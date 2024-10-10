import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const createVotingSession = () => {
    const newSessionId = Math.random().toString(36).substr(2, 9);
    navigate(`/vote/${newSessionId}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-purple-600">
      <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg p-8 rounded-xl shadow-2xl max-w-md mx-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-8 text-center">
          Welcome to Duck and Vote
        </h1>
        <button
          onClick={createVotingSession}
          className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white px-10 py-4 rounded-full text-xl font-semibold shadow-lg transform transition-transform duration-300 hover:scale-105 focus:outline-none"
        >
          Create Voting Session
        </button>
      </div>
    </div>
  );
}
