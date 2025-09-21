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
const tubeLength = 200;
const numSegments = 12; // Increased to ensure overlap and no gaps

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
tubeWallTexture.repeat.set(15, 2);

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

// Create tube segments with overlap to avoid gaps
for (let i = 0; i < numSegments; i++) {
    // Overlap each segment slightly to prevent visible seams
    const z = i * (tubeLength - 0.5); // 0.5 units overlap
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

gltfLoader.load(
    './space.glb', // or .gltf
    (gltf) => {
        rocket = gltf.scene;

        // Scale rocket to fit inside tube
        const rocketDiameter = tubeRadius * 1.6 * 0.6;
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
                flame.material.color.setRGB(
                    1,                         // strong red
                    0.4 + 0.4 * colorPhase,    // green shifts (orange-yellow)
                    0.1 + 0.15 * (1 - colorPhase) // subtle blue/red balance
                );
                flame.material.emissive.setRGB(
                    1,
                    0.4 + 0.4 * colorPhase,
                    0.2 + 0.15 * (1 - colorPhase)
                );
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

    // Optionally move the rocket with the camera
    if (rocket) {
        rocket.position.set(0, -0.5, cameraZ + 3);
        // rocket.rotation.z += 0.01; // Optional: spin the rocket for effect
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
            tube.position.z = maxZ + (tubeLength - 0.5);

            // Update geometry to match new position
            const newPath = new THREE.CatmullRomCurve3(makeTubePath(tube.position.z, tube.position.z + tubeLength));
            tube.geometry.dispose();
            tube.geometry = new THREE.TubeGeometry(newPath, 32, tubeRadius, 32, false);
        }
    }

    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);