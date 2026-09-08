import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * JOAH BOT — evolved interactive showroom
 *
 * Drop-in replacement for the original component.  It deliberately uses only
 * Three.js + React: no external models, textures, or post-processing package.
 */

const LAOS_UTC_OFFSET_HOURS = 7;
const WORK_START_HOUR = 6;
const WORK_END_HOUR = 24;

const COLORS = {
  ink: 0x09111f,
  navy: 0x0f1b32,
  steel: 0x34445d,
  steelLight: 0x7f94ae,
  white: 0xf2f7ff,
  warmWhite: 0xfff5e7,
  orange: 0xff6b21,
  gold: 0xffbd59,
  cyan: 0x3ee9ff,
  cyanSoft: 0x8defff,
  mint: 0x5af2bf,
  violet: 0xa78bfa,
  wood: 0x805033,
  woodDark: 0x57311f,
  leaf: 0x22b87b,
  parcel: 0xd99152,
  parcelDark: 0x91512e,
};

const PALETTE = {
  day: {
    background: 0xaed9e8,
    fog: 0xb9e2eb,
    hemiSky: 0xd7f3ff,
    hemiGround: 0x344055,
    hemiIntensity: 1.15,
    sunColor: 0xfff1d5,
    sunIntensity: 2.3,
    ambientIntensity: 0.32,
    lampIntensity: 0,
    monitorIntensity: 1.8,
    window: 0xbfeeff,
    wall: 0xe9f0f6,
    exposure: 1.05,
  },
  night: {
    background: 0x07101f,
    fog: 0x0a1425,
    hemiSky: 0x1b3158,
    hemiGround: 0x050811,
    hemiIntensity: 0.42,
    sunColor: 0x5d75ae,
    sunIntensity: 0.12,
    ambientIntensity: 0.11,
    lampIntensity: 2.55,
    monitorIntensity: 2.7,
    window: 0x142c58,
    wall: 0x111b31,
    exposure: 0.88,
  },
};

function getLaosHour() {
  const now = new Date();
  const utcMilliseconds = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMilliseconds + LAOS_UTC_OFFSET_HOURS * 3600000).getHours();
}

function isWorkingHour(hour) {
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

function makeCanvasTexture(draw, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeFaceTexture(mood) {
  return makeCanvasTexture((ctx, size) => {
    const active = mood === 'awake';
    const glow = active ? '#65f7c1' : '#8defff';
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#132742');
    gradient.addColorStop(1, '#07101d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(141,239,255,.16)';
    ctx.lineWidth = 2;
    for (let x = 12; x < size; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = glow;
    ctx.fillStyle = glow;
    ctx.lineCap = 'round';
    if (active) {
      ctx.beginPath();
      ctx.arc(78, 108, 17, 0, Math.PI * 2);
      ctx.arc(178, 108, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(128, 140, 38, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
    } else {
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(55, 112);
      ctx.quadraticCurveTo(78, 132, 101, 112);
      ctx.moveTo(155, 112);
      ctx.quadraticCurveTo(178, 132, 201, 112);
      ctx.stroke();
    }
  });
}

function makeMonitorTexture(title, accent) {
  return makeCanvasTexture((ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#102647');
    gradient.addColorStop(1, '#07111f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = `${accent}22`;
    for (let x = -size; x < size * 2; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - size, size);
      ctx.lineTo(x - size + 13, size);
      ctx.lineTo(x + 13, 0);
      ctx.fill();
    }
    ctx.fillStyle = '#d7efff';
    ctx.font = '700 20px ui-monospace, monospace';
    ctx.fillText(title, 22, 34);
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.fillStyle = '#6f99bd';
    ctx.fillText('LIVE  •  ODOO SYNC', 22, 56);
    const bars = [0.55, 0.82, 0.42, 0.7, 0.94, 0.62];
    bars.forEach((value, index) => {
      const x = 26 + index * 35;
      const height = value * 72;
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      ctx.fillRect(x, 176 - height, 19, height);
    });
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#35577c';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 80, 216, 110);
    ctx.fillStyle = '#9dc6e5';
    ctx.font = '600 14px ui-monospace, monospace';
    ctx.fillText('98.7%', 167, 72);
  });
}

function makeLabelSprite(text, color = '#8defff', width = 512) {
  const texture = makeCanvasTexture((ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.font = '800 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.fillText(text, size / 2, size / 2);
  }, width);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  return new THREE.Sprite(material);
}

function makeEmojiSprite(emoji) {
  const texture = makeCanvasTexture((ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.font = '128px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(2, 6, 23, .75)';
    ctx.shadowBlur = 18;
    ctx.fillText(emoji, size / 2, size / 2 + 4);
  });
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
}

function nextRandomDelay() {
  // The random rhythm prevents the room from feeling like a short repeating GIF.
  return 10 + Math.random() * 10;
}

function addBox(parent, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, args, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(...args), material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

export default function JoahBotRoomEvolved({ onBack }) {
  const mountRef = useRef(null);
  const worldRef = useRef(null);
  const [mode, setMode] = useState(() => (isWorkingHour(getLaosHour()) ? 'day' : 'night'));
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    if (!autoSync) return undefined;
    const syncClock = () => setMode(isWorkingHour(getLaosHour()) ? 'day' : 'night');
    syncClock();
    const intervalId = window.setInterval(syncClock, 60_000);
    return () => window.clearInterval(intervalId);
  }, [autoSync]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = PALETTE.day.exposure;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.day.background);
    scene.fog = new THREE.Fog(PALETTE.day.fog, 17, 38);

    const frustumSize = 13.6;
    const camera = new THREE.OrthographicCamera();
    camera.position.set(12.6, 10.5, 13.2);
    camera.lookAt(0, 1.7, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.7, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minZoom = 0.7;
    controls.maxZoom = 2.1;
    controls.minPolarAngle = Math.PI / 5.4;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.update();

    const hemiLight = new THREE.HemisphereLight(PALETTE.day.hemiSky, PALETTE.day.hemiGround, PALETTE.day.hemiIntensity);
    scene.add(hemiLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, PALETTE.day.ambientIntensity);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(PALETTE.day.sunColor, PALETTE.day.sunIntensity);
    sunLight.position.set(8, 13, 5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -10;
    sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 32;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight, sunLight.target);
    const lampLight = new THREE.PointLight(0xffaa5f, 0, 8, 2);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(512, 512);
    lampLight.position.set(-2.28, 2.25, -0.8);
    scene.add(lampLight);
    const rimLight = new THREE.PointLight(COLORS.cyan, 0.35, 8, 2);
    rimLight.position.set(4.2, 2.8, -3.7);
    scene.add(rimLight);

    const root = new THREE.Group();
    scene.add(root);
    const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...extra });
    const physicalWhite = new THREE.MeshPhysicalMaterial({
      color: COLORS.white,
      roughness: 0.28,
      metalness: 0.24,
      clearcoat: 0.82,
      clearcoatRoughness: 0.18,
    });
    const darkMetal = standard(COLORS.navy, { roughness: 0.27, metalness: 0.78 });
    const orangeMetal = standard(COLORS.orange, { roughness: 0.32, metalness: 0.48 });
    const wallMat = standard(PALETTE.day.wall, { roughness: 0.96 });
    const windowMat = standard(PALETTE.day.window, { emissive: PALETTE.day.window, emissiveIntensity: 0.42, roughness: 0.25, metalness: 0.08 });
    const floorMat = standard(COLORS.wood, { roughness: 0.83 });
    const floorDarkMat = standard(COLORS.woodDark, { roughness: 0.88 });

    // --- architectural shell ---
    const floor = addBox(root, [11.4, 0.32, 11.4], [0, -0.16, 0], floorMat);
    floor.name = 'warm wooden floor';
    for (let index = -5; index <= 5; index += 1) {
      const seam = addBox(root, [0.035, 0.013, 11.25], [index, 0.012, 0], floorDarkMat, { castShadow: false });
      seam.name = 'floor plank seam';
    }
    addBox(root, [11.4, 6.7, 0.24], [0, 3.18, -5.55], wallMat, { castShadow: false });
    addBox(root, [0.24, 6.7, 11.4], [-5.55, 3.18, 0], wallMat, { castShadow: false });
    const ceilingBeam = addBox(root, [11.2, 0.22, 0.22], [0, 6.2, -5.28], darkMetal);
    ceilingBeam.name = 'architectural beam';

    // Window with an inner cross frame and animated sky color.
    addBox(root, [3.15, 2.05, 0.12], [-2.75, 4.14, -5.38], darkMetal);
    addBox(root, [2.84, 1.73, 0.055], [-2.75, 4.14, -5.3], windowMat, { castShadow: false });
    addBox(root, [0.08, 1.78, 0.07], [-2.75, 4.14, -5.255], darkMetal, { castShadow: false });
    addBox(root, [2.9, 0.08, 0.07], [-2.75, 4.14, -5.255], darkMetal, { castShadow: false });
    const windowStars = new THREE.Group();
    windowStars.position.set(-2.75, 4.14, -5.22);
    for (let i = 0; i < 20; i += 1) {
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.012 + (i % 3) * 0.006, 6, 6),
        new THREE.MeshBasicMaterial({ color: COLORS.warmWhite, transparent: true, opacity: 0 })
      );
      star.position.set(-1.3 + ((i * 37) % 100) / 38, -0.76 + ((i * 71) % 100) / 62, 0);
      star.userData.phase = i * 0.91;
      windowStars.add(star);
    }
    root.add(windowStars);

    // --- operation board ---
    const titlePlate = addBox(root, [2.85, 0.7, 0.08], [2.62, 4.95, -5.25], darkMetal, { castShadow: false });
    titlePlate.name = 'JOAH OPS neon plate';
    const title = makeLabelSprite('JOAH  //  OPS', '#8defff');
    title.position.set(2.62, 4.95, -5.17);
    title.scale.set(2.55, 0.5, 1);
    root.add(title);
    const titleGlow = new THREE.PointLight(COLORS.cyan, 0.52, 3.5, 2);
    titleGlow.position.set(2.62, 4.9, -4.88);
    root.add(titleGlow);

    // --- shelf / parcels; establishes the warehouse character ---
    const shelf = new THREE.Group();
    shelf.position.set(-4.4, 0, -3.35);
    root.add(shelf);
    const shelfMat = standard(COLORS.steel, { roughness: 0.42, metalness: 0.62 });
    [-0.9, 0.9].forEach((x) => addBox(shelf, [0.1, 3.1, 0.1], [x, 1.55, 0], shelfMat));
    [0.45, 1.45, 2.45].forEach((y) => addBox(shelf, [2.0, 0.1, 0.78], [0, y, 0], shelfMat));
    const parcelMat = standard(COLORS.parcel, { roughness: 0.82 });
    const parcelRibbonMat = standard(COLORS.parcelDark, { roughness: 0.8 });
    [
      [-0.42, 0.69, 0.04, 0.48], [0.37, 0.67, -0.05, 0.42], [-0.42, 1.68, -0.05, 0.38],
      [0.3, 1.7, 0.04, 0.52], [-0.25, 2.68, 0.03, 0.5], [0.45, 2.65, -0.06, 0.32],
    ].forEach(([x, y, z, width], index) => {
      addBox(shelf, [width, 0.38, 0.46], [x, y, z], parcelMat);
      addBox(shelf, [0.05, 0.4, 0.47], [x, y, z + 0.005], parcelRibbonMat, { castShadow: false });
      if (index % 2 === 0) {
        const sticker = addBox(shelf, [0.16, 0.1, 0.008], [x, y + 0.04, 0.235], standard(COLORS.warmWhite), { castShadow: false });
        sticker.rotation.x = 0;
      }
    });
    const shelfLabel = makeLabelSprite('SYNC READY', '#5af2bf');
    shelfLabel.position.set(0, 3.38, 0.08);
    shelfLabel.scale.set(1.55, 0.24, 1);
    shelf.add(shelfLabel);

    // --- workstation ---
    const desk = new THREE.Group();
    desk.position.set(2.7, 0, -4.42);
    root.add(desk);
    const deskTop = addBox(desk, [3.45, 0.15, 1.62], [0, 1.18, 0], standard(0x40516a, { roughness: 0.36, metalness: 0.35 }));
    deskTop.name = 'floating desk top';
    [-1.5, 1.5].forEach((x) => [-0.65, 0.65].forEach((z) => addCylinder(desk, [0.06, 0.06, 1.18, 10], [x, 0.59, z], darkMetal)));
    const deskLedMat = new THREE.MeshStandardMaterial({ color: COLORS.cyan, emissive: COLORS.cyan, emissiveIntensity: 1.2, roughness: 0.3 });
    addBox(desk, [3.15, 0.035, 0.04], [0, 1.095, 0.7], deskLedMat, { castShadow: false });

    const monitorTextures = [makeMonitorTexture('INVENTORY', '#3ee9ff'), makeMonitorTexture('ORDERS', '#5af2bf')];
    const monitorMaterials = [];
    function makeMonitor(x, texture, accent) {
      const group = new THREE.Group();
      group.position.set(x, 1.27, -0.35);
      addCylinder(group, [0.15, 0.18, 0.045, 18], [0, 0.02, 0], darkMetal);
      addCylinder(group, [0.03, 0.03, 0.35, 8], [0, 0.19, 0], darkMetal);
      addBox(group, [1.15, 0.75, 0.08], [0, 0.59, 0], darkMetal);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: accent,
        emissiveIntensity: PALETTE.day.monitorIntensity,
        roughness: 0.2,
      });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.01, 0.61), material);
      screen.position.set(0, 0.59, 0.047);
      group.add(screen);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), new THREE.MeshBasicMaterial({ color: accent }));
      led.position.set(0.48, 0.25, 0.06);
      group.add(led);
      desk.add(group);
      monitorMaterials.push(material);
    }
    makeMonitor(-0.62, monitorTextures[0], COLORS.cyan);
    makeMonitor(0.62, monitorTextures[1], COLORS.mint);
    const keyboard = addBox(desk, [0.88, 0.055, 0.29], [0, 1.26, 0.36], darkMetal);
    keyboard.rotation.y = 0.02;
    for (let i = 0; i < 7; i += 1) addBox(desk, [0.08, 0.008, 0.06], [-0.32 + i * 0.107, 1.292, 0.35], standard(0x7b8da8), { castShadow: false });
    const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), darkMetal);
    mouse.scale.set(0.8, 0.42, 1);
    mouse.position.set(0.71, 1.275, 0.37);
    mouse.castShadow = true;
    desk.add(mouse);

    const mug = new THREE.Group();
    mug.position.set(-1.18, 1.23, 0.4);
    addCylinder(mug, [0.1, 0.085, 0.16, 18], [0, 0.08, 0], physicalWhite);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 14, Math.PI * 1.35), physicalWhite);
    handle.position.set(0.1, 0.08, 0);
    handle.rotation.z = Math.PI / 2;
    mug.add(handle);
    desk.add(mug);
    const steam = [0, 1, 2].map((index) => {
      const sprite = makeLabelSprite('~', '#f8fafc');
      sprite.scale.set(0.17, 0.17, 0.17);
      sprite.position.set(-1.18, 1.38, 0.4);
      sprite.material.opacity = 0;
      sprite.userData.phase = index * 0.8;
      desk.add(sprite);
      return sprite;
    });

    const plant = new THREE.Group();
    plant.position.set(1.42, 1.22, 0.42);
    addCylinder(plant, [0.13, 0.1, 0.18, 12], [0, 0.09, 0], orangeMetal);
    const leafMat = standard(COLORS.leaf, { roughness: 0.48, metalness: 0.08 });
    for (let index = 0; index < 6; index += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), leafMat);
      const angle = (index / 6) * Math.PI * 2;
      leaf.scale.set(0.55, 1.5, 0.42);
      leaf.position.set(Math.cos(angle) * 0.09, 0.28 + (index % 2) * 0.05, Math.sin(angle) * 0.09);
      leaf.rotation.z = Math.cos(angle) * 0.65;
      leaf.castShadow = true;
      plant.add(leaf);
    }
    desk.add(plant);

    // --- rest corner ---
    const bed = new THREE.Group();
    bed.position.set(-3.45, 0, 0.55);
    root.add(bed);
    const bedFrameMat = standard(0x5c3d2b, { roughness: 0.7 });
    addBox(bed, [1.82, 0.28, 2.92], [0, 0.32, 0], bedFrameMat);
    addBox(bed, [1.64, 0.23, 2.72], [0, 0.56, 0], standard(COLORS.warmWhite, { roughness: 0.93 }));
    const blanket = addBox(bed, [1.7, 0.15, 1.65], [0, 0.73, 0.52], orangeMetal);
    blanket.name = 'warm orange blanket';
    addBox(bed, [1.72, 0.88, 0.13], [0, 0.82, -1.42], bedFrameMat);
    const pillow = addBox(bed, [0.94, 0.16, 0.53], [0, 0.74, -1.05], standard(COLORS.white, { roughness: 0.9 }));
    pillow.rotation.y = 0.08;
    const nightStand = new THREE.Group();
    nightStand.position.set(1.15, 0, -1.25);
    addBox(nightStand, [0.58, 0.56, 0.56], [0, 0.28, 0], bedFrameMat);
    addCylinder(nightStand, [0.02, 0.02, 0.35, 8], [0, 0.75, 0], darkMetal);
    const lampShadeMat = new THREE.MeshStandardMaterial({ color: 0xffd5a1, emissive: 0xffa85f, emissiveIntensity: 0, roughness: 0.38 });
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 16, 1, true), lampShadeMat);
    lampShade.position.y = 0.96;
    lampShade.castShadow = true;
    nightStand.add(lampShade);
    bed.add(nightStand);

    // --- snack station: the bot visits this at a non-repeating random rhythm ---
    const fridge = new THREE.Group();
    fridge.position.set(-4.25, 0, 3.75);
    root.add(fridge);
    const fridgeShellMat = standard(0xdcecf8, { roughness: 0.25, metalness: 0.5 });
    const fridgeTrimMat = standard(COLORS.steel, { roughness: 0.28, metalness: 0.72 });
    addBox(fridge, [1.34, 2.85, 0.86], [0, 1.48, 0], fridgeShellMat);
    [-0.5, 0.5].forEach((x) => addCylinder(fridge, [0.06, 0.06, 0.15, 10], [x, 0.075, 0], fridgeTrimMat));
    const fridgeDoor = new THREE.Group();
    fridgeDoor.position.set(-0.62, 1.48, 0.46);
    const door = addBox(fridgeDoor, [1.22, 2.62, 0.08], [0.61, 0, 0], fridgeShellMat);
    door.name = 'opening refrigerator door';
    addBox(fridgeDoor, [0.055, 1.05, 0.055], [1.05, 0, 0.07], fridgeTrimMat);
    const doorDisplayMat = new THREE.MeshStandardMaterial({ color: COLORS.cyan, emissive: COLORS.cyan, emissiveIntensity: 1.5, roughness: 0.25 });
    addBox(fridgeDoor, [0.27, 0.16, 0.025], [0.77, 0.78, 0.055], doorDisplayMat, { castShadow: false });
    fridge.add(fridgeDoor);
    const fridgeLight = new THREE.PointLight(0xbfeeff, 0, 3, 2);
    fridgeLight.position.set(0, 1.48, 0.28);
    fridge.add(fridgeLight);
    const fridgeFood = [];
    const foodSpecs = [
      { color: 0xff8a65, shape: 'orb', label: '🍎' },
      { color: 0xffd166, shape: 'box', label: '🥪' },
      { color: 0x7dd3fc, shape: 'can', label: '🥤' },
      { color: 0x86efac, shape: 'orb', label: '🍙' },
    ];
    foodSpecs.forEach((spec, index) => {
      const food = new THREE.Group();
      const foodMat = new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.08, roughness: 0.42 });
      let foodMesh;
      if (spec.shape === 'box') foodMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.16), foodMat);
      else if (spec.shape === 'can') foodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 12), foodMat);
      else foodMesh = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), foodMat);
      foodMesh.castShadow = true;
      food.add(foodMesh);
      food.position.set(-0.37 + (index % 2) * 0.45, 0.92 + Math.floor(index / 2) * 0.56, 0.47);
      food.userData = { material: foodMat, label: spec.label, home: food.position.clone() };
      food.userData = { material: foodMat, label: spec.label, home: food.position.clone(), baseY: food.position.y };
      fridge.add(food);
      fridgeFood.push(food);
    });
    const fridgeBadge = makeLabelSprite('SNACK LAB', '#ffbd59');
    fridgeBadge.position.set(0, 3.08, 0.03);
    fridgeBadge.scale.set(1.14, 0.22, 1);
    fridge.add(fridgeBadge);

    // --- Mochi, a tiny robot cat. It independently strolls, then curls up to sleep. ---
    const pet = new THREE.Group();
    pet.position.set(-0.95, 0.29, 3.62);
    root.add(pet);
    const petFur = standard(0xffc680, { roughness: 0.72, metalness: 0.06 });
    const petDark = standard(0x9a542d, { roughness: 0.62 });
    const petBody = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), petFur);
    petBody.scale.set(1.25, 0.78, 1.05);
    petBody.castShadow = true;
    pet.add(petBody);
    const petHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), petFur);
    petHead.position.set(0, 0.17, 0.23);
    petHead.castShadow = true;
    pet.add(petHead);
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 3), petFur);
      ear.position.set(side * 0.12, 0.39, 0.23);
      ear.rotation.z = side * 0.2;
      ear.castShadow = true;
      pet.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 8), new THREE.MeshBasicMaterial({ color: COLORS.cyan }));
      eye.position.set(side * 0.075, 0.2, 0.42);
      pet.add(eye);
    });
    [-1, 1].forEach((side) => {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), petDark);
      paw.position.set(side * 0.17, -0.13, side > 0 ? -0.12 : 0.12);
      paw.scale.set(1.2, 0.5, 1.35);
      paw.castShadow = true;
      pet.add(paw);
    });
    const petTail = new THREE.Group();
    petTail.position.set(0, 0.04, -0.26);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.27, 5, 8), petDark);
    tail.position.set(0, 0.16, -0.12);
    tail.rotation.x = 0.65;
    tail.castShadow = true;
    petTail.add(tail);
    pet.add(petTail);
    const petSleepEmoji = makeEmojiSprite('💤');
    petSleepEmoji.position.set(0, 0.7, 0);
    petSleepEmoji.scale.set(0.28, 0.28, 0.28);
    petSleepEmoji.material.opacity = 0;
    pet.add(petSleepEmoji);
    const petState = {
      sleeping: false,
      nextChangeAt: 7 + Math.random() * 8,
      waypoint: 0,
      route: [
        new THREE.Vector3(-0.95, 0.29, 3.62),
        new THREE.Vector3(1.05, 0.29, 3.78),
        new THREE.Vector3(3.65, 0.29, 2.1),
        new THREE.Vector3(3.65, 0.29, 0.1),
        new THREE.Vector3(1.75, 0.29, 0.72),
      ],
    };

    // --- JOAH bot: layered shell, visor, chromed joints, chest core ---
    const bot = new THREE.Group();
    root.add(bot);
    const botShadow = new THREE.Mesh(new THREE.CircleGeometry(0.47, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
    botShadow.rotation.x = -Math.PI / 2;
    botShadow.position.y = 0.012;
    root.add(botShadow);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.39, 0.44, 8, 18), physicalWhite);
    torso.position.y = 0.54;
    torso.castShadow = true;
    bot.add(torso);
    const chestPlate = new THREE.Mesh(new THREE.SphereGeometry(0.305, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), orangeMetal);
    chestPlate.rotation.x = Math.PI / 2;
    chestPlate.position.set(0, 0.57, 0.33);
    chestPlate.scale.set(1, 0.38, 1);
    chestPlate.castShadow = true;
    bot.add(chestPlate);
    const coreMat = new THREE.MeshStandardMaterial({ color: COLORS.cyan, emissive: COLORS.cyan, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.35 });
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), coreMat);
    core.position.set(0, 0.59, 0.39);
    bot.add(core);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 10, 24), darkMetal);
    belt.position.y = 0.35;
    belt.rotation.x = Math.PI / 2;
    belt.castShadow = true;
    bot.add(belt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.39, 24, 20), physicalWhite);
    head.scale.set(1.13, 0.87, 0.94);
    head.position.y = 1.16;
    head.castShadow = true;
    bot.add(head);
    const faceAwake = makeFaceTexture('awake');
    const faceAsleep = makeFaceTexture('sleep');
    const faceMat = new THREE.MeshStandardMaterial({ map: faceAwake, emissiveMap: faceAwake, emissive: 0xffffff, emissiveIntensity: 1.05, roughness: 0.22, metalness: 0.1 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.36), faceMat);
    face.position.set(0, 1.16, 0.362);
    bot.add(face);
    const visorRim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 8, 24), darkMetal);
    visorRim.position.set(0, 1.16, 0.355);
    visorRim.scale.set(1.02, 0.66, 1);
    bot.add(visorRim);
    [-1, 1].forEach((side, index) => {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.065, 16), darkMetal);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(side * 0.42, 1.16, 0);
      ear.castShadow = true;
      bot.add(ear);
      const earLed = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: index ? COLORS.gold : COLORS.cyan }));
      earLed.position.set(side * 0.456, 1.16, 0);
      earLed.rotation.y = side * Math.PI / 2;
      bot.add(earLed);
    });
    const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.18, 8), darkMetal);
    antennaStem.position.y = 1.56;
    bot.add(antennaStem);
    const antenna = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 12), coreMat);
    antenna.position.y = 1.67;
    bot.add(antenna);
    const armPivots = [];
    [-1, 1].forEach((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.43, 0.75, 0.02);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), darkMetal);
      shoulder.castShadow = true;
      pivot.add(shoulder);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.28, 5, 10), physicalWhite);
      arm.position.set(side * 0.12, -0.2, 0.06);
      arm.rotation.z = -side * 0.42;
      arm.castShadow = true;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 12), orangeMetal);
      hand.position.set(side * 0.23, -0.4, 0.1);
      hand.castShadow = true;
      pivot.add(hand);
      bot.add(pivot);
      armPivots.push(pivot);
    });
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.22, 5, 10), darkMetal);
      leg.position.set(side * 0.15, 0.13, 0);
      leg.castShadow = true;
      bot.add(leg);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), physicalWhite);
      foot.scale.set(1, 0.55, 1.35);
      foot.position.set(side * 0.15, 0.02, 0.08);
      foot.castShadow = true;
      bot.add(foot);
    });

    // This is deliberately attached to the robot, so its mood follows every walk and turn.
    const moodAnchor = new THREE.Group();
    moodAnchor.position.set(0, 1.9, 0);
    bot.add(moodAnchor);
    const moodSprites = [
      ['working', '⌨️'],
      ['walking', '✨'],
      ['snacking', '😋'],
      ['sleeping', '💤'],
    ].map(([name, emoji]) => {
      const sprite = makeEmojiSprite(emoji);
      sprite.scale.set(0.34, 0.34, 0.34);
      sprite.material.opacity = 0;
      moodAnchor.add(sprite);
      return { name, sprite };
    });
    const heldSnack = new THREE.Group();
    heldSnack.position.set(0.38, 0.51, 0.43);
    const snackMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 0.45, roughness: 0.3 });
    const snack = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), snackMat);
    snack.scale.set(1, 0.75, 1);
    snack.castShadow = true;
    heldSnack.add(snack);
    heldSnack.visible = false;
    bot.add(heldSnack);

    const sitPose = { position: new THREE.Vector3(2.7, 0.32, -3.67), rotation: new THREE.Euler(0, Math.PI, 0) };
    const sleepPose = { position: new THREE.Vector3(-3.45, 0.77, 0.86), rotation: new THREE.Euler(0, 0, Math.PI / 2) };
    const botActivity = {
      name: 'desk',
      waypoint: 0,
      route: [],
      nextTripAt: nextRandomDelay(),
      snackUntil: 0,
      nextFridgeRefreshAt: nextRandomDelay(),
      selectedFood: 0,
    };
    const routeToFridge = [
      new THREE.Vector3(2.7, 0.04, -2.96),
      new THREE.Vector3(3.72, 0.04, -1.38),
      new THREE.Vector3(2.55, 0.04, 3.1),
      new THREE.Vector3(-3.18, 0.04, 3.16),
      new THREE.Vector3(-3.0, 0.04, 4.62),
      new THREE.Vector3(-4.25, 0.04, 4.62),
    ];
    const routeToDesk = [
      new THREE.Vector3(-3.0, 0.04, 4.62),
      new THREE.Vector3(2.55, 0.04, 3.1),
      new THREE.Vector3(3.72, 0.04, -1.38),
      new THREE.Vector3(2.7, 0.04, -2.96),
    ];
    bot.position.copy(sitPose.position);
    bot.rotation.copy(sitPose.rotation);
    botShadow.position.set(sitPose.position.x, 0.016, sitPose.position.z);

    const zGroup = new THREE.Group();
    zGroup.position.set(-3.83, 1.2, 0.9);
    root.add(zGroup);
    const zSprites = [0, 1, 2].map((index) => {
      const sprite = makeLabelSprite('Z', '#8defff');
      const size = 0.2 + index * 0.055;
      sprite.scale.set(size, size, size);
      sprite.material.opacity = 0;
      sprite.userData.phase = index * 0.87;
      zGroup.add(sprite);
      return sprite;
    });

    // Floating sync motes make daytime feel active without being distracting.
    const moteGeometry = new THREE.BufferGeometry();
    const moteCount = 46;
    const motePositions = new Float32Array(moteCount * 3);
    for (let index = 0; index < moteCount; index += 1) {
      motePositions[index * 3] = -4.9 + ((index * 47) % 100) / 10;
      motePositions[index * 3 + 1] = 0.4 + ((index * 31) % 100) / 30;
      motePositions[index * 3 + 2] = -4.8 + ((index * 19) % 100) / 10;
    }
    moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    const moteMaterial = new THREE.PointsMaterial({ color: COLORS.cyanSoft, size: 0.035, transparent: true, opacity: 0.46, depthWrite: false });
    const motes = new THREE.Points(moteGeometry, moteMaterial);
    root.add(motes);

    function resize() {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      const aspect = width / height;
      camera.left = (-frustumSize * aspect) / 2;
      camera.right = (frustumSize * aspect) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    resize();
    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    worldRef.current = {
      renderer, scene, camera, controls, hemiLight, ambientLight, sunLight, lampLight, rimLight,
      wallMat, windowMat, lampShadeMat, monitorMaterials, faceMat, faceAwake, faceAsleep,
      bot, botShadow, sitPose, sleepPose, armPivots, core, antenna, steam, zSprites, windowStars,
      motes, moteMaterial, clock, fridgeDoor, fridgeLight, fridgeFood, heldSnack, snackMat,
      moodSprites, botActivity, routeToFridge, routeToDesk, pet, petTail, petSleepEmoji, petState,
      modeRef: { current: mode }, target: mode === 'day' ? PALETTE.day : PALETTE.night,
      frameId: null,
    };

    function animate() {
      const world = worldRef.current;
      if (!world) return;
      world.frameId = requestAnimationFrame(animate);
      const delta = Math.min(world.clock.getDelta(), 0.05);
      const elapsed = world.clock.elapsedTime;
      const target = world.target;
      const isDay = world.modeRef.current === 'day';
      const lightLerp = 0.038;
      world.hemiLight.intensity += (target.hemiIntensity - world.hemiLight.intensity) * lightLerp;
      world.ambientLight.intensity += (target.ambientIntensity - world.ambientLight.intensity) * lightLerp;
      world.sunLight.intensity += (target.sunIntensity - world.sunLight.intensity) * lightLerp;
      world.lampLight.intensity += (target.lampIntensity - world.lampLight.intensity) * lightLerp;
      world.rimLight.intensity = isDay ? 0.35 : 1.05 + Math.sin(elapsed * 2.4) * 0.08;
      world.lampShadeMat.emissiveIntensity += (target.lampIntensity * 0.58 - world.lampShadeMat.emissiveIntensity) * lightLerp;
      world.windowMat.emissiveIntensity += ((isDay ? 0.42 : 0.95) - world.windowMat.emissiveIntensity) * lightLerp;
      world.windowMat.color.lerp(new THREE.Color(target.window), lightLerp);
      world.windowMat.emissive.lerp(new THREE.Color(target.window), lightLerp);
      world.wallMat.color.lerp(new THREE.Color(target.wall), lightLerp);
      world.monitorMaterials.forEach((material) => {
        material.emissiveIntensity += (target.monitorIntensity - material.emissiveIntensity) * lightLerp;
      });
      world.renderer.toneMappingExposure += (target.exposure - world.renderer.toneMappingExposure) * lightLerp;
      world.scene.background.lerp(new THREE.Color(target.background), lightLerp);
      world.scene.fog.color.lerp(new THREE.Color(target.fog), lightLerp);

      // JOAH's little daily loop: work → stand → walk to the fridge → eat → return to work.
      // A trip starts every 10–20 seconds, which makes watching it feel pleasantly unscripted.
        const activity = world.botActivity;
        let mood = isDay ? 'working' : 'sleeping';
        let doorTarget = 0;
        let fridgeLightTarget = 0;
        const walkSpeed = 1.25;
        const rotateTo = (targetPosition) => {
          const dx = targetPosition.x - world.bot.position.x;
          const dz = targetPosition.z - world.bot.position.z;
          const yaw = Math.atan2(dx, dz);
          world.bot.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), Math.min(1, delta * 8));
        };
        if (!isDay) {
          activity.name = 'nightSleep';
          world.bot.position.lerp(world.sleepPose.position, Math.min(1, delta * 3.5));
          world.bot.quaternion.slerp(new THREE.Quaternion().setFromEuler(world.sleepPose.rotation), Math.min(1, delta * 3.5));
          const breath = 1 + Math.sin(elapsed * 1.35) * 0.018;
          world.bot.scale.set(breath, 1, breath);
          world.armPivots.forEach((pivot) => { pivot.rotation.x = 0; });
        } else {
          if (activity.name === 'nightSleep') {
            activity.name = 'desk';
            activity.nextTripAt = elapsed + nextRandomDelay();
          }
          world.bot.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, delta * 6));
          if (activity.name === 'desk' && elapsed >= activity.nextTripAt) {
            activity.name = 'walkingToFridge';
            activity.route = world.routeToFridge;
            activity.waypoint = 0;
            activity.selectedFood = Math.floor(Math.random() * world.fridgeFood.length);
            const selectedMaterial = world.fridgeFood[activity.selectedFood].userData.material;
            world.snackMat.color.copy(selectedMaterial.color);
            world.snackMat.emissive.copy(selectedMaterial.color);
          }
          if (activity.name === 'walkingToFridge' || activity.name === 'walkingToDesk') {
            mood = 'walking';
            const targetPosition = activity.route[activity.waypoint];
            const dx = targetPosition.x - world.bot.position.x;
            const dz = targetPosition.z - world.bot.position.z;
            const distance = Math.hypot(dx, dz);
            if (distance < 0.07) {
              activity.waypoint += 1;
              if (activity.waypoint >= activity.route.length) {
                if (activity.name === 'walkingToFridge') {
                  activity.name = 'snacking';
                  activity.snackUntil = elapsed + 3.8;
                } else {
                  activity.name = 'desk';
                  activity.nextTripAt = elapsed + nextRandomDelay();
                }
              }
            } else {
              const step = Math.min(distance, walkSpeed * delta);
              world.bot.position.x += (dx / distance) * step;
              world.bot.position.z += (dz / distance) * step;
              world.bot.position.y = 0.04 + Math.abs(Math.sin(elapsed * 8)) * 0.038;
              rotateTo(targetPosition);
              const stride = Math.sin(elapsed * 10);
              world.armPivots[0].rotation.x = stride * 0.62;
              world.armPivots[1].rotation.x = -stride * 0.62;
            }
          }
          if (activity.name === 'desk') {
            world.bot.position.lerp(world.sitPose.position, Math.min(1, delta * 4));
            world.bot.position.y += Math.sin(elapsed * 2.1) * 0.012;
            world.bot.quaternion.slerp(new THREE.Quaternion().setFromEuler(world.sitPose.rotation), Math.min(1, delta * 4));
            world.armPivots[0].rotation.x = Math.sin(elapsed * 4.7) * 0.28;
            world.armPivots[1].rotation.x = Math.sin(elapsed * 4.7 + Math.PI) * 0.2;
          }
          if (activity.name === 'snacking') {
            mood = 'snacking';
            doorTarget = -Math.PI * 0.7;
            fridgeLightTarget = 1.5;
            world.heldSnack.visible = true;
            world.bot.position.y = 0.04 + Math.sin(elapsed * 2.5) * 0.012;
            world.bot.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), Math.min(1, delta * 6));
            world.armPivots[1].rotation.x = -0.75 + Math.sin(elapsed * 5.5) * 0.18;
            world.armPivots[0].rotation.x = 0.15;
            if (elapsed >= activity.snackUntil) {
              world.heldSnack.visible = false;
              activity.name = 'walkingToDesk';
              activity.route = world.routeToDesk;
              activity.waypoint = 0;
            }
          }
      }
      if (activity.name !== 'snacking') world.heldSnack.visible = false;
        world.fridgeDoor.rotation.y += (doorTarget - world.fridgeDoor.rotation.y) * Math.min(1, delta * 4.5);
        world.fridgeLight.intensity += (fridgeLightTarget - world.fridgeLight.intensity) * Math.min(1, delta * 5);
        world.botShadow.position.x += (world.bot.position.x - world.botShadow.position.x) * Math.min(1, delta * 10);
        world.botShadow.position.z += (world.bot.position.z - world.botShadow.position.z) * Math.min(1, delta * 10);
        world.botShadow.scale.setScalar(activity.name === 'desk' || activity.name === 'nightSleep' ? 0.85 : 1);
        world.core.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.12);
        world.antenna.scale.setScalar(1 + Math.sin(elapsed * 3 + 0.5) * 0.09);

        // Contents restock/reshuffle every 10–20 seconds, even if no one is watching.
        if (elapsed >= activity.nextFridgeRefreshAt) {
          activity.nextFridgeRefreshAt = elapsed + nextRandomDelay();
          world.fridgeFood.forEach((food, index) => {
            const home = food.userData.home;
            food.position.set(home.x + (Math.random() - 0.5) * 0.09, home.y + (Math.random() - 0.5) * 0.08, home.z);
            food.userData.baseY = food.position.y;
            food.rotation.y = (Math.random() - 0.5) * 0.55;
            food.userData.material.color.offsetHSL((Math.random() - 0.5) * 0.04, 0, 0);
            if (index === activity.selectedFood) food.userData.material.emissiveIntensity = 0.42;
          });
        }
        world.fridgeFood.forEach((food, index) => {
          const selected = activity.name === 'snacking' && index === activity.selectedFood;
          food.userData.material.emissiveIntensity += ((selected ? 1.15 : 0.08) - food.userData.material.emissiveIntensity) * Math.min(1, delta * 7);
          food.position.y = food.userData.baseY + (selected ? Math.sin(elapsed * 4) * 0.02 : 0);
        });

        world.moodSprites.forEach(({ name, sprite }) => {
          sprite.material.opacity = name === mood ? 1 : 0;
          sprite.position.y = Math.sin(elapsed * 3) * 0.035;
        });

        // Mochi chooses between a slow patrol and a catnap on its own clock.
        const petState = world.petState;
        if (elapsed >= petState.nextChangeAt) {
          petState.sleeping = Math.random() < 0.34;
          petState.nextChangeAt = elapsed + 6 + Math.random() * 9;
          if (!petState.sleeping) petState.waypoint = (petState.waypoint + 1) % petState.route.length;
        }
        if (petState.sleeping) {
          const curl = 1 + Math.sin(elapsed * 1.8) * 0.025;
          world.pet.scale.set(1.08, 0.74 * curl, 1.08);
          world.petSleepEmoji.material.opacity = 0.95;
          world.petSleepEmoji.position.y = 0.7 + Math.sin(elapsed * 2) * 0.03;
          world.petTail.rotation.y = 0;
        } else {
          const petTarget = petState.route[petState.waypoint];
          const dx = petTarget.x - world.pet.position.x;
          const dz = petTarget.z - world.pet.position.z;
          const distance = Math.hypot(dx, dz);
          if (distance < 0.09) petState.waypoint = (petState.waypoint + 1) % petState.route.length;
          else {
            const step = Math.min(distance, delta * 0.6);
            world.pet.position.x += (dx / distance) * step;
            world.pet.position.z += (dz / distance) * step;
            const yaw = Math.atan2(dx, dz);
            world.pet.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), Math.min(1, delta * 6));
          }
          world.pet.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, delta * 5));
          world.pet.position.y = 0.29 + Math.abs(Math.sin(elapsed * 7)) * 0.025;
          world.petSleepEmoji.material.opacity = 0;
          world.petTail.rotation.y = Math.sin(elapsed * 6) * 0.55;
        }

        world.steam.forEach((sprite, index) => {
          const local = (elapsed + sprite.userData.phase) % 2.2;
          sprite.position.y = 1.36 + local * 0.22;
          sprite.position.x = -1.18 + Math.sin(elapsed * 2 + index) * 0.028;
          sprite.material.opacity = isDay ? Math.max(0, 0.32 - local * 0.13) : 0;
        });
        world.zSprites.forEach((sprite) => {
          const local = (elapsed + sprite.userData.phase) % 2.5;
          sprite.position.set(local * 0.25, local * 0.5, 0);
          sprite.material.opacity = isDay ? 0 : Math.sin((local / 2.5) * Math.PI) * 0.96;
        });
        world.windowStars.children.forEach((star) => {
          star.material.opacity = isDay ? 0 : 0.35 + Math.sin(elapsed * 2 + star.userData.phase) * 0.25;
        });
        world.moteMaterial.opacity = isDay ? 0.46 : 0.1;
        world.motes.rotation.y = elapsed * 0.022;
        world.controls.update();
        world.renderer.render(world.scene, world.camera);
      }
      animate();

      return () => {
        window.removeEventListener('resize', resize);
        const world = worldRef.current;
        if (world?.frameId) cancelAnimationFrame(world.frameId);
        world?.controls.dispose();
        scene.traverse((object) => {
          object.geometry?.dispose();
          const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
          materials.forEach((material) => {
            material.map?.dispose();
            material.emissiveMap?.dispose();
            material.dispose();
          });
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        worldRef.current = null;
      };
      // The scene is built once; mode updates mutate live objects below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.modeRef.current = mode;
    world.target = mode === 'day' ? PALETTE.day : PALETTE.night;
    world.faceMat.map = mode === 'day' ? world.faceAwake : world.faceAsleep;
    world.faceMat.emissiveMap = world.faceMat.map;
    world.faceMat.needsUpdate = true;
  }, [mode]);

  const preview = useCallback((nextMode) => {
    setAutoSync(false);
    setMode(nextMode);
  }, []);
  const resumeAutoSync = useCallback(() => {
    setAutoSync(true);
    setMode(isWorkingHour(getLaosHour()) ? 'day' : 'night');
  }, []);
  const daytime = mode === 'day';

  return (
    <section className="relative h-full min-h-[570px] w-full overflow-hidden rounded-[28px] border border-slate-700/80 bg-slate-950 select-none shadow-2xl shadow-slate-950/60">
      <div ref={mountRef} className="absolute inset-0" aria-label="Interactive 3D JOAH Bot operations room" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,transparent_42%,rgba(2,6,23,.28)_100%)]" />

      <header className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button type="button" onClick={onBack} className="rounded-full border border-white/20 bg-slate-950/35 px-3 py-2 text-xs font-bold text-white backdrop-blur-xl transition hover:-translate-x-0.5 hover:bg-white/15 active:scale-95">
              ← Back
            </button>
          )}
          <div className="rounded-2xl border border-white/15 bg-slate-950/45 px-3.5 py-2.5 text-white shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full shadow-[0_0_14px_currentColor] ${daytime ? 'bg-emerald-300 text-emerald-300' : 'bg-sky-300 text-sky-300'} animate-pulse`} />
              <span className="text-[10px] font-black tracking-[0.18em] text-white/55">JOAH // OPERATIONS</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold tracking-tight">{daytime ? 'Bot online · inventory in sync' : 'Night mode · bot recharging'}</p>
          </div>
        </div>
        <div className="rounded-full border border-white/15 bg-slate-950/45 px-3 py-2 text-[11px] font-semibold text-white/70 shadow-lg backdrop-blur-xl">
          {autoSync ? 'AUTO · Laos UTC+7' : 'MANUAL PREVIEW'}
        </div>
      </header>

      <div className="absolute bottom-4 left-1/2 z-10 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/50 p-1.5 shadow-2xl backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={() => preview('day')} className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${!autoSync && daytime ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            ☀ Work shift
          </button>
          <button type="button" onClick={() => preview('night')} className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${!autoSync && !daytime ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            ☾ Sleep shift
          </button>
          <button type="button" onClick={resumeAutoSync} className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${autoSync ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/25' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            ↻ Auto sync
          </button>
        </div>
      </div>
      <p className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tracking-wide text-white/45">DRAG TO EXPLORE · SCROLL TO ZOOM</p>
    </section>
  );
}
