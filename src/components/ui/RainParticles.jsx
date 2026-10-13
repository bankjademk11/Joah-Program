import React, { useEffect, useRef, useState, useCallback } from 'react';

import { fetchKm8Weather, subscribeWeather } from '../../utils/weatherService';

/**

 * SmartWeatherParticles

 * Dynamic Particle System:

 * - Rain FX: Renders realistic Rain + Splashes when raining

 * - Halloween Theme (ACTIVE DEFAULT): Kawaii Chibi Skulls + Ambient Glow Embers + Candies

 * - Sakura Theme (PRESERVED): Floating & swaying Sakura Petals + Ambient Pollen

 * - Cubes Theme (PRESERVED): Floating Rubik Network Cubes

 * - Shares cached weatherService data (zero redundant API calls)

 */

// ── Season windows ──────────────────────────────────────────────────────────

// Each season: { start: Date, end: Date (exclusive), theme: string }

// When now < end → season is active; when now ≥ end → auto-fallback applies.

const SEASONS = [

    // Halloween  : 1 Oct → 1 Nov (every year)

    { theme: 'halloween', month: 9, day: 1, endMonth: 10, endDay: 1 },

    // Sakura      : 15 Mar → 15 May (every year)

    { theme: 'sakura', month: 2, day: 15, endMonth: 4, endDay: 15 },

];

/**

 * Returns the calendar-correct theme for today.

 * If a season is active → return its theme.

 * Otherwise → 'cubes' (default off-season).

 */

const getSeasonTheme = () => {

    const now = new Date();

    const yr = now.getFullYear();

    const mon = now.getMonth();   // 0-indexed

    const date = now.getDate();

    for (const s of SEASONS) {

        const start = new Date(yr, s.month, s.day);

        const end = new Date(yr, s.endMonth, s.endDay);

        if (now >= start && now < end) return s.theme;

    }

    return 'cubes';

};

// Theme Resolver

export const getActiveTheme = () => {

    try {

        const manual = localStorage.getItem('joah_particle_mode');

        // If a manual override is set, check whether it is still within its

        // valid season window. If the season has passed, clear the override

        // automatically so the user doesn't stay stuck on a stale theme.

        if (manual === 'halloween') {

            const now = new Date();

            const yr = now.getFullYear();

            // Halloween window: Oct 1 → Nov 1

            const hwStart = new Date(yr, 9, 1);

            const hwEnd = new Date(yr, 10, 1);

            if (now >= hwStart && now < hwEnd) {

                return 'halloween';                 // still Halloween 🎃

            } else {

                // Season over — clear the expired override silently

                try { localStorage.removeItem('joah_particle_mode'); } catch (_) { }

                return getSeasonTheme();            // fall through to calendar

            }

        }

        if (manual === 'sakura') return 'sakura';

        if (manual === 'cubes') return 'cubes';

        // 'halloween' manual is already handled above with expiry check

    } catch (_) { }

    // No override (or override was cleared) → use calendar season

    return getSeasonTheme();

};

export const isHalloweenSeason = () => getActiveTheme() === 'halloween';

export const isSakuraSeason = () => getActiveTheme() === 'sakura';

// Developer / User manual theme switch helper

if (typeof window !== 'undefined') {

    window.__setParticleTheme = (theme) => {

        // 'halloween' | 'sakura' | 'cubes' | 'auto'

        if (theme === 'auto') localStorage.removeItem('joah_particle_mode');

        else localStorage.setItem('joah_particle_mode', theme);

        window.location.reload();

    };

    window.__setParticleMode = window.__setParticleTheme;

}

// Sakura Palette (Preserved)

const SAKURA_PALETTES = [

    { base: '#f43f5e', tip: '#fbcfe8' },

    { base: '#fb7185', tip: '#ffe4e6' },

    { base: '#ec4899', tip: '#fdf2f8' },

    { base: '#fda4af', tip: '#ffffff' },

    { base: '#f472b6', tip: '#ffe4e6' },

];

// Kawaii Ghost Glow Palette

const GHOST_GLOW_COLORS = [

    [168, 85, 247], // Spooky Purple

    [249, 115, 22], // Pumpkin Orange

    [236, 72, 153], // Kawaii Pink

    [56, 189, 248], // Ghostly Cyan

    [250, 204, 21], // Lantern Gold

];

const SmartWeatherParticles = ({ className = '' }) => {

    const canvasRef = useRef(null);

    const animFrameRef = useRef(null);

    const mouseRef = useRef({ x: -1000, y: -1000 });

    const isDarkRef = useRef(false);

    // Weather state

    const [weatherData, setWeatherData] = useState({

        precipitation: 0,

        rain: 0,

        showers: 0,

        weatherCode: 0,

        isRaining: false,

        loading: true

    });

    // Particle pools

    const dropsRef = useRef([]);

    const splashesRef = useRef([]);

    const cubesRef = useRef([]);

    const petalsRef = useRef([]);

    const pollenRef = useRef([]);

    const ghostsRef = useRef([]);

    const embersRef = useRef([]);

    const dropCountRef = useRef(30);

    const rainSpeedMultRef = useRef(1.0);

    // Configs

    const CUBE_COUNT = 35;

    const PETAL_COUNT = 65;

    const POLLEN_COUNT = 30;

    const GHOST_COUNT = 20; // Kawaii floating ghosts (perf-friendly)

    const EMBER_COUNT = 18; // Atmospheric glow embers

    const CONNECTION_DIST = 180;

    const MOUSE_RADIUS = 200;

    const SPLASH_COUNT = 3;

    // Subscribe to shared Weather Service

    useEffect(() => {

        const unsubscribe = subscribeWeather((data) => {

            if (!data) return;

            const precip = data.precipitation ?? 0;

            dropCountRef.current = Math.min(180, Math.max(30, Math.round(precip * 40 + 50)));

            rainSpeedMultRef.current = Math.min(2.0, Math.max(0.7, 0.8 + precip * 0.3));

            setWeatherData({

                ...data,

                loading: false

            });

        });

        fetchKm8Weather();

        return () => {

            unsubscribe();

        };

    }, []);

    // 🌧️ Raindrop Generator

    const createDrop = useCallback((w, h, randomY = true) => {

        const speedMult = rainSpeedMultRef.current || 1;

        return {

            x: Math.random() * w,

            y: randomY ? Math.random() * h : -20 - Math.random() * 50,

            length: (Math.random() * 18 + 12) * Math.min(1.4, speedMult),

            speed: (Math.random() * 8 + 10) * speedMult,

            thickness: Math.random() * 1.5 + 0.8,

            opacity: Math.random() * 0.4 + 0.25,

            wind: (Math.random() - 0.2) * 1.2,

        };

    }, []);

    // 🌧️ Splash Generator

    const createSplash = (x, y) => {

        for (let i = 0; i < SPLASH_COUNT; i++) {

            splashesRef.current.push({

                x,

                y,

                vx: (Math.random() - 0.5) * 3,

                vy: -Math.random() * 3 - 1,

                radius: Math.random() * 2 + 1,

                opacity: 0.8,

                life: 1,

                decay: Math.random() * 0.05 + 0.04

            });

        }

    };

    // 🌸 Sakura Petal Generator (Preserved)

    const createPetal = useCallback((w, h, randomY = true) => {

        const palette = SAKURA_PALETTES[Math.floor(Math.random() * SAKURA_PALETTES.length)];

        return {

            x: Math.random() * (w + 100) - 50,

            y: randomY ? Math.random() * h : -30 - Math.random() * 40,

            size: Math.random() * 7 + 9,

            speedY: Math.random() * 1.1 + 0.75,

            speedX: Math.random() * 0.6 + 0.35,

            swayAngle: Math.random() * Math.PI * 2,

            swaySpeed: Math.random() * 0.02 + 0.012,

            swayRadius: Math.random() * 1.3 + 0.7,

            roll: Math.random() * Math.PI * 2,

            rollSpeed: (Math.random() - 0.5) * 0.02,

            flip: Math.random() * Math.PI * 2,

            flipSpeed: Math.random() * 0.035 + 0.015,

            color1: palette.base,

            color2: palette.tip,

            opacity: Math.random() * 0.35 + 0.45,

        };

    }, []);

    // 🌸 Pollen Generator (Preserved)

    const createPollen = useCallback((w, h, randomY = true) => {

        return {

            x: Math.random() * w,

            y: randomY ? Math.random() * h : -15,

            size: Math.random() * 1.5 + 1.0,

            speedY: Math.random() * 0.5 + 0.3,

            speedX: Math.random() * 0.4 + 0.15,

            phase: Math.random() * Math.PI * 2,

            opacity: Math.random() * 0.4 + 0.35

        };

    }, []);

    // 👻 Kawaii Ghost Generator — floats UPWARD, lightweight

    const createGhost = useCallback((w, h, randomY = true) => {

        const glowRgb = GHOST_GLOW_COLORS[Math.floor(Math.random() * GHOST_GLOW_COLORS.length)];

        const size = Math.random() * 10 + 18; // 18–28 px

        return {

            x: Math.random() * (w + 60) - 30,

            y: randomY ? Math.random() * h : h + size + Math.random() * 40,

            size,

            // float upward slowly

            speedY: -(Math.random() * 0.45 + 0.25),

            wobble: Math.random() * Math.PI * 2,

            wobbleSpeed: Math.random() * 0.022 + 0.012,

            wobbleAmp: Math.random() * 1.2 + 0.6,

            // very gentle tilt, no full flip (cheaper)

            tilt: (Math.random() - 0.5) * 0.18,

            // accessory: 0=plain, 1=witch hat, 2=bow

            variant: Math.floor(Math.random() * 3),

            glowRgb,

            opacity: Math.random() * 0.2 + 0.72,

        };

    }, []);

    // 🎃 Halloween Glow Embers Generator

    const createHalloweenEmber = useCallback((w, h, randomY = true) => {

        const colors = ['#f97316', '#a855f7', '#ec4899', '#fde047', '#34d399'];

        return {

            x: Math.random() * w,

            y: randomY ? Math.random() * h : -15,

            size: Math.random() * 2.2 + 1.2,

            speedY: Math.random() * 0.6 + 0.35,

            speedX: Math.random() * 0.4 + 0.15,

            phase: Math.random() * Math.PI * 2,

            color: colors[Math.floor(Math.random() * colors.length)],

            opacity: Math.random() * 0.4 + 0.4,

            isCandy: Math.random() > 0.6 // 40% are tiny floating candy corn

        };

    }, []);

    // 🧊 Cube Generator (Preserved fallback)

    const createCube = useCallback((w, h) => {

        const size = Math.random() * 15 + 10;

        const colors = ['#FFFFFF', '#FFD500', '#FF5800', '#C41E3A', '#0051BA', '#009E60'];

        return {

            x: Math.random() * w,

            y: Math.random() * h,

            size,

            vx: (Math.random() - 0.5) * 0.6,

            vy: (Math.random() - 0.5) * 0.6,

            angle: Math.random() * Math.PI * 2,

            angleV: (Math.random() - 0.5) * 0.03,

            mainColor: colors[Math.floor(Math.random() * colors.length)],

            topColor: colors[Math.floor(Math.random() * colors.length)],

            sideColor: colors[Math.floor(Math.random() * colors.length)],

            opacity: Math.random() * 0.5 + 0.3,

        };

    }, []);

    useEffect(() => {

        const canvas = canvasRef.current;

        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const checkDark = () => {

            isDarkRef.current = document.documentElement.classList.contains('dark');

        };

        checkDark();

        const observer = new MutationObserver(checkDark);

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        const resize = () => {

            const dpr = window.devicePixelRatio || 1;

            const pRect = canvas.parentElement?.getBoundingClientRect();

            const w = pRect && pRect.width > 0 ? pRect.width : window.innerWidth;

            const h = pRect && pRect.height > 0 ? pRect.height : window.innerHeight;

            canvas.width = w * dpr;

            canvas.height = h * dpr;

            canvas.style.width = w + 'px';

            canvas.style.height = h + 'px';

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        };

        resize();

        window.addEventListener('resize', resize);

        const w = canvas.width / (window.devicePixelRatio || 1);

        const h = canvas.height / (window.devicePixelRatio || 1);

        // Init pools

        dropsRef.current = Array.from({ length: dropCountRef.current }, () => createDrop(w, h, true));

        cubesRef.current = Array.from({ length: CUBE_COUNT }, () => createCube(w, h));

        petalsRef.current = Array.from({ length: PETAL_COUNT }, () => createPetal(w, h, true));

        pollenRef.current = Array.from({ length: POLLEN_COUNT }, () => createPollen(w, h, true));

        ghostsRef.current = Array.from({ length: GHOST_COUNT }, () => createGhost(w, h, true));

        embersRef.current = Array.from({ length: EMBER_COUNT }, () => createHalloweenEmber(w, h, true));

        const handleMouseMove = (e) => {

            const rect = canvas.getBoundingClientRect();

            mouseRef.current.x = e.clientX - rect.left;

            mouseRef.current.y = e.clientY - rect.top;

        };

        const handleMouseLeave = () => {

            mouseRef.current.x = -1000;

            mouseRef.current.y = -1000;

        };

        window.addEventListener('mousemove', handleMouseMove);

        window.addEventListener('mouseleave', handleMouseLeave);

        window.addEventListener('touchmove', (e) => {

            if (e.touches[0]) {

                const rect = canvas.getBoundingClientRect();

                mouseRef.current.x = e.touches[0].clientX - rect.left;

                mouseRef.current.y = e.touches[0].clientY - rect.top;

            }

        }, { passive: true });

        // ========================================================

        // 👻 KAWAII GHOST RENDERER  (no shadowBlur = smooth perf)

        // ========================================================

        const drawGhost = (g) => {

            const { x, y, size, tilt, wobble, variant, glowRgb, opacity } = g;

            const [r, gv, b] = glowRgb;

            ctx.save();

            ctx.globalAlpha = opacity;

            ctx.translate(x, y);

            ctx.rotate(tilt + Math.sin(wobble) * 0.08);

            // ── Soft radial glow (no shadowBlur = smooth perf) ──────────────

            const grd = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 1.5);

            grd.addColorStop(0, `rgba(${r},${gv},${b},0.22)`);

            grd.addColorStop(1, `rgba(${r},${gv},${b},0)`);

            ctx.fillStyle = grd;

            ctx.beginPath();

            ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);

            ctx.fill();

            // ── Ghost body ────────────────────────────────────────────────────

            const bodyGrad = ctx.createLinearGradient(0, -size, 0, size * 0.85);

            bodyGrad.addColorStop(0, 'rgba(255,255,255,0.98)');

            bodyGrad.addColorStop(0.6, `rgba(${r},${gv},${b},0.25)`);

            bodyGrad.addColorStop(1, `rgba(${r},${gv},${b},0.12)`);

            ctx.fillStyle = bodyGrad;

            ctx.beginPath();

            ctx.arc(0, -size * 0.18, size * 0.72, Math.PI, 0, false);

            ctx.lineTo(size * 0.72, size * 0.52);

            ctx.quadraticCurveTo(size * 0.52, size * 0.82, size * 0.24, size * 0.58);

            ctx.quadraticCurveTo(0, size * 0.88, -size * 0.24, size * 0.58);

            ctx.quadraticCurveTo(-size * 0.52, size * 0.82, -size * 0.72, size * 0.52);

            ctx.closePath();

            ctx.fill();

            ctx.strokeStyle = `rgba(${r},${gv},${b},0.35)`;

            ctx.lineWidth = Math.max(0.8, size * 0.04);

            ctx.stroke();

            // ── Eyes ──────────────────────────────────────────────────────────

            const ey = -size * 0.22;

            const ex = size * 0.24;

            const er = size * 0.10;

            [[- ex, ey], [ex, ey]].forEach(([cx, cy]) => {

                ctx.beginPath();

                ctx.ellipse(cx, cy, er, er * 1.25, 0, 0, Math.PI * 2);

                ctx.fillStyle = '#1e1b4b';

                ctx.fill();

                ctx.beginPath();

                ctx.arc(cx - er * 0.3, cy - er * 0.4, er * 0.38, 0, Math.PI * 2);

                ctx.fillStyle = '#fff';

                ctx.fill();

            });

            // ── Blush ─────────────────────────────────────────────────────────

            ctx.globalAlpha = opacity * 0.7;

            ctx.fillStyle = 'rgba(251,113,133,0.55)';

            ctx.beginPath();

            ctx.ellipse(-size * 0.38, size * 0.06, size * 0.14, size * 0.08, 0, 0, Math.PI * 2);

            ctx.fill();

            ctx.beginPath();

            ctx.ellipse(size * 0.38, size * 0.06, size * 0.14, size * 0.08, 0, 0, Math.PI * 2);

            ctx.fill();

            ctx.globalAlpha = opacity;

            // ── UwU mouth ─────────────────────────────────────────────────────

            ctx.beginPath();

            ctx.arc(0, size * 0.15, size * 0.14, 0.25, Math.PI - 0.25, false);

            ctx.strokeStyle = '#4c1d95';

            ctx.lineWidth = Math.max(1, size * 0.06);

            ctx.lineCap = 'round';

            ctx.stroke();

            // ── Accessories ───────────────────────────────────────────────────

            if (variant === 1) {

                // 🧙 Witch hat

                ctx.save();

                ctx.translate(size * 0.08, -size * 0.88);

                ctx.rotate(-0.18);

                ctx.beginPath();

                ctx.ellipse(0, 0, size * 0.52, size * 0.13, 0, 0, Math.PI * 2);

                ctx.fillStyle = '#4c1d95'; ctx.fill();

                ctx.beginPath();

                ctx.moveTo(-size * 0.3, 0);

                ctx.quadraticCurveTo(0, -size * 0.7, size * 0.3, 0);

                ctx.closePath();

                ctx.fillStyle = '#6d28d9'; ctx.fill();

                ctx.beginPath();

                ctx.ellipse(0, -size * 0.06, size * 0.23, size * 0.07, 0, 0, Math.PI * 2);

                ctx.fillStyle = '#f97316'; ctx.fill();

                ctx.restore();

            } else if (variant === 2) {

                // 🎀 Bow

                ctx.save();

                ctx.translate(size * 0.5, -size * 0.55);

                ctx.rotate(0.28);

                [[-1, '#ec4899'], [1, '#f472b6']].forEach(([dir, col]) => {

                    ctx.beginPath();

                    ctx.moveTo(0, 0);

                    ctx.bezierCurveTo(dir * size * 0.22, -size * 0.16, dir * size * 0.22, size * 0.16, 0, 0);

                    ctx.fillStyle = col; ctx.fill();

                });

                ctx.beginPath();

                ctx.arc(0, 0, size * 0.07, 0, Math.PI * 2);

                ctx.fillStyle = '#fbbf24'; ctx.fill();

                ctx.restore();

            }

            ctx.restore();

        };

        // 🌸 Sakura Petal Renderer (Preserved)

        const drawSakuraPetal = (size, color1, color2, opacity, isDark) => {

            ctx.save();

            ctx.globalAlpha = opacity;

            if (isDark) {

                ctx.shadowColor = 'rgba(251, 113, 133, 0.4)';

                ctx.shadowBlur = 6;

            }

            const grad = ctx.createLinearGradient(0, size, 0, -size);

            grad.addColorStop(0, color1);

            grad.addColorStop(0.7, color2);

            grad.addColorStop(1, '#ffffff');

            ctx.fillStyle = grad;

            ctx.beginPath();

            ctx.moveTo(0, size);

            ctx.bezierCurveTo(-size * 0.8, size * 0.35, -size * 0.85, -size * 0.45, -size * 0.28, -size * 0.95);

            ctx.quadraticCurveTo(0, -size * 0.65, size * 0.28, -size * 0.95);

            ctx.bezierCurveTo(size * 0.85, -size * 0.45, size * 0.8, size * 0.35, 0, size);

            ctx.closePath();

            ctx.fill();

            ctx.beginPath();

            ctx.moveTo(0, size * 0.85);

            ctx.quadraticCurveTo(0, 0, 0, -size * 0.35);

            ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.55)';

            ctx.lineWidth = Math.max(0.6, size * 0.05);

            ctx.stroke();

            ctx.restore();

        };

        // 🧊 Cube Renderer (Preserved)

        const drawIsometricCube = (x, y, size, angle, colors, opacity) => {

            const ch = size * 0.5;

            const cw = size * 0.866;

            ctx.save();

            ctx.translate(x, y);

            ctx.rotate(angle);

            ctx.globalAlpha = opacity;

            const drawFace = (path, color) => {

                ctx.fillStyle = color;

                ctx.beginPath();

                path();

                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.1)';

                ctx.lineWidth = 0.5;

                ctx.stroke();

            };

            drawFace(() => {

                ctx.moveTo(0, -size); ctx.lineTo(cw, -ch); ctx.lineTo(0, 0); ctx.lineTo(-cw, -ch); ctx.closePath();

            }, colors.top);

            drawFace(() => {

                ctx.moveTo(0, 0); ctx.lineTo(cw, -ch); ctx.lineTo(cw, ch); ctx.lineTo(0, size); ctx.closePath();

            }, colors.side);

            drawFace(() => {

                ctx.moveTo(0, 0); ctx.lineTo(-cw, -ch); ctx.lineTo(-cw, ch); ctx.lineTo(0, size); ctx.closePath();

            }, colors.main);

            ctx.restore();

        };

        // Main Animation Loop

        const animate = () => {

            const width = canvas.width / (window.devicePixelRatio || 1);

            const height = canvas.height / (window.devicePixelRatio || 1);

            ctx.clearRect(0, 0, width, height);

            const mx = mouseRef.current.x;

            const my = mouseRef.current.y;

            const isDark = isDarkRef.current;

            const currentTheme = getActiveTheme();

            if (weatherData.isRaining) {

                // ==========================================

                // 🌧️ MODE 1: RAIN PARTICLES

                // ==========================================

                const targetCount = dropCountRef.current;

                if (dropsRef.current.length < targetCount) {

                    for (let i = dropsRef.current.length; i < targetCount; i++) {

                        dropsRef.current.push(createDrop(width, height, true));

                    }

                } else if (dropsRef.current.length > targetCount) {

                    dropsRef.current.length = targetCount;

                }

                const mainDropColor = isDark ? '56, 189, 248' : '14, 165, 233';

                const accentDropColor = isDark ? '249, 115, 22' : '234, 88, 12';

                dropsRef.current.forEach((drop) => {

                    let windOffset = drop.wind;

                    const dx = mx - drop.x;

                    const dy = my - drop.y;

                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 150) {

                        windOffset += (dx / dist) * -3;

                    }

                    ctx.save();

                    ctx.beginPath();

                    const grad = ctx.createLinearGradient(drop.x, drop.y, drop.x + windOffset * 2, drop.y + drop.length);

                    grad.addColorStop(0, `rgba(${mainDropColor}, 0)`);

                    grad.addColorStop(0.7, `rgba(${mainDropColor}, ${drop.opacity})`);

                    grad.addColorStop(1, `rgba(${accentDropColor}, ${drop.opacity + 0.3})`);

                    ctx.strokeStyle = grad;

                    ctx.lineWidth = drop.thickness;

                    ctx.lineCap = 'round';

                    ctx.moveTo(drop.x, drop.y);

                    ctx.lineTo(drop.x + windOffset * 2, drop.y + drop.length);

                    ctx.stroke();

                    ctx.restore();

                    drop.y += drop.speed;

                    drop.x += windOffset;

                    if (drop.y > height - 10) {

                        createSplash(drop.x, height - 10);

                        drop.y = -20 - Math.random() * 30;

                        drop.x = Math.random() * width;

                    } else if (dist < 30) {

                        createSplash(drop.x, drop.y);

                        drop.y = -20 - Math.random() * 30;

                        drop.x = Math.random() * width;

                    }

                    if (drop.x < -20) drop.x = width + 20;

                    if (drop.x > width + 20) drop.x = -20;

                });

                for (let i = splashesRef.current.length - 1; i >= 0; i--) {

                    const s = splashesRef.current[i];

                    s.x += s.vx;

                    s.y += s.vy;

                    s.vy += 0.2;

                    s.life -= s.decay;

                    if (s.life <= 0) {

                        splashesRef.current.splice(i, 1);

                        continue;

                    }

                    ctx.save();

                    ctx.beginPath();

                    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);

                    ctx.fillStyle = `rgba(${accentDropColor}, ${s.life * 0.7})`;

                    ctx.fill();

                    ctx.restore();

                }

            } else if (currentTheme === 'halloween') {

                // ==========================================

                // 🎃 MODE 2: KAWAII HALLOWEEN SKULLS & EMBERS

                // ==========================================

                // 1. Atmospheric Glowing Embers & Floating Candy Corn

                embersRef.current.forEach((e) => {

                    e.phase += 0.03;

                    e.y += e.speedY;

                    e.x += e.speedX + Math.sin(e.phase) * 0.35;

                    if (e.y > height + 15) {

                        e.y = -15;

                        e.x = Math.random() * width;

                    }

                    if (e.x > width + 15) e.x = -15;

                    const pulseOp = e.opacity * (0.6 + 0.4 * Math.sin(e.phase));

                    ctx.save();

                    if (e.isCandy) {

                        // Tiny cute Candy Corn

                        ctx.translate(e.x, e.y);

                        ctx.rotate(e.phase * 0.5);

                        ctx.beginPath();

                        ctx.moveTo(0, -e.size * 1.5);

                        ctx.lineTo(e.size, e.size);

                        ctx.lineTo(-e.size, e.size);

                        ctx.closePath();

                        ctx.fillStyle = '#f97316';

                        ctx.globalAlpha = pulseOp;

                        ctx.fill();

                    } else {

                        // Glowing Spooky Ember Spark (radial gradient — no shadowBlur)

                        const eGrd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 2.2);

                        eGrd.addColorStop(0, e.color.replace(')', `,${pulseOp})`).replace('rgb', 'rgba'));

                        eGrd.addColorStop(0.5, e.color.replace(')', `,${pulseOp * 0.5})`).replace('rgb', 'rgba'));

                        eGrd.addColorStop(1, e.color.replace(')', ',0)').replace('rgb', 'rgba'));

                        ctx.beginPath();

                        ctx.arc(e.x, e.y, e.size * 2.2, 0, Math.PI * 2);

                        ctx.fillStyle = eGrd;

                        ctx.globalAlpha = 1;

                        ctx.fill();

                        // crisp centre dot

                        ctx.beginPath();

                        ctx.arc(e.x, e.y, e.size * 0.7, 0, Math.PI * 2);

                        ctx.fillStyle = '#fff';

                        ctx.globalAlpha = pulseOp * 0.85;

                        ctx.fill();

                    }

                    ctx.restore();

                });

                // 2. Kawaii Floating Ghosts — float upward, gentle wobble

                ghostsRef.current.forEach((g) => {

                    g.wobble += g.wobbleSpeed;

                    g.x += Math.sin(g.wobble) * g.wobbleAmp;

                    g.y += g.speedY; // negative = upward

                    // Soft mouse repel

                    const dx = mx - g.x;

                    const dy = my - g.y;

                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < MOUSE_RADIUS && dist > 0) {

                        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;

                        g.x -= (dx / dist) * force * 1.8;

                        g.y -= (dy / dist) * force * 1.8;

                    }

                    // Recycle: when ghost floats above top, re-spawn at bottom

                    if (g.y < -g.size * 2) {

                        g.y = height + g.size + Math.random() * 40;

                        g.x = Math.random() * (width + 60) - 30;

                    }

                    if (g.x > width + 40) g.x = -30;

                    if (g.x < -40) g.x = width + 30;

                    drawGhost(g, isDark);

                });

            } else if (currentTheme === 'sakura') {

                // ==========================================

                // 🌸 MODE 3: SAKURA BLOSSOMS (PRESERVED)

                // ==========================================

                pollenRef.current.forEach((p) => {

                    p.phase += 0.025;

                    p.y += p.speedY;

                    p.x += p.speedX + Math.sin(p.phase) * 0.3;

                    if (p.y > height + 15) {

                        p.y = -15;

                        p.x = Math.random() * width;

                    }

                    if (p.x > width + 15) p.x = -15;

                    const pulseOp = p.opacity * (0.6 + 0.4 * Math.sin(p.phase));

                    ctx.save();

                    ctx.beginPath();

                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

                    ctx.fillStyle = isDark ? `rgba(254, 205, 211, ${pulseOp})` : `rgba(251, 113, 133, ${pulseOp * 0.8})`;

                    if (isDark) {

                        ctx.shadowColor = 'rgba(251, 113, 133, 0.5)';

                        ctx.shadowBlur = 4;

                    }

                    ctx.fill();

                    ctx.restore();

                });

                petalsRef.current.forEach((petal) => {

                    petal.swayAngle += petal.swaySpeed;

                    petal.x += petal.speedX + Math.sin(petal.swayAngle) * petal.swayRadius;

                    petal.y += petal.speedY;

                    petal.roll += petal.rollSpeed;

                    petal.flip += petal.flipSpeed;

                    const dx = mx - petal.x;

                    const dy = my - petal.y;

                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < MOUSE_RADIUS) {

                        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;

                        petal.x -= (dx / dist) * force * 2.8;

                        petal.y -= (dy / dist) * force * 2.8;

                        petal.roll += force * 0.06;

                        petal.flip += force * 0.1;

                    }

                    if (petal.y > height + 30) {

                        petal.y = -30 - Math.random() * 30;

                        petal.x = Math.random() * (width + 100) - 50;

                    }

                    if (petal.x > width + 50) {

                        petal.x = -40;

                    } else if (petal.x < -50) {

                        petal.x = width + 40;

                    }

                    ctx.save();

                    ctx.translate(petal.x, petal.y);

                    ctx.rotate(petal.roll);

                    const scaleX = Math.cos(petal.flip);

                    ctx.scale(scaleX, 1);

                    drawSakuraPetal(petal.size, petal.color1, petal.color2, petal.opacity, isDark);

                    ctx.restore();

                });

            } else {

                // ==========================================

                // 🧊 MODE 4: RUBIK NETWORK CUBES (PRESERVED)

                // ==========================================

                const lineColor = isDark ? '249, 115, 22' : '234, 88, 12';

                cubesRef.current.forEach((c1, i) => {

                    const dxm = mx - c1.x;

                    const dym = my - c1.y;

                    const distm = Math.sqrt(dxm * dxm + dym * dym);

                    if (distm < MOUSE_RADIUS) {

                        const op = (1 - distm / MOUSE_RADIUS) * 0.4;

                        ctx.strokeStyle = `rgba(${lineColor}, ${op})`;

                        ctx.setLineDash([4, 4]);

                        ctx.beginPath();

                        ctx.moveTo(c1.x, c1.y);

                        ctx.lineTo(mx, my);

                        ctx.stroke();

                        ctx.setLineDash([]);

                    }

                    for (let j = i + 1; j < cubesRef.current.length; j++) {

                        const c2 = cubesRef.current[j];

                        const dx = c1.x - c2.x;

                        const dy = c1.y - c2.y;

                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < CONNECTION_DIST) {

                            const op = (1 - dist / CONNECTION_DIST) * 0.25;

                            ctx.strokeStyle = `rgba(${lineColor}, ${op})`;

                            ctx.lineWidth = 1;

                            ctx.beginPath();

                            ctx.moveTo(c1.x, c1.y);

                            ctx.lineTo(c2.x, c2.y);

                            ctx.stroke();

                        }

                    }

                });

                cubesRef.current.forEach((c) => {

                    c.x += c.vx;

                    c.y += c.vy;

                    c.angle += c.angleV;

                    const dx = mx - c.x;

                    const dy = my - c.y;

                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < MOUSE_RADIUS) {

                        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;

                        c.angle += force * 0.05;

                        c.x -= (dx / dist) * force * 2;

                        c.y -= (dy / dist) * force * 2;

                    }

                    if (c.x < -40) c.x = width + 40;

                    if (c.x > width + 40) c.x = -40;

                    if (c.y < -40) c.y = height + 40;

                    if (c.y > height + 40) c.y = -40;

                    drawIsometricCube(c.x, c.y, c.size, c.angle, {

                        main: c.mainColor,

                        top: c.topColor,

                        side: c.sideColor

                    }, c.opacity);

                });

            }

            animFrameRef.current = requestAnimationFrame(animate);

        };

        animFrameRef.current = requestAnimationFrame(animate);

        return () => {

            cancelAnimationFrame(animFrameRef.current);

            window.removeEventListener('resize', resize);

            window.removeEventListener('mousemove', handleMouseMove);

            window.removeEventListener('mouseleave', handleMouseLeave);

            observer.disconnect();

        };

    }, [createDrop, createCube, createPetal, createPollen, createHalloweenEmber, weatherData.isRaining]);

    return (

        <canvas

            ref={canvasRef}

            className={`fixed inset-0 w-full h-full pointer-events-none ${className}`}

            style={{ zIndex: 0 }}

        />

    );

};

export default SmartWeatherParticles;
