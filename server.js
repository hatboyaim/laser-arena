const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};

io.on("connection", (socket) => {
  if (Object.keys(players).length >= 2) {
    socket.emit("gameFull");
    return;
  }

  const count = Object.keys(players).length;
  players[socket.id] = {
    id: socket.id,
    x: count === 0 ? -8 : 8,
    y: 1,
    z: 0,
    rotation: 0,
    health: 100,
    score: 0
  };

  socket.emit("playerId", socket.id);
  io.emit("players", players);

  socket.on("move", (data) => {
    if (!players[socket.id]) return;
    Object.assign(players[socket.id], data);
    socket.broadcast.emit("playerMoved", { id: socket.id, ...data });
  });

  socket.on("shoot", (laser) => {
    socket.broadcast.emit("enemyShot", { owner: socket.id, ...laser });
  });

  socket.on("hit", (targetId) => {
    if (!players[targetId] || !players[socket.id]) return;
    players[targetId].health -= 20;

    if (players[targetId].health <= 0) {
      players[socket.id].score++;
      players[targetId].health = 100;
      players[targetId].x = Math.random() * 20 - 10;
      players[targetId].z = Math.random() * 20 - 10;
    }

    io.emit("players", players);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

server.listen(3000, () => {
  console.log("LASER ARENA running on http://localhost:3000");
});