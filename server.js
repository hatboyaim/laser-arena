const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static("public"));
const players={};
io.on("connection",socket=>{
 if(Object.keys(players).length>=2){socket.emit("gameFull");return;}
 const n=Object.keys(players).length;
 players[socket.id]={x:n?8:-8,y:1.6,z:0,yaw:n?Math.PI:0,pitch:0,health:100,score:0};
 socket.emit("playerId",socket.id);io.emit("players",players);
 socket.on("move",d=>{if(!players[socket.id])return;Object.assign(players[socket.id],d);socket.broadcast.emit("playerMoved",{id:socket.id,...d});});
 socket.on("shoot",d=>socket.broadcast.emit("enemyShot",{owner:socket.id,...d}));
 socket.on("hit",id=>{if(!players[id]||!players[socket.id])return;players[id].health-=20;if(players[id].health<=0){players[socket.id].score++;players[id].health=100;players[id].x=Math.random()*20-10;players[id].z=Math.random()*20-10;}io.emit("players",players);});
 socket.on("disconnect",()=>{delete players[socket.id];io.emit("players",players);});
});
const PORT=process.env.PORT||3000;server.listen(PORT,"0.0.0.0",()=>console.log("LASER ARENA on "+PORT));