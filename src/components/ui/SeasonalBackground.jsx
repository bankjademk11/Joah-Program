import React from 'react';
import halloweenBg from '../../assets/BackGroundIM/halloween_bg_01.webp';
import sakuraBg from '../../assets/BackGroundIM/sakura.webp';
import { getActiveTheme } from './RainParticles';

/**
 * SeasonalBackground — Dynamic Seasonal Background (Image-based)
 *
 * - 🎃 Halloween: halloween_bg_01.webp
 * - 🌸 Sakura: sakura.webp
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

    if (activeSeason === 'halloween') {
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
                        : 'linear-gradient(to bottom, rgba(5,2,20,0.35) 0%, transparent 100%)',
                }}
            />
        </div>
    );
};

export default SeasonalBackground;