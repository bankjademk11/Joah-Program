import React, { useMemo } from 'react';

/**
 * SeasonalBackground — 🎃 Kawaii Halloween Edition (v2 Enhanced)
 *
 * Improvements over v1:
 *  - Richer sky: purple aurora ribbons + nebula wash + brighter star field
 *  - Moon: volumetric 3-ring halo, crisp craters, subtle purple rim light
 *  - Buildings: stone texture lines, brighter glowing windows, ridge caps, improved chimneys
 *  - Ground glow: warm amber pools under pumpkins, candlelit door spill
 *  - More foreground: right fence + lantern posts + cauldron + extra pumpkin cluster (left)
 *  - Better fog: 3-band layered mist system
 *  - Bats: larger + more variation in colour tint
 *  - Ghosts: glowing inner light, sparkle particles around them
 *  - Tombstones: moss stripe, epitaph line
 *
 * Props:
 *  - theme: 'night' (default) | 'light'
 *  - className
 */

const THEMES = {
    night: {
        skyTop:      '#0a0618',
        skyMid:      '#1e0f40',
        skyLow:      '#4a1f68',
        aurora1:     '#7c3aed',
        aurora2:     '#db2777',
        glow:        '#ff7a2f',
        glowOpacity: 0.42,
        stars:       1,
        moon:        '#fff8d6',
        moonRim:     '#c084fc',
        moonCrater:  '#e2cc88',
        far:         '#1a0a38',
        mid:         '#120830',
        near:        '#080418',
        edge:        '#4c1d95',
        edgeBright:  '#7c3aed',
        fog:         '#c4b5fd',
        fogOpacity:  0.18,
        ghost:       '#ede9fe',
        ghostGlow:   '#a78bfa',
        ghostStroke: 'none',
        web:         '#e9d5ff',
        webOpacity:  0.45,
        cloud:       '#6b21a8',
        windowCol:   '#ffb84d',
        windowGlow:  '#ff9500',
        groundGlow:  '#ff6a00',
    },
    light: {
        skyTop:      '#faf5ff',
        skyMid:      '#fde8d8',
        skyLow:      '#fff4e8',
        aurora1:     '#ddd6fe',
        aurora2:     '#fbcfe8',
        glow:        '#ffb067',
        glowOpacity: 0.28,
        stars:       0,
        moon:        '#fff1b8',
        moonRim:     '#e9d5ff',
        moonCrater:  '#f0dc92',
        far:         '#d3c6ea',
        mid:         '#a692cc',
        near:        '#6a578f',
        edge:        '#c0b0e0',
        edgeBright:  '#9f7aea',
        fog:         '#ffffff',
        fogOpacity:  0.5,
        ghost:       '#ffffff',
        ghostGlow:   '#d8b4fe',
        ghostStroke: '#e9d5ff',
        web:         '#7c3aed',
        webOpacity:  0.35,
        cloud:       '#ffffff',
        windowCol:   '#ffd580',
        windowGlow:  '#ffaa00',
        groundGlow:  '#ffb347',
    },
};

/* ── seeded RNG (deterministic, no rerenders) ──────────────────────────────── */
const seeded = (seed) => {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

/* ── Sub-components ─────────────────────────────────────────────────────────── */

const Bat = ({ x, y, s = 1, fill, delay = 0, tint = '#ffd84a' }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
        <g className="bg-anim bg-flap" style={{ animationDelay: `${delay}s` }}>
            <path fill={fill}
                d="M0,-7 C-5,-7 -7,-12 -9,-16 L-11,-7 C-20,-18 -38,-16 -50,-5
                   C-41,-7 -34,-2 -29,5 C-24,0 -18,0 -13,7
                   C-9,2 -4,5 0,12
                   C4,5 9,2 13,7 C18,0 24,0 29,5
                   C34,-2 41,-7 50,-5 C38,-16 20,-18 11,-7
                   L9,-16 C7,-12 5,-7 0,-7 Z"
            />
            {/* cute glowing eyes */}
            <circle cx="-3" cy="-4" r="1.4" fill={tint} />
            <circle cx="3"  cy="-4" r="1.4" fill={tint} />
        </g>
    </g>
);

const Ghost = ({ x, y, s = 1, delay = 0, fill, glowCol, stroke, hat = false }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
        <g className="bg-anim bg-float" style={{ animationDelay: `${delay}s` }}>
            {/* soft outer glow */}
            <ellipse cx="0" cy="0" rx="30" ry="46" fill={glowCol} opacity="0.25" filter="url(#softGlow)" />
            {/* body */}
            <path
                d="M-24,32 L-24,-4 C-24,-30 -13,-42 0,-42 C13,-42 24,-30 24,-4 L24,32
                   L16,23 L8,32 L0,23 L-8,32 L-16,23 Z"
                fill={fill} stroke={stroke} strokeWidth="1.5" opacity="0.94"
                filter="url(#softGlow)"
            />
            {/* inner warm candle light */}
            <ellipse cx="0" cy="0" rx="14" ry="22" fill={glowCol} opacity="0.18" />
            {/* eyes */}
            <ellipse cx="-9" cy="-10" rx="4" ry="5.5" fill="#1e0b40" />
            <ellipse cx="9"  cy="-10" rx="4" ry="5.5" fill="#1e0b40" />
            <circle  cx="-8" cy="-12" r="1.4" fill="#fff" />
            <circle  cx="10" cy="-12" r="1.4" fill="#fff" />
            {/* cute round mouth */}
            <ellipse cx="0" cy="6" rx="4.5" ry="6.5" fill="#1e0b40" />
            {/* blush */}
            <circle cx="-17" cy="2" r="4.5" fill="#ff9ec4" opacity="0.7" />
            <circle cx="17"  cy="2" r="4.5" fill="#ff9ec4" opacity="0.7" />
            {/* sparkle dots around ghost */}
            <circle cx="-28" cy="-18" r="1.5" fill="#e9d5ff" opacity="0.8" />
            <circle cx="30"  cy="-6"  r="1"   fill="#c4b5fd" opacity="0.7" />
            <circle cx="22"  cy="28"  r="1.2" fill="#e9d5ff" opacity="0.6" />
            {hat && (
                <g>
                    <polygon points="-16,-34 0,-66 16,-34" fill="#6d28d9" />
                    {/* hat brim */}
                    <rect x="-22" y="-34" width="44" height="6" rx="2" fill="#5b21b6" />
                    {/* hat band */}
                    <rect x="-14" y="-34" width="28" height="4" fill="#f59e0b" />
                    <circle cx="0" cy="-31" r="2.5" fill="#fde047" />
                </g>
            )}
        </g>
    </g>
);

const Pumpkin = ({ x, y, s = 1, face = 0 }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
        {/* ground glow */}
        <ellipse cx="0" cy="50" rx="55" ry="10" fill="#ff6a00" opacity="0.22" filter="url(#softGlow)" />
        {/* body lobes */}
        <ellipse cx="-26" cy="0" rx="31" ry="36" fill="url(#pumpkinGrad)" />
        <ellipse cx="26"  cy="0" rx="31" ry="36" fill="url(#pumpkinGrad)" />
        <ellipse cx="0"   cy="0" rx="33" ry="42" fill="url(#pumpkinGrad)" />
        {/* highlights */}
        <ellipse cx="-10" cy="-14" rx="6" ry="14" fill="#ffcf80" opacity="0.28" />
        {/* seam lines */}
        <path d="M-14,-38 C-24,-10 -24,10 -14,38" stroke="#b84a00" strokeWidth="2" fill="none" opacity="0.45" />
        <path d="M14,-38  C24,-10  24,10  14,38"  stroke="#b84a00" strokeWidth="2" fill="none" opacity="0.45" />
        {/* stem */}
        <path d="M-5,-40 C-5,-54 2,-62 9,-64 L13,-55 C7,-53 7,-47 7,-40 Z" fill="#3d6b20" />
        <path d="M9,-62 C22,-66 28,-56 23,-47" stroke="#5a9e30" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* face — warm glow */}
        <g fill="#ffec80" filter="url(#glow)" className="bg-anim bg-flicker"
           style={{ animationDelay: `${(x % 7) * 0.4}s` }}>
            {face === 0 && (<>
                <polygon points="-28,-8 -12,-8 -20,-24" />
                <polygon points="12,-8  28,-8  20,-24"  />
                <polygon points="0,0 -5,10 5,10" />
                <path d="M-28,18 L-20,30 L-10,20 L-2,30 L8,20 L16,30 L24,20 L30,18 Q0,50 -28,18 Z" />
            </>)}
            {face === 1 && (<>
                <polygon points="-30,-18 -12,-6 -28,-2" />
                <polygon points="30,-18  12,-6  28,-2"  />
                <polygon points="0,0 -5,10 5,10" />
                <path d="M-28,16 Q0,46 28,16 L22,24 L14,18 L8,28 L0,20 L-8,28 L-14,18 L-22,24 Z" />
            </>)}
            {face === 2 && (<>
                <circle cx="-15" cy="-9" r="7.5" />
                <circle cx="15"  cy="-9" r="7.5" />
                <polygon points="0,2 -5,12 5,12" />
                <ellipse cx="0" cy="24" rx="10" ry="13" />
            </>)}
        </g>
    </g>
);

/* Arched window with candle glow */
const Window = ({ x, y, w = 38, h = 60, delay = 0, bar, opacity = 1, col, glowCol }) => {
    const r = w / 2;
    const winCol  = col     || '#ffb84d';
    const winGlow = glowCol || '#ff9500';
    return (
        <g className="bg-anim bg-flicker" style={{ animationDelay: `${delay}s` }} opacity={opacity}>
            {/* outer glow bloom */}
            <path
                d={`M${x - 8},${y + h + 8} V${y + r} A${r + 8},${r + 8} 0 0 1 ${x + w + 8},${y + r} V${y + h + 8} Z`}
                fill={winGlow} opacity="0.18" filter="url(#softGlow)"
            />
            {/* window pane */}
            <path
                d={`M${x},${y + h} V${y + r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h} Z`}
                fill={winCol} filter="url(#glow)"
            />
            {/* glazing bars */}
            <path
                d={`M${x + r},${y} V${y + h} M${x},${y + h * 0.55} H${x + w}`}
                stroke={bar} strokeWidth="3" fill="none"
            />
        </g>
    );
};

/* Tombstone with moss stripe */
const Tombstone = ({ x, y, s = 1, fill, edge, tilt = 0 }) => (
    <g transform={`translate(${x} ${y}) rotate(${tilt}) scale(${s})`}>
        <path d="M0,65 V22 A24,24 0 0 1 48,22 V65 Z" fill={fill} stroke={edge} strokeWidth="2" />
        {/* cross */}
        <path d="M24,14 V42 M14,24 H34" stroke={edge} strokeWidth="3.5" strokeLinecap="round" />
        {/* epitaph line */}
        <rect x="10" y="44" width="28" height="3" rx="1" fill={edge} opacity="0.5" />
        <rect x="14" y="51" width="20" height="2" rx="1" fill={edge} opacity="0.4" />
        {/* moss */}
        <rect x="0"  y="58" width="48" height="5" rx="0" fill="#4a7a2a" opacity="0.4" />
    </g>
);

/* Lantern on fence post */
const Lantern = ({ x, y, col, glowCol }) => (
    <g transform={`translate(${x} ${y})`}>
        {/* post */}
        <rect x="-3" y="0" width="6" height="60" fill="#1a0a30" />
        {/* lantern box */}
        <g className="bg-anim bg-flicker" style={{ animationDelay: `${(x % 5) * 0.6}s` }}>
            <ellipse cx="0" cy="-18" rx="18" ry="18" fill={glowCol} opacity="0.2" filter="url(#softGlow)" />
            <rect x="-10" y="-30" width="20" height="24" rx="3" fill={col} filter="url(#glow)" />
            <polygon points="-12,-30 0,-42 12,-30" fill="#2a1060" />
            <line x1="-4" y1="-30" x2="-4" y2="-6"  stroke="#1a0a30" strokeWidth="1.5" />
            <line x1="4"  y1="-30" x2="4"  y2="-6"  stroke="#1a0a30" strokeWidth="1.5" />
            <line x1="-10" y1="-18" x2="10" y2="-18" stroke="#1a0a30" strokeWidth="1.5" />
        </g>
        {/* hanging hook */}
        <path d="M0,-30 Q6,-36 6,-42" stroke="#2a1060" strokeWidth="2" fill="none" />
    </g>
);

/* Cauldron */
const Cauldron = ({ x, y, s = 1 }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
        {/* legs */}
        <line x1="-20" y1="30" x2="-28" y2="55" stroke="#1a0a30" strokeWidth="5" strokeLinecap="round" />
        <line x1="20"  y1="30" x2="28"  y2="55" stroke="#1a0a30" strokeWidth="5" strokeLinecap="round" />
        {/* pot */}
        <ellipse cx="0" cy="30" rx="38" ry="32" fill="#1a0a30" />
        <ellipse cx="0" cy="10" rx="42" ry="14" fill="#2a1060" />
        {/* bubble brew */}
        <g className="bg-anim bg-flicker" filter="url(#glow)">
            <ellipse cx="0" cy="8" rx="34" ry="10" fill="#22c55e" opacity="0.7" />
            <circle cx="-12" cy="4"  r="6"  fill="#16a34a" opacity="0.85" />
            <circle cx="14"  cy="6"  r="4"  fill="#16a34a" opacity="0.75" />
            <circle cx="0"   cy="2"  r="5"  fill="#15803d" opacity="0.85" />
        </g>
        {/* handle */}
        <path d="M-42,14 Q0,-20 42,14" stroke="#2a1060" strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* steam wisps */}
        <g stroke="#a7f3d0" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"
           className="bg-anim bg-float">
            <path d="M-10,-2 Q-6,-18 -10,-34" />
            <path d="M0,0   Q4,-16  0,-32"   style={{ animationDelay: '1s' }} />
            <path d="M10,-2 Q6,-18  10,-34"  style={{ animationDelay: '2s' }} />
        </g>
    </g>
);

/* ── Main component ─────────────────────────────────────────────────────────── */
const SeasonalBackground = ({ className = '', theme = 'night' }) => {
    const T = THEMES[theme] || THEMES.night;

    /* Stars */
    const stars = useMemo(() => {
        const r = seeded(42);
        return Array.from({ length: 140 }, () => ({
            x: r() * 1920,
            y: r() * 580,
            sz: 0.7 + r() * 2.2,
            d:  1.8 + r() * 4.5,
            b:  r() * 5,
        }));
    }, []);

    /* Web (upper right corner) */
    const web = useMemo(() => {
        const cx = 1920, cy = 0, R = 400;
        const angles = [88, 102, 116, 130, 144, 158, 172].map(a => a * Math.PI / 180);
        const rings  = [55, 110, 175, 245, 315, 388];
        const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        const spokes = angles.map(a => {
            const [px, py] = pt(R, a);
            return `M${cx},${cy} L${px.toFixed(1)},${py.toFixed(1)}`;
        }).join(' ');
        const arcs = rings.map(r => {
            let d = '';
            for (let i = 0; i < angles.length - 1; i++) {
                const [x1, y1] = pt(r, angles[i]);
                const [x2, y2] = pt(r, angles[i + 1]);
                const [qx, qy] = pt(r * 0.85, (angles[i] + angles[i + 1]) / 2);
                if (i === 0) d += `M${x1.toFixed(1)},${y1.toFixed(1)} `;
                d += `Q${qx.toFixed(1)},${qy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} `;
            }
            return d;
        });
        return { spokes, arcs };
    }, []);

    /* Left fence pickets */
    const leftFence = useMemo(
        () => Array.from({ length: 17 }, (_, i) => ({ x: 6 + i * 32, top: 910 + ((i * 41) % 28) })),
        []
    );

    /* Right fence pickets */
    const rightFence = useMemo(
        () => Array.from({ length: 14 }, (_, i) => ({ x: 1386 + i * 37, top: 915 + ((i * 29) % 22) })),
        []
    );

    return (
        <div className={`fixed inset-0 w-full h-full pointer-events-none overflow-hidden select-none ${className}`}
             style={{ zIndex: -1 }}>
            <svg className="w-full h-full" viewBox="0 0 1920 1080"
                 preserveAspectRatio="xMidYMid slice" fill="none"
                 xmlns="http://www.w3.org/2000/svg">

                {/* ── ANIMATIONS ───────────────────────────────────────────── */}
                <style>{`
                    .bg-anim { transform-box: fill-box; transform-origin: center; }
                    .bg-float   { animation: bgFloat   6s ease-in-out infinite; }
                    .bg-flicker { animation: bgFlicker 3.4s linear infinite; }
                    .bg-twinkle { animation: bgTwinkle 4s  ease-in-out infinite; }
                    .bg-flap    { animation: bgFlap  0.42s ease-in-out infinite; }
                    .bg-fly     { animation: bgFly   38s   linear    infinite; }
                    .bg-drift   { animation: bgDrift 28s   ease-in-out infinite alternate; }
                    .bg-sway    { animation: bgSway  7s    ease-in-out infinite alternate;
                                  transform-origin: 50% 100%; }
                    .bg-aurora  { animation: bgAurora 12s  ease-in-out infinite alternate; }
                    @keyframes bgFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
                    @keyframes bgFlicker { 0%,100%{opacity:1} 18%{opacity:.76} 32%{opacity:1}
                                           55%{opacity:.86} 70%{opacity:.58} 82%{opacity:1} }
                    @keyframes bgTwinkle { 0%,100%{opacity:.2} 50%{opacity:1} }
                    @keyframes bgFlap    { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(.4)} }
                    @keyframes bgFly     { from{transform:translateX(0)} to{transform:translateX(2300px)} }
                    @keyframes bgDrift   { from{transform:translateX(-80px)} to{transform:translateX(80px)} }
                    @keyframes bgSway    { from{transform:rotate(-1.2deg)} to{transform:rotate(1.2deg)} }
                    @keyframes bgAurora  { 0%,100%{opacity:.14} 50%{opacity:.34} }
                    @media (prefers-reduced-motion:reduce){
                        .bg-anim,.bg-anim *{animation:none !important}
                    }
                `}</style>

                {/* ── DEFS ─────────────────────────────────────────────────── */}
                <defs>
                    <linearGradient id="customBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%"   stopColor={T.skyTop} />
                        <stop offset="52%"  stopColor={T.skyMid} />
                        <stop offset="100%" stopColor={T.skyLow} />
                    </linearGradient>

                    <radialGradient id="horizonGlow" cx="50%" cy="100%" r="65%">
                        <stop offset="0%"   stopColor={T.glow} stopOpacity={T.glowOpacity} />
                        <stop offset="100%" stopColor={T.glow} stopOpacity="0" />
                    </radialGradient>

                    {/* moon halo layers */}
                    <radialGradient id="moonHalo3" cx="50%" cy="50%" r="50%">
                        <stop offset="0%"   stopColor={T.moon}    stopOpacity="0.12" />
                        <stop offset="100%" stopColor={T.moon}    stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="moonHalo2" cx="50%" cy="50%" r="50%">
                        <stop offset="0%"   stopColor={T.moonRim} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={T.moonRim} stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="moonBody" cx="38%" cy="30%" r="75%">
                        <stop offset="0%"   stopColor="#fffff0" />
                        <stop offset="60%"  stopColor={T.moon} />
                        <stop offset="100%" stopColor="#e0d080" />
                    </radialGradient>

                    <radialGradient id="pumpkinGrad" cx="38%" cy="32%" r="78%">
                        <stop offset="0%"   stopColor="#ffc96e" />
                        <stop offset="50%"  stopColor="#ff7a1a" />
                        <stop offset="100%" stopColor="#c94e08" />
                    </radialGradient>

                    <linearGradient id="fogGrad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={T.fog} stopOpacity="0" />
                        <stop offset="100%" stopColor={T.fog} stopOpacity={T.fogOpacity} />
                    </linearGradient>
                    <linearGradient id="fogGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={T.fog} stopOpacity="0" />
                        <stop offset="100%" stopColor={T.fog} stopOpacity={T.fogOpacity * 2.2} />
                    </linearGradient>

                    <filter id="glow"     x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="7" result="b"/>
                        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="4" result="b"/>
                        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="bigGlow"  x="-80%" y="-80%" width="360%" height="360%">
                        <feGaussianBlur stdDeviation="18" result="b"/>
                        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                </defs>

                {/* ── LAYER 1: SKY ─────────────────────────────────────────── */}
                <rect width="1920" height="1080" fill="url(#customBgGrad)" />
                <rect width="1920" height="1080" fill="url(#horizonGlow)" />

                {/* Aurora / Nebula ribbons */}
                <g className="bg-anim bg-aurora" opacity="1">
                    <path d="M0,180 Q480,80 960,200 Q1440,320 1920,160 L1920,240 Q1440,400 960,280 Q480,160 0,260 Z"
                          fill={T.aurora1} opacity="0.12" />
                    <path d="M0,360 Q600,260 1200,380 Q1600,460 1920,340 L1920,400 Q1600,520 1200,440 Q600,320 0,420 Z"
                          fill={T.aurora2} opacity="0.08" />
                </g>

                {/* Stars */}
                <g opacity={T.stars}>
                    {stars.map((s, i) => (
                        <circle key={i} className="bg-anim bg-twinkle"
                            cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.sz.toFixed(2)}
                            fill="#fff"
                            style={{ animationDuration: `${s.d}s`, animationDelay: `${s.b}s` }} />
                    ))}
                </g>

                {/* ── LAYER 2: DISTANT ─────────────────────────────────────── */}
                <g id="layer-distant">
                    {/* Moon — 3-ring halo */}
                    <circle cx="1300" cy="175" r="360" fill="url(#moonHalo3)" />
                    <circle cx="1300" cy="175" r="210" fill="url(#moonHalo2)" />
                    {/* purple rim backlight */}
                    <circle cx="1300" cy="175" r="82" fill={T.moonRim} opacity="0.22"
                            filter="url(#bigGlow)" />
                    {/* moon disc */}
                    <circle cx="1300" cy="175" r="74" fill="url(#moonBody)" />
                    {/* craters */}
                    <circle cx="1272" cy="157" r="13" fill={T.moonCrater} opacity="0.5" />
                    <circle cx="1324" cy="204" r="18" fill={T.moonCrater} opacity="0.4" />
                    <circle cx="1340" cy="148" r="8"  fill={T.moonCrater} opacity="0.45" />
                    <circle cx="1283" cy="192" r="6"  fill={T.moonCrater} opacity="0.3" />
                    {/* rim lit highlight */}
                    <path d="M1238,158 Q1252,128 1290,122" stroke="#fffff8" strokeWidth="2"
                          strokeLinecap="round" fill="none" opacity="0.5" />

                    {/* Drifting clouds */}
                    <g className="bg-anim bg-drift" opacity="0.35">
                        <ellipse cx="1240" cy="218" rx="140" ry="16" fill={T.cloud} />
                        <ellipse cx="1360" cy="236" rx="100" ry="12" fill={T.cloud} />
                    </g>
                    <g className="bg-anim bg-drift" opacity="0.22"
                       style={{ animationDelay: '-11s', animationDuration: '36s' }}>
                        <ellipse cx="380" cy="130" rx="160" ry="15" fill={T.cloud} />
                        <ellipse cx="510" cy="152" rx="100" ry="11" fill={T.cloud} />
                    </g>

                    {/* Distant hills */}
                    <path d="M0,770 C220,706 400,752 580,726 C780,700 920,770 1120,748
                             C1320,724 1520,695 1720,736 C1820,757 1870,748 1920,728
                             L1920,1080 L0,1080 Z"
                          fill={T.far} />

                    {/* Distant bare trees (silhouette) */}
                    <g stroke={T.far} strokeLinecap="round" fill="none">
                        <path strokeWidth="7"
                              d="M610,742 C614,700 604,675 612,648 M610,692 C628,680 638,668 648,650
                                 M608,675 C594,667 588,658 582,644" />
                        <path strokeWidth="7"
                              d="M1370,748 C1374,708 1364,684 1372,658 M1372,700 C1388,688 1400,676 1410,658
                                 M1370,684 C1358,676 1352,668 1346,654" />
                        <path strokeWidth="5"
                              d="M820,755 C824,724 817,706 822,684 M820,712 C832,704 840,696 848,682" />
                    </g>
                </g>

                {/* ── LAYER 3: MIDGROUND ───────────────────────────────────── */}
                <g id="layer-midground">

                    {/* ===== LEFT HAUNTED HOUSE ===== */}
                    <g id="haunted-house-left">
                        {/* Ground hill */}
                        <path d="M0,908 C110,865 270,855 435,888 C510,902 565,934 645,964
                                 L645,1080 L0,1080 Z" fill={T.near} />

                        {/* Tall tower */}
                        <rect x="90" y="518" width="88" height="372" fill={T.mid} />
                        {/* Tower stone lines */}
                        <g stroke={T.edge} strokeWidth="1.5" opacity="0.5">
                            <path d="M90,580 H178 M90,640 H178 M90,700 H178 M90,760 H178 M90,820 H178" />
                        </g>
                        {/* Tower roof */}
                        <polygon points="74,520 134,362 194,520" fill={T.mid} />
                        {/* Roof ridge tiles */}
                        <g stroke={T.edge} strokeWidth="1.5" opacity="0.6">
                            <path d="M100,484 H168 M88,450 H180 M80,416 H188" />
                        </g>
                        {/* Tower flag */}
                        <line x1="134" y1="362" x2="134" y2="320" stroke={T.mid} strokeWidth="4" />
                        <polygon points="134,322 162,332 134,342" fill="#6d28d9" />

                        {/* Main house body */}
                        <rect x="168" y="398" width="234" height="492" fill={T.mid} />
                        {/* Wall stone texture */}
                        <g stroke={T.edge} strokeWidth="1.2" opacity="0.45">
                            <path d="M168,460 H402 M168,522 H402 M168,584 H402 M168,646 H402 M168,708 H402 M168,770 H402 M168,832 H402" />
                        </g>
                        {/* Main roof */}
                        <polygon points="114,406 275,152 444,406" fill={T.mid} />
                        {/* Roof ridge lines */}
                        <g stroke={T.edge} strokeWidth="2" opacity="0.6">
                            <path d="M222,254 H328 M190,304 H362 M158,354 H400" />
                        </g>
                        {/* Roof cap ridge */}
                        <path d="M114,406 L444,406" stroke={T.edgeBright} strokeWidth="3" opacity="0.5" />

                        {/* Chimney */}
                        <polygon points="336,218 370,206 378,316 344,302" fill={T.mid} />
                        <polygon points="330,220 376,204 378,214 332,230" fill={T.near} />
                        {/* Chimney smoke */}
                        <g stroke={T.fog} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.3"
                           className="bg-anim bg-float" style={{ animationDuration: '8s' }}>
                            <path d="M348,206 Q342,190 350,175" />
                            <path d="M358,202 Q365,185 358,170" style={{ animationDelay: '2s' }} />
                        </g>

                        {/* Gable vent */}
                        <ellipse cx="275" cy="218" rx="20" ry="20"
                                 fill="none" stroke={T.edge} strokeWidth="3" />
                        <g className="bg-anim bg-flicker" style={{ animationDelay: '1.3s' }}>
                            <ellipse cx="275" cy="218" rx="14" ry="14"
                                     fill={T.windowCol} filter="url(#glow)" />
                            <path d="M275,204 V232 M261,218 H289" stroke={T.mid} strokeWidth="2" />
                        </g>

                        {/* Windows */}
                        <Window x={252} y={276} w={42} h={74} delay={0}   bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} />
                        <Window x={113} y={576} w={40} h={64} delay={0.9} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} />
                        <Window x={200} y={508} w={40} h={64} delay={1.7} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} />
                        <Window x={328} y={508} w={40} h={64} delay={0.4} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} />
                        <Window x={200} y={660} w={40} h={64} delay={2.4} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} opacity={0.3} />
                        <Window x={328} y={660} w={40} h={64} delay={1.2} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} />

                        {/* Front door */}
                        <path d="M246,890 V823 A28,28 0 0 1 306,823 V890 Z"
                              fill={T.near} stroke={T.edge} strokeWidth="2.5" />
                        {/* Door light spill */}
                        <ellipse cx="276" cy="895" rx="40" ry="10"
                                 fill={T.windowGlow} opacity="0.22" filter="url(#softGlow)" />
                        <rect x="274" y="829" width="4" height="58" fill={T.windowCol} opacity="0.9" />
                        <rect x="226" y="890" width="98" height="10" rx="1" fill={T.near} />
                        <rect x="210" y="900" width="128" height="8" rx="1" fill={T.near} />

                        {/* Dead trees */}
                        <g stroke={T.mid} strokeLinecap="round" fill="none">
                            <path strokeWidth="18" d="M46,908 C50,838 34,796 42,738 C46,698 38,668 22,636" />
                            <path strokeWidth="9"  d="M42,742 C68,720 88,710 110,678" />
                            <path strokeWidth="7"  d="M40,700 C20,690 8,674 0,656" />
                            <path strokeWidth="6"  d="M22,636 C26,618 20,602 28,586
                                                       M22,636 C10,624 6,612 0,604" />
                            <path strokeWidth="4.5" d="M110,678 C120,668 124,658 126,644" />
                        </g>
                    </g>

                    {/* ===== RIGHT MANSION ===== */}
                    <g id="haunted-house-right">
                        <path d="M1920,890 C1818,858 1648,868 1496,908
                                 C1434,922 1374,955 1292,974 L1292,1080 L1920,1080 Z"
                              fill={T.near} />

                        {/* Main building */}
                        <rect x="1748" y="438" width="232" height="452" fill={T.mid} />
                        {/* Stone lines */}
                        <g stroke={T.edge} strokeWidth="1.2" opacity="0.4">
                            <path d="M1748,500 H1980 M1748,562 H1980 M1748,624 H1980 M1748,686 H1980 M1748,748 H1980 M1748,810 H1980" />
                        </g>
                        <polygon points="1716,444 1846,248 1990,444" fill={T.mid} />
                        <g stroke={T.edge} strokeWidth="2" opacity="0.55">
                            <path d="M1810,318 H1882 M1780,372 H1912" />
                        </g>
                        {/* Main roof cap */}
                        <path d="M1716,444 L1990,444" stroke={T.edgeBright} strokeWidth="3" opacity="0.45" />
                        <line x1="1846" y1="248" x2="1846" y2="206" stroke={T.mid} strokeWidth="5" />

                        {/* Small tower */}
                        <rect x="1692" y="608" width="70" height="282" fill={T.mid} />
                        <g stroke={T.edge} strokeWidth="1.2" opacity="0.4">
                            <path d="M1692,660 H1762 M1692,720 H1762 M1692,780 H1762" />
                        </g>
                        <polygon points="1680,610 1727,488 1774,610" fill={T.mid} />
                        <g stroke={T.edge} strokeWidth="1.5" opacity="0.5">
                            <path d="M1692,568 H1762 M1692,530 H1762" />
                        </g>
                        <line x1="1727" y1="490" x2="1727" y2="456" stroke={T.mid} strokeWidth="3.5" />
                        <polygon points="1727,458 1748,466 1727,474" fill="#7c3aed" />

                        {/* Chimney */}
                        <rect x="1910" y="296" width="38" height="96" fill={T.mid} />
                        <rect x="1904" y="292" width="50" height="12" fill={T.near} />

                        {/* Circular attic window */}
                        <circle cx="1846" cy="372" r="28" fill="none" stroke={T.edge} strokeWidth="3" />
                        <g className="bg-anim bg-flicker" style={{ animationDelay: '0.6s' }}>
                            <circle cx="1846" cy="372" r="22" fill={T.windowCol} filter="url(#glow)" />
                            <path d="M1846,350 V394 M1824,372 H1868" stroke={T.mid} strokeWidth="2.5" />
                        </g>

                        {/* Windows */}
                        <Window x={1706} y={678} w={36} h={58} delay={1.5} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} />
                        <Window x={1784} y={538} w={40} h={64} delay={0.2} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} />
                        <Window x={1870} y={538} w={40} h={64} delay={2.1} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} opacity={0.38} />
                        <Window x={1784} y={692} w={40} h={64} delay={1.0} bar={T.mid} col={T.windowCol} glowCol={T.windowGlow} />

                        {/* Front door */}
                        <path d="M1844,890 V820 A30,30 0 0 1 1904,820 V890 Z"
                              fill={T.near} stroke={T.edge} strokeWidth="2.5" />
                        <ellipse cx="1874" cy="895" rx="42" ry="10"
                                 fill={T.windowGlow} opacity="0.2" filter="url(#softGlow)" />
                        <rect x="1872" y="828" width="4" height="62" fill={T.windowCol} opacity="0.9" />
                    </g>

                    {/* ===== GHOST-FACE TREE (centre-right) ===== */}
                    <g id="ghost-face-tree" className="bg-anim bg-sway">
                        <path d="M1558,900 C1568,806 1553,706 1566,604 C1572,562 1553,522 1528,468
                                 L1550,464 C1572,498 1588,518 1600,540 C1608,498 1604,448 1592,394
                                 L1614,392 C1632,448 1636,498 1630,544 C1650,518 1672,488 1706,466
                                 L1712,484 C1680,514 1664,548 1654,598 C1666,706 1658,808 1668,900 Z"
                              fill={T.near} />
                        <g stroke={T.near} strokeLinecap="round" fill="none">
                            <path strokeWidth="6"
                                  d="M1528,468 C1514,450 1512,436 1502,424
                                     M1522,458 C1506,454 1498,446 1488,444" />
                            <path strokeWidth="6"
                                  d="M1706,466 C1724,448 1732,436 1746,428
                                     M1714,460 C1728,460 1740,456 1750,452" />
                            <path strokeWidth="5"
                                  d="M1592,394 C1586,376 1592,360 1586,344" />
                        </g>
                        {/* Glowing tree face */}
                        <g className="bg-anim bg-flicker" filter="url(#glow)"
                           style={{ animationDelay: '0.8s' }}>
                            <ellipse cx="1572" cy="660" rx="14" ry="18" fill="#ffec80" opacity="0.9" />
                            <ellipse cx="1642" cy="668" rx="14" ry="18" fill="#ffec80" opacity="0.9" />
                            <path d="M1578,730 L1588,718 L1600,732 L1610,718 L1620,732 L1630,718 L1642,730
                                     Q1610,768 1578,730 Z" fill="#ffb84d" />
                        </g>
                    </g>

                    {/* ===== SPIDER WEB (upper right) ===== */}
                    <g stroke={T.web} strokeOpacity={T.webOpacity} strokeWidth="1.8"
                       fill="none" strokeLinecap="round">
                        <path d={web.spokes} />
                        {web.arcs.map((d, i) => <path key={i} d={d} />)}
                    </g>
                    {/* Spider on web */}
                    <g transform="translate(1658,220)" filter="url(#softGlow)">
                        <line x1="0" y1="-20" x2="0" y2="0" stroke={T.web} strokeOpacity={T.webOpacity} strokeWidth="1.5" />
                        <ellipse cx="0" cy="8" rx="10" ry="7" fill={T.near} />
                        <ellipse cx="0" cy="-2" rx="7" ry="6" fill={T.near} />
                        {/* legs */}
                        {[-1,1].map(d => [[-14,-2],[-16,4],[-14,10]].map(([lx,ly],j) => (
                            <line key={`${d}${j}`} x1={d*5} y1={ly-6} x2={d*lx} y2={ly}
                                  stroke={T.near} strokeWidth="1.5" />
                        )))}
                        <circle cx="-3" cy="-4" r="1.2" fill="#fde047" />
                        <circle cx="3"  cy="-4" r="1.2" fill="#fde047" />
                    </g>
                </g>

                {/* ── LAYER 4: FOREGROUND ──────────────────────────────────── */}
                <g id="layer-foreground">

                    {/* Bats flying across */}
                    {[
                        { tx:-160, ty:245, dur:'36s', del:'-6s',   s:1.0, t:'#ffd84a' },
                        { tx:-160, ty:435, dur:'49s', del:'-25s',  s:0.65,t:'#c4b5fd' },
                        { tx:-160, ty:128, dur:'30s', del:'-18s',  s:0.8, t:'#fde047' },
                        { tx:-160, ty:340, dur:'55s', del:'-40s',  s:0.5, t:'#a7f3d0' },
                    ].map(({ tx, ty, dur, del, s, t }, i) => (
                        <g key={i} transform={`translate(${tx} ${ty})`}>
                            <g className="bg-anim bg-fly"
                               style={{ animationDuration: dur, animationDelay: del }}>
                                <Bat x={0} y={0} s={s} fill={T.near} tint={t} />
                            </g>
                        </g>
                    ))}

                    {/* Bats near buildings */}
                    <Bat x={88}   y={256} s={1.0} fill={T.near} tint="#ffd84a" delay={0}    />
                    <Bat x={448}  y={112} s={0.75} fill={T.near} tint="#c4b5fd" delay={0.2} />
                    <Bat x={506}  y={192} s={0.55} fill={T.near} tint="#fde047" delay={0.38}/>
                    <Bat x={1558} y={228} s={0.85} fill={T.near} tint="#a7f3d0" delay={0.12}/>
                    <Bat x={1696} y={118} s={1.05} fill={T.near} tint="#ffd84a" delay={0.28}/>
                    <Bat x={1800} y={285} s={0.6}  fill={T.near} tint="#c4b5fd" delay={0.45}/>

                    {/* Kawaii Ghosts */}
                    <Ghost x={516}  y={644} s={1.05} delay={0}   fill={T.ghost} glowCol={T.ghostGlow} stroke={T.ghostStroke} hat />
                    <Ghost x={1392} y={724} s={0.9}  delay={-2}  fill={T.ghost} glowCol={T.ghostGlow} stroke={T.ghostStroke} />
                    <Ghost x={1428} y={305} s={0.7}  delay={-4}  fill={T.ghost} glowCol={T.ghostGlow} stroke={T.ghostStroke} />
                    <Ghost x={58}   y={476} s={0.75} delay={-1}  fill={T.ghost} glowCol={T.ghostGlow} stroke={T.ghostStroke} />

                    {/* 3-band layered fog */}
                    <rect x="0" y="800" width="1920" height="280" fill="url(#fogGrad1)" />
                    <g className="bg-anim bg-drift" opacity={T.fogOpacity * 1.5}>
                        <ellipse cx="320"  cy="968" rx="360" ry="28" fill={T.fog} />
                        <ellipse cx="1620" cy="996" rx="400" ry="32" fill={T.fog} />
                        <ellipse cx="960"  cy="980" rx="280" ry="18" fill={T.fog} />
                    </g>
                    <rect x="0" y="1000" width="1920" height="80" fill="url(#fogGrad2)" />

                    {/* Tombstones */}
                    <Tombstone x={505} y={922} s={0.95} fill={T.near} edge={T.edge} tilt={-6} />
                    <Tombstone x={1336} y={928} s={1.05} fill={T.near} edge={T.edge} tilt={5} />
                    <Tombstone x={1390} y={948} s={0.75} fill={T.near} edge={T.edge} tilt={-3} />

                    {/* LEFT fence with lanterns */}
                    <g fill={T.near} stroke={T.edge} strokeWidth="1.8">
                        <rect x="0"   y="945" width="548" height="9" rx="1" />
                        <rect x="0"   y="990" width="548" height="9" rx="1" />
                        {leftFence.map((p, i) => (
                            <path key={i}
                                d={`M${p.x},${p.top + 16} L${p.x + 10},${p.top} L${p.x + 20},${p.top + 16}
                                    L${p.x + 20},1034 L${p.x},1034 Z`} />
                        ))}
                    </g>
                    <Lantern x={0}   y={940} col={T.windowCol} glowCol={T.windowGlow} />
                    <Lantern x={272} y={935} col={T.windowCol} glowCol={T.windowGlow} />
                    <Lantern x={548} y={942} col={T.windowCol} glowCol={T.windowGlow} />

                    {/* RIGHT fence */}
                    <g fill={T.near} stroke={T.edge} strokeWidth="1.8">
                        <rect x="1386" y="950" width="534" height="9" rx="1" />
                        <rect x="1386" y="995" width="534" height="9" rx="1" />
                        {rightFence.map((p, i) => (
                            <path key={i}
                                d={`M${p.x},${p.top + 14} L${p.x + 10},${p.top} L${p.x + 20},${p.top + 14}
                                    L${p.x + 20},1036 L${p.x},1036 Z`} />
                        ))}
                    </g>
                    <Lantern x={1386} y={945} col={T.windowCol} glowCol={T.windowGlow} />
                    <Lantern x={1660} y={940} col={T.windowCol} glowCol={T.windowGlow} />
                    <Lantern x={1920} y={948} col={T.windowCol} glowCol={T.windowGlow} />

                    {/* LEFT pumpkin cluster */}
                    <Pumpkin x={510}  y={964} s={1.1}  face={2} />
                    <Pumpkin x={575}  y={972} s={0.85} face={0} />

                    {/* RIGHT pumpkin cluster (enhanced) */}
                    <Pumpkin x={1436} y={966} s={1.35} face={2} />
                    <Pumpkin x={1610} y={976} s={1.7}  face={0} />
                    <Pumpkin x={1800} y={966} s={1.45} face={1} />
                    <Pumpkin x={1522} y={886} s={1.05} face={1} />
                    <Pumpkin x={1706} y={882} s={1.1}  face={2} />

                    {/* Cauldron (left foreground) */}
                    <Cauldron x={390} y={958} s={1.1} />

                </g>
            </svg>
        </div>
    );
};

export default SeasonalBackground;