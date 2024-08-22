// server/api/voteRoutes.js
const express = require('express');
const clientPromise = require('../lib/mongodb');
const router = express.Router();

router.post('/vote', async (req, res) => {
  const { sessionId, memberId, nickname, vote } = req.body;

  if (!sessionId || vote == null || !nickname) {
    return res.status(400).json({ message: "Invalid input" });
  }

  const client = await clientPromise;
  const db = client.db("voting-app");

  try {
    const result = await db
      .collection("votes")
      .updateOne(
        { sessionId },
        { $set: { [`members.${memberId}`]: { nickname, vote } } },
        { upsert: true }
      );
    console.log("Vote submitted: ", result);
    res.status(200).json({ message: "Vote submitted" });
  } catch (error) {
    console.error("Error submitting vote: ", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
