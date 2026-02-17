import React, { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/outline";
import { UserIcon } from "@heroicons/react/solid";

export default function JoinSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const creatorKey = searchParams.get("creatorKey");
  const [nickname, setNickname] = useState("");
  const [copied, setCopied] = useState(false);

  const joinSession = () => {
    if (nickname) {
      const query = new URLSearchParams({
        nickname,
      });
      if (creatorKey) {
        query.set("creatorKey", creatorKey);
      }
      navigate(`/vote/${sessionId}/vote?${query.toString()}`);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,.2),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,.18),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(249,115,22,.12),transparent_30%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-8 shadow-[0_30px_80px_rgba(2,6,23,.65)] backdrop-blur-lg">
        <h1 className="mb-6 flex items-center justify-center text-3xl font-bold text-white">
          <UserIcon className="mr-2 h-8 w-8" />
          Join Voting Session
        </h1>

        <div className="mb-6">
          <label className="mb-2 block font-medium text-slate-100">Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            className="w-full rounded-xl border border-white/20 bg-slate-900/55 px-4 py-3 text-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        <button
          onClick={joinSession}
          disabled={!nickname}
          className={`w-full rounded-2xl py-3 px-6 font-semibold text-white transition ${
            nickname
              ? "bg-gradient-to-r from-cyan-500 to-sky-500 shadow-lg hover:translate-y-[-1px]"
              : "cursor-not-allowed bg-slate-400"
          }`}
        >
          Join Session
        </button>

        {sessionId && (
          <div className="mt-8">
            <h2 className="mb-2 flex items-center font-medium text-slate-100">
              <ClipboardIcon className="mr-2 h-6 w-6" />
              Share this link to invite others:
            </h2>
            <div className="flex items-center rounded-xl border border-white/20 bg-slate-900/50 p-3">
              <span className="text-white truncate">{shareableLink}</span>
              <button
                onClick={copyToClipboard}
                className="ml-2 p-2 text-white transition-colors duration-200 hover:text-cyan-300"
              >
                {copied ? (
                  <CheckIcon className="h-6 w-6 text-green-400" />
                ) : (
                  <ClipboardIcon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
