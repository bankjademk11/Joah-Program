import React from 'react';
import halloweenBg from '../../assets/BackGroundIM/halloween_bg_01.webp';

/**
 * SeasonalBackground — 🎃 Halloween Edition (Image-based)
 *
 * ใช้ halloween_bg_01.webp เป็นพื้นหลังเต็มจอ
 * พร้อม overlay gradient เบาๆ เพื่อให้การ์ด/เนื้อหาตรงกลางอ่านง่าย
 *
 * Props:
 *  - theme     : 'night' (default) | 'light'  — ปรับ overlay opacity
 *  - className : เพิ่ม class เอง
 */
const SeasonalBackground = ({ className = '', theme = 'night' }) => {
    const isNight = theme !== 'light';

    return (
        <div
            className={`fixed inset-0 w-full h-full pointer-events-none overflow-hidden select-none ${className}`}
            style={{ zIndex: -1 }}
        >
            {/* ── Background image ─────────────────────────────────────── */}
            <img
                src={halloweenBg}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: 'cover', objectPosition: 'center' }}
                draggable={false}
            />

            {/* ── Subtle dark vignette so centre cards stay readable ───── */}
            <div
                className="absolute inset-0"
                style={{
                    background: isNight
                        ? 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(5,2,20,0.38) 100%)'
                        : 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(5,2,20,0.18) 100%)',
                }}
            />

            {/* ── Bottom edge fade — blends into page background ───────── */}
            <div
                className="absolute bottom-0 left-0 right-0"
                style={{
                    height: '18%',
                    background: 'linear-gradient(to top, rgba(5,2,20,0.55) 0%, transparent 100%)',
                }}
            />

            {/* ── Top edge fade ─────────────────────────────────────────── */}
            <div
                className="absolute top-0 left-0 right-0"
                style={{
                    height: '8%',
                    background: 'linear-gradient(to bottom, rgba(5,2,20,0.35) 0%, transparent 100%)',
                }}
            />
        </div>
    );
};

export default SeasonalBackground;