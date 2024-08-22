import { useEffect, useState } from "react";
import io from "socket.io-client";

const useSocket = (sessionId) => {
  const [socket, setSocket] = useState(null); // State to manage socket instance
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketUrl =
      process.env.NODE_ENV === "production"
        ? "wss://duck-and-vote-z37v.vercel.app"
        : "http://localhost:5000";

    const newSocket = io(socketUrl, { transports: ['websocket'] }); // Force WebSocket transport
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected");
      setConnected(true);
      if (sessionId) {
        newSocket.emit("join", { sessionId });
      }
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [sessionId]);

  return socket;
};

export default useSocket;
