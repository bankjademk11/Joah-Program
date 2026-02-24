import React from 'react';

// 1. ไอคอนอัปโหลด (กระดาษลอยขึ้นพร้อมลูกศร)
export const UploadFileIcon = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>
            {`
        .arrow-up { animation: floatUp 2s infinite ease-in-out; }
        @keyframes floatUp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .doc-base { stroke-dasharray: 200; stroke-dashoffset: 0; }
      `}
        </style>
        <rect x="25" y="15" width="50" height="70" rx="6" stroke="currentColor" strokeWidth="6" className="doc-base" fill="transparent" />
        <path d="M60 15L75 30V15H60Z" fill="currentColor" />
        <g className="arrow-up" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M35 55L50 40L65 55M50 40V70" />
        </g>
    </svg>
);

// 2. ไอคอนฐานข้อมูลคลาวด์ (กอนเมฆพร้อมโหนดประกายไฟ)
export const CloudDatabaseIcon = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>
            {`
        .cloud-path { opacity: 0.9; }
        .data-node { animation: pulseLoc 2s infinite alternate; }
        .node-2 { animation-delay: 0.5s; }
        .node-3 { animation-delay: 1s; }
        @keyframes pulseLoc {
          0% { transform: translateY(0px) scale(1); opacity: 0.5; }
          100% { transform: translateY(-3px) scale(1.3); opacity: 1; }
        }
        .signal { animation: signalFade 2s infinite ease-out; transform-origin: 50% 50%; }
        @keyframes signalFade {
          0% { transform: scale(0.5); opacity: 1; stroke-width: 4; }
          100% { transform: scale(2.5); opacity: 0; stroke-width: 0; }
        }
      `}
        </style>
        <path className="cloud-path" d="M30 70C21.7157 70 15 63.2843 15 55C15 47.3821 20.672 41.0926 28.0263 40.1659C30.4074 30.4578 39.3871 23 50 23C62.7025 23 73 33.2975 73 46C81.8366 46 89 53.1634 89 62C89 70.8366 81.8366 78 73 78H35C33.3431 78 31.6863 78 30 78V70Z" fill="currentColor" />
        <circle cx="35" cy="55" r="4" fill="var(--bg-white, white)" className="data-node" />
        <circle cx="50" cy="50" r="5" fill="var(--bg-white, white)" className="data-node node-2" />
        <circle cx="65" cy="58" r="4" fill="var(--bg-white, white)" className="data-node node-3" />
        <path d="M35 55L50 50L65 58" stroke="var(--bg-white, white)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
        <circle cx="50" cy="50" r="10" stroke="var(--bg-white, white)" fill="none" className="signal" />
    </svg>
);

// 3. ไอคอนจัดการสินค้า (กล่อง 3 มิติเปิด-ปิดลอยได้)
export const ProductBoxIcon = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>
            {`
        .box-top { animation: lidBounce 2s infinite ease-in-out; transform-origin: 50px 35px; }
        @keyframes lidBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .glow { animation: pulseGlow 2s infinite alternate; }
        @keyframes pulseGlow {
          0% { opacity: 0.3; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.2); }
        }
      `}
        </style>
        <path d="M50 85L25 70V45L50 60L75 45V70L50 85Z" fill="currentColor" fillOpacity="0.8" />
        <path d="M25 45L50 60L50 85L25 70V45Z" fill="black" fillOpacity="0.15" />
        <circle cx="50" cy="40" r="8" fill="var(--bg-white, white)" className="glow" />
        <g className="box-top">
            <path d="M50 25L25 40L50 55L75 40L50 25Z" fill="currentColor" />
            <path d="M25 40L50 55L75 40L75 40" stroke="var(--bg-white, white)" strokeWidth="1" opacity="0.4" />
        </g>
    </svg>
);

// 4. ไอคอนกวดสอบฐานข้อมูล (ชั้นฐานข้อมูลขยับเข้า-ออก)
export const AuditDatabaseIcon = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>
            {`
        .db-layer { animation: layerPulse 2s infinite alternate ease-in-out; transform-origin: center; }
        .layer-1 { animation-delay: 0s; }
        .layer-2 { animation-delay: 0.3s; }
        .layer-3 { animation-delay: 0.6s; }
        @keyframes layerPulse {
          0% { transform: scale(1); fill-opacity: 0.6; }
          100% { transform: scale(1.05); fill-opacity: 1; }
        }
        .scanner { animation: scanMove 2.5s infinite ease-in-out; transform-origin: center; }
        @keyframes scanMove {
          0% { transform: translateY(-5px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(35px); opacity: 0; }
        }
      `}
        </style>
        <g transform="translate(50, 0)">
            <ellipse cx="0" cy="30" rx="30" ry="8" fill="currentColor" className="db-layer layer-1" />
            <path d="M-30 30 V45 A30 8 0 0 0 30 45 V30 A30 8 0 0 1 -30 30Z" fill="currentColor" fillOpacity="0.5" />
            <ellipse cx="0" cy="50" rx="30" ry="8" fill="currentColor" className="db-layer layer-2" />
            <path d="M-30 50 V65 A30 8 0 0 0 30 65 V50 A30 8 0 0 1 -30 50Z" fill="currentColor" fillOpacity="0.5" />
            <ellipse cx="0" cy="70" rx="30" ry="8" fill="currentColor" className="db-layer layer-3" />
            <path d="M-30 70 V85 A30 8 0 0 0 30 85 V70 A30 8 0 0 1 -30 70Z" fill="currentColor" fillOpacity="0.5" />
        </g>
        <rect x="15" y="25" width="70" height="2" fill="var(--bg-white, white)" className="scanner" />
    </svg>
);

// 5. ไอคอน Odoo Sync (ลูกศรหมุนพร้อมไฟฟ้าสถิตย์)
export const SyncOdooIcon = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>
            {`
        .spin-group { animation: spinSmooth 4s infinite linear; transform-origin: 50px 50px; }
        @keyframes spinSmooth {
          100% { transform: rotate(360deg); }
        }
        .bolt { animation: boltFlash 1.5s infinite steps(2, end); }
        @keyframes boltFlash {
          0%, 100% { fill: transparent; }
          50% { fill: currentColor; }
        }
      `}
        </style>
        <g className="spin-group" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
            <path d="M20 50 A30 30 0 0 1 80 50" fill="none" />
            <path d="M80 50 L68 40 M80 50 L92 40" fill="none" />
            <path d="M80 50 A30 30 0 0 1 20 50" fill="none" />
            <path d="M20 50 L8 60 M20 50 L32 60" fill="none" />
        </g>
        <path d="M45 35 L55 35 L50 48 L60 48 L45 65 L50 52 L40 52 Z" stroke="currentColor" strokeWidth="2" className="bolt" />
    </svg>
);

// 6. ไอคอนคำขอสโตร์ (โล่แอนิเมชันเด้งและติ๊กถูก)
export const StoreRequestIcon = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>
            {`
        .shield-base { animation: shieldPulse 3s infinite alternate ease-in-out; transform-origin: center; }
        @keyframes shieldPulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
        .check-mark { stroke-dasharray: 100; stroke-dashoffset: 100; animation: drawCheck 3s infinite ease-in-out; }
        @keyframes drawCheck {
          0%, 20% { stroke-dashoffset: 100; opacity: 0; }
          50%, 80% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 100; opacity: 0; }
        }
      `}
        </style>
        <path className="shield-base" d="M50 15 L20 25 V45 C20 65 35 80 50 85 C65 80 80 65 80 45 V25 L50 15Z" fill="currentColor" fillOpacity="0.8" />
        <path d="M20 45 C20 65 35 80 50 85 V15 L20 25 V45Z" fill="black" fillOpacity="0.15" />
        <path className="check-mark" d="M35 50 L45 60 L65 40" stroke="var(--bg-white, white)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
