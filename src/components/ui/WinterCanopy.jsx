import React from 'react';
import { isWinterSeason } from './RainParticles';

/**
 * WinterCanopy (Early Winter / Frost & Starry Night Corner Accent)
 * Cozy, whimsical winter pine branch anchored to the upper-right corner.
 * Features:
 * - Frosted midnight pine branch with soft snow caps & evergreen needles
 * - Cute Kawaii Snow Owl perched on the branch wearing an orange Joah scarf
 * - Warm amber glowing mini-lantern dangling gently (matches background lanterns)
 * - Sparkling cyan ice-crystal star ornament dangling on a silver thread
 */
const WinterCanopy = () => {
    if (!isWinterSeason()) return null;

    return (
        <div className="fixed top-0 right-0 pointer-events-none select-none z-10 overflow-visible opacity-95 transition-opacity duration-1000">
            <style>{`
                @keyframes winterPineSway {
                    0%, 100% {
                        transform: rotate(0deg) translate3d(0, 0, 0);
                    }
                    50% {
                        transform: rotate(1.1deg) translate3d(-2px, 3px, 0);
                    }
                }
                @keyframes lanternSwing {
                    0%, 100% {
                        transform: rotate(-3.5deg);
                    }
                    50% {
                        transform: rotate(3.5deg);
                    }
                }
                @keyframes crystalDangle {
                    0%, 100% {
                        transform: translateY(0px) rotate(-5deg) scale(1);
                    }
                    50% {
                        transform: translateY(5px) rotate(5deg) scale(1.06);
                    }
                }
                @keyframes owlBreathe {
                    0%, 100% {
                        transform: translateY(0px) rotate(0deg);
                    }
                    50% {
                        transform: translateY(-2px) rotate(-1.5deg);
                    }
                }
                @keyframes starPulse {
                    0%, 100% {
                        opacity: 0.45;
                        transform: scale(0.85);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.15);
                    }
                }
                .winter-pine-sway {
                    transform-origin: top right;
                    animation: winterPineSway 7s ease-in-out infinite;
                    filter: drop-shadow(0 6px 18px rgba(56, 189, 248, 0.22));
                }
                .dangle-lantern {
                    transform-origin: 210px 104px;
                    animation: lanternSwing 4.8s ease-in-out infinite;
                }
                .dangle-crystal {
                    transform-origin: 390px 68px;
                    animation: crystalDangle 4.2s ease-in-out infinite;
                }
                .kawaii-owl {
                    transform-origin: 305px 68px;
                    animation: owlBreathe 3.8s ease-in-out infinite;
                }
                .twinkle-star-1 {
                    transform-origin: 135px 88px;
                    animation: starPulse 3.2s ease-in-out infinite;
                }
                .twinkle-star-2 {
                    transform-origin: 265px 145px;
                    animation: starPulse 2.6s ease-in-out infinite 1.1s;
                }
            `}</style>

            <svg
                className="winter-pine-sway w-[290px] sm:w-[390px] md:w-[470px] lg:w-[530px] h-auto pointer-events-none"
                viewBox="0 0 540 340"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    {/* Midnight Frosted Pine Wood Gradient */}
                    <linearGradient id="winterBranchGrad" x1="540" y1="0" x2="120" y2="210" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="50%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#334155" />
                    </linearGradient>

                    {/* Frosted Evergreen Pine Needles Gradient */}
                    <linearGradient id="pineNeedleGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0f2942" />
                        <stop offset="60%" stopColor="#164e63" />
                        <stop offset="100%" stopColor="#083344" />
                    </linearGradient>

                    {/* Soft Snow Cap Gradient */}
                    <linearGradient id="snowCapGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="70%" stopColor="#e0f2fe" />
                        <stop offset="100%" stopColor="#bae6fd" />
                    </linearGradient>

                    {/* Warm Amber Lantern Glow */}
                    <radialGradient id="lanternWarmGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                        <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.55" />
                        <stop offset="70%" stopColor="#f97316" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                    </radialGradient>

                    {/* Lantern Glass Core */}
                    <linearGradient id="lanternGlassGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fef9c3" />
                        <stop offset="55%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>

                    {/* Ice Crystal Cyan Glow */}
                    <radialGradient id="iceCrystalGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.9" />
                        <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                    </radialGradient>
                </defs>

                {/* 1. FROSTED PINE NEEDLE CLUSTERS (Background layer) */}
                <g className="pine-needles">
                    {/* Upper right pine cluster */}
                    <ellipse cx="475" cy="28" rx="52" ry="22" transform="rotate(-18 475 28)" fill="url(#pineNeedleGrad)" />
                    <ellipse cx="425" cy="46" rx="46" ry="18" transform="rotate(-15 425 46)" fill="url(#pineNeedleGrad)" />
                    {/* Mid branch pine cluster */}
                    <ellipse cx="335" cy="70" rx="48" ry="19" transform="rotate(-22 335 70)" fill="url(#pineNeedleGrad)" />
                    <ellipse cx="245" cy="98" rx="44" ry="17" transform="rotate(-25 245 98)" fill="url(#pineNeedleGrad)" />
                    {/* Tip pine cluster */}
                    <ellipse cx="165" cy="136" rx="38" ry="15" transform="rotate(-30 165 136)" fill="url(#pineNeedleGrad)" />
                    <ellipse cx="115" cy="168" rx="28" ry="11" transform="rotate(-28 115 168)" fill="url(#pineNeedleGrad)" />
                </g>

                {/* 2. MAIN WINTER PINE BRANCH & SNOW CAPS */}
                <g className="winter-branches">
                    {/* Main branch */}
                    <path
                        d="M 545, -12
                           C 470, 18  410, 42  340, 62
                           C 270, 82  210, 110 150, 150
                           C 120, 170  90, 188  62, 196
                           C 88,  180 122, 158 158, 138
                           C 215, 100 278, 74  348, 54
                           C 415, 34  475, 12  545, -2 Z"
                        fill="url(#winterBranchGrad)"
                    />

                    {/* Upper twig */}
                    <path
                        d="M 390, 50
                           C 340, 38 290, 34 235, 44
                           C 190, 52 155, 70 122, 88
                           C 148, 76 185, 62 232, 54
                           C 285, 45 335, 46 380, 55 Z"
                        fill="url(#winterBranchGrad)"
                    />

                    {/* Fluffy Snow Caps resting on the branch */}
                    <path
                        d="M 542, -8
                           C 480, 12 425, 32 365, 50
                           C 345, 56 352, 64 375, 56
                           C 430, 38 485, 18 542, -2 Z"
                        fill="url(#snowCapGrad)"
                        opacity="0.92"
                    />
                    <path
                        d="M 330, 60
                           C 275, 76 225, 98 175, 130
                           C 162, 138 168, 145 184, 134
                           C 232, 104 280, 82 332, 66 Z"
                        fill="url(#snowCapGrad)"
                        opacity="0.9"
                    />
                    <path
                        d="M 355, 44
                           C 310, 36 265, 36 225, 45
                           C 215, 48 218, 54 230, 51
                           C 268, 43 310, 42 352, 49 Z"
                        fill="url(#snowCapGrad)"
                        opacity="0.85"
                    />

                    {/* Hanging threads for Lantern & Ice Crystal */}
                    <line x1="210" y1="104" x2="210" y2="152" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="390" y1="48" x2="390" y2="112" stroke="rgba(224, 242, 254, 0.55)" strokeWidth="1.2" strokeDasharray="2 2" />
                </g>

                {/* 3. CUTE KAWAII SNOW OWL WITH ORANGE JOAH SCARF (Perched on branch) */}
                <g className="kawaii-owl">
                    {/* Soft Cyan Halo behind Owl */}
                    <circle cx="305" cy="50" r="28" fill="url(#iceCrystalGlow)" opacity="0.45" />

                    {/* Little Orange Feet gripping branch */}
                    <ellipse cx="297" cy="70" rx="4" ry="2.2" fill="#f97316" />
                    <ellipse cx="313" cy="68" rx="4" ry="2.2" fill="#f97316" />

                    {/* Chubby Snow Owl Body */}
                    <ellipse cx="305" cy="48" rx="20" ry="22" fill="url(#snowCapGrad)" />
                    {/* Belly Feather Pattern (Soft icy blue chevrons) */}
                    <path d="M 297, 54 Q 300, 57 303, 54" stroke="#93c5fd" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    <path d="M 307, 54 Q 310, 57 313, 54" stroke="#93c5fd" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    <path d="M 302, 60 Q 305, 63 308, 60" stroke="#93c5fd" strokeWidth="1.3" strokeLinecap="round" fill="none" />

                    {/* Cute Fluffy Ear Tufts */}
                    <path d="M 288, 34 C 284, 26 290, 24 295, 29 Z" fill="#e0f2fe" />
                    <path d="M 322, 34 C 326, 26 320, 24 315, 29 Z" fill="#e0f2fe" />

                    {/* Cute Little Wings */}
                    <ellipse cx="285" cy="49" rx="5" ry="11" transform="rotate(12 285 49)" fill="#bae6fd" />
                    <ellipse cx="325" cy="49" rx="5" ry="11" transform="rotate(-12 325 49)" fill="#bae6fd" />

                    {/* Big Sparkling Anime Eyes */}
                    <circle cx="297" cy="41" r="5" fill="#0f172a" />
                    <circle cx="295.5" cy="39.5" r="1.8" fill="#ffffff" />
                    <circle cx="298.5" cy="42.5" r="0.9" fill="#38bdf8" />

                    <circle cx="313" cy="41" r="5" fill="#0f172a" />
                    <circle cx="311.5" cy="39.5" r="1.8" fill="#ffffff" />
                    <circle cx="314.5" cy="42.5" r="0.9" fill="#38bdf8" />

                    {/* Tiny Golden Beak */}
                    <path d="M 303, 43 L 307, 43 L 305, 46.5 Z" fill="#f59e0b" />

                    {/* Rosy Pink Winter Blush */}
                    <ellipse cx="290" cy="45" rx="3.2" ry="1.8" fill="#fb7185" opacity="0.65" />
                    <ellipse cx="320" cy="45" rx="3.2" ry="1.8" fill="#fb7185" opacity="0.65" />

                    {/* 🧣 Cozy JOAH Orange Scarf wrapped around neck */}
                    <path
                        d="M 287, 49 C 296, 54 314, 54 323, 49 C 324, 53 322, 56 318, 56 C 309, 59 299, 59 290, 56 C 286, 55 285, 52 287, 49 Z"
                        fill="#f97316"
                    />
                    {/* Scarf stripe detail */}
                    <path d="M 290, 52 Q 305, 56 320, 52" stroke="#fed7aa" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                    {/* Hanging scarf tail */}
                    <path
                        d="M 312, 53 C 315, 60 318, 65 316, 70 C 313, 71 309, 70 308, 67 C 308, 62 309, 57 312, 53 Z"
                        fill="#ea580c"
                    />
                    <line x1="309" y1="69" x2="315" y2="70" stroke="#fed7aa" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* 4. DANGLING WARM AMBER WINTER LANTERN (Matches background lanterns) */}
                <g className="dangle-lantern">
                    {/* Outer Warm Halo */}
                    <circle cx="210" cy="172" r="36" fill="url(#lanternWarmGlow)" />

                    {/* Lantern Ring & Roof */}
                    <circle cx="210" cy="152" r="3" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
                    <path d="M 196, 161 L 210, 153 L 224, 161 Z" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    {/* Snow cap on lantern roof */}
                    <path d="M 199, 159 L 210, 153 L 221, 159" stroke="#e0f2fe" strokeWidth="2" strokeLinecap="round" fill="none" />

                    {/* Glowing Glass Chamber */}
                    <rect x="199" y="161" width="22" height="24" rx="3" fill="url(#lanternGlassGrad)" />
                    {/* Inner bright flame core */}
                    <ellipse cx="210" cy="173" rx="5" ry="7" fill="#ffffff" opacity="0.85" />

                    {/* Lantern Metal Frame Bars */}
                    <line x1="199" y1="161" x2="201" y2="185" stroke="#1e293b" strokeWidth="1.6" />
                    <line x1="221" y1="161" x2="219" y2="185" stroke="#1e293b" strokeWidth="1.6" />
                    <line x1="210" y1="161" x2="210" y2="185" stroke="#1e293b" strokeWidth="1.2" opacity="0.7" />

                    {/* Lantern Base */}
                    <rect x="196" y="184" width="28" height="4.5" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
                </g>

                {/* 5. DANGLING GLOWING ICE CRYSTAL STAR */}
                <g className="dangle-crystal">
                    <circle cx="390" cy="128" r="22" fill="url(#iceCrystalGlow)" />
                    {/* 8-Pointed Crystal Star */}
                    <path
                        d="M 390, 110 L 393.5, 123.5 L 407, 128 L 393.5, 132.5 L 390, 146 L 386.5, 132.5 L 373, 128 L 386.5, 123.5 Z"
                        fill="#e0f2fe"
                        stroke="#38bdf8"
                        strokeWidth="0.8"
                    />
                    <path
                        d="M 390, 116 L 398, 120 L 394, 128 L 398, 136 L 390, 140 L 382, 136 L 386, 128 L 382, 120 Z"
                        fill="#bae6fd"
                        opacity="0.75"
                    />
                    <circle cx="390" cy="128" r="3" fill="#ffffff" />
                </g>

                {/* 6. AMBIENT TWINKLING STARLIGHT MOTES */}
                <g className="twinkle-star-1">
                    <circle cx="135" cy="88" r="8" fill="url(#iceCrystalGlow)" />
                    <path d="M 135, 81 L 136.5, 86.5 L 142, 88 L 136.5, 89.5 L 135, 95 L 133.5, 89.5 L 128, 88 L 133.5, 86.5 Z" fill="#ffffff" />
                </g>
                <g className="twinkle-star-2">
                    <circle cx="265" cy="145" r="6" fill="url(#iceCrystalGlow)" />
                    <path d="M 265, 140 L 266, 144 L 270, 145 L 266, 146 L 265, 150 L 264, 146 L 260, 145 L 264, 144 Z" fill="#e0f2fe" />
                </g>
            </svg>
        </div>
    );
};

export default WinterCanopy;

