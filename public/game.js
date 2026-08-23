import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const socket = io();
let myId = null;
let players = {};
let enemyShips = {};
let lasers = [];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 10, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 2));

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(30, 1, 30),
  new THREE.MeshStandardMaterial({ color: 0x222244 })
);
floor.position.y = -1;
scene.add(floor);

function createWall(x, z, width, depth) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, 5, depth),
    new THREE.MeshStandardMaterial({ color: 0x444466 })
  );
  wall.position.set(x, 1.5, z);
  scene.add(wall);
}
createWall(0, -15, 30, 1);
createWall(0, 15, 30, 1);
createWall(-15, 0, 1, 30);
createWall(15, 0, 1, 30);

function createShip() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(1, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0x00aaff })
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.2, 1),
    new THREE.MeshStandardMaterial({ color: 0x7777ff })
  );
  group.add(wing);

  group.position.y = 1;
  scene.add(group);
  return group;
}

const myShip = createShip();
const keys = {};

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    shoot();
  }
});
window.addEventListener("keyup", (event) => keys[event.code] = false);

socket.on("playerId", (id) => {
  myId = id;
  document.getElementById("status").textContent = "You joined the arena!";
});

socket.on("gameFull", () => {
  document.getElementById("status").textContent = "Arena is full!";
});

socket.on("players", (serverPlayers) => {
  players = serverPlayers;
  updatePlayers();
});

socket.on("playerMoved", (data) => {
  if (data.id === myId) return;
  const ship = enemyShips[data.id];
  if (ship) {
    ship.position.set(data.x, data.y, data.z);
    ship.rotation.y = data.rotation;
  }
});

function updatePlayers() {
  for (const id in players) {
    if (id === myId) {
      const p = players[id];
      myShip.position.set(p.x, p.y, p.z);
      document.getElementById("health").textContent = "❤️ Health: " + p.health;
      document.getElementById("score").textContent = "🏆 Score: " + p.score;
      continue;
    }

    if (!enemyShips[id]) {
      const ship = createShip();
      ship.traverse((child) => {
        if (child.material) child.material.color.set(0xff3333);
      });
      enemyShips[id] = ship;
      document.getElementById("status").textContent = "Opponent connected!";
    }

    const p = players[id];
    enemyShips[id].position.set(p.x, p.y, p.z);
    enemyShips[id].rotation.y = p.rotation;
  }

  for (const id in enemyShips) {
    if (!players[id]) {
      scene.remove(enemyShips[id]);
      delete enemyShips[id];
      document.getElementById("status").textContent = "Waiting for another player...";
    }
  }
}

function shoot() {
  if (!myId) return;
  createLaser(myShip.position.clone(), myShip.rotation.y, myId);
  socket.emit("shoot", {
    x: myShip.position.x,
    y: myShip.position.y,
    z: myShip.position.z,
    rotation: myShip.rotation.y
  });
}

socket.on("enemyShot", (data) => {
  createLaser(new THREE.Vector3(data.x, data.y, data.z), data.rotation, data.owner);
});

function createLaser(position, rotation, owner) {
  const laser = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    new THREE.MeshBasicMaterial({ color: owner === myId ? 0x00ffff : 0xff0000 })
  );

  laser.position.copy(position);
  laser.userData = { rotation, owner, life: 100 };
  scene.add(laser);
  lasers.push(laser);
}

function updateMovement() {
  const speed = 0.15;
  if (keys["KeyW"]) myShip.position.z -= speed;
  if (keys["KeyS"]) myShip.position.z += speed;
  if (keys["KeyA"]) myShip.position.x -= speed;
  if (keys["KeyD"]) myShip.position.x += speed;

  myShip.position.x = Math.max(-13, Math.min(13, myShip.position.x));
  myShip.position.z = Math.max(-13, Math.min(13, myShip.position.z));

  if (myId) {
    socket.emit("move", {
      x: myShip.position.x,
      y: myShip.position.y,
      z: myShip.position.z,
      rotation: myShip.rotation.y
    });
  }
}

window.addEventListener("mousemove", (event) => {
  myShip.rotation.y += event.movementX * 0.002;
});

function updateLasers() {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    const direction = new THREE.Vector3(
      Math.sin(laser.userData.rotation),
      0,
      Math.cos(laser.userData.rotation)
    );

    laser.position.add(direction.multiplyScalar(-0.5));
    laser.userData.life--;

    if (laser.userData.life <= 0) {
      scene.remove(laser);
      lasers.splice(i, 1);
      continue;
    }

    if (laser.userData.owner === myId) {
      for (const id in enemyShips) {
        if (laser.position.distanceTo(enemyShips[id].position) < 1.5) {
          socket.emit("hit", id);
          scene.remove(laser);
          lasers.splice(i, 1);
          break;
        }
      }
    }
  }
}

function updateCamera() {
  const target = myShip.position.clone();
  const offset = new THREE.Vector3(0, 8, 15);
  camera.position.lerp(target.add(offset), 0.1);
  camera.lookAt(myShip.position);
}

function animate() {
  requestAnimationFrame(animate);
  updateMovement();
  updateLasers();
  updateCamera();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
