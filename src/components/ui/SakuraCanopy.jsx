import React from 'react';
import { isSakuraSeason } from './RainParticles';

/**
 * SakuraCanopy (Corner Branch Foliage Accent)
 * A delicate, Japanese-inspired cherry blossom branch silhouette and cluster
 * anchored to the upper corner, swaying gracefully with natural breathing ease.
 * Active during the seasonal month (until end of October 2026).
 */
const SakuraCanopy = () => {
    if (!isSakuraSeason()) return null;

    return (
        <div className="fixed top-0 right-0 pointer-events-none select-none z-10 overflow-visible opacity-90 transition-opacity duration-1000">
            {/* CSS Animation embedded for smooth independent sway */}
            <style>{`
                @keyframes branchSwayMain {
                    0%, 100% {
                        transform: rotate(0deg) translate3d(0, 0, 0);
                    }
                    50% {
                        transform: rotate(1.5deg) translate3d(-4px, 5px, 0);
                    }
                }
                @keyframes branchSwaySub {
                    0%, 100% {
                        transform: rotate(0deg) scale(1);
                    }
                    50% {
                        transform: rotate(-1.2deg) scale(1.02);
                    }
                }
                .sakura-branch-sway {
                    transform-origin: top right;
                    animation: branchSwayMain 7s ease-in-out infinite;
                    filter: drop-shadow(0 6px 16px rgba(244, 63, 94, 0.22));
                }
                .sakura-sub-sway {
                    transform-origin: 320px 80px;
                    animation: branchSwaySub 5.5s ease-in-out infinite;
                }
            `}</style>

            <svg
                className="sakura-branch-sway w-[280px] sm:w-[380px] md:w-[460px] lg:w-[520px] h-auto pointer-events-none"
                viewBox="0 0 540 340"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    {/* Branch Wood Gradient */}
                    <linearGradient id="sakuraWoodGrad" x1="540" y1="0" x2="160" y2="240" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#2c1810" />
                        <stop offset="40%" stopColor="#4a2518" />
                        <stop offset="85%" stopColor="#633220" />
                        <stop offset="100%" stopColor="#3d1b10" />
                    </linearGradient>

                    {/* Flower Petal Gradients */}
                    <radialGradient id="sakuraFlowerGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ffe4e6" />
                        <stop offset="60%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#f43f5e" />
                    </radialGradient>

                    <radialGradient id="sakuraBlushGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="50%" stopColor="#fbcfe8" />
                        <stop offset="100%" stopColor="#f472b6" />
                    </radialGradient>

                    <linearGradient id="sakuraBudGrad" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#881337" />
                        <stop offset="60%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#fbcfe8" />
                    </linearGradient>

                    {/* 5-Petal Flower Symbol Definition */}
                    <g id="fullSakuraBloom">
                        {/* 5 Overlapping Petals */}
                        {[0, 72, 144, 216, 288].map((angle, i) => (
                            <path
                                key={i}
                                transform={`rotate(${angle})`}
                                d="M 0,0 C -6,-10 -11,-18 -4,-26 C -2,-28 0,-25 0,-24 C 0,-25 2,-28 4,-26 C 11,-18 6,-10 0,0 Z"
                                fill={i % 2 === 0 ? "url(#sakuraFlowerGlow)" : "url(#sakuraBlushGlow)"}
                                opacity="0.94"
                            />
                        ))}
                        {/* Central Pistils & Stamens */}
                        <circle cx="0" cy="0" r="4" fill="#fbbf24" opacity="0.95" />
                        <circle cx="0" cy="0" r="2" fill="#ef4444" />
                        {[30, 90, 150, 210, 270, 330].map((deg, j) => (
                            <line
                                key={j}
                                transform={`rotate(${deg})`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="-8"
                                stroke="#fef08a"
                                strokeWidth="0.8"
                                strokeLinecap="round"
                            />
                        ))}
                    </g>

                    {/* Side Profile Flower Symbol */}
                    <g id="sideSakuraBloom">
                        <path
                            d="M0,0 C-12,-8 -16,-22 -8,-28 C-3,-24 0,-18 0,-18 C0,-18 3,-24 8,-28 C16,-22 12,-8 0,0 Z"
                            fill="url(#sakuraFlowerGlow)"
                            opacity="0.9"
                        />
                        <path
                            d="M-3,-2 C-14,-4 -18,-14 -10,-20 C-5,-16 0,-12 0,-12 Z"
                            fill="url(#sakuraBlushGlow)"
                            opacity="0.85"
                        />
                        <circle cx="0" cy="-4" r="2.5" fill="#f59e0b" />
                    </g>

                    {/* Unopened Bud Symbol */}
                    <g id="sakuraBud">
                        <path
                            d="M0,0 C-3,-4 -4,-9 0,-13 C4,-9 3,-4 0,0 Z"
                            fill="url(#sakuraBudGrad)"
                        />
                        <path
                            d="M-1,0 C-2,2 0,4 0,4 C0,4 2,2 1,0 Z"
                            fill="#3f2e18"
                        />
                    </g>
                </defs>

                {/* ======================================================== */}
                {/* 1. MAIN BARK BRANCH (Curves from Top-Right Corner)     */}
                {/* ======================================================== */}
                <g className="sakura-branches">
                    {/* Primary thick trunk branch */}
                    <path
                        d="M 545, -15 
                           C 480, 25  430, 45  360, 60 
                           C 290, 75  230, 105 170, 150 
                           C 140, 172 105, 195 70,  205 
                           C 95,  190 135, 165 175, 142 
                           C 230, 100 295, 70  365, 55 
                           C 432, 40  485, 20  545, -5 Z"
                        fill="url(#sakuraWoodGrad)"
                    />

                    {/* Secondary upper branch reaching towards center */}
                    <path
                        d="M 410, 52 
                           C 360, 40 310, 32 250, 42 
                           C 200, 50 160, 72 120, 95
                           C 145, 82 185, 65 240, 56
                           C 295, 48 350, 50 395, 58 Z"
                        fill="url(#sakuraWoodGrad)"
                    />

                    {/* Tertiary lower drooping twig */}
                    <path
                        d="M 285, 88 
                           C 260, 120 235, 160 215, 210
                           C 200, 245 185, 275 160, 295
                           C 175, 275 190, 242 205, 208
                           C 225, 162 250, 122 275, 92 Z"
                        fill="url(#sakuraWoodGrad)"
                    />

                    {/* Small delicate twigs */}
                    <path
                        d="M 180, 145 C 150, 152 125, 168 95, 182"
                        stroke="#4a2518"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />
                    <path
                        d="M 330, 65 C 300, 85 270, 105 245, 115"
                        stroke="#4a2518"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <path
                        d="M 220, 205 C 195, 215 175, 235 150, 250"
                        stroke="#4a2518"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />
                </g>

                {/* ======================================================== */}
                {/* 2. SAKURA BLOSSOMS & CLUSTERS (Layered for Depth)       */}
                {/* ======================================================== */}

                {/* Sub-swaying branch tip cluster */}
                <g className="sakura-sub-sway">
                    {/* Far left branch tip */}
                    <use href="#fullSakuraBloom" x="70" y="205" transform="scale(0.85)" />
                    <use href="#sideSakuraBloom" x="95" y="180" transform="scale(0.75) rotate(-25 95 180)" />
                    <use href="#sakuraBud" x="55" y="215" transform="scale(0.9) rotate(45 55 215)" />
                    <use href="#sakuraBud" x="65" y="222" transform="scale(0.7) rotate(60 65 222)" />
                </g>

                {/* Upper branch cluster */}
                <g>
                    <use href="#fullSakuraBloom" x="120" y="95" transform="scale(0.9) rotate(15 120 95)" />
                    <use href="#fullSakuraBloom" x="155" y="75" transform="scale(1.05) rotate(-10 155 75)" />
                    <use href="#sideSakuraBloom" x="195" y="55" transform="scale(0.8) rotate(35 195 55)" />
                    <use href="#fullSakuraBloom" x="245" y="42" transform="scale(1.15) rotate(40 245 42)" />
                    <use href="#sakuraBud" x="105" y="105" transform="scale(0.9) rotate(-30 105 105)" />
                </g>

                {/* Lower hanging branch cluster */}
                <g>
                    <use href="#fullSakuraBloom" x="160" y="295" transform="scale(0.9) rotate(20 160 295)" />
                    <use href="#sideSakuraBloom" x="180" y="260" transform="scale(0.85) rotate(-40 180 260)" />
                    <use href="#fullSakuraBloom" x="210" y="210" transform="scale(1.1) rotate(10 210 210)" />
                    <use href="#sakuraBud" x="145" y="310" transform="scale(0.8) rotate(50 145 310)" />
                </g>

                {/* Main trunk junction lush blossom clusters */}
                <g>
                    {/* Foreground large full blooms */}
                    <use href="#fullSakuraBloom" x="275" y="92" transform="scale(1.25) rotate(-15 275 92)" />
                    <use href="#fullSakuraBloom" x="320" y="65" transform="scale(1.3) rotate(25 320 65)" />
                    <use href="#fullSakuraBloom" x="375" y="55" transform="scale(1.2) rotate(-5 375 55)" />
                    <use href="#sideSakuraBloom" x="295" y="125" transform="scale(0.95) rotate(-60 295 125)" />
                    <use href="#fullSakuraBloom" x="350" y="95" transform="scale(1.1) rotate(18 350 95)" />

                    {/* Corner anchor clusters (near screen edge) */}
                    <use href="#fullSakuraBloom" x="430" y="40" transform="scale(1.35) rotate(30 430 40)" />
                    <use href="#fullSakuraBloom" x="480" y="25" transform="scale(1.4) rotate(-20 480 25)" />
                    <use href="#sideSakuraBloom" x="460" y="65" transform="scale(1.0) rotate(45 460 65)" />
                    <use href="#fullSakuraBloom" x="515" y="15" transform="scale(1.25) rotate(10 515 15)" />
                </g>

                {/* Extra gentle loose petals ready to drift */}
                <g opacity="0.85">
                    <path
                        d="M 140, 160 C 136, 155 132, 148 138, 142 C 144, 146 142, 154 140, 160 Z"
                        fill="url(#sakuraFlowerGlow)"
                    />
                    <path
                        d="M 225, 125 C 220, 120 218, 112 225, 107 C 231, 111 228, 120 225, 125 Z"
                        fill="url(#sakuraBlushGlow)"
                    />
                </g>
            </svg>
        </div>
    );
};

export default SakuraCanopy;
