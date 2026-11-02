import React from 'react';
import halloweenBg from '../../assets/BackGroundIM/halloween_bg_01.webp';
import sakuraBg from '../../assets/BackGroundIM/sakura.webp';
import winterBg from '../../assets/BackGroundIM/winter_2d_bg_02.webp';
import { getActiveTheme } from './RainParticles';

/**
 * SeasonalBackground — Dynamic Seasonal Background (Image-based)
 *
 * - ❄️ Winter: winter_bg_01.webp (Nov – Dec)
 * - 🎃 Halloween: halloween_bg_01.webp (Oct)
 * - 🌸 Sakura: sakura.webp (Mar – May)
 * - 🧊 Cubes / Default: no seasonal background image
 *
 * Props:
 *  - theme     : 'night' (default) | 'light'  — ปรับ overlay opacity
 *  - className : เพิ่ม class เอง
 */
const SeasonalBackground = ({ className = '', theme = 'night' }) => {
    const activeSeason = getActiveTheme();
    const isNight = theme !== 'light';

    // เลือกภาพพื้นหลังตามธีมที่เลือก
    let bgImage = null;
    let isSakura = false;
    let isHalloween = false;
    let isWinter = false;

    if (activeSeason === 'winter') {
        bgImage = winterBg;
        isWinter = true;
    } else if (activeSeason === 'halloween') {
        bgImage = halloweenBg;
        isHalloween = true;
    } else if (activeSeason === 'sakura') {
        bgImage = sakuraBg;
        isSakura = true;
    }

    // หากเป็น Cubes หรือไม่มีธีม seasonal ไม่ต้องแสดงภาพพื้นหลัง
    if (!bgImage) return null;

    return (
        <div
            className={`fixed inset-0 w-full h-full pointer-events-none overflow-hidden select-none ${className}`}
            style={{ zIndex: -1 }}
        >
            {/* ── Background image ─────────────────────────────────────── */}
            <img
                src={bgImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full transition-opacity duration-1000"
                style={{ objectFit: 'cover', objectPosition: 'center' }}
                draggable={false}
            />

            {/* ── Subtle vignette so centre cards stay readable ───── */}
            <div
                className="absolute inset-0"
                style={{
                    background: isSakura
                        ? isNight
                            ? 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 25%, rgba(40,10,25,0.40) 100%)'
                            : 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 35%, rgba(255,240,245,0.25) 100%)'
                        : isWinter
                            ? isNight
                                ? 'radial-gradient(ellipse 72% 62% at 50% 50%, transparent 35%, rgba(2,8,28,0.32) 100%)'
                                : 'radial-gradient(ellipse 72% 62% at 50% 50%, transparent 38%, rgba(2,8,28,0.15) 100%)'
                            : isNight
                                ? 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(5,2,20,0.38) 100%)'
                                : 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(5,2,20,0.18) 100%)',
                }}
            />

            {/* ── Bottom edge fade — blends into page background ───────── */}
            <div
                className="absolute bottom-0 left-0 right-0"
                style={{
                    height: '18%',
                    background: isSakura
                        ? 'linear-gradient(to top, rgba(20,5,15,0.45) 0%, transparent 100%)'
                        : isWinter
                            ? 'linear-gradient(to top, rgba(3,10,30,0.48) 0%, transparent 100%)'
                            : 'linear-gradient(to top, rgba(5,2,20,0.55) 0%, transparent 100%)',
                }}
            />

            {/* ── Top edge fade ─────────────────────────────────────────── */}
            <div
                className="absolute top-0 left-0 right-0"
                style={{
                    height: '8%',
                    background: isSakura
                        ? 'linear-gradient(to bottom, rgba(20,5,15,0.25) 0%, transparent 100%)'
                        : isWinter
                            ? 'linear-gradient(to bottom, rgba(3,10,30,0.28) 0%, transparent 100%)'
                            : 'linear-gradient(to bottom, rgba(5,2,20,0.35) 0%, transparent 100%)',
                }}
            />
        </div>
    );
};

export default SeasonalBackground;