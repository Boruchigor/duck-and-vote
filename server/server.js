// server/server.js
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
    origin: "http://localhost:3000", // Adjust for production deployment
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(err));

// In-memory session store (to replace sessions logic)
const sessions = {};

// Socket.IO logic (based on your existing code)
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("join", ({ sessionId, nickname }) => {
    console.log(
      `Client ${socket.id} joined session ${sessionId} as ${nickname}`
    );
    if (!sessions[sessionId]) {
      sessions[sessionId] = {};
    }
    sessions[sessionId][socket.id] = { nickname, status: "Joined" };
    socket.join(sessionId);

    io.to(sessionId).emit("memberUpdate", sessions[sessionId]);
  });

  socket.on("vote", (data) => {
    console.log(`Client ${data.memberId} voted in session ${data.sessionId}`);
    if (sessions[data.sessionId] && sessions[data.sessionId][data.memberId]) {
      sessions[data.sessionId][data.memberId] = {
        nickname: data.nickname,
        status: "Done",
        vote: data.vote,
      };
      io.to(data.sessionId).emit("voteUpdate", sessions[data.sessionId]);
    }
  });

  socket.on("finishVoting", (sessionId) => {
    console.log(`Finishing voting for session ${sessionId}`);
    const members = sessions[sessionId];
    const votes = Object.values(members)
      .map((member) => member.vote)
      .filter((vote) => vote != null);
    const total = votes.reduce((acc, curr) => acc + curr, 0);
    const averageVote = votes.length > 0 ? total / votes.length : 0;
    io.to(sessionId).emit("navigateToResults", { sessionId, averageVote });
  });

  socket.on("resetVotes", ({ sessionId }) => {
    console.log(`Reset votes for session ${sessionId}`);
    if (sessions[sessionId]) {
      Object.keys(sessions[sessionId]).forEach((memberId) => {
        sessions[sessionId][memberId].status = "Joined";
        delete sessions[sessionId][memberId].vote;
      });
      console.log(`Emitting resetVotes for session ${sessionId}`);
      io.to(sessionId).emit("resetVotes", {
        sessionId,
        members: sessions[sessionId],
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    for (const sessionId in sessions) {
      if (sessions[sessionId][socket.id]) {
        delete sessions[sessionId][socket.id];
        io.to(sessionId).emit("memberUpdate", sessions[sessionId]);
      }
    }
  });
});

// API Routes
const voteRoutes = require('./api/voteRoutes');
const resetRoutes = require('./api/resetRoutes');
const resultsRoutes = require('./api/resultsRoutes');
app.use('/api', voteRoutes);
app.use('/api', resetRoutes);
app.use('/api', resultsRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
