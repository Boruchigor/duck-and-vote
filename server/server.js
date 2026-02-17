const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? "https://duck-and-vote.vercel.app" // Use your Vercel frontend URL here
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? "https://duck-and-vote.vercel.app" // Use your Vercel frontend URL here
    : "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true,
}));

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(err));

// In-memory session store (to replace sessions logic)
const sessions = {};

const getSession = (sessionId) => sessions[sessionId];

const createSessionIfMissing = (sessionId) => {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      members: {},
      adminSocketId: null,
      creatorKey: null,
      tasks: [],
      activeTaskId: null,
    };
  }
  return sessions[sessionId];
};

const getVotesAverage = (session) => {
  const votes = Object.values(session.members)
    .map((member) => member.vote)
    .filter((vote) => vote != null);
  const total = votes.reduce((acc, curr) => acc + curr, 0);
  return votes.length > 0 ? total / votes.length : 0;
};

const allMembersVoted = (session) =>
  Object.values(session.members).length > 0 &&
  Object.values(session.members).every((member) => member.status === "Done");

const emitSessionState = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    return;
  }

  io.to(sessionId).emit("sessionState", {
    members: session.members,
    adminSocketId: session.adminSocketId,
    tasks: session.tasks,
    activeTaskId: session.activeTaskId,
  });
};

const ensureAdmin = (session, socket, eventName) => {
  if (!session || session.adminSocketId !== socket.id) {
    console.log(`Blocked non-admin action "${eventName}" from ${socket.id}`);
    socket.emit("sessionError", {
      code: "NOT_ADMIN",
      message: "Only admin can perform this action.",
    });
    return false;
  }
  return true;
};

// Socket.IO logic (based on your existing code)
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("join", ({ sessionId, nickname, creatorKey }) => {
    console.log(
      `Client ${socket.id} joined session ${sessionId} as ${nickname}`
    );
    const session = createSessionIfMissing(sessionId);

    if (!session.creatorKey && creatorKey) {
      session.creatorKey = creatorKey;
    }

    if (!session.adminSocketId) {
      session.adminSocketId = socket.id;
    } else if (session.creatorKey && creatorKey && session.creatorKey === creatorKey) {
      session.adminSocketId = socket.id;
    }

    session.members[socket.id] = { nickname, status: "Joined" };
    socket.join(sessionId);

    emitSessionState(sessionId);
  });

  socket.on("vote", (data) => {
    console.log(`Client ${data.memberId} voted in session ${data.sessionId}`);
    const session = getSession(data.sessionId);
    if (session && session.members[data.memberId]) {
      session.members[data.memberId] = {
        nickname: data.nickname,
        status: "Done",
        vote: data.vote,
      };
      emitSessionState(data.sessionId);

      // Check if all members have voted
      if (allMembersVoted(session)) {
        const averageVote = getVotesAverage(session);

        // Emit 'navigateToResults' to all clients in the session
        io.to(data.sessionId).emit("navigateToResults", {
          sessionId: data.sessionId,
          averageVote,
        });
      }
    }
  });

  socket.on("finishVoting", ({ sessionId }) => {
    console.log(`Finishing voting for session ${sessionId}`);
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "finishVoting")) {
      return;
    }

    const averageVote = getVotesAverage(session);
    io.to(sessionId).emit("navigateToResults", { sessionId, averageVote });
  });

  socket.on("resetVotes", ({ sessionId }) => {
    console.log(`Reset votes for session ${sessionId}`);
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "resetVotes")) {
      return;
    }

    if (session) {
      Object.keys(session.members).forEach((memberId) => {
        session.members[memberId].status = "Joined";
        delete session.members[memberId].vote;
      });
      console.log(`Emitting resetVotes for session ${sessionId}`);
      io.to(sessionId).emit("resetVotes", {
        sessionId,
        members: session.members,
      });
      emitSessionState(sessionId);
    }
  });

  socket.on("addTask", ({ sessionId, title }) => {
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "addTask")) {
      return;
    }
    const trimmed = (title || "").trim();
    if (!trimmed) {
      return;
    }

    const task = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trimmed,
    };

    session.tasks.unshift(task);
    if (!session.activeTaskId) {
      session.activeTaskId = task.id;
    }
    emitSessionState(sessionId);
  });

  socket.on("replaceTasks", ({ sessionId, tasks }) => {
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "replaceTasks")) {
      return;
    }
    if (!Array.isArray(tasks)) {
      return;
    }

    session.tasks = tasks
      .filter((task) => task && typeof task.title === "string")
      .map((task, index) => ({
        id: task.id || `import-${Date.now()}-${index}`,
        title: task.title.trim(),
      }))
      .filter((task) => task.title);

    session.activeTaskId = session.tasks[0]?.id || null;
    emitSessionState(sessionId);
  });

  socket.on("selectTask", ({ sessionId, taskId }) => {
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "selectTask")) {
      return;
    }

    const hasTask = session.tasks.some((task) => task.id === taskId);
    if (!hasTask) {
      return;
    }
    session.activeTaskId = taskId;
    emitSessionState(sessionId);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    for (const sessionId in sessions) {
      const session = sessions[sessionId];
      if (session.members[socket.id]) {
        delete session.members[socket.id];

        if (session.adminSocketId === socket.id) {
          session.adminSocketId = Object.keys(session.members)[0] || null;
        }
        emitSessionState(sessionId);

        // Check if all remaining members have voted
        if (allMembersVoted(session)) {
          const averageVote = getVotesAverage(session);

          // Emit 'navigateToResults' to all clients in the session
          io.to(sessionId).emit("navigateToResults", {
            sessionId,
            averageVote,
          });
        }

        if (Object.keys(session.members).length === 0) {
          delete sessions[sessionId];
        }
      }
    }
  });
});

// API Routes
const voteRoutes = require('./api/voteRoutes');
const resetRoutes = require('./api/resetRoutes');
const resultsRoutes = require('./api/resultsRoutes');
const linearRoutes = require('./api/linearRoutes');
app.use('/api', voteRoutes);
app.use('/api', resetRoutes);
app.use('/api', resultsRoutes);
app.use('/api', linearRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
