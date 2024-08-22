import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(null);

  const createVotingSession = () => {
    const newSessionId = Math.random().toString(36).substr(2, 9);
    setSessionId(newSessionId);
    navigate(`/vote/${newSessionId}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Welcome to the Voting App</h1>
        <button
          onClick={createVotingSession}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition duration-200"
        >
          Create Voting Session
        </button>
      </div>
    </div>
  );
}
