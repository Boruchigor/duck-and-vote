import { useEffect, useState } from "react";
import io from "socket.io-client";

const useSocket = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const socketUrl =
      process.env.NODE_ENV === "production"
        ? "https://duck-and-vote.onrender.com"
        : "http://localhost:5000";

    const newSocket = io(socketUrl, { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected");
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return socket;
};

export default useSocket;
