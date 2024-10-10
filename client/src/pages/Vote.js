import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import useSocket from "../hooks/useSocket";
import { UserGroupIcon } from "@heroicons/react/solid";

export default function Vote() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const nickname = searchParams.get("nickname");
  const [myVote, setMyVote] = useState(null);
  const [members, setMembers] = useState({});
  const [votingFinished, setVotingFinished] = useState(false);
  const [averageVote, setAverageVote] = useState(null);
  const socket = useSocket();

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

  // Calculate voting progress percentage
  const votingProgress = totalMembers > 0 ? (membersVoted / totalMembers) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-600 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-3xl bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg p-8 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-8 text-center flex items-center justify-center">
          <UserGroupIcon className="w-8 h-8 mr-2" />
          Voting Session: {sessionId}
        </h1>

        <div className="mb-8">
          <label className="block text-white mb-4 text-xl font-medium text-center">
            Your Vote:
          </label>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => (
              <button
                key={number}
                onClick={() => submitVote(number)}
                disabled={myVote !== null}
                className={`w-full py-4 rounded-full text-white font-semibold focus:outline-none transition-all duration-200 transform ${
                  myVote === number
                    ? "bg-gradient-to-br from-green-400 to-blue-500 shadow-lg scale-105"
                    : "bg-white bg-opacity-20 hover:bg-opacity-30"
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

          <p className="text-white text-center mb-4">
            {membersVoted} out of {totalMembers} members have voted.
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-white bg-opacity-20 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${votingProgress}%` }}
            ></div>
          </div>
        </div>

        {averageVote !== null && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4 text-center">
              Average Vote: {averageVote.toFixed(2)}
            </h2>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4 text-center">
            Members
          </h2>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {Object.keys(members).map((memberId) => (
              <li
                key={memberId}
                className="bg-white bg-opacity-20 p-4 rounded-md text-white flex items-center justify-between"
              >
                <span className="font-semibold">
                  {members[memberId].nickname || "Unknown"}
                </span>
                <span>
                  {members[memberId].status}
                  {votingFinished &&
                    members[memberId].vote != null &&
                    ` (Voted: ${members[memberId].vote})`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center space-x-4">
          <button
            onClick={finishVoting}
            className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white py-3 px-6 rounded-full font-semibold shadow-lg transform transition-transform duration-300 hover:scale-105 focus:outline-none"
          >
            Finish Voting
          </button>
          <button
            onClick={resetVotes}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white py-3 px-6 rounded-full font-semibold shadow-lg transform transition-transform duration-300 hover:scale-105 focus:outline-none"
          >
            Reset Votes
          </button>
        </div>
      </div>
    </div>
  );
}
