import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import useSocket from "../hooks/useSocket";

export default function Vote() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const nickname = searchParams.get("nickname");
  const [myVote, setMyVote] = useState(null);
  const [members, setMembers] = useState({});
  const [votingFinished, setVotingFinished] = useState(false);
  const [averageVote, setAverageVote] = useState(null);
  const socket = useSocket(); // Updated to remove sessionId

  // Ref to prevent multiple joins
  const hasJoinedRef = useRef(false);

  // Emit join event only once
  useEffect(() => {
    if (socket && nickname && sessionId && !hasJoinedRef.current) {
      console.log("Emitting join event with nickname:", nickname);
      socket.emit("join", { sessionId, nickname });
      hasJoinedRef.current = true;
    }
  }, [socket, nickname, sessionId]);

  // Set up socket event handlers
  useEffect(() => {
    if (socket) {
      const handleVoteUpdate = (updatedMembers) => {
        setMembers(updatedMembers);
      };

      const handleMemberUpdate = (updatedMembers) => {
        console.log("Received memberUpdate:", updatedMembers);
        setMembers(updatedMembers);
      };

      const handleNavigateToResults = ({ averageVote }) => {
        setAverageVote(averageVote);
        setVotingFinished(true);
      };

      const handleResetVotes = ({ members }) => {
        setMembers(members);
        setMyVote(null);
        setAverageVote(null);
        setVotingFinished(false);
      };

      socket.on("voteUpdate", handleVoteUpdate);
      socket.on("memberUpdate", handleMemberUpdate);
      socket.on("navigateToResults", handleNavigateToResults);
      socket.on("resetVotes", handleResetVotes);

      // Clean up on unmount
      return () => {
        socket.off("voteUpdate", handleVoteUpdate);
        socket.off("memberUpdate", handleMemberUpdate);
        socket.off("navigateToResults", handleNavigateToResults);
        socket.off("resetVotes", handleResetVotes);
      };
    }
  }, [socket]);

  const submitVote = async (vote) => {
    if (vote != null) {
      try {
        const apiUrl =
          process.env.NODE_ENV === "production"
            ? "https://duck-and-vote.onrender.com/api/vote"
            : "http://localhost:5000/api/vote";

        await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            memberId: socket.id,
            nickname,
            vote,
          }),
        });

        socket.emit("vote", {
          sessionId,
          memberId: socket.id,
          nickname,
          vote,
        });

        setMyVote(vote);
      } catch (error) {
        console.error("Error submitting vote: ", error);
      }
    }
  };

  const finishVoting = () => {
    socket.emit("finishVoting", sessionId);
  };

  const resetVotes = () => {
    if (socket) {
      socket.emit("resetVotes", { sessionId });
    }
  };

  const totalMembers = Object.keys(members).length;
const membersVoted = Object.values(members).filter(
  (member) => member.status === "Done"
).length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Voting Session: {sessionId}
        </h1>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2 font-medium">
            Your Vote:
          </label>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => (
              <button
                key={number}
                onClick={() => submitVote(number)}
                disabled={myVote !== null}
                className={`w-full py-3 px-4 rounded-full text-white font-semibold focus:outline-none transition-colors duration-200 ${
                  myVote === number
                    ? "bg-blue-600"
                    : "bg-blue-400 hover:bg-blue-500"
                } ${
                  myVote !== null && myVote !== number
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {number}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Members</h2>
          <ul className="space-y-2">
            {Object.keys(members).map((memberId) => (
              <li
                key={memberId}
                className="bg-gray-200 p-4 rounded-md text-gray-700"
              >
                <span className="font-semibold">
                  {members[memberId].nickname || "Unknown"}
                </span>
                {": "}
                {members[memberId].status}
                {votingFinished &&
                  members[memberId].vote != null &&
                  ` (Voted: ${members[memberId].vote})`}
              </li>
            ))}
          </ul>
        </div>

        <p>
  {membersVoted} out of {totalMembers} members have voted.
</p>

        {averageVote !== null && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Average Vote: {averageVote.toFixed(2)}
            </h2>
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={finishVoting}
            className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors duration-200"
          >
            Finish Voting
          </button>
          <button
            onClick={resetVotes}
            className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors duration-200"
          >
            Reset Votes
          </button>
        </div>
      </div>
    </div>
  );
}
