import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/outline";

export default function JoinSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [copied, setCopied] = useState(false);

  const joinSession = () => {
    if (nickname) {
      navigate(`/vote/${sessionId}/vote?nickname=${nickname}`);
    }
  };

  const shareableLink = `http://localhost:3000/vote/${sessionId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset copied state after 2 seconds
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
          Join Voting Session
        </h1>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2 font-medium">
            Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={joinSession}
          disabled={!nickname}
          className={`w-full py-2 px-4 text-white font-semibold rounded-md transition-colors duration-200 ${
            nickname
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-blue-300 cursor-not-allowed"
          }`}
        >
          Join Session
        </button>

        {sessionId && (
          <div className="mt-8">
            <h2 className="text-gray-700 font-medium mb-2">
              Share this link to invite others:
            </h2>
            <div className="flex items-center bg-gray-100 p-2 rounded-md">
              <span className="text-gray-600 truncate">{shareableLink}</span>
              <button
                onClick={copyToClipboard}
                className="ml-2 p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                {copied ? (
                  <CheckIcon className="w-5 h-5 text-green-500" />
                ) : (
                  <ClipboardIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
