import { useEffect, useState } from "react";
import io from "socket.io-client";

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketUrl =
      process.env.NODE_ENV === "production"
        ? "https://duck-and-vote.onrender.com"
        : "http://localhost:5000";

    const newSocket = io(socketUrl, { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected");
      setConnected(true);
      // **Removed the 'join' event emission here**
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // **Removed 'sessionId' from dependencies to prevent socket recreation**

  return socket;
};

export default useSocket;
