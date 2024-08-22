// server/api/resetRoutes.js
const express = require('express');
const clientPromise = require('../lib/mongodb');
const router = express.Router();

router.post('/reset', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ message: "Invalid session ID" });
  }

  const client = await clientPromise;
  const db = client.db("voting-app");

  try {
    const session = await db.collection("votes").findOne({ sessionId });
    if (session) {
      const members = session.members;
      for (const memberId in members) {
        members[memberId].vote = null;
        members[memberId].status = "Joined";
      }

      await db
        .collection("votes")
        .updateOne({ sessionId }, { $set: { members } });

      res.status(200).json({ message: "Votes reset" });
    } else {
      res.status(404).json({ message: "Session not found" });
    }
  } catch (error) {
    console.error("Error resetting votes: ", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
