import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * JoahBotRoom
 * -----------
 * A low-poly isometric diorama of "JOAH BOT" — the automated warehouse &
 * retail inventory sync bot for KokkokMart / Odoo.
 *
 * WORKING MODE (06:00–23:59, Laos time / UTC+7): bright daylight, bot sits
 * at its dual-monitor desk syncing with Odoo.
 * SLEEPING MODE (00:00–05:59): store closed, cozy night lighting, bot is
 * asleep in bed with floating "Z z z" particles.
 *
 * Pure Three.js (no @react-three/fiber). Tailwind is used only for the
 * floating HUD chrome around the <canvas>.
 */

const LAOS_UTC_OFFSET_HOURS = 7;
const WORK_START_HOUR = 6; // 06:00
const WORK_END_HOUR = 24; // up to 23:59

function getLaosHour() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const laosMs = utcMs + LAOS_UTC_OFFSET_HOURS * 3600000;
  return new Date(laosMs).getHours();
}

function isWorkingHour(hour) {
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

/* ------------------------------------------------------------------ */
/*  Small canvas-texture helpers (kept dependency-free, no image files) */
/* ------------------------------------------------------------------ */

function createBotFaceTexture(mood) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // screen background
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, size, size);

  const glow = mood === 'sleep' ? '#38bdf8' : '#34d399';
  ctx.fillStyle = glow;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;

  if (mood === 'sleep') {
    // closed, sleepy eyes: two flat arcs
    ctx.lineWidth = 8;
    ctx.strokeStyle = glow;
    ctx.beginPath();
    ctx.moveTo(30, 62);
    ctx.quadraticCurveTo(44, 74, 58, 62);
    ctx.moveTo(70, 62);
    ctx.quadraticCurveTo(84, 74, 98, 62);
    ctx.stroke();
  } else {
    // happy round eyes + tiny smile
    ctx.beginPath();
    ctx.arc(44, 56, 10, 0, Math.PI * 2);
    ctx.arc(84, 56, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = glow;
    ctx.beginPath();
    ctx.arc(64, 72, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlyphSprite(glyph, color) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(glyph, size / 2, size / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Sprite(material);
}

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const PALETTE = {
  day: {
    background: 0x9ecfe0,
    fog: 0x9ecfe0,
    hemiSky: 0xbfe3f2,
    hemiGround: 0x3a3f52,
    hemiIntensity: 0.9,
    sunColor: 0xfff2d6,
    sunIntensity: 1.4,
    ambientIntensity: 0.25,
    lampIntensity: 0,
    monitorIntensity: 1.6,
  },
  night: {
    background: 0x0b1024,
    fog: 0x0b1024,
    hemiSky: 0x1b2440,
    hemiGround: 0x05060c,
    hemiIntensity: 0.25,
    sunColor: 0x28304f,
    sunIntensity: 0.12,
    ambientIntensity: 0.08,
    lampIntensity: 1.8,
    monitorIntensity: 0.15,
  },
};

const COLORS = {
  navy: 0x0f172a,
  slate: 0x334155,
  slateLight: 0x64748b,
  wallDay: 0xe8edf5,
  wallNight: 0x141a2e,
  floorA: 0x8a5a3c,
  floorB: 0x7a4c30,
  orange: 0xf97316,
  orangeSoft: 0xfdba74,
  cyan: 0x22d3ee,
  emerald: 0x34d399,
  desk: 0x445164,
  chair: 0x2c3444,
  bedFrame: 0x5b4636,
  blanket: 0xf97316,
  pillow: 0xf1f5f9,
  botBody: 0xf5f7fa,
  botAccent: 0xf97316,
  plantPot: 0xb45309,
  plantLeaf: 0x22a06b,
  mug: 0xf1f5f9,
};

/* ------------------------------------------------------------------ */
/*  React component                                                    */
/* ------------------------------------------------------------------ */

export default function JoahBotRoom({ onBack }) {
  const mountRef = useRef(null);
  const worldRef = useRef(null); // holds every mutable three.js handle
  const [mode, setMode] = useState(() =>
    isWorkingHour(getLaosHour()) ? 'day' : 'night'
  );
  const [autoSync, setAutoSync] = useState(true);

  /* ---- keep an auto time-sync clock running ---- */
  useEffect(() => {
    if (!autoSync) return undefined;

    const tick = () => {
      setMode(isWorkingHour(getLaosHour()) ? 'day' : 'night');
    };
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [autoSync]);

  /* ---- build the scene once ---- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    /* ---------- renderer ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    /* ---------- scene / camera ---------- */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.day.background);
    scene.fog = new THREE.Fog(PALETTE.day.fog, 18, 34);

    const frustumSize = 13;
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    camera.position.set(11, 10, 11);
    camera.lookAt(0, 1.5, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.5, 0);
    controls.minZoom = 0.6;
    controls.maxZoom = 2.2;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minPolarAngle = Math.PI / 5;
    controls.enablePan = false;
    controls.update();

    /* ---------- lights ---------- */
    const hemiLight = new THREE.HemisphereLight(
      PALETTE.day.hemiSky,
      PALETTE.day.hemiGround,
      PALETTE.day.hemiIntensity
    );
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, PALETTE.day.ambientIntensity);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(PALETTE.day.sunColor, PALETTE.day.sunIntensity);
    sunLight.position.set(8, 12, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -10;
    sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 30;
    sunLight.shadow.bias = -0.0015;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const lampLight = new THREE.PointLight(0xffb066, PALETTE.night.lampIntensity, 7, 2.2);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(512, 512);
    scene.add(lampLight);

    /* ---------- ground / walls ---------- */
    const root = new THREE.Group();
    scene.add(root);

    const floorGeo = new THREE.BoxGeometry(11, 0.3, 11);
    const floorMat = new THREE.MeshStandardMaterial({ color: COLORS.floorA, roughness: 0.85 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    root.add(floor);

    // subtle plank stripes using thin overlay boxes
    const plankMat = new THREE.MeshStandardMaterial({ color: COLORS.floorB, roughness: 0.9 });
    for (let i = -5; i <= 5; i += 2) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(11, 0.01, 0.4), plankMat);
      plank.position.set(0, 0.006, i);
      plank.receiveShadow = true;
      root.add(plank);
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wallDay, roughness: 1 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(11, 6.5, 0.25), wallMat);
    backWall.position.set(0, 3.1, -5.4);
    backWall.receiveShadow = true;
    root.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6.5, 11), wallMat);
    leftWall.position.set(-5.4, 3.1, 0);
    leftWall.receiveShadow = true;
    root.add(leftWall);

    // a simple window on the back wall (frame + glow pane)
    const windowFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.7, 0.1),
      new THREE.MeshStandardMaterial({ color: COLORS.slate })
    );
    windowFrame.position.set(-2.4, 4.1, -5.32);
    root.add(windowFrame);
    const windowGlowMat = new THREE.MeshStandardMaterial({
      color: 0xbfe3f2,
      emissive: 0xbfe3f2,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });
    const windowPane = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.4, 0.05), windowGlowMat);
    windowPane.position.set(-2.4, 4.1, -5.28);
    root.add(windowPane);

    /* ---------- workstation ---------- */
    const desk = new THREE.Group();
    desk.position.set(2.6, 0, -4.55);
    root.add(desk);

    const deskTopMat = new THREE.MeshStandardMaterial({ color: COLORS.desk, roughness: 0.6 });
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.5), deskTopMat);
    deskTop.position.y = 1.15;
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    desk.add(deskTop);

    const legMat = new THREE.MeshStandardMaterial({ color: COLORS.slate });
    const legGeo = new THREE.BoxGeometry(0.12, 1.15, 0.12);
    [
      [-1.45, 0.575, -0.6],
      [1.45, 0.575, -0.6],
      [-1.45, 0.575, 0.6],
      [1.45, 0.575, 0.6],
    ].forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      desk.add(leg);
    });

    function makeMonitor(x) {
      const group = new THREE.Group();
      group.position.set(x, 1.21, -0.35);

      const standBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: COLORS.slate })
      );
      group.add(standBase);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.slate })
      );
      neck.position.y = 0.19;
      group.add(neck);

      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.55, 0.04),
        new THREE.MeshStandardMaterial({ color: COLORS.navy, roughness: 0.5 })
      );
      bezel.position.y = 0.52;
      bezel.castShadow = true;
      group.add(bezel);

      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        emissive: COLORS.cyan,
        emissiveIntensity: PALETTE.day.monitorIntensity,
        roughness: 0.3,
      });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.44), screenMat);
      screen.position.set(0, 0.52, 0.021);
      group.add(screen);

      return { group, screenMat };
    }

    const monitorLeft = makeMonitor(-0.55);
    const monitorRight = makeMonitor(0.55);
    desk.add(monitorLeft.group, monitorRight.group);

    const keyboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.04, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x1e2536 })
    );
    keyboard.position.set(0, 1.23, 0.35);
    desk.add(keyboard);

    const mouse = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.05, 0.06, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e2536 })
    );
    mouse.rotation.z = Math.PI / 2;
    mouse.position.set(0.5, 1.24, 0.35);
    desk.add(mouse);

    // coffee mug + steam
    const mugGroup = new THREE.Group();
    mugGroup.position.set(-1.05, 1.21, 0.4);
    const mugBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.08, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: COLORS.mug })
    );
    mugBody.position.y = 0.07;
    mugBody.castShadow = true;
    mugGroup.add(mugBody);
    const mugHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.012, 8, 12, Math.PI * 1.2),
      new THREE.MeshStandardMaterial({ color: COLORS.mug })
    );
    mugHandle.rotation.z = Math.PI / 2;
    mugHandle.position.set(0.1, 0.07, 0);
    mugGroup.add(mugHandle);
    desk.add(mugGroup);

    const steamSprites = [0, 1, 2].map((i) => {
      const s = createGlyphSprite('~', '#f8fafc');
      s.scale.set(0.16, 0.16, 0.16);
      s.position.set(-1.05, 1.32 + i * 0.001, 0.4);
      s.material.opacity = 0;
      s.userData.phase = i * 1.4;
      desk.add(s);
      return s;
    });

    // potted plant
    const plantGroup = new THREE.Group();
    plantGroup.position.set(1.9, 1.21, 0.42);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: COLORS.plantPot })
    );
    pot.position.y = 0.08;
    pot.castShadow = true;
    plantGroup.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color: COLORS.plantLeaf });
    [0, 1, 2].forEach((i) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), leafMat);
      leaf.scale.set(0.6, 1, 0.6);
      leaf.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.05, 0.24, Math.sin((i * Math.PI * 2) / 3) * 0.05);
      leaf.castShadow = true;
      plantGroup.add(leaf);
    });
    desk.add(plantGroup);

    // chair
    const chair = new THREE.Group();
    chair.position.set(0, 0, 0.95);
    const chairMat = new THREE.MeshStandardMaterial({ color: COLORS.chair, roughness: 0.7 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), chairMat);
    seat.position.y = 0.62;
    seat.castShadow = true;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.08), chairMat);
    back.position.set(0, 0.92, -0.24);
    back.castShadow = true;
    chair.add(back);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.58, 8), chairMat);
    pole.position.y = 0.32;
    chair.add(pole);
    const wheelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), chairMat);
    wheelBase.position.y = 0.04;
    chair.add(wheelBase);
    desk.add(chair);

    /* ---------- bed ---------- */
    const bed = new THREE.Group();
    bed.position.set(-3.55, 0, 0.3);
    root.add(bed);

    const frameMat = new THREE.MeshStandardMaterial({ color: COLORS.bedFrame, roughness: 0.8 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 2.9), frameMat);
    frame.position.y = 0.3;
    frame.castShadow = true;
    frame.receiveShadow = true;
    bed.add(frame);

    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.22, 2.75),
      new THREE.MeshStandardMaterial({ color: COLORS.pillow, roughness: 0.9 })
    );
    mattress.position.y = 0.56;
    mattress.castShadow = true;
    mattress.receiveShadow = true;
    bed.add(mattress);

    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.14, 1.7),
      new THREE.MeshStandardMaterial({ color: COLORS.blanket, roughness: 0.9 })
    );
    blanket.position.set(0, 0.72, 0.5);
    blanket.castShadow = true;
    bed.add(blanket);

    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.16, 0.5),
      new THREE.MeshStandardMaterial({ color: COLORS.pillow })
    );
    pillow.position.set(0, 0.72, -1.05);
    pillow.castShadow = true;
    bed.add(pillow);

    // headboard
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 0.12), frameMat);
    headboard.position.set(0, 0.75, -1.45);
    headboard.castShadow = true;
    bed.add(headboard);

    // nightstand + lamp
    const nightstand = new THREE.Group();
    nightstand.position.set(1.15, 0, -1.3);
    bed.add(nightstand);
    const standTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.55),
      new THREE.MeshStandardMaterial({ color: COLORS.bedFrame })
    );
    standTop.position.y = 0.28;
    standTop.castShadow = true;
    standTop.receiveShadow = true;
    nightstand.add(standTop);

    const lampGroup = new THREE.Group();
    lampGroup.position.set(0, 0.56, 0);
    const lampPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a8f9a })
    );
    lampPole.position.y = 0.15;
    lampGroup.add(lampPole);
    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: 0xffdca8,
      emissive: 0xffb066,
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 12, 1, true), lampShadeMat);
    lampShade.position.y = 0.32;
    lampGroup.add(lampShade);
    nightstand.add(lampGroup);
    lampLight.position.set(-3.55 + 1.15, 0.9, 0.3 - 1.3);

    /* ---------- JOAH BOT ---------- */
    const bot = new THREE.Group();
    root.add(bot);

    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.botBody, roughness: 0.55 });
    const accentMat = new THREE.MeshStandardMaterial({ color: COLORS.botAccent, roughness: 0.5 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.32, 6, 12), bodyMat);
    torso.castShadow = true;
    torso.position.y = 0.5;
    bot.add(torso);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 8, 16), accentMat);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.36;
    bot.add(belt);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 20), bodyMat);
    head.position.y = 1.02;
    head.castShadow = true;
    bot.add(head);

    const faceAwake = createBotFaceTexture('awake');
    const faceAsleep = createBotFaceTexture('sleep');
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceAwake,
      emissive: 0xffffff,
      emissiveMap: faceAwake,
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), faceMat);
    face.position.set(0, 1.02, 0.255);
    bot.add(face);

    const antennaMat = new THREE.MeshStandardMaterial({ color: COLORS.slateLight });
    [-0.12, 0.12].forEach((x, i) => {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), antennaMat);
      stalk.position.set(x, 1.32, 0);
      bot.add(stalk);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshStandardMaterial({
          color: i === 0 ? COLORS.cyan : COLORS.orangeSoft,
          emissive: i === 0 ? COLORS.cyan : COLORS.orangeSoft,
          emissiveIntensity: 0.6,
        })
      );
      tip.position.set(x, 1.41, 0);
      bot.add(tip);
    });

    const armMat = bodyMat;
    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 8), armMat);
    leftArm.position.set(-0.34, 0.55, 0.1);
    leftArm.rotation.z = 0.5;
    bot.add(leftArm);
    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 8), armMat);
    rightArm.position.set(0.34, 0.55, 0.1);
    rightArm.rotation.z = -0.5;
    bot.add(rightArm);

    const legMatBot = new THREE.MeshStandardMaterial({ color: COLORS.slate });
    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), legMatBot);
    leftLeg.position.set(-0.13, 0.14, 0);
    bot.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), legMatBot);
    rightLeg.position.set(0.13, 0.14, 0);
    bot.add(rightLeg);

    // pose anchors
    const sitPose = {
      position: new THREE.Vector3(2.6, 0.32, -3.7),
      rotation: new THREE.Euler(0, Math.PI, 0),
    };
    const sleepPose = {
      position: new THREE.Vector3(-3.55, 0.72, 0.65),
      rotation: new THREE.Euler(0, 0, Math.PI / 2),
    };
    bot.position.copy(sitPose.position);
    bot.rotation.copy(sitPose.rotation);

    /* ---------- Zzz particles ---------- */
    const zGroup = new THREE.Group();
    zGroup.position.set(-3.9, 1.05, 0.65);
    root.add(zGroup);
    const zSprites = [0, 1, 2].map((i) => {
      const s = createGlyphSprite('Z', '#7dd3fc');
      const scale = 0.22 + i * 0.05;
      s.scale.set(scale, scale, scale);
      s.userData.phase = i * 1.1;
      s.material.opacity = 0;
      zGroup.add(s);
      return s;
    });

    /* ---------- resize handling ---------- */
    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      const a = w / h;
      camera.left = (-frustumSize * a) / 2;
      camera.right = (frustumSize * a) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    /* ---------- store mutable world ---------- */
    worldRef.current = {
      renderer,
      scene,
      camera,
      controls,
      hemiLight,
      ambientLight,
      sunLight,
      lampLight,
      windowGlowMat,
      lampShadeMat,
      monitorMats: [monitorLeft.screenMat, monitorRight.screenMat],
      bot,
      sitPose,
      sleepPose,
      faceMat,
      faceAwake,
      faceAsleep,
      zSprites,
      steamSprites,
      leftArm,
      rightArm,
      clock: new THREE.Clock(),
      // targets are mutated from the mode-sync effect below
      target: { ...PALETTE.day },
      modeRef: { current: 'day' },
      frameId: null,
    };

    /* ---------- animation loop ---------- */
    function animate() {
      const world = worldRef.current;
      if (!world) return;
      world.frameId = requestAnimationFrame(animate);

      const t = world.clock.getElapsedTime();
      const target = world.target;
      const lerpSpeed = 0.04;

      // smooth lighting transition
      world.hemiLight.intensity += (target.hemiIntensity - world.hemiLight.intensity) * lerpSpeed;
      world.ambientLight.intensity += (target.ambientIntensity - world.ambientLight.intensity) * lerpSpeed;
      world.sunLight.intensity += (target.sunIntensity - world.sunLight.intensity) * lerpSpeed;
      world.lampLight.intensity += (target.lampIntensity - world.lampLight.intensity) * lerpSpeed;
      world.lampShadeMat.emissiveIntensity += (target.lampIntensity * 0.9 - world.lampShadeMat.emissiveIntensity) * lerpSpeed;
      world.windowGlowMat.emissiveIntensity += ((target === PALETTE.day ? 0.6 : 0.08) - world.windowGlowMat.emissiveIntensity) * lerpSpeed;
      world.monitorMats.forEach((m) => {
        m.emissiveIntensity += (target.monitorIntensity - m.emissiveIntensity) * lerpSpeed;
      });

      const bg = new THREE.Color(target.background);
      world.scene.background.lerp(bg, lerpSpeed);
      world.scene.fog.color.lerp(new THREE.Color(target.fog), lerpSpeed);

      // bot pose + idle animation
      const isDay = world.modeRef.current === 'day';
      const pose = isDay ? world.sitPose : world.sleepPose;
      world.bot.position.lerp(pose.position, 0.06);
      const targetQuat = new THREE.Quaternion().setFromEuler(pose.rotation);
      world.bot.quaternion.slerp(targetQuat, 0.06);

      if (isDay) {
        world.bot.position.y += Math.sin(t * 2.4) * 0.012;
        world.leftArm.rotation.x = Math.sin(t * 6) * 0.25;
        world.rightArm.rotation.x = Math.sin(t * 6 + Math.PI) * 0.25;
      } else {
        const breathe = 1 + Math.sin(t * 1.2) * 0.02;
        world.bot.scale.set(breathe, 1, breathe);
      }

      // steam
      world.steamSprites.forEach((s, i) => {
        const local = (t + s.userData.phase) % 2.2;
        s.position.y = 1.32 + local * 0.25;
        s.material.opacity = isDay ? Math.max(0, 0.5 - local * 0.25) : 0;
        s.position.x = -1.05 + Math.sin(t * 2 + i) * 0.03;
      });

      // Zzz
      world.zSprites.forEach((s, i) => {
        const local = (t + s.userData.phase) % 2.4;
        s.position.y = local * 0.55;
        s.position.x = local * 0.28;
        s.material.opacity = isDay ? 0 : Math.max(0, Math.sin((local / 2.4) * Math.PI)) * 0.9;
      });

      world.controls.update();
      world.renderer.render(world.scene, world.camera);
    }
    animate();

    /* ---------- cleanup ---------- */
    return () => {
      window.removeEventListener('resize', handleResize);
      const world = worldRef.current;
      if (world?.frameId) cancelAnimationFrame(world.frameId);
      world?.controls.dispose();

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => {
            if (m.map) m.map.dispose();
            if (m.emissiveMap) m.emissiveMap.dispose();
            m.dispose();
          });
        }
      });
      faceAwake.dispose();
      faceAsleep.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      worldRef.current = null;
    };
    // scene is built exactly once; mode changes are handled by the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- push mode changes into the running world (no rebuild) ---- */
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.modeRef.current = mode;
    world.target = mode === 'day' ? PALETTE.day : PALETTE.night;
    world.faceMat.map = mode === 'day' ? world.faceAwake : world.faceAsleep;
    world.faceMat.emissiveMap = world.faceMat.map;
    world.faceMat.needsUpdate = true;
    if (mode === 'day') {
      world.bot.scale.set(1, 1, 1);
    }
  }, [mode]);

  const handleManualToggle = useCallback((next) => {
    setAutoSync(false);
    setMode(next);
  }, []);

  const handleAuto = useCallback(() => {
    setAutoSync(true);
    setMode(isWorkingHour(getLaosHour()) ? 'day' : 'night');
  }, []);

  const isDay = mode === 'day';

  return (
    <div className="relative w-full h-full min-h-[550px] rounded-2xl overflow-hidden bg-slate-950 select-none shadow-2xl border border-slate-800">
      <div ref={mountRef} className="absolute inset-0" />

      {/* status badge & back button */}
      <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full backdrop-blur-md transition-all shadow-md active:scale-95 cursor-pointer"
          >
            ← ກັບຄືນ (Back)
          </button>
        )}
        <div
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md shadow-lg transition-colors duration-500 pointer-events-none ${
            isDay
              ? 'bg-emerald-400/10 border-emerald-300/30 text-emerald-100'
              : 'bg-sky-400/10 border-sky-300/30 text-sky-100'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isDay ? 'bg-emerald-400' : 'bg-sky-300'} animate-pulse`} />
          {isDay ? 'JOAH BOT: WORKING (Syncing with Odoo)' : 'JOAH BOT: SLEEPING (Store Closed)'}
        </div>
      </div>

      {/* auto-sync indicator */}
      <div className="pointer-events-none absolute top-4 right-4">
        <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md">
          {autoSync ? 'Auto · UTC+7 (Laos)' : 'Manual preview'}
        </div>
      </div>

      {/* controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-2xl border border-white/15 bg-white/5 p-1.5 backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={() => handleManualToggle('day')}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              !autoSync && isDay
                ? 'bg-orange-500 text-white shadow'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            Preview Day (Work)
          </button>
          <button
            type="button"
            onClick={() => handleManualToggle('night')}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              !autoSync && !isDay
                ? 'bg-slate-700 text-white shadow'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            Preview Night (Sleep)
          </button>
          <div className="mx-1 h-6 w-px bg-white/15" />
          <button
            type="button"
            onClick={handleAuto}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              autoSync
                ? 'bg-cyan-500/90 text-white shadow'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            Auto (Sync with local time)
          </button>
        </div>
      </div>
    </div>
  );
}
