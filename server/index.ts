import express from "express";
import http from "http";
import socketio from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new socketio.Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 8080;

const users: {
  [room: string]: { id: string; name: string }[];
} = {};

const roomSocket: { [socketId: string]: string } = {};

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ room, name }: { room: string; name: string }) => {
    users[room] = [
      ...(users[room] ? users[room] : []),
      { id: socket.id, name },
    ];
    roomSocket[socket.id] = room;
    socket.join(room);
    io.sockets.to(socket.id).emit(
      "users",
      users[room].filter((user) => user.id !== socket.id)
    );
  });

  socket.on("offer", ({ receiverId, ...data }) => {
    socket.to(receiverId).emit("myOffer", data);
  });

  socket.on("answer", ({ receiverId, ...data }) => {
    socket.to(receiverId).emit("myAnswer", data);
  });

  socket.on("candidate", ({ receiverId, ...data }) => {
    socket.to(receiverId).emit("myCandidate", data);
  });

  socket.on("disconnect", () => {
    const roomId = roomSocket[socket.id];
    let room = users[roomId];
    if (room) {
      room = room.filter((user) => user.id !== socket.id);
      users[roomId] = room;
      if (room.length === 0) {
        delete users[roomId];
        return;
      }
    }
    socket.to(roomId).emit("exit", { id: socket.id });
  });
});

server.listen(PORT, () => {
  console.log(`server running on ${PORT}`);
});
