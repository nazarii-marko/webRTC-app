import React, { useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { WebRTCUser } from "./@types";
import Login from "./components/Login";
import Room from "./components/Room";
export const SOCKET_SERVER_URL = "https://192.168.68.107:1234";

export const socket = io(SOCKET_SERVER_URL);
function App() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [users, setUsers] = useState<WebRTCUser[]>([]);
  const socketRef = useRef<Socket>();
  const setUser = ({ name, room }: { name: string; room: string }) => {
    setName(name);
    setRoom(room);
    setLoggedIn(true);
  };
  return (
    <div className="App">
      {loggedIn ? (
        <Room
          users={users}
          setUsers={setUsers}
          name={name}
          room={room}
          socketRef={socketRef}
        />
      ) : (
        <Login setUser={setUser} />
      )}
    </div>
  );
}

export default App;
