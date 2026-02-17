const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOriginHandler = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS blocked for origin: ${origin}`));
};

const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors({
  origin: corsOriginHandler,
  methods: ["GET", "POST"],
  credentials: true,
}));

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(err));

// In-memory session store (to replace sessions logic)
const sessions = {};

const ensureSessionShape = (session) => {
  if (!session) {
    return session;
  }
  if (!Array.isArray(session.tasks)) {
    session.tasks = [];
  }
  if (!Array.isArray(session.importTasks)) {
    session.importTasks = [];
  }
  if (!session.members || typeof session.members !== "object") {
    session.members = {};
  }
  return session;
};

const getSession = (sessionId) => ensureSessionShape(sessions[sessionId]);

const createSessionIfMissing = (sessionId) => {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      members: {},
      adminSocketId: null,
      creatorKey: null,
      tasks: [],
      importTasks: [],
      activeTaskId: null,
    };
  }
  return ensureSessionShape(sessions[sessionId]);
};

const getActiveTask = (session) =>
  session.tasks.find((task) => task.id === session.activeTaskId) || null;

const getTaskVotesAverage = (task) => {
  const votes = Object.values(task.votesByMember || {}).filter((vote) => vote != null);
  const total = votes.reduce((acc, curr) => acc + curr, 0);
  return votes.length > 0 ? total / votes.length : 0;
};

const allMembersVoted = (session) =>
  Object.keys(session.members).length > 0 &&
  Object.keys(session.members).every((memberId) => {
    const activeTask = getActiveTask(session);
    if (!activeTask) {
      return false;
    }
    return activeTask.votesByMember?.[memberId] != null;
  });

const hydrateTask = (task, index = 0) => ({
  id: task.id || `task-${Date.now()}-${index}`,
  title: (task.title || "").trim(),
  identifier: task.identifier || null,
  linearIssueId: task.linearIssueId || null,
  status: task.status || "pending",
  averageVote: typeof task.averageVote === "number" ? task.averageVote : null,
  voteCount: typeof task.voteCount === "number" ? task.voteCount : 0,
  roundsCompleted: typeof task.roundsCompleted === "number" ? task.roundsCompleted : 0,
  votesByMember: task.votesByMember || {},
});

const syncMembersWithActiveTask = (session) => {
  const activeTask = getActiveTask(session);
  const votesByMember = activeTask?.votesByMember || {};
  const isFinished = activeTask?.status === "voted";

  Object.keys(session.members).forEach((memberId) => {
    const vote = votesByMember[memberId];
    session.members[memberId].status = vote == null ? "Joined" : "Done";
    if (vote == null || !isFinished) {
      delete session.members[memberId].vote;
    } else {
      session.members[memberId].vote = vote;
    }
  });
};

const syncTaskToLinear = async ({ task, averageVote, voteCount, roundsCompleted }) => {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey || !task?.linearIssueId) {
    return;
  }

  const estimatedPoints = Math.max(1, Math.min(10, Math.round(averageVote)));
  const estimateMutation = `
    mutation UpdateIssueEstimate($id: String!, $estimate: Float) {
      issueUpdate(id: $id, input: { estimate: $estimate }) {
        success
      }
    }
  `;

  const commentMutation = `
    mutation AddIssueComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
      }
    }
  `;

  const headers = {
    Authorization: apiKey,
    "Content-Type": "application/json",
  };

  await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: estimateMutation,
      variables: {
        id: task.linearIssueId,
        estimate: estimatedPoints,
      },
    }),
  });

  await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: commentMutation,
      variables: {
        issueId: task.linearIssueId,
        body:
          roundsCompleted > 1
            ? `Backlog revoted difficulty 1-10 (round ${roundsCompleted}). Average: ${averageVote.toFixed(
                2
              )} (${voteCount} vote${voteCount === 1 ? "" : "s"}).`
            : `Backlog voted difficulty 1-10. Average: ${averageVote.toFixed(
                2
              )} (${voteCount} vote${voteCount === 1 ? "" : "s"}).`,
      },
    }),
  });
};

const finalizeActiveTask = async (session, sessionId) => {
  const activeTask = getActiveTask(session);
  if (!activeTask) {
    return 0;
  }

  if (activeTask.status === "voted" && activeTask.averageVote != null) {
    io.to(sessionId).emit("navigateToResults", {
      sessionId,
      averageVote: activeTask.averageVote,
    });
    return activeTask.averageVote;
  }

  const averageVote = getTaskVotesAverage(activeTask);
  const voteCount = Object.values(activeTask.votesByMember || {}).filter(
    (vote) => vote != null
  ).length;
  activeTask.status = "voted";
  activeTask.averageVote = averageVote;
  activeTask.voteCount = voteCount;
  activeTask.roundsCompleted = (activeTask.roundsCompleted || 0) + 1;
  syncMembersWithActiveTask(session);
  emitSessionState(sessionId);

  io.to(sessionId).emit("navigateToResults", { sessionId, averageVote });

  try {
    await syncTaskToLinear({
      task: activeTask,
      averageVote,
      voteCount,
      roundsCompleted: activeTask.roundsCompleted,
    });
  } catch (error) {
    console.error("Failed to sync task to Linear:", error?.message || error);
  }

  return averageVote;
};

const emitSessionState = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    return;
  }

  syncMembersWithActiveTask(session);

  io.to(sessionId).emit("sessionState", {
    members: session.members,
    adminSocketId: session.adminSocketId,
    tasks: session.tasks,
    importTasks: session.importTasks,
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
    const activeTask = session ? getActiveTask(session) : null;
    if (session && session.members[data.memberId] && activeTask) {
      if (activeTask.status === "voted") {
        socket.emit("sessionError", {
          code: "VOTING_FINISHED",
          message: "Voting is finished. Admin must start re-vote first.",
        });
        return;
      }
      activeTask.votesByMember[data.memberId] = data.vote;
      activeTask.status = "pending";
      activeTask.averageVote = null;
      activeTask.voteCount = 0;
      emitSessionState(data.sessionId);
    }
  });

  socket.on("finishVoting", async ({ sessionId }) => {
    console.log(`Finishing voting for session ${sessionId}`);
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "finishVoting")) {
      return;
    }

    await finalizeActiveTask(session, sessionId);
    emitSessionState(sessionId);
  });

  socket.on("resetVotes", ({ sessionId }) => {
    console.log(`Reset votes for session ${sessionId}`);
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "resetVotes")) {
      return;
    }

    if (session) {
      const activeTask = getActiveTask(session);
      if (!activeTask) {
        return;
      }
      activeTask.votesByMember = {};
      activeTask.status = "pending";
      activeTask.averageVote = null;
      activeTask.voteCount = 0;
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

    const task = hydrateTask({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trimmed,
    });

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

    const previousByLinearId = new Map(
      session.importTasks
        .filter((task) => task.linearIssueId)
        .map((task) => [task.linearIssueId, task])
    );

    session.importTasks = tasks
      .filter((task) => task && typeof task.title === "string")
      .map((task, index) => {
        const existing = task.linearIssueId
          ? previousByLinearId.get(task.linearIssueId)
          : null;
        return hydrateTask(
          existing
            ? { ...existing, ...task }
            : {
                ...task,
                id: task.id || `import-${Date.now()}-${index}`,
                status: "imported",
                votesByMember: {},
              },
          index
        );
      })
      .filter((task) => task.title);

    emitSessionState(sessionId);
  });

  socket.on("addImportedTask", ({ sessionId, importedTaskId }) => {
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "addImportedTask")) {
      return;
    }
    const importedTask = session.importTasks.find(
      (task) => task.id === importedTaskId
    );
    if (!importedTask) {
      return;
    }

    const existingTask = session.tasks.find(
      (task) =>
        importedTask.linearIssueId &&
        task.linearIssueId === importedTask.linearIssueId
    );

    if (existingTask) {
      session.activeTaskId = existingTask.id;
    } else {
      const votingTask = hydrateTask({
        id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: importedTask.title,
        linearIssueId: importedTask.linearIssueId,
        identifier: importedTask.identifier,
        status: "pending",
        votesByMember: {},
        averageVote: null,
        voteCount: 0,
      });
      session.tasks.push(votingTask);
      if (!session.activeTaskId) {
        session.activeTaskId = votingTask.id;
      }
    }

    session.importTasks = session.importTasks.filter(
      (task) => task.id !== importedTaskId
    );
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

  socket.on("nextTask", ({ sessionId }) => {
    const session = getSession(sessionId);
    if (!ensureAdmin(session, socket, "nextTask")) {
      return;
    }
    const activeIndex = session.tasks.findIndex(
      (task) => task.id === session.activeTaskId
    );
    if (activeIndex < 0) {
      const firstPending = session.tasks.find((task) => task.status !== "voted");
      if (firstPending) {
        session.activeTaskId = firstPending.id;
        emitSessionState(sessionId);
      }
      return;
    }
    const nextPending = session.tasks.find(
      (task, index) => index > activeIndex && task.status !== "voted"
    );
    const fallbackNext = session.tasks[activeIndex + 1];
    const nextTask = nextPending || fallbackNext || null;
    if (nextTask) {
      session.activeTaskId = nextTask.id;
      emitSessionState(sessionId);
    }
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
