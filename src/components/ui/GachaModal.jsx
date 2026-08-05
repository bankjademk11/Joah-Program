import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

// ─── IMPORT ALL 70 2D PIXEL ART GAME ASSETS ──────────────────────────────
import rustyDagger from '../../assets/GameAssests/swords/rusty_dagger.png';
import ironSword from '../../assets/GameAssests/swords/iron_sword.png';
import steelLongsword from '../../assets/GameAssests/swords/steel_longsword.png';
import bronzeGladius from '../../assets/GameAssests/swords/bronze_gladius.png';
import sharpKatana from '../../assets/GameAssests/swords/sharp_katana.png';
import heavyClaymore from '../../assets/GameAssests/swords/heavy_claymore.png';
import serratedBlade from '../../assets/GameAssests/swords/serrated_blade.png';
import guardsRapier from '../../assets/GameAssests/swords/guards_rapier.png';
import silverScimitar from '../../assets/GameAssests/swords/silver_scimitar.png';
import flamingBroadsword from '../../assets/GameAssests/swords/flaming_broadsword.png';
import frozenCutlass from '../../assets/GameAssests/swords/frozen_cutlass.png';
import poisonedDirk from '../../assets/GameAssests/swords/poisoned_dirk.png';
import herosBlade from '../../assets/GameAssests/swords/heros_blade.png';
import darkKnightsGreatsword from '../../assets/GameAssests/swords/dark_knights_greatsword.png';
import celestialSaber from '../../assets/GameAssests/swords/celestial_saber.png';
import dragonSlayer from '../../assets/GameAssests/swords/dragon_slayer.png';
import excalibur from '../../assets/GameAssests/swords/excalibur.png';
import voidReaper from '../../assets/GameAssests/swords/void_reaper.png';
import sunfuryBlade from '../../assets/GameAssests/swords/sunfury_blade.png';
import soulEater from '../../assets/GameAssests/swords/soul_eater.png';

import woodenWand from '../../assets/GameAssests/magic/wooden_wand.png';
import apprenticeStaff from '../../assets/GameAssests/magic/apprentice_staff.png';
import boneWand from '../../assets/GameAssests/magic/bone_wand.png';
import oakGreatstaff from '../../assets/GameAssests/magic/oak_greatstaff.png';
import crystalWand from '../../assets/GameAssests/magic/crystal_wand.png';
import druidsBranch from '../../assets/GameAssests/magic/druids_branch.png';
import wizardsFocus from '../../assets/GameAssests/magic/wizards_focus.png';
import lightningRod from '../../assets/GameAssests/magic/lightning_rod.png';
import necromancersScepter from '../../assets/GameAssests/magic/necromancers_scepter.png';
import archmagesStaff from '../../assets/GameAssests/magic/archmages_staff.png';
import phoenixFeatherWand from '../../assets/GameAssests/magic/phoenix_feather_wand.png';
import abyssalTome from '../../assets/GameAssests/magic/abyssal_tome.png';
import staffOfTheGods from '../../assets/GameAssests/magic/staff_of_the_gods.png';
import starfallWand from '../../assets/GameAssests/magic/starfall_wand.png';
import infinityCatalyst from '../../assets/GameAssests/magic/infinity_catalyst.png';

import leatherTunic from '../../assets/GameAssests/armour/leather_tunic.png';
import clothRobe from '../../assets/GameAssests/armour/cloth_robe.png';
import chainmailShirt from '../../assets/GameAssests/armour/chainmail_shirt.png';
import ironPlate from '../../assets/GameAssests/armour/iron_plate.png';
import reinforcedLeather from '../../assets/GameAssests/armour/reinforced_leather.png';
import magesVestment from '../../assets/GameAssests/armour/mages_vestment.png';
import steelBreastplate from '../../assets/GameAssests/armour/steel_breastplate.png';
import elvenChain from '../../assets/GameAssests/armour/elven_chain.png';
import knightsPlate from '../../assets/GameAssests/armour/knights_plate.png';
import dragonscaleMail from '../../assets/GameAssests/armour/dragonscale_mail.png';
import paladinsArmour from '../../assets/GameAssests/armour/paladins_armour.png';
import shadowGarb from '../../assets/GameAssests/armour/shadow_garb.png';
import aegisOfKings from '../../assets/GameAssests/armour/aegis_of_kings.png';
import titansCuirass from '../../assets/GameAssests/armour/titans_cuirass.png';
import celestialRaiment from '../../assets/GameAssests/armour/celestial_raiment.png';

import woodenShield from '../../assets/GameAssests/helmets_shields/wooden_shield.png';
import ironHelmet from '../../assets/GameAssests/helmets_shields/iron_helmet.png';
import buckler from '../../assets/GameAssests/helmets_shields/buckler.png';
import greatHelmet from '../../assets/GameAssests/helmets_shields/great_helmet.png';
import kiteShield from '../../assets/GameAssests/helmets_shields/kite_shield.png';
import wingedHelm from '../../assets/GameAssests/helmets_shields/winged_helm.png';
import towerShield from '../../assets/GameAssests/helmets_shields/tower_shield.png';
import crownOfThorns from '../../assets/GameAssests/helmets_shields/crown_of_thorns.png';
import shieldOfValhalla from '../../assets/GameAssests/helmets_shields/shield_of_valhalla.png';
import dragonHelm from '../../assets/GameAssests/helmets_shields/dragon_helm.png';

import copperRing from '../../assets/GameAssests/accessories/copper_ring.png';
import stoneAmulet from '../../assets/GameAssests/accessories/stone_amulet.png';
import silverBand from '../../assets/GameAssests/accessories/silver_band.png';
import jadePendant from '../../assets/GameAssests/accessories/jade_pendant.png';
import goldRingOfPower from '../../assets/GameAssests/accessories/gold_ring_of_power.png';
import rubyAmulet from '../../assets/GameAssests/accessories/ruby_amulet.png';
import emeraldEye from '../../assets/GameAssests/accessories/emerald_eye.png';
import diamondChoker from '../../assets/GameAssests/accessories/diamond_choker.png';
import ringOfEternity from '../../assets/GameAssests/accessories/ring_of_eternity.png';
import heartOfTheWorld from '../../assets/GameAssests/accessories/heart_of_the_world.png';

// ─── RARITY CONFIG (LAO TRANSLATION) ──────────────────────────────────────
const RARITIES = {
  common: {
    id: 'common', name: 'COMMON', nameTH: 'ທຳມະດາ', grade: 'D',
    weight: 45, color: '#94a3b8', glow: '#94a3b8aa',
    bg1: '#1e293b', bg2: '#0f172a',
    particleColors: ['#94a3b8', '#cbd5e1', '#ffffff'],
    particleCount: 50, beamCount: 0, shake: false,
  },
  uncommon: {
    id: 'uncommon', name: 'UNCOMMON', nameTH: 'ພິເສດ', grade: 'C',
    weight: 30, color: '#22c55e', glow: '#22c55eaa',
    bg1: '#14532d', bg2: '#052e16',
    particleColors: ['#22c55e', '#4ade80', '#86efac', '#ffffff'],
    particleCount: 90, beamCount: 3, shake: false,
  },
  rare: {
    id: 'rare', name: 'RARE', nameTH: 'ຫາຍາກ', grade: 'B',
    weight: 15, color: '#3b82f6', glow: '#3b82f6aa',
    bg1: '#1e3a5f', bg2: '#0f172a',
    particleColors: ['#3b82f6', '#60a5fa', '#93c5fd', '#ffffff'],
    particleCount: 150, beamCount: 5, shake: false,
  },
  epic: {
    id: 'epic', name: 'EPIC', nameTH: 'ທະລັງ', grade: 'A',
    weight: 7, color: '#a855f7', glow: '#a855f7aa',
    bg1: '#3b0764', bg2: '#0f172a',
    particleColors: ['#a855f7', '#c084fc', '#e879f9', '#f0abfc', '#ffffff'],
    particleCount: 250, beamCount: 8, shake: true,
  },
  legendary: {
    id: 'legendary', name: 'LEGENDARY', nameTH: 'ລະດັບຕຳນານ', grade: 'S / SS MYTHIC',
    weight: 3, color: '#f59e0b', glow: '#f59e0bcc',
    bg1: '#451a03', bg2: '#1c0a00',
    particleColors: ['#f59e0b', '#fbbf24', '#fde68a', '#fff700', '#ffffff', '#ff6600', '#ef4444'],
    particleCount: 450, beamCount: 12, shake: true,
  },
};

// ─── 70 PIXEL ART ITEMS POOL ──────────────────────────────────────────────
const ITEM_POOL = {
  common: [
    { name: 'Rusty Dagger', category: 'Swords', img: rustyDagger, flavor: '"Old dagger, still sharp"' },
    { name: 'Iron Sword', category: 'Swords', img: ironSword, flavor: '"Standard army iron sword"' },
    { name: 'Steel Longsword', category: 'Swords', img: steelLongsword, flavor: '"Well-balanced steel longsword"' },
    { name: 'Bronze Gladius', category: 'Swords', img: bronzeGladius, flavor: '"Roman-style bronze short sword"' },
    { name: 'Wooden Wand', category: 'Magic', img: woodenWand, flavor: '"Simple wooden wand for beginners"' },
    { name: 'Apprentice Staff', category: 'Magic', img: apprenticeStaff, flavor: '"Staff of a magic apprentice"' },
    { name: 'Bone Wand', category: 'Magic', img: boneWand, flavor: '"Wand made from ancient animal bone"' },
    { name: 'Leather Tunic', category: 'Armour', img: leatherTunic, flavor: '"Light leather tunic, easy to move"' },
    { name: 'Cloth Robe', category: 'Armour', img: clothRobe, flavor: '"Soft cloth robe for mages"' },
    { name: 'Chainmail Shirt', category: 'Armour', img: chainmailShirt, flavor: '"Mail shirt protects against slashes"' },
    { name: 'Wooden Shield', category: 'Helmets & Shields', img: woodenShield, flavor: '"Wooden shield with iron rim"' },
    { name: 'Iron Helmet', category: 'Helmets & Shields', img: ironHelmet, flavor: '"Full iron helmet for protection"' },
    { name: 'Copper Ring', category: 'Accessories', img: copperRing, flavor: '"Ancient patterned copper ring"' },
    { name: 'Stone Amulet', category: 'Accessories', img: stoneAmulet, flavor: '"Stone amulet engraved with runes"' },
  ],
  uncommon: [
    { name: 'Sharp Katana', category: 'Swords', img: sharpKatana, flavor: '"Sharp katana from the East"' },
    { name: 'Heavy Claymore', category: 'Swords', img: heavyClaymore, flavor: '"Powerful two-handed greatsword"' },
    { name: 'Serrated Blade', category: 'Swords', img: serratedBlade, flavor: '"Saw-toothed blade causing deep wounds"' },
    { name: "Guard's Rapier", category: 'Swords', img: guardsRapier, flavor: '"Rapier of the knight guard"' },
    { name: 'Oak Greatstaff', category: 'Magic', img: oakGreatstaff, flavor: '"Ancient giant oak staff"' },
    { name: 'Crystal Wand', category: 'Magic', img: crystalWand, flavor: '"Crystal wand shimmering with magic"' },
    { name: "Druid's Branch", category: 'Magic', img: druidsBranch, flavor: '"Magical branch of the druid"' },
    { name: 'Iron Plate', category: 'Armour', img: ironPlate, flavor: '"Sturdy iron plate armour"' },
    { name: 'Reinforced Leather', category: 'Armour', img: reinforcedLeather, flavor: '"Leather armour reinforced with rivets"' },
    { name: "Mage's Vestment", category: 'Armour', img: magesVestment, flavor: '"Vestment woven with mana threads"' },
    { name: 'Buckler', category: 'Helmets & Shields', img: buckler, flavor: '"Small round shield for quick parry"' },
    { name: 'Great Helmet', category: 'Helmets & Shields', img: greatHelmet, flavor: '"Giant knight helmet, powerful protection"' },
    { name: 'Silver Band', category: 'Accessories', img: silverBand, flavor: '"Pure silver ring with a shiny finish"' },
    { name: 'Jade Pendant', category: 'Accessories', img: jadePendant, flavor: '"Green jade pendant bringing good luck"' },
  ],
  rare: [
    { name: 'Silver Scimitar', category: 'Swords', img: silverScimitar, flavor: '"Silver curved sword reflecting moonlight"' },
    { name: 'Flaming Broadsword', category: 'Swords', img: flamingBroadsword, flavor: '"Broadsword engulfed in eternal flame"' },
    { name: 'Frozen Cutlass', category: 'Swords', img: frozenCutlass, flavor: '"Cutlass of freezing cold that chills targets"' },
    { name: 'Poisoned Dirk', category: 'Swords', img: poisonedDirk, flavor: '"Dagger coated with deadly poison"' },
    { name: "Wizard's Focus", category: 'Magic', img: wizardsFocus, flavor: '"Crystal focus for magic power"' },
    { name: 'Lightning Rod', category: 'Magic', img: lightningRod, flavor: '"Staff that calls lightning and thunder"' },
    { name: "Necromancer's Scepter", category: 'Magic', img: necromancersScepter, flavor: '"Scepter of the necromancer to summon spirits"' },
    { name: 'Steel Breastplate', category: 'Armour', img: steelBreastplate, flavor: '"Shiny steel breastplate armour"' },
    { name: 'Elven Chain', category: 'Armour', img: elvenChain, flavor: '"Lightweight elven chainmail"' },
    { name: "Knight's Plate", category: 'Armour', img: knightsPlate, flavor: '"Honorable knight plate armour"' },
    { name: 'Kite Shield', category: 'Helmets & Shields', img: kiteShield, flavor: '"Kite shield with knightly crest"' },
    { name: 'Winged Helm', category: 'Helmets & Shields', img: wingedHelm, flavor: '"Helm with angelic wings, beautifully crafted"' },
    { name: 'Gold Ring of Power', category: 'Accessories', img: goldRingOfPower, flavor: '"Gold ring that enhances magical power"' },
    { name: 'Ruby Amulet', category: 'Accessories', img: rubyAmulet, flavor: '"Stunning ruby amulet with fiery glow"' },
  ],
  epic: [
    { name: "Hero's Blade", category: 'Swords', img: herosBlade, flavor: '"Blade of the legendary hero"' },
    { name: "Dark Knight's Greatsword", category: 'Swords', img: darkKnightsGreatsword, flavor: '"Greatsword of the dark knight"' },
    { name: 'Celestial Saber', category: 'Swords', img: celestialSaber, flavor: '"Saber of the stars, shining with celestial light"' },
    { name: 'Dragon Slayer', category: 'Swords', img: dragonSlayer, flavor: '"Giant sword that slays ancient dragons"' },
    { name: "Archmage's Staff", category: 'Magic', img: archmagesStaff, flavor: '"Staff of the archmage, unparalleled power"' },
    { name: 'Phoenix Feather Wand', category: 'Magic', img: phoenixFeatherWand, flavor: '"Wand of phoenix feather that revives life"' },
    { name: 'Abyssal Tome', category: 'Magic', img: abyssalTome, flavor: '"Tome of abyssal magic from the deep"' },
    { name: 'Dragonscale Mail', category: 'Armour', img: dragonscaleMail, flavor: '"Mail of dragon scales, heat-resistant"' },
    { name: "Paladin's Armour", category: 'Armour', img: paladinsArmour, flavor: '"Paladin armour shining with holy light"' },
    { name: 'Shadow Garb', category: 'Armour', img: shadowGarb, flavor: '"Shadow garb that hides in darkness"' },
    { name: 'Tower Shield', category: 'Helmets & Shields', img: towerShield, flavor: '"Giant tower shield, an iron wall"' },
    { name: 'Crown of Thorns', category: 'Helmets & Shields', img: crownOfThorns, flavor: '"Crown of thorns with dark power"' },
    { name: 'Emerald Eye', category: 'Accessories', img: emeraldEye, flavor: '"Emerald eye that foresees the future"' },
    { name: 'Diamond Choker', category: 'Accessories', img: diamondChoker, flavor: '"Diamond choker sparkling with brilliance"' },
  ],
  legendary: [
    { name: 'Excalibur', category: 'Swords', img: excalibur, flavor: '⚔️ "Sacred sword Excalibur of the king" ⚔️' },
    { name: 'Void Reaper', category: 'Swords', img: voidReaper, flavor: '🌌 "Scythe that reaps souls from the void" 🌌' },
    { name: 'Sunfury Blade', category: 'Swords', img: sunfuryBlade, flavor: '🔥 "Blade of sun fury, bright as the sun" 🔥' },
    { name: 'Soul Eater', category: 'Swords', img: soulEater, flavor: '💀 "Sword that devours souls, thirsty for battle" 💀' },
    { name: 'Staff of the Gods', category: 'Magic', img: staffOfTheGods, flavor: '✨ "Staff of the gods, descended from heaven" ✨' },
    { name: 'Starfall Wand', category: 'Magic', img: starfallWand, flavor: '☄️ "Wand that calls down meteor showers" ☄️' },
    { name: 'Infinity Catalyst', category: 'Magic', img: infinityCatalyst, flavor: '🔮 "Catalyst of infinite potential" 🔮' },
    { name: 'Aegis of Kings', category: 'Armour', img: aegisOfKings, flavor: '🛡️ "Golden armour of the emperor, invincible" 🛡️' },
    { name: "Titan's Cuirass", category: 'Armour', img: titansCuirass, flavor: '⛰️ "Titan breastplate, strong as a mountain" ⛰️' },
    { name: 'Celestial Raiment', category: 'Armour', img: celestialRaiment, flavor: '🌟 "Celestial raiment of the goddess" 🌟' },
    { name: 'Shield of Valhalla', category: 'Helmets & Shields', img: shieldOfValhalla, flavor: '🛡️ "Shield of Valhalla, of the angelic knights" 🛡️' },
    { name: 'Dragon Helm', category: 'Helmets & Shields', img: dragonHelm, flavor: '🐉 "Dragon helm that commands the land" 🐉' },
    { name: 'Ring of Eternity', category: 'Accessories', img: ringOfEternity, flavor: '💍 "Ring of eternity, bound to time" 💍' },
    { name: 'Heart of the World', category: 'Accessories', img: heartOfTheWorld, flavor: '💎 "Heart of the world, pure power" 💎' },
  ],
};

function drawGacha() {
  const totalWeight = Object.values(RARITIES).reduce((s, r) => s + r.weight, 0);
  let rand = Math.random() * totalWeight;
  let rarity = RARITIES.common;
  for (const r of Object.values(RARITIES)) {
    rand -= r.weight;
    if (rand <= 0) { rarity = r; break; }
  }
  const pool = ITEM_POOL[rarity.id];
  const item = pool[Math.floor(Math.random() * pool.length)];
  return { rarity, item };
}

// ─── THREE.JS 3D SKULL CHEST CANVAS ──────────────────────────────────────────
function ThreeChestCanvas({ phase, rarity, onClick }) {
  const containerRef = useRef(null);
  const phaseRef = useRef(phase);
  const rarityRef = useRef(rarity);

  // Keep refs in sync without recreating scene
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { rarityRef.current = rarity; }, [rarity]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.offsetWidth || 300;
    const H = container.offsetHeight || 280;

    // ── Scene & Renderer ───────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06000f, 0.04);

    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 60);
    camera.position.set(0, 2.0, 5.2);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // ── Lights ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1a0022, 1.2));

    const rimLight = new THREE.DirectionalLight(0x7722cc, 1.4);
    rimLight.position.set(-3, 5, -2);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xffe5b0, 0.7);
    fillLight.position.set(3, 6, 5);
    fillLight.castShadow = true;
    scene.add(fillLight);

    const innerLight = new THREE.PointLight(0x00ff55, 0, 5);
    innerLight.position.set(0, 0.5, 0.3);
    scene.add(innerLight);

    const eyeLightL = new THREE.PointLight(0x00ff44, 3.5, 2.0);
    const eyeLightR = new THREE.PointLight(0x00ff44, 3.5, 2.0);
    scene.add(eyeLightL, eyeLightR);

    // ── Materials ──────────────────────────────────────────────────────────
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x1a0a30, roughness: 0.75, metalness: 0.15 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1c2535, roughness: 0.3, metalness: 0.85 });
    const ironAccentMat = new THREE.MeshStandardMaterial({ color: 0x2d3f52, roughness: 0.25, metalness: 0.9 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6c9a0, roughness: 0.55, metalness: 0.05 });
    const darkBoneMat = new THREE.MeshStandardMaterial({ color: 0x8c7a4a, roughness: 0.7, metalness: 0.0 });
    const voidMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1.0, metalness: 0.0 });
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xede8d0, roughness: 0.35, metalness: 0.05 });
    const eyeGlowMat = new THREE.MeshStandardMaterial({
      color: 0x00ff44, emissive: new THREE.Color(0x00ff44), emissiveIntensity: 4.0, roughness: 0, metalness: 0
    });

    // ── Chest Group ────────────────────────────────────────────────────────
    const chestGroup = new THREE.Group();
    scene.add(chestGroup);

    // Base body — dark sinister wood
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.05, 1.45), darkWoodMat);
    baseMesh.position.y = 0.525;
    baseMesh.castShadow = true;
    chestGroup.add(baseMesh);

    // Corner iron bolts (8 corners)
    const boltGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    [[-1.07, 0.08, 0.65], [1.07, 0.08, 0.65], [-1.07, 1.0, 0.65], [1.07, 1.0, 0.65],
     [-1.07, 0.08, -0.65], [1.07, 0.08, -0.65], [-1.07, 1.0, -0.65], [1.07, 1.0, -0.65]].forEach(([x, y, z]) => {
      const b = new THREE.Mesh(boltGeo, ironMat);
      b.position.set(x, y, z);
      chestGroup.add(b);
    });

    // Horizontal iron bands (3)
    const hBandGeo = new THREE.BoxGeometry(2.34, 0.1, 1.49);
    [0.15, 0.55, 1.0].forEach(y => {
      const b = new THREE.Mesh(hBandGeo, ironAccentMat);
      b.position.y = y;
      chestGroup.add(b);
    });

    // Vertical straps on front
    const vBandGeo = new THREE.BoxGeometry(0.08, 1.08, 0.08);
    [-0.55, 0.55].forEach(x => {
      const b = new THREE.Mesh(vBandGeo, ironMat);
      b.position.set(x, 0.525, 0.77);
      chestGroup.add(b);
    });

    // ── Lid Group (pivots at back-top of base) ─────────────────────────────
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 1.05, -0.72);
    chestGroup.add(lidGroup);

    // Lid body
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.58, 1.49), darkWoodMat);
    lidMesh.position.set(0, 0.29, 0.72);
    lidMesh.castShadow = true;
    lidGroup.add(lidMesh);

    // Lid iron bands
    [0.08, 0.5].forEach(y => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.1, 1.53), ironAccentMat);
      b.position.set(0, y, 0.72);
      lidGroup.add(b);
    });

    // ── SKULL on front-center of lid ───────────────────────────────────────
    const skullGroup = new THREE.Group();
    skullGroup.position.set(0, 0.22, 1.49);
    skullGroup.scale.setScalar(0.88);
    lidGroup.add(skullGroup);

    // Cranium (main dome)
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 14), boneMat);
    cranium.scale.set(1.0, 0.92, 0.88);
    cranium.position.y = 0.34;
    skullGroup.add(cranium);

    // Face plate (forward bulge)
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), boneMat);
    face.scale.set(0.9, 0.74, 0.52);
    face.position.set(0, 0.18, 0.14);
    skullGroup.add(face);

    // Cheekbones (L & R)
    [-0.22, 0.22].forEach((x, i) => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), boneMat);
      cheek.scale.set(1.0, 0.65, 0.58);
      cheek.position.set(x, 0.07, 0.17);
      skullGroup.add(cheek);
    });

    // Eye sockets — dark voids
    [[-0.165, 0.27], [0.165, 0.27]].forEach(([x, y]) => {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 10), voidMat);
      socket.position.set(x, y, 0.29);
      skullGroup.add(socket);
    });

    // Glowing eye orbs inside sockets
    [[-0.165, 0.27], [0.165, 0.27]].forEach(([x, y], i) => {
      const eyeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeGlowMat);
      eyeOrb.position.set(x, y, 0.32);
      skullGroup.add(eyeOrb);
    });

    // Update eye lights (will be synced in animate)
    eyeLightL.position.set(-0.165 * 0.88, 0.22 + 0.27 * 0.88, 1.0);
    eyeLightR.position.set(0.165 * 0.88, 0.22 + 0.27 * 0.88, 1.0);

    // Nose cavity
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.09), voidMat);
    nose.position.set(0, 0.1, 0.31);
    skullGroup.add(nose);

    // Temporal ridges (brow ridges above eyes)
    [-0.165, 0.165].forEach(x => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.1), darkBoneMat);
      brow.position.set(x, 0.38, 0.26);
      brow.rotation.z = x > 0 ? -0.2 : 0.2;
      skullGroup.add(brow);
    });

    // Upper teeth row (5 teeth)
    for (let i = -2; i <= 2; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.14, 0.062), toothMat);
      tooth.position.set(i * 0.082, -0.065, 0.29);
      skullGroup.add(tooth);
    }

    // ── Jaw Group (pivots at y = -0.07, z = 0.12) ─────────────────────────
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.07, 0.12);
    skullGroup.add(jawGroup);

    // Mandible body
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.19, 0.46), boneMat);
    jaw.position.set(0, -0.095, 0.2);
    jawGroup.add(jaw);

    // Side arches of jaw
    [-0.29, 0.29].forEach(x => {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.24, 0.38), boneMat);
      arch.position.set(x, -0.075, 0.14);
      jawGroup.add(arch);
    });

    // Lower teeth row (5 teeth)
    for (let i = -2; i <= 2; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), toothMat);
      tooth.position.set(i * 0.082, 0.01, 0.32);
      jawGroup.add(tooth);
    }

    // ── Animate Loop (reads phaseRef/rarityRef, no re-setup needed) ────────
    const clock = new THREE.Clock();
    let frameId;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const p = phaseRef.current;
      const r = rarityRef.current;

      // Sync eye lights to skull world position
      const skullWorldPos = new THREE.Vector3();
      skullGroup.getWorldPosition(skullWorldPos);
      eyeLightL.position.set(skullWorldPos.x - 0.145, skullWorldPos.y + 0.24, skullWorldPos.z + 0.35);
      eyeLightR.position.set(skullWorldPos.x + 0.145, skullWorldPos.y + 0.24, skullWorldPos.z + 0.35);

      if (p === 'chest') {
        // IDLE: gentle float, sway, eye pulse, jaw chatters slightly
        chestGroup.position.y = Math.sin(t * 1.9) * 0.1;
        chestGroup.rotation.y = Math.sin(t * 0.75) * 0.28;
        chestGroup.rotation.z = THREE.MathUtils.lerp(chestGroup.rotation.z, 0, 0.05);
        lidGroup.rotation.x = THREE.MathUtils.lerp(lidGroup.rotation.x, 0, 0.06);
        jawGroup.rotation.x = Math.sin(t * 2.8) * 0.04; // subtle chatter
        innerLight.intensity = THREE.MathUtils.lerp(innerLight.intensity, 0, 0.1);
        eyeLightL.intensity = 2.5 + Math.sin(t * 3.2) * 1.0;
        eyeLightR.intensity = eyeLightL.intensity;
        eyeGlowMat.emissiveIntensity = 3.0 + Math.sin(t * 3.2) * 1.2;
        eyeGlowMat.emissive.set(0x00ff44);
        eyeGlowMat.color.set(0x00ff44);
        eyeLightL.color.set(0x00ff44);
        eyeLightR.color.set(0x00ff44);

      } else if (p === 'opening') {
        // OPENING: violent shaking + lid flies open + jaw screams open
        chestGroup.position.y = Math.sin(t * 22) * 0.13;
        chestGroup.rotation.z = Math.sin(t * 42) * 0.11;
        chestGroup.rotation.y += 0.024;
        // Lid flies open
        lidGroup.rotation.x = THREE.MathUtils.lerp(lidGroup.rotation.x, -Math.PI * 0.78, 0.11);
        // Jaw drops dramatically (screaming skull!)
        jawGroup.rotation.x = THREE.MathUtils.lerp(jawGroup.rotation.x, Math.PI * 0.58, 0.1);
        // Explosion of inner light
        innerLight.intensity = THREE.MathUtils.lerp(innerLight.intensity, 28, 0.14);
        // Eyes flash white → rarity color
        eyeGlowMat.emissiveIntensity = 10 + Math.sin(t * 15) * 5;
        eyeGlowMat.emissive.set(0xffffff);
        eyeGlowMat.color.set(0xffffff);
        eyeLightL.intensity = 9 + Math.sin(t * 12) * 4;
        eyeLightR.intensity = eyeLightL.intensity;
        eyeLightL.color.set(0xffffff);
        eyeLightR.color.set(0xffffff);

      } else if (p === 'revealing' || p === 'result') {
        // REVEALED: fully open, slow spin, rarity-colored eyes
        lidGroup.rotation.x = THREE.MathUtils.lerp(lidGroup.rotation.x, -Math.PI * 0.8, 0.05);
        jawGroup.rotation.x = THREE.MathUtils.lerp(jawGroup.rotation.x, Math.PI * 0.58, 0.05);
        chestGroup.rotation.y += 0.013;
        chestGroup.rotation.z = THREE.MathUtils.lerp(chestGroup.rotation.z, 0, 0.05);
        innerLight.intensity = THREE.MathUtils.lerp(innerLight.intensity, 32, 0.05);

        if (r) {
          const rc = new THREE.Color(r.color);
          eyeGlowMat.emissive.lerp(rc, 0.1);
          eyeGlowMat.color.lerp(rc, 0.1);
          eyeGlowMat.emissiveIntensity = 5.5 + Math.sin(t * 5) * 2.0;
          eyeLightL.color.lerp(rc, 0.1);
          eyeLightR.color.lerp(rc, 0.1);
          innerLight.color.lerp(rc, 0.08);
        }
        eyeLightL.intensity = 7 + Math.sin(t * 4) * 2.5;
        eyeLightR.intensity = eyeLightL.intensity;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.offsetWidth || 300;
      const h = container.offsetHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      if (container && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []); // ← runs once only, phase/rarity read via ref

  return (
    <div
      ref={containerRef}
      className="w-72 h-64 cursor-pointer select-none"
      onClick={onClick}
    />
  );
}

// ─── CANVAS PARTICLE ENGINE ──────────────────────────────────────────────────
function useParticleEngine(canvasRef, active, rarity) {
  const animFrameRef = useRef(null);
  const particlesRef = useRef([]);

  const spawnParticle = useCallback((canvas, r) => {
    const colors = r.particleColors;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.0 + Math.random() * 6.5;
    const size = 3.0 + Math.random() * 6.0;
    const life = 0.7 + Math.random() * 1.3;
    return {
      x: cx + (Math.random() - 0.5) * 80,
      y: cy + (Math.random() - 0.5) * 80,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (Math.random() * 2.5),
      size,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: 1 / (life * 60),
      gravity: 0.06 + Math.random() * 0.12,
      sparkle: Math.random() > 0.35,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.25,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || !rarity) return;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    particlesRef.current = [];
    let frameCount = 0;
    const spawnRate = Math.max(1, Math.floor(60 / (rarity.particleCount / 10)));

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      frameCount++;
      if (frameCount % spawnRate === 0 && particlesRef.current.length < rarity.particleCount * 3.5) {
        for (let i = 0; i < 4; i++) {
          particlesRef.current.push(spawnParticle(canvas, rarity));
        }
      }

      // Light beams (Vampire Survivors style rays)
      if (rarity.beamCount > 0) {
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.5;
        for (let b = 0; b < rarity.beamCount; b++) {
          const angle = (b / rarity.beamCount) * Math.PI * 2 + frameCount * 0.015;
          const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * 450, cy + Math.sin(angle) * 450);
          grad.addColorStop(0, rarity.color + '66');
          grad.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * 700, cy + Math.sin(angle) * 700);
          ctx.lineWidth = 4 + Math.sin(frameCount * 0.12 + b) * 3;
          ctx.strokeStyle = grad;
          ctx.stroke();
        }
      }

      // Particles
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.alpha -= p.decay;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.sparkle) {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-p.size / 4, -p.size, p.size / 2, p.size * 2);
          }
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 14;
          ctx.fill();
        }
        ctx.restore();
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [active, rarity, spawnParticle, canvasRef]);
}

// ─── MAIN GACHA MODAL COMPONENT ────────────────────────────────────────────
export default function GachaModal({ isOpen, onClose }) {
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [shakeActive, setShakeActive] = useState(false);
  const canvasRef = useRef(null);
  const timeoutRef = useRef(null);

  useParticleEngine(canvasRef, phase === 'revealing' || phase === 'result', result?.rarity);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setResult(null);
      setShakeActive(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      setPhase('chest');
    }
  }, [isOpen]);

  const handleOpen = useCallback(() => {
    if (phase !== 'chest') return;
    const draw = drawGacha();
    setResult(draw);
    setPhase('opening');

    timeoutRef.current = setTimeout(() => {
      if (draw.rarity.shake) setShakeActive(true);
      setPhase('revealing');
      timeoutRef.current = setTimeout(() => {
        setShakeActive(false);
        setPhase('result');
        timeoutRef.current = null;
      }, 1200);
    }, 1000);
  }, [phase]);

  if (!isOpen) return null;

  const r = result?.rarity;
  const item = result?.item;
  const isRevealing = phase === 'revealing' || phase === 'result';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Outfit:wght@400;600;800;900&display=swap');

        @keyframes gacha-card-in {
          0%   { opacity: 0; transform: scale(0.3) translateY(120px) rotate(-8deg); }
          65%  { transform: scale(1.08) translateY(-10px) rotate(1deg); }
          100% { opacity: 1; transform: scale(1) translateY(0) rotate(0deg); }
        }
        @keyframes gacha-grade-stamp {
          0%   { opacity: 0; transform: scale(3.5) rotate(-25deg); }
          55%  { opacity: 1; transform: scale(0.92) rotate(4deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes gacha-screen-shake {
          0%,100% { transform: translate(0,0); }
          10%     { transform: translate(-12px, -10px); }
          20%     { transform: translate(12px, 10px); }
          30%     { transform: translate(-10px, 8px); }
          40%     { transform: translate(10px, -8px); }
          50%     { transform: translate(-6px, 8px); }
          60%     { transform: translate(6px, -8px); }
        }
        @keyframes gacha-pixel-float {
          0%,100% { transform: translateY(0px) scale(1.05); }
          50%     { transform: translateY(-10px) scale(1.15); }
        }
        @keyframes gacha-rarity-flash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes gacha-title-glow {
          0%,100% { text-shadow: 0 0 15px currentColor, 0 0 30px currentColor; }
          50%     { text-shadow: 0 0 30px currentColor, 0 0 60px currentColor, 0 0 90px currentColor; }
        }

        .gacha-shake-screen { animation: gacha-screen-shake 0.65s ease-in-out; }
        .gacha-card-reveal { animation: gacha-card-in 0.85s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .gacha-grade-stamp { animation: gacha-grade-stamp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .gacha-title-glow { animation: gacha-title-glow 2s ease-in-out infinite; }
        .pixel-art-img { image-rendering: pixelated; image-rendering: crisp-edges; }
      `}</style>

      {/* ── OVERLAY ──────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center font-['Outfit',sans-serif] ${shakeActive ? 'gacha-shake-screen' : ''}`}
        style={{ background: isRevealing && r ? `radial-gradient(ellipse at center, ${r.bg1} 0%, ${r.bg2} 100%)` : 'radial-gradient(ellipse at center, #1a1035 0%, #0a0a1a 100%)' }}
        onClick={phase === 'result' ? onClose : undefined}
      >
        {/* Particle Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: isRevealing ? 1 : 0, transition: 'opacity 0.5s' }}
        />

        {/* Rarity flash */}
        {phase === 'revealing' && r && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: r.color, animation: 'gacha-rarity-flash 0.8s ease-out forwards', zIndex: 1 }}
          />
        )}

        {/* ── CHEST PHASE ─────────────────────────────────────── */}
        {(phase === 'chest' || phase === 'opening') && (
          <div className="flex flex-col items-center gap-6 relative z-10">
            {/* Title - LAO */}
            <div className="text-center">
              <p className="text-amber-400/70 text-xs tracking-[0.5em] font-bold uppercase mb-2">THREE.JS 3D CHEST & 2D PIXEL ASSETS</p>
              <h2
                className="text-4xl sm:text-6xl font-black text-amber-300 gacha-title-glow"
                style={{ fontFamily: "'Cinzel Decorative', serif", letterSpacing: '0.05em' }}
              >
                GACHA BOX
              </h2>
              <p className="text-amber-400/60 text-sm mt-2 font-semibold">ສຸ່ມເອົາໄອເທມຍຸດໂທພັນບູຮານ 70 ລາຍການ!</p>
            </div>

            {/* THREE.JS 3D CHEST CANVAS */}
            <ThreeChestCanvas phase={phase} rarity={r} onClick={handleOpen} />

            {/* Action button - LAO */}
            <div
              className={`px-10 py-3.5 rounded-full font-black text-sm tracking-widest uppercase cursor-pointer select-none transition-all shadow-xl
                ${phase === 'chest' ? 'hover:scale-105 active:scale-95' : 'opacity-50'}
              `}
              style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#1c0a00', letterSpacing: '0.12em', boxShadow: '0 0 30px #f59e0b88' }}
              onClick={handleOpen}
            >
              {phase === 'chest' ? '✦ ເປີດກ່ອງ GACHA 3D ✦' : '⚡ ກຳລັງເປີດເຜີຍໄອເທມ... ⚡'}
            </div>

            <button onClick={onClose} className="text-amber-400/40 hover:text-amber-400/80 text-xs transition-colors font-bold">
              ✕ ປິດໜ້າຈໍ
            </button>
          </div>
        )}

        {/* ── RESULT CARD PHASE ───────────────────────────────── */}
        {isRevealing && r && item && (
          <div className="flex flex-col items-center gap-5 relative z-10 w-full max-w-sm px-4">

            {/* Rarity header - LAO */}
            <div
              className="text-center gacha-grade-stamp"
              style={{ animationDelay: '0.15s', fontFamily: "'Cinzel Decorative', serif" }}
            >
              <p style={{ color: r.color, fontSize: '0.75rem', letterSpacing: '0.45em', fontWeight: 900 }} className="uppercase mb-1">
                ── {r.nameTH} ──
              </p>
              <p style={{ color: r.color, fontSize: '2.4rem', fontWeight: 900, textShadow: `0 0 30px ${r.color}, 0 0 60px ${r.color}aa` }}>
                {r.name}
              </p>
            </div>

            {/* Main Loot Card */}
            <div
              className="gacha-card-reveal relative w-full rounded-3xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${r.bg1}, ${r.bg2})`,
                border: `2px solid ${r.color}aa`,
                boxShadow: `0 0 45px ${r.glow}, 0 0 90px ${r.glow.replace('aa', '33')}, inset 0 0 40px ${r.color}15`,
              }}
            >
              <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${r.color}, transparent)` }} />

              <div className="p-6 flex flex-col items-center gap-4">
                {/* 2D Pixel Art Asset Render */}
                <div
                  className="w-28 h-28 rounded-2xl flex items-center justify-center p-3 relative border border-white/10"
                  style={{
                    background: `radial-gradient(circle, ${r.color}33 0%, transparent 75%)`,
                    boxShadow: `0 0 35px ${r.color}66`,
                    animation: 'gacha-pixel-float 2s ease-in-out infinite',
                  }}
                >
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-full h-full object-contain pixel-art-img drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]"
                  />
                  {/* Category Tag */}
                  <span
                    className="absolute -bottom-2 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white"
                    style={{ background: r.color, boxShadow: `0 0 10px ${r.color}` }}
                  >
                    {item.category}
                  </span>
                </div>

                {/* Item Titles */}
                <div className="text-center mt-2">
                  <h3
                    className="text-2xl font-black mb-1"
                    style={{ color: r.color, textShadow: `0 0 12px ${r.color}` }}
                  >
                    {item.name}
                  </h3>
                  <p className="text-white/50 text-xs italic font-medium max-w-xs">{item.flavor}</p>
                </div>

                {/* Grade Badge */}
                <div
                  className="gacha-grade-stamp flex items-center gap-3 px-5 py-2 rounded-full"
                  style={{
                    background: `${r.color}22`,
                    border: `1.5px solid ${r.color}66`,
                    animationDelay: '0.35s',
                  }}
                >
                  <span className="text-white/60 text-xs font-black uppercase tracking-widest">GRADE</span>
                  <span
                    className="text-2xl font-black"
                    style={{ color: r.color, textShadow: `0 0 18px ${r.color}` }}
                  >
                    {r.grade}
                  </span>
                </div>

                {/* Sparkle stars */}
                {(r.id === 'epic' || r.id === 'legendary') && (
                  <div className="flex gap-1.5 text-sm" style={{ color: r.color }}>
                    {'✦'.repeat(r.id === 'legendary' ? 5 : 3)}
                  </div>
                )}
              </div>

              <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${r.color}, transparent)` }} />
            </div>

            {/* Action buttons - LAO */}
            <div className="flex gap-3 w-full">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all hover:scale-105 cursor-pointer"
                style={{ background: `${r.color}22`, color: r.color, border: `1px solid ${r.color}55` }}
              >
                ✕ ປິດໜ້າຈໍ
              </button>
              <button
                onClick={() => { setResult(null); setPhase('chest'); }}
                className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider text-white transition-all hover:scale-105 cursor-pointer shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${r.color}dd, ${r.color})`,
                  boxShadow: `0 0 25px ${r.color}66`,
                }}
              >
                🎲 ສຸ່ມກ່ອງອີກຄັ້ງ
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}