import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import useSocket from "../hooks/useSocket";
import { UserGroupIcon } from "@heroicons/react/solid";

export default function Vote() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const nickname = searchParams.get("nickname");
  const creatorKey = searchParams.get("creatorKey");
  const [myVote, setMyVote] = useState(null);
  const [members, setMembers] = useState({});
  const [adminSocketId, setAdminSocketId] = useState(null);
  const [votingFinished, setVotingFinished] = useState(false);
  const [averageVote, setAverageVote] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [linearSearch, setLinearSearch] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const socket = useSocket();
  const apiBase =
    process.env.NODE_ENV === "production"
      ? "https://duck-and-vote.onrender.com"
      : "http://localhost:5000";

  // Ref to prevent multiple joins
  const hasJoinedRef = useRef(false);

  // Emit join event only once
  useEffect(() => {
    if (socket && nickname && sessionId && !hasJoinedRef.current) {
      console.log("Emitting join event with nickname:", nickname);
      socket.emit("join", { sessionId, nickname, creatorKey });
      hasJoinedRef.current = true;
    }
  }, [socket, nickname, sessionId, creatorKey]);

  // Set up socket event handlers
  useEffect(() => {
    if (socket) {
      const handleSessionState = (sessionState) => {
        setMembers(sessionState.members || {});
        setAdminSocketId(sessionState.adminSocketId || null);
        setTasks(sessionState.tasks || []);
        setActiveTaskId(sessionState.activeTaskId || null);
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

      const handleSessionError = ({ message }) => {
        setErrorMessage(message || "Action not allowed.");
      };

      socket.on("sessionState", handleSessionState);
      socket.on("navigateToResults", handleNavigateToResults);
      socket.on("resetVotes", handleResetVotes);
      socket.on("sessionError", handleSessionError);

      // Clean up on unmount
      return () => {
        socket.off("sessionState", handleSessionState);
        socket.off("navigateToResults", handleNavigateToResults);
        socket.off("resetVotes", handleResetVotes);
        socket.off("sessionError", handleSessionError);
      };
    }
  }, [socket]);

  const submitVote = async (vote) => {
    if (vote != null) {
      try {
        await fetch(`${apiBase}/api/vote`, {
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
    if (socket) {
      setErrorMessage("");
      socket.emit("finishVoting", { sessionId });
    }
  };

  const resetVotes = () => {
    if (socket) {
      setErrorMessage("");
      socket.emit("resetVotes", { sessionId });
    }
  };

  const addTask = () => {
    if (socket && taskInput.trim()) {
      setErrorMessage("");
      socket.emit("addTask", { sessionId, title: taskInput.trim() });
      setTaskInput("");
    }
  };

  const selectTask = (taskId) => {
    if (socket) {
      setErrorMessage("");
      socket.emit("selectTask", { sessionId, taskId });
    }
  };

  const importFromLinear = async () => {
    setIsImporting(true);
    setErrorMessage("");
    try {
      const query = new URLSearchParams({
        search: linearSearch,
        limit: "20",
      });
      const response = await fetch(`${apiBase}/api/linear/issues?${query.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || "Linear import failed.");
        return;
      }

      socket.emit("replaceTasks", {
        sessionId,
        tasks: data.tasks || [],
      });
    } catch (error) {
      setErrorMessage("Linear import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const isAdmin = Boolean(socket?.id && adminSocketId === socket.id);
  const totalMembers = Object.keys(members).length;
  const membersVoted = Object.values(members).filter(
    (member) => member.status === "Done"
  ).length;

  // Calculate voting progress percentage
  const votingProgress = totalMembers > 0 ? (membersVoted / totalMembers) * 100 : 0;

  if (!nickname) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        Missing nickname. Re-open the invite link and join with your nickname.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_25px_70px_rgba(2,6,23,.7)] backdrop-blur-xl sm:p-8">
          <h1 className="mb-2 flex items-center justify-center text-center text-3xl font-extrabold">
            <UserGroupIcon className="mr-2 h-8 w-8" />
            Session {sessionId}
          </h1>
          <p className="mb-6 text-center text-sm text-slate-300">
            {isAdmin ? "You are admin." : "Waiting for admin actions."}
          </p>

          <div className="mb-8 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-4">
            <p className="text-xs uppercase tracking-wider text-cyan-200">Current Task</p>
            <p className="mt-1 text-lg font-semibold text-cyan-100">
              {activeTask ? activeTask.title : "No task selected"}
            </p>
          </div>

          <div className="mb-8">
            <label className="mb-4 block text-center text-xl font-medium">Your Vote</label>
            <div className="mb-6 grid grid-cols-5 gap-3 sm:grid-cols-10">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => (
                <button
                  key={number}
                  onClick={() => submitVote(number)}
                  disabled={myVote !== null}
                  className={`rounded-2xl py-4 font-semibold transition ${
                    myVote === number
                      ? "scale-105 bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-lg"
                      : "bg-slate-800/85 text-slate-100 hover:bg-slate-700"
                  } ${myVote !== null && myVote !== number ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  {number}
                </button>
              ))}
            </div>

            <p className="mb-3 text-center text-slate-100">
              {membersVoted} / {totalMembers} voted
            </p>
            <div className="h-3 w-full rounded-full bg-slate-700">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-all duration-500"
                style={{ width: `${votingProgress}%` }}
              />
            </div>
          </div>

          {averageVote !== null && (
            <div className="mb-6 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-center">
              <h2 className="text-2xl font-semibold">
                Average Vote: {averageVote.toFixed(2)}
              </h2>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-300/40 bg-red-500/15 p-3 text-sm text-red-100">
              {errorMessage}
            </div>
          )}

          {isAdmin && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={finishVoting}
                className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 font-semibold text-white hover:brightness-110"
              >
                Finish Early
              </button>
              <button
                onClick={resetVotes}
                className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-6 py-3 font-semibold text-white hover:brightness-110"
              >
                Reset Votes
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_25px_70px_rgba(2,6,23,.7)] backdrop-blur-xl">
            <h2 className="mb-4 text-2xl font-semibold">Tasks</h2>
            {isAdmin && (
              <>
                <div className="mb-3 flex gap-2">
                  <input
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    placeholder="Add task manually"
                    className="w-full rounded-xl border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    onClick={addTask}
                    className="rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-white hover:bg-cyan-400"
                  >
                    Add
                  </button>
                </div>
                <div className="mb-4 flex gap-2">
                  <input
                    value={linearSearch}
                    onChange={(e) => setLinearSearch(e.target.value)}
                    placeholder="Import from Linear (search query)"
                    className="w-full rounded-xl border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    onClick={importFromLinear}
                    disabled={isImporting}
                    className="rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
                  >
                    {isImporting ? "..." : "Import"}
                  </button>
                </div>
              </>
            )}

            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <li key={task.id}>
                  <button
                    onClick={() => isAdmin && selectTask(task.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      activeTaskId === task.id
                        ? "border-cyan-300 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 bg-slate-900/50 text-slate-100"
                    } ${isAdmin ? "hover:border-cyan-300/70" : "cursor-default"}`}
                  >
                    {task.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_25px_70px_rgba(2,6,23,.7)] backdrop-blur-xl">
            <h2 className="mb-4 text-2xl font-semibold">Members</h2>
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {Object.keys(members).map((memberId) => (
                <li
                  key={memberId}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/45 p-3"
                >
                  <span className="font-semibold">
                    {members[memberId].nickname || "Unknown"}
                    {memberId === adminSocketId ? " (admin)" : ""}
                  </span>
                  <span className="text-sm text-slate-200">
                    {members[memberId].status}
                    {votingFinished &&
                      members[memberId].vote != null &&
                      ` (${members[memberId].vote})`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
