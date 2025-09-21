import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Tube parameters
const tubeRadius = 2;
const tubeLength = 20;
const numSegments = 12; // Number of tube segments

// Path for a straight tube segment
function makeTubePath(zStart, zEnd) {
    return [
        new THREE.Vector3(0, 0, zStart),
        new THREE.Vector3(0, 0, zEnd)
    ];
}

// Load a texture for the tube wall
const textureLoader = new THREE.TextureLoader();
const tubeWallTexture = textureLoader.load(
    "https://cdn.pixabay.com/photo/2016/12/18/21/23/brick-wall-1916752_1280.jpg"
);
tubeWallTexture.wrapS = THREE.RepeatWrapping;
tubeWallTexture.wrapT = THREE.RepeatWrapping;
tubeWallTexture.repeat.set(2, 2);

const ObsWallTexture = textureLoader.load(
    "https://cdn.pixabay.com/photo/2016/12/18/21/23/brick-wall-1916752_1280.jpg"
);
ObsWallTexture.wrapS = THREE.RepeatWrapping;
ObsWallTexture.wrapT = THREE.RepeatWrapping;
ObsWallTexture.repeat.set(1, 1);
// Store tube segments
const tubeSegments = [];
function createTubeMaterial() {
    return new THREE.MeshPhongMaterial({
        map: tubeWallTexture,
        side: THREE.DoubleSide,
        shininess: 10,
        emissive: 0x112244
    });
}

// --- FIX: Remove gaps between tube segments ---
// The problem is that TubeGeometry's start/end are not exact, and floating point errors can cause tiny gaps.
// Solution: Slightly overlap segments, and ensure their positions are contiguous (no rounding errors).
// We'll use a small negative overlap (e.g. -0.2) to ensure overlap, and always compute z from i * (tubeLength - overlap).
const tubeOverlap = 0.2; // Overlap between segments (in world units)
for (let i = 0; i < numSegments; i++) {
    // Each segment starts where the previous ended, minus overlap
    const z = i * (tubeLength - tubeOverlap);
    const path = new THREE.CatmullRomCurve3(makeTubePath(z, z + tubeLength));
    const tubeGeom = new THREE.TubeGeometry(path, 32, tubeRadius, 32, false);
    const tube = new THREE.Mesh(tubeGeom, createTubeMaterial());
    tube.position.z = 0;
    scene.add(tube);
    tubeSegments.push(tube);
}

// Lighting
const ambientLight = new THREE.AmbientLight(0x222233, 80);
ambientLight.castShadow = true
scene.add(ambientLight);

// const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
// directionalLight.position.set(5, 10, 7);
// scene.add(directionalLight);

// Camera setup
// Center the camera inside the tube (at the center axis)
camera.position.set(0, 0, 0);
camera.lookAt(0, 0, 1);
const rocketColorPalette = [
    0x3A86FF, // Cerulean Blue
    0xFFBE0B, // Gold
    0xFB5607, // Orange Pantone
    0xFF006E, // Magenta
    0x8338EC, // Blue Violet
    0xffffff, // White
];

const gltfLoader = new GLTFLoader();
let rocket;
const fire = [];
const rings = [];

// Joystick state
let joystickX = 0; // -1 to 1
let joystickY = 0; // -1 to 1

// Sparkle effect state
let sparkleGroup = null;
let sparkleTimeout = null;
let isSparkling = false;

// Listen for joystickMove events from index.html
window.addEventListener('joystickMove', (e) => {
    // Clamp values just in case
    joystickX = Math.max(-1, Math.min(1, e.detail.x));
    joystickY = Math.max(-1, Math.min(1, e.detail.y));
});

gltfLoader.load(
    './space.glb', // or .gltf
    (gltf) => {
        rocket = gltf.scene;

        // Scale rocket to fit inside tube
        // --- CHANGED: Make rocket diameter cover the tube (almost) ---
        // Use 2*tubeRadius*0.98 to allow a tiny margin for visual fit
        const rocketDiameter = tubeRadius * 1 * 0.98;
        const box = new THREE.Box3().setFromObject(rocket);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = rocketDiameter / maxDim;
        rocket.scale.set(scale, scale, scale);

        // Center the rocket
        const center = new THREE.Vector3();
        box.getCenter(center);
        rocket.position.sub(center);
        rocket.position.set(0, 0, 0);

        // Assign multiple colors (optional)
        // const colorPalette = [
        //   0xff5533, 0x33aaff, 0x44ff44, 0xffee33,
        //   0xffffff, 0x888888, 0xff33bb
        // ];
        let meshIndex = 0;
        const allObj = []
        rocket.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
                // Replace material with MeshPhongMaterial using a palette
                // child.material = new THREE.MeshPhongMaterial({
                // //   color: colorPalette[meshIndex % colorPalette.length],
                //   shininess: 60,
                //   specular: 0x222222
                // });
                // meshIndex++;
            }
            if (obj.name.includes("Point")) {
                const flameLight = new THREE.PointLight(0x3399ff, 1, 10);
                obj.add(flameLight);
               
            }
            if(obj.name.includes("Circle")){
                fire.push(obj)
            }
            if(obj.name.toLowerCase().includes("tor")){
                rings.push(obj)
            }
            obj.castShadow = true
            allObj.push(obj)
        });
        console.log(allObj)
        scene.add(rocket);
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('An error happened loading rocket.glb', error);
    }
);
const clock = new THREE.Clock();



// Camera movement variables
let cameraZ = 0;
const cameraSpeed = 0.1;

// Rocket movement state
let rocketTargetX = 0;
let rocketTargetY = 0;
let rocketCurrentX = 0;
let rocketCurrentY = 0;

// How far the rocket can move from the center (should be less than tubeRadius)
// --- CHANGED: Allow rocket to move to the very top and bottom of the tube ---
// For full coverage, allow max offset to be almost tubeRadius (with a small margin)
const rocketMaxOffsetX = tubeRadius * 0.8;
const rocketMaxOffsetY = tubeRadius * 0.8;

// Sparkle helper
function createSparkleGroup() {
    const group = new THREE.Group();
    const sparkleCount = 18;
    for (let i = 0; i < sparkleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 6, 6);
        const color = new THREE.Color().setHSL(Math.random(), 1, 0.7);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            emissive: color,
            transparent: true,
            opacity: 0.85,
        });
        const mesh = new THREE.Mesh(geometry, material);
        // Randomly position in a small circle around the bottom of the rocket
        const angle = (i / sparkleCount) * Math.PI * 2;
        const radius = 0.25 + Math.random() * 0.12;
        mesh.position.set(
            Math.cos(angle) * radius,
            -0.7 + (Math.random() - 0.5) * 0.08,
            0.1 + (Math.random() - 0.5) * 0.1
        );
        group.add(mesh);
    }
    return group;
}

function showSparkleAt(x, y, z) {
    if (isSparkling) return;
    isSparkling = true;
    if (sparkleGroup) {
        scene.remove(sparkleGroup);
        sparkleGroup = null;
    }
    sparkleGroup = createSparkleGroup();
    sparkleGroup.position.set(x, y, z);
    scene.add(sparkleGroup);

    // Animate sparkle fade out
    let sparkleStart = clock.getElapsedTime();
    function animateSparkle() {
        if (!sparkleGroup) return;
        const t = clock.getElapsedTime() - sparkleStart;
        for (let i = 0; i < sparkleGroup.children.length; i++) {
            const mesh = sparkleGroup.children[i];
            mesh.material.opacity = Math.max(0, 0.85 - t * 1.5);
            mesh.scale.setScalar(1 + t * 1.2);
        }
        if (t < 0.6) {
            requestAnimationFrame(animateSparkle);
        } else {
            if (sparkleGroup) {
                scene.remove(sparkleGroup);
                sparkleGroup = null;
            }
            isSparkling = false;
        }
    }
    animateSparkle();
}

// --- Use the createObstacleWithHoles function ---

// Function to create an obstacle that covers the tube with 1 or more holes of different shapes
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

// --- Obstacle management ---
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

function animate() {
    // Move camera forward

    // Animate the fire to look like a real flame: flicker, stretch, and rotate
    if (fire && fire.length > 0) {
        const t = clock.getElapsedTime();
        for (let i = 0; i < rings.length; i++) {
            const flame = fire[i];
            
            // --- 🔥 Better Flicker ---
            // Base smooth wave (slow breathing)
            const base = 0.8 + 0.2 * Math.sin(t * 6 + i);
            
            // Fast chaotic wave
            const chaos = 0.1 * Math.sin(t * 25 + i * 1.3);
            
            // Small random jitter (changes every frame)
            const jitter = (Math.random() - 0.5) * 0.05;
            
            // Combine all three
            const flicker = Math.min(1, Math.max(0.65, base + chaos + jitter));
            if(fire[i]){
                // Apply only to Z (length)
                flame.scale.set(1, 1, flicker);

                // --- 🔥 Animate Flame Color ---
                if (flame.material && flame.material.color) {
                    // Color pulsates slightly with the flicker
                    const colorPhase = 0.5 + 0.5 * Math.sin(t * 4 + i);
                    // flame.material.color.setRGB(
                    //     1,                         // strong red
                    //     0.4 + 0.4 * colorPhase,    // green shifts (orange-yellow)
                    //     0.1 + 0.15 * (1 - colorPhase) // subtle blue/red balance
                    // );
                    // flame.material.emissive.setRGB(
                    //     1,
                    //     0.4 + 0.4 * colorPhase,
                    //     0.2 + 0.15 * (1 - colorPhase)
                    // );
                }
            }
            // --- 🔵 Rotate the corresponding ring according to the fire ---
            if (rings && rings[i]) {
                // Example: rotate the ring around Z based on the flicker and time
                rings[i].rotation.z = t * 2 + flicker * Math.PI * 0.2;
                // Optionally, you can also add a little "wobble" based on the flicker
                // rings[i].rotation.x = 0.1 * Math.sin(t * 3 + i);
                // rings[i].rotation.y = 0.1 * Math.cos(t * 2 + i);
            }
        }
    }

    cameraZ += cameraSpeed;
    camera.position.set(0, 0.3, cameraZ); // Always keep camera at center of tube
    camera.lookAt(0, 0, cameraZ + 1);

    // Move the rocket with the joystick
    if (rocket) {
        // Target position based on joystick
        rocketTargetX = -joystickX * rocketMaxOffsetX;
        // Clamp rocketTargetY so it never goes below the bottom or above the top of the tube
        // The -0.5 offset is for the rocket's visual center, so we want to avoid going below -rocketMaxOffsetY or above +rocketMaxOffsetY
        rocketTargetY = Math.max(-rocketMaxOffsetY, Math.min(rocketMaxOffsetY, -joystickY * rocketMaxOffsetY)); // Invert Y so up is up

        // Smoothly interpolate rocket position for a natural feel
        const lerpAlpha = 0.1; // Smoothing factor (0 = no move, 1 = instant)
        rocketCurrentX += (rocketTargetX - rocketCurrentX) * lerpAlpha;
        rocketCurrentY += (rocketTargetY - rocketCurrentY) * lerpAlpha;

        rocket.position.set(rocketCurrentX, rocketCurrentY - 0.0, cameraZ + 5);

        // Optional: tilt the rocket based on movement for realism
        rocket.rotation.x = (rocketCurrentY / rocketMaxOffsetY) * 0.25; // pitch up/down
        rocket.rotation.y = -(rocketCurrentX / rocketMaxOffsetX) * 0.25; // yaw left/right
        rocket.rotation.z = -(rocketCurrentX / rocketMaxOffsetX) * 1; // roll left/right
        // camera.rotation.x = (rocketCurrentY / rocketMaxOffsetY) * 0.25; // pitch up/down
        camera.rotation.y = -(rocketCurrentX / rocketMaxOffsetX) * 0.2; // yaw left/right
        // camera.rotation.z = -(rocketCurrentX / rocketMaxOffsetX)*1 ; // roll left/right

        // Sparkle effect if touching the bottom
        // If joystickY is at or below -0.98 and rocketCurrentY is at the clamp, trigger sparkle
        if (
            Math.abs(rocketCurrentY - (-rocketMaxOffsetY)) < 0.05 &&
            joystickY < -0.98
        ) {
            // Show sparkle at the bottom of the rocket
            showSparkleAt(rocket.position.x, rocket.position.y - 0.3, rocket.position.z);
        }
    }

    // Recycle tube segments to create infinite effect
    for (let i = 0; i < tubeSegments.length; i++) {
        const tube = tubeSegments[i];
        // The tube's geometry starts at tube.position.z + 0, ends at tube.position.z + tubeLength
        // If the tube is behind the camera by more than one segment, move it forward
        if (tube.position.z + tubeLength < cameraZ - tubeLength) {
            // Find the furthest tube segment
            let maxZ = Math.max(...tubeSegments.map(t => t.position.z));
            // Overlap the new segment slightly with the previous to avoid gaps
            tube.position.z = maxZ + (tubeLength - tubeOverlap);

            // Update geometry to match new position
            const newPath = new THREE.CatmullRomCurve3(makeTubePath(tube.position.z, tube.position.z + tubeLength));
            tube.geometry.dispose();
            tube.geometry = new THREE.TubeGeometry(newPath, 32, tubeRadius, 32, false);
        }
    }

    // Move and recycle obstacles to create infinite effect
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

    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);