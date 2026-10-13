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
    { theme: 'halloween', month: 9,  day: 1,  endMonth: 10, endDay: 1  },
    // Sakura      : 15 Mar → 15 May (every year)
    { theme: 'sakura',   month: 2,  day: 15, endMonth: 4,  endDay: 15 },
];

/**
 * Returns the calendar-correct theme for today.
 * If a season is active → return its theme.
 * Otherwise → 'cubes' (default off-season).
 */
const getSeasonTheme = () => {
    const now  = new Date();
    const yr   = now.getFullYear();
    const mon  = now.getMonth();   // 0-indexed
    const date = now.getDate();

    for (const s of SEASONS) {
        const start = new Date(yr, s.month,    s.day);
        const end   = new Date(yr, s.endMonth, s.endDay);
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
            const yr  = now.getFullYear();
            // Halloween window: Oct 1 → Nov 1
            const hwStart = new Date(yr, 9,  1);
            const hwEnd   = new Date(yr, 10, 1);
            if (now >= hwStart && now < hwEnd) {
                return 'halloween';                 // still Halloween 🎃
            } else {
                // Season over — clear the expired override silently
                try { localStorage.removeItem('joah_particle_mode'); } catch (_) {}
                return getSeasonTheme();            // fall through to calendar
            }
        }
        if (manual === 'sakura') return 'sakura';
        if (manual === 'cubes') return 'cubes';
        // 'halloween' manual is already handled above with expiry check
    } catch (_) {}

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

// Kawaii Skulls Theme Palettes
const SKULL_AURA_COLORS = [
    'rgba(168, 85, 247, 0.45)', // Neon Spooky Purple
    'rgba(249, 115, 22, 0.45)',  // Jack-o'-lantern Orange
    'rgba(236, 72, 153, 0.45)',  // Kawaii Pink
    'rgba(56, 189, 248, 0.45)',  // Ghostly Cyan
    'rgba(52, 211, 153, 0.45)'   // Phantom Mint
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
    const skullsRef = useRef([]);
    const embersRef = useRef([]);

    const dropCountRef = useRef(30);
    const rainSpeedMultRef = useRef(1.0);

    // Configs
    const CUBE_COUNT = 35;
    const PETAL_COUNT = 65;
    const POLLEN_COUNT = 30;
    const SKULL_COUNT = 48; // Kawaii floating skulls
    const EMBER_COUNT = 28; // Atmospheric glowing embers / candies
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

    // 💀 Kawaii Halloween Skull Generator
    const createKawaiiSkull = useCallback((w, h, randomY = true) => {
        const bodyPalettes = [
            { body: '#ffffff', shade: '#e2e8f0' }, // Ghost White
            { body: '#fdf4ff', shade: '#fae8ff' }, // Lilac Mist
            { body: '#f0fdfa', shade: '#ccfbf1' }, // Mint Phantom
            { body: '#fff7ed', shade: '#ffedd5' }, // Peach Pumpkin
            { body: '#faf5ff', shade: '#f3e8ff' }  // Purple Velvet
        ];
        const chosen = bodyPalettes[Math.floor(Math.random() * bodyPalettes.length)];
        const glow = SKULL_AURA_COLORS[Math.floor(Math.random() * SKULL_AURA_COLORS.length)];

        return {
            x: Math.random() * (w + 80) - 40,
            y: randomY ? Math.random() * h : -40 - Math.random() * 30,
            size: Math.random() * 7 + 13, // 13px - 20px (Crisp & cute)
            speedY: Math.random() * 0.8 + 0.55, // Gentle float downwards
            speedX: Math.random() * 0.5 + 0.2,  // Natural slight drift
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: Math.random() * 0.03 + 0.02,
            wobbleRadius: Math.random() * 1.4 + 0.8,
            angle: (Math.random() - 0.5) * 0.25,
            flip: Math.random() * Math.PI * 2,
            flipSpeed: Math.random() * 0.025 + 0.015,
            variant: Math.floor(Math.random() * 4), // 0: Classic Blush, 1: Tiny Witch Hat, 2: Kawaii Bow, 3: Star Forehead
            bodyColor: chosen.body,
            shadeColor: chosen.shade,
            glowColor: glow,
            blushColor: 'rgba(251, 113, 133, 0.65)',
            opacity: Math.random() * 0.25 + 0.75, // 0.75 - 1.0 (Crisp visibility)
        };
    }, []);

    // 🎃 Halloween Glow Embers & Candies Generator
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
        skullsRef.current = Array.from({ length: SKULL_COUNT }, () => createKawaiiSkull(w, h, true));
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
        // 💀 KAWAII SKULL VECTOR RENDERER
        // ========================================================
        const drawKawaiiSkull = (skull, isDark) => {
            ctx.save();
            ctx.translate(skull.x, skull.y);
            ctx.rotate(skull.angle + Math.sin(skull.wobble) * 0.12);

            // 3D subtle flip perspective
            const scaleX = Math.cos(skull.flip);
            ctx.scale(scaleX, 1);
            ctx.globalAlpha = skull.opacity;

            const size = skull.size;

            // Outer Spooky Glow
            if (isDark) {
                ctx.shadowColor = skull.glowColor;
                ctx.shadowBlur = 10;
            } else {
                ctx.shadowColor = 'rgba(0,0,0,0.12)';
                ctx.shadowBlur = 5;
            }

            // 1. Skull Head Contour (Chibi round head + cute chin)
            ctx.beginPath();
            ctx.arc(0, -size * 0.15, size * 0.65, Math.PI * 0.85, Math.PI * 0.15, false);
            ctx.quadraticCurveTo(size * 0.72, size * 0.25, size * 0.42, size * 0.55);
            ctx.quadraticCurveTo(size * 0.28, size * 0.78, 0, size * 0.8);
            ctx.quadraticCurveTo(-size * 0.28, size * 0.78, -size * 0.42, size * 0.55);
            ctx.quadraticCurveTo(-size * 0.72, size * 0.25, -Math.cos(Math.PI * 0.15) * size * 0.65, -size * 0.15 + Math.sin(Math.PI * 0.15) * size * 0.65);
            ctx.closePath();

            // Gradient fill: pearl white to soft ghostly pastel
            const grad = ctx.createLinearGradient(0, -size * 0.8, 0, size * 0.8);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.7, skull.bodyColor);
            grad.addColorStop(1, skull.shadeColor);
            ctx.fillStyle = grad;
            ctx.fill();

            // Subtle outline
            ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(30, 41, 59, 0.35)';
            ctx.lineWidth = Math.max(1, size * 0.05);
            ctx.stroke();

            // Clear shadow for crisp face features
            ctx.shadowBlur = 0;

            // 2. Rosy Blush Cheeks (Super Kawaii!)
            ctx.beginPath();
            ctx.ellipse(-size * 0.42, size * 0.18, size * 0.14, size * 0.08, 0, 0, Math.PI * 2);
            ctx.ellipse(size * 0.42, size * 0.18, size * 0.14, size * 0.08, 0, 0, Math.PI * 2);
            ctx.fillStyle = skull.blushColor;
            ctx.fill();

            // 3. Big Adorable Anime Eyes
            const eyeOffsetX = size * 0.26;
            const eyeOffsetY = -size * 0.05;
            const eyeRadiusX = size * 0.18;
            const eyeRadiusY = size * 0.22;

            const drawEye = (ex, ey) => {
                ctx.beginPath();
                ctx.ellipse(ex, ey, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
                ctx.fillStyle = isDark ? '#0f172a' : '#1e293b';
                ctx.fill();

                // Big sparkle highlight (top-left)
                ctx.beginPath();
                ctx.arc(ex - eyeRadiusX * 0.35, ey - eyeRadiusY * 0.35, eyeRadiusX * 0.45, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                // Secondary tiny highlight (bottom-right)
                ctx.beginPath();
                ctx.arc(ex + eyeRadiusX * 0.35, ey + eyeRadiusY * 0.25, eyeRadiusX * 0.22, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            };

            drawEye(-eyeOffsetX, eyeOffsetY);
            drawEye(eyeOffsetX, eyeOffsetY);

            // 4. Tiny Cute Inverted Heart Nose
            ctx.beginPath();
            const ny = size * 0.16;
            ctx.moveTo(0, ny + size * 0.07);
            ctx.bezierCurveTo(-size * 0.06, ny + size * 0.02, -size * 0.06, ny - size * 0.04, 0, ny);
            ctx.bezierCurveTo(size * 0.06, ny - size * 0.04, size * 0.06, ny + size * 0.02, 0, ny + size * 0.07);
            ctx.fillStyle = isDark ? '#475569' : '#64748b';
            ctx.fill();

            // 5. Cute Smile with Rounded Stitches
            ctx.beginPath();
            ctx.arc(0, size * 0.36, size * 0.24, 0.2, Math.PI - 0.2, false);
            ctx.strokeStyle = isDark ? '#475569' : '#64748b';
            ctx.lineWidth = Math.max(1.2, size * 0.06);
            ctx.stroke();

            // 2 cute little vertical tooth stitches
            [-size * 0.09, size * 0.09].forEach(tx => {
                ctx.beginPath();
                ctx.moveTo(tx, size * 0.48);
                ctx.lineTo(tx, size * 0.62);
                ctx.stroke();
            });

            // 6. Accessories by Variant!
            if (skull.variant === 1) {
                // 🧙 Tiny Witch Hat
                ctx.save();
                ctx.translate(-size * 0.2, -size * 0.65);
                ctx.rotate(-0.25);
                // Hat brim
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.45, size * 0.12, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#581c87';
                ctx.fill();
                // Hat cone
                ctx.beginPath();
                ctx.moveTo(-size * 0.28, 0);
                ctx.quadraticCurveTo(-size * 0.1, -size * 0.45, -size * 0.05, -size * 0.65);
                ctx.quadraticCurveTo(0, -size * 0.45, size * 0.28, 0);
                ctx.closePath();
                ctx.fillStyle = '#6b21a8';
                ctx.fill();
                // Orange ribbon band
                ctx.beginPath();
                ctx.ellipse(0, -size * 0.04, size * 0.22, size * 0.07, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#f97316';
                ctx.fill();
                ctx.restore();
            } else if (skull.variant === 2) {
                // 🎀 Cute Pink/Purple Bow
                ctx.save();
                ctx.translate(size * 0.42, -size * 0.45);
                ctx.rotate(0.35);
                // Left loop
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(-size * 0.24, -size * 0.18, -size * 0.24, size * 0.18, 0, 0);
                ctx.fillStyle = '#ec4899';
                ctx.fill();
                // Right loop
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(size * 0.24, -size * 0.18, size * 0.24, size * 0.18, 0, 0);
                ctx.fillStyle = '#f472b6';
                ctx.fill();
                // Center knot
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.07, 0, Math.PI * 2);
                ctx.fillStyle = '#fbbf24';
                ctx.fill();
                ctx.restore();
            } else if (skull.variant === 3) {
                // ✨ Cute Sparkle Star on Forehead
                ctx.save();
                ctx.translate(0, -size * 0.42);
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
                ctx.fillStyle = '#fde047';
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur = 6;
                ctx.fill();
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
                        // Glowing Spooky Ember Spark
                        ctx.beginPath();
                        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
                        ctx.fillStyle = e.color;
                        ctx.globalAlpha = pulseOp;
                        if (isDark) {
                            ctx.shadowColor = e.color;
                            ctx.shadowBlur = 6;
                        }
                        ctx.fill();
                    }
                    ctx.restore();
                });

                // 2. Kawaii Floating Skulls with Bobbing & Mouse Breeze
                skullsRef.current.forEach((skull) => {
                    skull.wobble += skull.wobbleSpeed;
                    skull.x += skull.speedX + Math.sin(skull.wobble) * skull.wobbleRadius;
                    skull.y += skull.speedY;
                    skull.flip += skull.flipSpeed;

                    // Playful mouse avoidance
                    const dx = mx - skull.x;
                    const dy = my - skull.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < MOUSE_RADIUS) {
                        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
                        skull.x -= (dx / dist) * force * 2.8;
                        skull.y -= (dy / dist) * force * 2.8;
                        skull.angle += force * 0.06;
                        skull.flip += force * 0.1;
                    }

                    // Screen recycling
                    if (skull.y > height + 35) {
                        skull.y = -35 - Math.random() * 30;
                        skull.x = Math.random() * (width + 100) - 50;
                    }
                    if (skull.x > width + 50) {
                        skull.x = -40;
                    } else if (skull.x < -50) {
                        skull.x = width + 40;
                    }

                    drawKawaiiSkull(skull, isDark);
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
    }, [createDrop, createCube, createPetal, createPollen, createKawaiiSkull, createHalloweenEmber, weatherData.isRaining]);

    return (
        <canvas
            ref={canvasRef}
            className={`fixed inset-0 w-full h-full pointer-events-none ${className}`}
            style={{ zIndex: 0 }}
        />
    );
};

export default SmartWeatherParticles;
