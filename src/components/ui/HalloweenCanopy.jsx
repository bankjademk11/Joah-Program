import React from 'react';
import { isHalloweenSeason } from './RainParticles';

/**
 * HalloweenCanopy (Kawaii Halloween Corner Accent)
 * Whimsical, cute Halloween corner foliage anchored to the upper-right corner.
 * Features:
 * - Curly midnight vine branch
 * - Cute hanging smiling mini-pumpkin (Jack-o'-lantern) with amber glow
 * - Cute smiling kawaii spider dangling on a delicate silk thread
 * - Gentle swaying wind physics (pointer-events-none)
 */
const HalloweenCanopy = () => {
    if (!isHalloweenSeason()) return null;

    return (
        <div className="fixed top-0 right-0 pointer-events-none select-none z-10 overflow-visible opacity-90 transition-opacity duration-1000">
            <style>{`
                @keyframes spookyVineSway {
                    0%, 100% {
                        transform: rotate(0deg) translate3d(0, 0, 0);
                    }
                    50% {
                        transform: rotate(1.2deg) translate3d(-3px, 4px, 0);
                    }
                }
                @keyframes pumpkinDangle {
                    0%, 100% {
                        transform: rotate(-3deg);
                    }
                    50% {
                        transform: rotate(4deg);
                    }
                }
                @keyframes spiderDangle {
                    0%, 100% {
                        transform: translateY(0px) rotate(-4deg);
                    }
                    50% {
                        transform: translateY(8px) rotate(5deg);
                    }
                }
                .halloween-vine-sway {
                    transform-origin: top right;
                    animation: spookyVineSway 6.5s ease-in-out infinite;
                    filter: drop-shadow(0 6px 18px rgba(168, 85, 247, 0.25));
                }
                .dangle-pumpkin {
                    transform-origin: 220px 105px;
                    animation: pumpkinDangle 4.5s ease-in-out infinite;
                }
                .dangle-spider {
                    transform-origin: 360px 85px;
                    animation: spiderDangle 3.8s ease-in-out infinite;
                }
            `}</style>

            <svg
                className="halloween-vine-sway w-[290px] sm:w-[390px] md:w-[470px] lg:w-[530px] h-auto pointer-events-none"
                viewBox="0 0 540 340"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    {/* Spooky Branch Gradient (Midnight Violet to Dark Plum) */}
                    <linearGradient id="spookyWoodGrad" x1="540" y1="0" x2="160" y2="240" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#1e1035" />
                        <stop offset="40%" stopColor="#2e1065" />
                        <stop offset="85%" stopColor="#4c1d95" />
                        <stop offset="100%" stopColor="#3b0764" />
                    </linearGradient>

                    {/* Glowing Pumpkin Gradient */}
                    <radialGradient id="pumpkinGrad" cx="50%" cy="45%" r="55%">
                        <stop offset="0%" stopColor="#fed7aa" />
                        <stop offset="45%" stopColor="#fb923c" />
                        <stop offset="90%" stopColor="#ea580c" />
                        <stop offset="100%" stopColor="#c2410c" />
                    </radialGradient>

                    {/* Jack-o'-lantern Inner Candle Light Glow */}
                    <radialGradient id="candleGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="60%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                    </radialGradient>
                </defs>

                {/* 1. MAIN SPOOKY VINE BRANCH */}
                <g className="spooky-branches">
                    {/* Main curvy branch */}
                    <path
                        d="M 545, -15 
                           C 470, 20  420, 40  350, 55 
                           C 280, 70  220, 100 160, 145 
                           C 130, 168  95, 192  60, 200 
                           C 85,  185 125, 160 165, 138 
                           C 220, 95  285, 65  355, 50 
                           C 422, 35  475, 15  545, -5 Z"
                        fill="url(#spookyWoodGrad)"
                    />

                    {/* Secondary upper curlicue twig */}
                    <path
                        d="M 400, 48 
                           C 350, 35 300, 28 240, 38 
                           C 190, 46 150, 68 110, 90
                           C 135, 78 175, 62 230, 52
                           C 285, 44 340, 46 385, 54 Z"
                        fill="url(#spookyWoodGrad)"
                    />

                    {/* Curly Vine Tendril */}
                    <path
                        d="M 160, 145 C 130, 152 105, 175 90, 210 C 80, 235 95, 255 115, 245 C 130, 235 125, 215 110, 215"
                        stroke="#6b21a8"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                    />

                    {/* Spiderweb Thread (Dropping down for cute spider) */}
                    <line x1="360" y1="52" x2="360" y2="125" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.2" strokeDasharray="2 2" />

                    {/* Pumpkin Thread (Dropping down for cute pumpkin) */}
                    <line x1="220" y1="88" x2="220" y2="148" stroke="#581c87" strokeWidth="2" strokeLinecap="round" />
                </g>

                {/* 2. CUTE DANGLING JACK-O'-LANTERN PUMPKIN */}
                <g className="dangle-pumpkin">
                    {/* Stem & Little Leaf */}
                    <path d="M 218, 142 C 218, 134 226, 132 228, 126" stroke="#15803d" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <circle cx="228" cy="133" r="3" fill="#22c55e" />

                    {/* Pumpkin Body (Chubby Cute Shapes) */}
                    <g filter="drop-shadow(0 4px 8px rgba(249, 115, 22, 0.45))">
                        {/* Outer Bulges */}
                        <ellipse cx="204" cy="158" rx="14" ry="17" fill="url(#pumpkinGrad)" />
                        <ellipse cx="236" cy="158" rx="14" ry="17" fill="url(#pumpkinGrad)" />
                        {/* Middle Bulges */}
                        <ellipse cx="212" cy="159" rx="15" ry="18" fill="url(#pumpkinGrad)" />
                        <ellipse cx="228" cy="159" rx="15" ry="18" fill="url(#pumpkinGrad)" />
                        {/* Center Bulge */}
                        <ellipse cx="220" cy="160" rx="16" ry="19" fill="url(#pumpkinGrad)" />
                    </g>

                    {/* Kawaii Smiling Eyes & Mouth (Glowing Warm Candle Light) */}
                    {/* Left Eye (Curved happy eye) */}
                    <path d="M 211, 153 C 211, 149 216, 149 216, 153 Z" fill="url(#candleGlow)" />
                    {/* Right Eye (Curved happy eye) */}
                    <path d="M 224, 153 C 224, 149 229, 149 229, 153 Z" fill="url(#candleGlow)" />
                    {/* Cute Smiling Mouth with 2 little teeth */}
                    <path d="M 213, 161 C 217, 168 223, 168 227, 161 C 225, 163 222, 163 220, 162 Z" fill="url(#candleGlow)" />
                    {/* Cute Pink Blush on Pumpkin */}
                    <circle cx="207" cy="162" r="3" fill="#f43f5e" opacity="0.6" />
                    <circle cx="233" cy="162" r="3" fill="#f43f5e" opacity="0.6" />
                </g>

                {/* 3. CUTE DANGLING KAWAII SPIDER */}
                <g className="dangle-spider">
                    {/* Spider Body */}
                    <circle cx="360" cy="138" r="12" fill="#1e1b4b" filter="drop-shadow(0 3px 6px rgba(124, 58, 237, 0.4))" />
                    <circle cx="360" cy="138" r="11" fill="#312e81" />

                    {/* Cute Spider Legs (8 little curved bent legs) */}
                    {/* Left Legs */}
                    <path d="M 352, 133 C 342, 128 338, 134 336, 140" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                    <path d="M 350, 138 C 340, 137 336, 142 334, 148" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                    <path d="M 352, 143 C 344, 145 340, 151 338, 156" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                    {/* Right Legs */}
                    <path d="M 368, 133 C 378, 128 382, 134 384, 140" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                    <path d="M 370, 138 C 380, 137 384, 142 386, 148" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                    <path d="M 368, 143 C 376, 145 380, 151 382, 156" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" fill="none" />

                    {/* Cute Big Anime Eyes */}
                    <circle cx="356" cy="136" r="3.2" fill="#ffffff" />
                    <circle cx="356" cy="136" r="1.8" fill="#0f172a" />
                    <circle cx="355.2" cy="135.2" r="0.8" fill="#ffffff" />

                    <circle cx="364" cy="136" r="3.2" fill="#ffffff" />
                    <circle cx="364" cy="136" r="1.8" fill="#0f172a" />
                    <circle cx="363.2" cy="135.2" r="0.8" fill="#ffffff" />

                    {/* Cute Pink Blush */}
                    <circle cx="353" cy="142" r="1.5" fill="#f43f5e" opacity="0.8" />
                    <circle cx="367" cy="142" r="1.5" fill="#f43f5e" opacity="0.8" />
                    {/* Cute tiny happy mouth */}
                    <path d="M 358, 141 Q 360, 143 362, 141" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" fill="none" />
                </g>

                {/* 4. CUTE LITTLE BATS FLUTTERING */}
                <g transform="translate(140, 75) scale(0.7) rotate(-15)">
                    {/* Little Bat Body */}
                    <path d="M 0,0 C -6,-10 -18,-12 -22,-6 C -20,2 -10,6 -4,3 L -2,8 L 0,6 L 2,8 L 4,3 C 10,6 20,2 22,-6 C 18,-12 6,-10 0,0 Z" fill="#4c1d95" opacity="0.85" />
                    {/* Tiny glowing yellow eyes */}
                    <circle cx="-2" cy="-1" r="0.8" fill="#fde047" />
                    <circle cx="2" cy="-1" r="0.8" fill="#fde047" />
                </g>
                <g transform="translate(85, 155) scale(0.5) rotate(20)">
                    <path d="M 0,0 C -6,-10 -18,-12 -22,-6 C -20,2 -10,6 -4,3 L -2,8 L 0,6 L 2,8 L 4,3 C 10,6 20,2 22,-6 C 18,-12 6,-10 0,0 Z" fill="#6d28d9" opacity="0.75" />
                </g>
            </svg>
        </div>
    );
};

export default HalloweenCanopy;
