const express=require('express'),http=require('http');const {Server}=require('socket.io');
const app=express(),server=http.createServer(app),io=new Server(server);app.use(express.static('public'));
const players={};io.on('connection',s=>{if(Object.keys(players).length>=2)return s.emit('gameFull');
const n=Object.keys(players).length;players[s.id]={x:n?8:-8,y:1.6,z:0,yaw:n?Math.PI:0,health:100,score:0};s.emit('playerId',s.id);io.emit('players',players);
s.on('move',d=>{if(players[s.id]){Object.assign(players[s.id],d);s.broadcast.emit('playerMoved',{id:s.id,...d})}});
s.on('shoot',d=>s.broadcast.emit('enemyShot',{owner:s.id,...d}));
s.on('hit',id=>{if(!players[id]||!players[s.id])return;players[id].health-=20;if(players[id].health<=0){players[s.id].score++;players[id].health=100;players[id].x=Math.random()*20-10;players[id].z=Math.random()*20-10;}io.emit('players',players)});
s.on('disconnect',()=>{delete players[s.id];io.emit('players',players)})});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log('LASER ARENA '+PORT));