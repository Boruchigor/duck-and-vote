// server/api/resultsRoutes.js
const express = require('express');
const clientPromise = require('../lib/mongodb');
const router = express.Router();

router.get('/results', async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ message: "Invalid session ID" });
  }

  const client = await clientPromise;
  const db = client.db("voting-app");

  try {
    const session = await db.collection("votes").findOne({ sessionId });
    if (session) {
      const votes = Object.values(session.members).map((member) => member.vote);
      const average = votes.reduce((a, b) => a + b, 0) / votes.length;
      res.status(200).json({ average, members: session.members });
    } else {
      res.status(404).json({ message: "Session not found" });
    }
  } catch (error) {
    console.error("Error fetching results: ", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
