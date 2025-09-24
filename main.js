// This version is designed to work when loaded via a <script type="module"> in index.html
// Make sure THREE and GLTFLoader are available via ES modules (e.g. from unpkg or local node_modules)
// and that 'space.glb' is in the same directory as index.html or adjust the path accordingly.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

//================================================================================
// Scene, Camera, and Renderer Setup
//================================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10102a); // Dark blue space background

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//================================================================================
// Lighting
//================================================================================
const ambientLight = new THREE.AmbientLight(0x606080, 10);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 5, 10);
camera.add(directionalLight);
scene.add(camera);

//================================================================================
// Tube Creation (Performance Optimized)
//================================================================================
const tubeRadius = 2;
const tubeLength = 20;
const numSegments = 12;
const tubeOverlap = 0.2;
const tubeSegments = [];
let baseTubeGeom;

const textureLoader = new THREE.TextureLoader();
const tubeWallTexture = textureLoader.load(
  "https://cdn.pixabay.com/photo/2016/12/18/21/23/brick-wall-1916752_1280.jpg"
);
tubeWallTexture.wrapS = THREE.RepeatWrapping;
tubeWallTexture.wrapT = THREE.RepeatWrapping;
tubeWallTexture.repeat.set(2, 2);

const ObsWallTexture = textureLoader.load(
  "https://images.freecreatives.com/wp-content/uploads/2016/08/3d-textures.jpg"
);
ObsWallTexture.wrapS = THREE.RepeatWrapping;
ObsWallTexture.wrapT = THREE.RepeatWrapping;
ObsWallTexture.repeat.set(1, 2);

const tubeMaterial = new THREE.MeshPhongMaterial({
  map: tubeWallTexture,
  side: THREE.DoubleSide,
  shininess: 10,
  emissive: 0x112244,
});

for (let i = 0; i < numSegments; i++) {
  if (!baseTubeGeom) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -tubeLength),
    ]);
    baseTubeGeom = new THREE.TubeGeometry(path, 32, tubeRadius, 32, false);
  }
  const tube = new THREE.Mesh(baseTubeGeom, tubeMaterial);
  tube.position.z = -i * (tubeLength - tubeOverlap);
  scene.add(tube);
  tubeSegments.push(tube);
}

//================================================================================
// Rocket Loading
//================================================================================
let rocket;
const fire = [];
const rings = [];
const gltfLoader = new GLTFLoader();

// Show a loading overlay until the rocket is loaded
let loadingDiv = document.getElementById("loading-overlay");
if (!loadingDiv) {
  loadingDiv = document.createElement("div");
  loadingDiv.id = "loading-overlay";
  loadingDiv.style.position = "fixed";
  loadingDiv.style.top = "0";
  loadingDiv.style.left = "0";
  loadingDiv.style.width = "100vw";
  loadingDiv.style.height = "100vh";
  loadingDiv.style.background = "rgba(0,0,0,0.85)";
  loadingDiv.style.display = "flex";
  loadingDiv.style.alignItems = "center";
  loadingDiv.style.justifyContent = "center";
  loadingDiv.style.zIndex = "99999";
  loadingDiv.style.color = "white";
  loadingDiv.style.fontSize = "3vw";
  loadingDiv.style.fontFamily = "sans-serif";
  loadingDiv.innerText = "Loading...";
  document.body.appendChild(loadingDiv);
}

// Use a relative path for space.glb so it works in index.html (must be in same dir as index.html)
gltfLoader.load(
  "space.glb",
  (gltf) => {
    rocket = gltf.scene;

    const box = new THREE.Box3().setFromObject(rocket);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (tubeRadius * 0.9) / maxDim;
    rocket.scale.set(scale, scale, scale);

    const center = new THREE.Vector3();
    box.getCenter(center);
    rocket.position.sub(center);

    rocket.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      if (obj.name.toLowerCase().includes("circle")) {
        fire.push(obj);
      }
      if (obj.name.toLowerCase().includes("tor")) {
        rings.push(obj);
      }
    });

    camera.add(rocket);
    rocket.position.set(0, 0, -5);
    rocket.rotation.y = Math.PI;
    // Remove loading overlay
    if (loadingDiv) loadingDiv.remove();
    console.log("Rocket loaded and added to camera.");
  },
  (xhr) => {
    // Optionally update loading progress
    if (loadingDiv && xhr.lengthComputable) {
      const percent = Math.round((xhr.loaded / xhr.total) * 100);
      loadingDiv.innerText = `Loading... ${percent}%`;
    }
  },
  (error) => {
    if (loadingDiv) {
      loadingDiv.innerText =
        "CRITICAL ERROR: Could not load 'space.glb'.<br>Check the file path and make sure the file is not corrupt.<br>See console for details.";
    }
    console.error(
      "CRITICAL ERROR: Could not load 'space.glb'. Check the file path and make sure the file is not corrupt.",
      error
    );
  }
);

//================================================================================
// Game State & Controls
//================================================================================
const clock = new THREE.Clock();
const cameraSpeed = 10;
let joystickX = 0;
let joystickY = 0;
let rocketCurrentX = 0,
  rocketCurrentY = 0;
const rocketMaxOffset = tubeRadius * 0.8;

window.addEventListener("joystickMove", (e) => {
  joystickX = e.detail.x;
  joystickY = e.detail.y;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Predefined obstacle patterns for more interesting and consistent obstacles ---
const PREDEFINED_OBSTACLE_PATTERNS = [
  [
    { type: "circle", angle: 0 },
    { type: "circle", angle: Math.PI },
  ],
  [
    { type: "circle", angle: 0 },
    { type: "circle", angle: (2 * Math.PI) / 3 },
    { type: "circle", angle: (4 * Math.PI) / 3 },
  ],
];

function pickObstaclePattern() {
  if (PREDEFINED_OBSTACLE_PATTERNS.length > 0) {
    const idx = Math.floor(Math.random() * PREDEFINED_OBSTACLE_PATTERNS.length);
    return PREDEFINED_OBSTACLE_PATTERNS[idx];
  }
  return [];
}

function createObstacleWithHoles({
  tubeRadius = 2,
  thickness = 0.15,
  z = 0,
  numHoles = 2 + Math.floor(Math.random() * 2),
  holeShapes = null,
  color = 0x3a86ff,
} = {}) {
  const outerShape = new THREE.Shape();
  outerShape.absarc(0, 0, tubeRadius, 0, Math.PI * 2, false);

  const pattern = pickObstaclePattern(tubeRadius, numHoles, holeShapes);

  for (let i = 0; i < pattern.length; i++) {
    const holeRadius = tubeRadius * 0.49;
    const holeAngle = pattern[i].angle;
    const holeX = Math.cos(holeAngle) * holeRadius;
    const holeY = Math.sin(holeAngle) * holeRadius;
    const holeShape = new THREE.Path();
    holeShape.absarc(holeX, holeY, holeRadius, 0.2, Math.PI * 2, false);
    outerShape.holes.push(holeShape);
  }

  const extrudeSettings = {
    depth: thickness,
    bevelEnabled: false,
  };

  const geometry = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
  geometry.center();

  const material = new THREE.MeshPhongMaterial({
    map: ObsWallTexture,
    shininess: 60,
    emissive: 0x222244,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = z;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

const obstacles = [];
const obstacleGeometries = [];
const obstacleSpacing = 60;
const maxObstacles = 8;

// Pre-generate 15 different obstacle geometries to choose from
for (let i = 0; i < 15; i++) {
  const geom = createObstacleWithHoles({ tubeRadius, thickness: 0.18 }).geometry;
  obstacleGeometries.push(geom);
}

// Create the initial obstacles using the pool
for (let i = 0; i < maxObstacles; i++) {
  const material = new THREE.MeshPhongMaterial({
    map: ObsWallTexture,
    side: THREE.DoubleSide,
  });
  const obstacle = new THREE.Mesh(
    obstacleGeometries[i % obstacleGeometries.length],
    material
  );
  obstacle.position.z = -(40 + i * obstacleSpacing);
  obstacle.castShadow = true;
  obstacle.receiveShadow = true;
  scene.add(obstacle);
  obstacles.push(obstacle);
}

//================================================================================
// Game Over State & Score
//================================================================================
let isGameOver = false;
let score = 0;
let lastPassedObstacleIndex = -1;

// Score display (refer to index.html, expects <div id="score"></div>)
let scoreDiv = document.getElementById("score");
if (!scoreDiv) {
  scoreDiv = document.createElement("div");
  scoreDiv.id = "score";
  scoreDiv.style.position = "fixed";
  scoreDiv.style.top = "2vw";
  scoreDiv.style.left = "2vw";
  scoreDiv.style.color = "white";
  scoreDiv.style.fontSize = "2.5vw";
  scoreDiv.style.fontFamily = "sans-serif";
  scoreDiv.style.zIndex = "1000";
  scoreDiv.style.textShadow = "0 0 10px #000";
  document.body.appendChild(scoreDiv);
}
scoreDiv.innerText = `Score: 0`;

function updateScoreDisplay() {
  if (scoreDiv) scoreDiv.innerText = `Score: ${score}`;
}

function showGameOver() {
  isGameOver = true;
  let overlay = document.getElementById("game-over-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "game-over-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0,0,0,0.8)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.style.color = "white";
    overlay.style.fontSize = "4vw";
    overlay.style.fontFamily = "sans-serif";

    const text = document.createElement("div");
    text.innerText = "GAME OVER";
    text.style.marginBottom = "2vw";

    // Show final score
    const scoreText = document.createElement("div");
    scoreText.innerText = `Score: ${score}`;
    scoreText.style.fontSize = "2.5vw";
    scoreText.style.marginBottom = "2vw";

    const refreshBtn = document.createElement("button");
    refreshBtn.innerText = "Restart";
    refreshBtn.style.fontSize = "2vw";
    refreshBtn.style.padding = "1vw 2vw";
    refreshBtn.style.border = "none";
    refreshBtn.style.borderRadius = "0.5vw";
    refreshBtn.style.background = "#222244";
    refreshBtn.style.color = "white";
    refreshBtn.style.cursor = "pointer";
    refreshBtn.style.boxShadow = "0 0 10px #0008";
    refreshBtn.addEventListener("click", function () {
      window.location.reload();
    });

    overlay.appendChild(text);
    overlay.appendChild(scoreText);
    overlay.appendChild(refreshBtn);

    document.body.appendChild(overlay);
  }
}

//================================================================================
// Animation Loop
//================================================================================

// Helper: get the closest obstacle in front of the camera
function getNextObstacleIndex() {
  let minDist = Infinity;
  let idx = -1;
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (obs.position.z < camera.position.z) continue; // Already passed
    const dist = obs.position.z - camera.position.z;
    if (dist < minDist) {
      minDist = dist;
      idx = i;
    }
  }
  return idx;
}

// Improved collision: Only trigger game over if the rocket's bounding sphere actually overlaps the obstacle wall (not just near in Z)
function checkRocketObstacleCollision() {
  if (!rocket) return false;

  // Get rocket's world position
  const rocketWorldPos = new THREE.Vector3();
  rocket.getWorldPosition(rocketWorldPos);

  // We'll use a bounding sphere for the rocket
  const rocketRadius = tubeRadius * 0.25;

  for (const obs of obstacles) {
    // Only check if rocket is at the same Z as the obstacle (within thickness)
    const dz = Math.abs(rocketWorldPos.z - obs.position.z);
    // The obstacle thickness is about 0.18, but fudge for speed
    if (dz < 0.18 + rocketRadius * 1.1) {
      // The obstacle is a ring with holes at certain angles
      // If the rocket is NOT inside any hole, it's a collision

      // For our patterns, holes are at fixed radii and angles
      // We'll check both patterns for safety
      let safe = false;
      const patterns = [
        [0, Math.PI],
        [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3],
      ];
      for (const angles of patterns) {
        for (let i = 0; i < angles.length; i++) {
          const holeAngle = angles[i];
          const hx = Math.cos(holeAngle) * tubeRadius * 0.49;
          const hy = Math.sin(holeAngle) * tubeRadius * 0.49;
          const dist = Math.sqrt(
            (rocketWorldPos.x - hx) * (rocketWorldPos.x - hx) +
              (rocketWorldPos.y - hy) * (rocketWorldPos.y - hy)
          );
          // The hole is a circle of radius tubeRadius*0.49, so if the rocket's center is within the hole minus its own radius, it's safe
          if (dist < tubeRadius * 0.49 - rocketRadius * 0.85) {
            safe = true;
            break;
          }
        }
        if (safe) break;
      }
      // If not safe, collision!
      if (!safe) {
        return true;
      }
    }
  }
  return false;
}

function animate() {
  if (isGameOver) return;

  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  // --- 1. Move the Camera ---
  camera.position.z -= cameraSpeed * delta;

  // --- 2. Update Rocket Position & Rotation (if it has loaded) ---
  if (rocket) {
    const targetX = joystickX * rocketMaxOffset;
    const targetY = -joystickY * rocketMaxOffset;
    const lerpFactor = 5 * delta;

    rocketCurrentX += (targetX - rocketCurrentX) * lerpFactor;
    rocketCurrentY += (targetY - rocketCurrentY) * lerpFactor;

    rocket.position.x = rocketCurrentX;
    rocket.position.y = rocketCurrentY;

    rocket.rotation.x = (rocketCurrentY / rocketMaxOffset) * 0.5;
    rocket.rotation.y = Math.PI - (rocketCurrentX / rocketMaxOffset) * 0.3;
    rocket.rotation.z = -(rocketCurrentX / rocketMaxOffset) * 1;

    for (let i = 0; i < rings.length; i++) {
      if (fire[i]) {
        fire[i].scale.z = 0.8 + 0.3 * Math.sin(elapsedTime * 50 + i);
      }
      if (rings[i]) {
        rings[i].rotation.z = elapsedTime * 3 + i;
      }
    }
  }

  // --- 3. Recycle Tubes ---
  for (const tube of tubeSegments) {
    if (camera.position.z < tube.position.z - tubeLength) {
      const minZ = Math.min(...tubeSegments.map((t) => t.position.z));
      tube.position.z = minZ - tubeLength + tubeOverlap;
    }
  }

  // --- 3.1. Score update: check if we passed an obstacle ---
  // Find the closest obstacle in front of the camera
  let passed = false;
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    // If the obstacle is behind the camera and we haven't counted it yet
    if (obs.position.z > camera.position.z && i !== lastPassedObstacleIndex) {
      // Not yet passed
      break;
    }
    if (obs.position.z <= camera.position.z && i !== lastPassedObstacleIndex) {
      // Just passed this obstacle
      score++;
      lastPassedObstacleIndex = i;
      updateScoreDisplay();
      passed = true;
      break;
    }
  }

  // --- 3.2. Recycle obstacles ---
  for (const obs of obstacles) {
    if (obs.position.z > camera.position.z) {
      const minZ = Math.min(...obstacles.map((o) => o.position.z));
      obs.position.z = minZ - obstacleSpacing;
      obs.geometry.dispose();
      obs.geometry =
        obstacleGeometries[
          Math.floor(Math.random() * obstacleGeometries.length)
        ];
    }
  }

  // --- 4. Check for collision (Game Over) ---
  if (checkRocketObstacleCollision()) {
    showGameOver();
    return;
  }

  // --- 5. Render the Scene ---
  renderer.render(scene, camera);
}

// Wait for DOMContentLoaded to ensure overlays and containers exist
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    animate();
  });
} else {
  animate();
}