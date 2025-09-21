import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

//================================================================================
// Scene, Camera, and Renderer Setup
//================================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10102a); // Dark blue space background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Place the camera at a positive Z so it looks down the -Z axis (the default in Three.js)
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
// Place the light in front of the camera, so it shines down the -Z axis
directionalLight.position.set(5, 5, 10); // Positive Z, in front of camera
camera.add(directionalLight); // Light moves with the camera
scene.add(camera); // Add camera to the scene so its children are visible

//================================================================================
// Tube Creation (Performance Optimized)
//================================================================================
const tubeRadius = 2;
const tubeLength = 20;
const numSegments = 12;
const tubeOverlap = 0.2;
const tubeSegments = [];
let baseTubeGeom; // Single, reusable geometry

const textureLoader = new THREE.TextureLoader();
const tubeWallTexture = textureLoader.load("https://cdn.pixabay.com/photo/2016/12/18/21/23/brick-wall-1916752_1280.jpg");
tubeWallTexture.wrapS = THREE.RepeatWrapping;
tubeWallTexture.wrapT = THREE.RepeatWrapping;
tubeWallTexture.repeat.set(2, 2);

const tubeMaterial = new THREE.MeshPhongMaterial({
    map: tubeWallTexture,
    side: THREE.DoubleSide,
    shininess: 10,
    emissive: 0x112244
});

for (let i = 0; i < numSegments; i++) {
    if (!baseTubeGeom) {
        const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -tubeLength)]);
        baseTubeGeom = new THREE.TubeGeometry(path, 32, tubeRadius, 32, false);
    }
    const tube = new THREE.Mesh(baseTubeGeom, tubeMaterial);
    tube.position.z = -i * (tubeLength - tubeOverlap); // Tubes extend in -Z direction
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

gltfLoader.load(
    './space.glb', // <-- DOUBLE CHECK THIS PATH IS CORRECT!
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
            if (obj.name.toLowerCase().includes("circle")) { fire.push(obj); }
            if (obj.name.toLowerCase().includes("tor")) { rings.push(obj); }
        });

        // --- THIS IS THE KEY ---
        // 1. Add the rocket as a child of the camera.
        // 2. Position it in front of the camera (negative Z).
        // 3. FIX: Rotate the rocket 180 degrees around Y so it points down -Z.
        camera.add(rocket);
        rocket.position.set(0, 0, -5);
        rocket.rotation.y = Math.PI; // Fix orientation so rocket points forward
        console.log("Rocket loaded and added to camera.");
    },
    undefined, // onProgress callback not needed
    (error) => {
        console.error("CRITICAL ERROR: Could not load 'space.glb'. Check the file path and make sure the file is not corrupt.", error);
    }
);

//================================================================================
// Game State & Controls
//================================================================================
const clock = new THREE.Clock();
const cameraSpeed = 10;
let joystickX = 0;
let joystickY = 0;
let rocketCurrentX = 0, rocketCurrentY = 0;
const rocketMaxOffset = tubeRadius * 0.8;

window.addEventListener('joystickMove', (e) => {
    joystickX = e.detail.x;
    joystickY = e.detail.y;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function createObstacleWithHoles({
    tubeRadius = 2,
    thickness = 0.15,
    z = 0,
    numHoles = 2 + Math.floor(Math.random() * 2), // 2 or 3 holes
    holeShapes = null, // e.g. ['circle', 'square', 'triangle']
    color = 0x3A86FF,
} = {}) {
    // Outer circle shape (covers the tube)
    const outerShape = new THREE.Shape();
    outerShape.absarc(0, 0, tubeRadius, 0, Math.PI * 2, false);

    // Generate holes
    const holes = [];
    const usedAngles = [];
    for (let i = 0; i < numHoles; i++) {
        // Pick a random angle and distance from center for the hole
        let angle, r;
        // Try to avoid overlapping holes
        let tries = 0;
        do {
            angle = Math.random() * Math.PI * 2;
            r = tubeRadius * 0.5 + Math.random() * (tubeRadius * 0.35);
            tries++;
        } while (
            usedAngles.some(a => Math.abs(a - angle) < Math.PI / 6) && tries < 10
        );
        usedAngles.push(angle);

        const cx = Math.cos(angle) * r;
        const cy = Math.sin(angle) * r;

        // Pick shape
        let shapeType;
        if (holeShapes && holeShapes[i]) {
            shapeType = holeShapes[i];
        } else {
            const types = ['circle', 'square', 'triangle'];
            shapeType = types[Math.floor(Math.random() * types.length)];
        }

        // Add hole to shape
        if (shapeType === 'circle') {
            const holeRadius = tubeRadius * (0.25 + Math.random() * 0.15);
            const holePath = new THREE.Path();
            holePath.absarc(cx, cy, holeRadius, 0, Math.PI * 2, true);
            outerShape.holes.push(holePath);
        } else if (shapeType === 'square') {
            const size = tubeRadius * (0.35 + Math.random() * 0.1);
            const holePath = new THREE.Path();
            holePath.moveTo(cx - size / 2, cy - size / 2);
            holePath.lineTo(cx + size / 2, cy - size / 2);
            holePath.lineTo(cx + size / 2, cy + size / 2);
            holePath.lineTo(cx - size / 2, cy + size / 2);
            holePath.lineTo(cx - size / 2, cy - size / 2);
            outerShape.holes.push(holePath);
        } else if (shapeType === 'triangle') {
            const size = tubeRadius * (0.38 + Math.random() * 0.08);
            const holePath = new THREE.Path();
            // Equilateral triangle
            for (let j = 0; j < 3; j++) {
                const theta = angle + Math.PI * 2 * (j / 3);
                const x = cx + Math.cos(theta) * size / 2;
                const y = cy + Math.sin(theta) * size / 2;
                if (j === 0) {
                    holePath.moveTo(x, y);
                } else {
                    holePath.lineTo(x, y);
                }
            }
            holePath.closePath();
            outerShape.holes.push(holePath);
        }
    }

    // Extrude settings: thin wall
    const extrudeSettings = {
        depth: thickness,
        bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
    geometry.center();

    // Material
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

    // Optionally, add a subtle glow or outline
    // (could add a second mesh with emissive material, or use postprocessing)

    return mesh;
}

const obstacles = [];
const obstacleSpacing = 60; // Distance between obstacles along Z
const maxObstacles = 6; // How many obstacles to keep in the scene

// Pre-populate obstacles
for (let i = 0; i < maxObstacles; i++) {
    const z = 30 + i * obstacleSpacing;
    const color = [0x3A86FF, 0xFFBE0B, 0xFB5607, 0xFF006E, 0x8338EC][i % 5];
    const obstacle = createObstacleWithHoles({
        tubeRadius,
        thickness: 0.18,
        z,
        color,
    });
    scene.add(obstacle);
    obstacles.push(obstacle);
}
//================================================================================
// Animation Loop
//================================================================================
function animate() {
    requestAnimationFrame(animate); // Use requestAnimationFrame for the loop

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // --- 1. Move the Camera ---
    // Move the camera in the -Z direction (forward down the tunnel)
    camera.position.z -= cameraSpeed * delta;

    // --- 2. Update Rocket Position & Rotation (if it has loaded) ---
    if (rocket) {
        const targetX = joystickX * rocketMaxOffset;
        const targetY = -joystickY * rocketMaxOffset;
        const lerpFactor = 5 * delta; // Frame-rate independent smoothing

        rocketCurrentX += (targetX - rocketCurrentX) * lerpFactor;
        rocketCurrentY += (targetY - rocketCurrentY) * lerpFactor;

        // Update the rocket's LOCAL position
        rocket.position.x = rocketCurrentX;
        rocket.position.y = rocketCurrentY;

        // If joystick is centered (no value change), make the rocket straight
        
            // Update rotation for effect
            rocket.rotation.x = (rocketCurrentY / rocketMaxOffset) * 0.5;
            rocket.rotation.y = Math.PI - (rocketCurrentX / rocketMaxOffset) * 0.3;
            rocket.rotation.z = -(rocketCurrentX / rocketMaxOffset) * 1;
        

        // Animate flame
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
            const minZ = Math.min(...tubeSegments.map(t => t.position.z));
            tube.position.z = minZ - tubeLength + tubeOverlap;
        }
    }
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        // If the obstacle is far behind the camera, recycle it ahead
        if (obs.position.z < cameraZ - 10) {
            // Find the furthest obstacle
            let maxZ = Math.max(...obstacles.map(o => o.position.z));
            obs.position.z = maxZ + obstacleSpacing;
            // Optionally randomize color and holes
            obs.material.color.setHex([0x3A86FF, 0xFFBE0B, 0xFB5607, 0xFF006E, 0x8338EC][Math.floor(Math.random()*5)]);
            // Optionally, replace geometry for new holes
            const newObstacle = createObstacleWithHoles({
                tubeRadius,
                thickness: 0.18,
                z: obs.position.z,
                color: obs.material.color.getHex(),
            });
            obs.geometry.dispose();
            obs.geometry = newObstacle.geometry;
        }
    }
    
    // --- 4. Render the Scene ---
    renderer.render(scene, camera);
}

// Start the animation loop
animate();