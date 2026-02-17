import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const createVotingSession = () => {
    const newSessionId = Math.random().toString(36).slice(2, 11);
    const creatorKey = Math.random().toString(36).slice(2, 14);
    navigate(`/vote/${newSessionId}?creatorKey=${creatorKey}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.28),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,.22),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(168,85,247,.18),transparent_38%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="w-full rounded-3xl border border-white/15 bg-white/5 p-8 shadow-[0_30px_80px_rgba(2,6,23,.65)] backdrop-blur-xl sm:p-12">
          <p className="mb-3 inline-flex rounded-full border border-sky-300/40 bg-sky-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sky-200">
            Planning Poker
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
            Duck and Vote
          </h1>
          <p className="mt-4 max-w-xl text-slate-200">
            Create a room, invite teammates with a nickname, and estimate tasks together.
          </p>
          <button
            onClick={createVotingSession}
            className="mt-8 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:translate-y-[-1px] hover:shadow-cyan-500/30 focus:outline-none"
          >
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
}
