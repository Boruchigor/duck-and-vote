import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/outline";
import { UserIcon } from "@heroicons/react/solid";

export default function JoinSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [copied, setCopied] = useState(false);

  const joinSession = () => {
    if (nickname) {
      navigate(`/vote/${sessionId}/vote?nickname=${encodeURIComponent(nickname)}`);
    }
  };

  const shareableLink = `${window.location.origin}/vote/${sessionId}`;

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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-purple-600 px-4">
      <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg w-full max-w-md p-8 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-6 text-center flex items-center justify-center">
          <UserIcon className="w-8 h-8 mr-2" />
          Join Voting Session
        </h1>

        <div className="mb-6">
          <label className="block text-white mb-2 font-medium">
            Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            className="w-full px-4 py-3 bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-75 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <button
          onClick={joinSession}
          disabled={!nickname}
          className={`w-full py-3 px-6 text-white font-semibold rounded-full transition-all duration-200 transform ${
            nickname
              ? "bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 hover:scale-105 shadow-lg"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          Join Session
        </button>

        {sessionId && (
          <div className="mt-8">
            <h2 className="text-white font-medium mb-2 flex items-center">
              <ClipboardIcon className="w-6 h-6 mr-2" />
              Share this link to invite others:
            </h2>
            <div className="flex items-center bg-white bg-opacity-20 p-3 rounded-md">
              <span className="text-white truncate">{shareableLink}</span>
              <button
                onClick={copyToClipboard}
                className="ml-2 p-2 text-white hover:text-green-400 transition-colors duration-200"
              >
                {copied ? (
                  <CheckIcon className="w-6 h-6 text-green-400" />
                ) : (
                  <ClipboardIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
