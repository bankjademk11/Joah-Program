import React, { useEffect, useRef, useCallback } from 'react';

const RubikNetworkParticles = ({ className = '' }) => {
    const canvasRef = useRef(null);
    const cubesRef = useRef([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animFrameRef = useRef(null);
    const isDarkRef = useRef(false);

    // Config
    const CUBE_COUNT = 30;
    const CONNECTION_DIST = 180;
    const MOUSE_RADIUS = 200;

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
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);
        cubesRef.current = Array.from({ length: CUBE_COUNT }, () => createCube(w, h));

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
        // Also support touch for mobile
        window.addEventListener('touchmove', (e) => {
            if (e.touches[0]) {
                const rect = canvas.getBoundingClientRect();
                mouseRef.current.x = e.touches[0].clientX - rect.left;
                mouseRef.current.y = e.touches[0].clientY - rect.top;
            }
        }, { passive: true });

        const drawIsometricCube = (x, y, size, angle, colors, opacity) => {
            const h = size * 0.5;
            const w = size * 0.866;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.globalAlpha = opacity;

            // Faces
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
                ctx.moveTo(0, -size); ctx.lineTo(w, -h); ctx.lineTo(0, 0); ctx.lineTo(-w, -h); ctx.closePath();
            }, colors.top);

            drawFace(() => {
                ctx.moveTo(0, 0); ctx.lineTo(w, -h); ctx.lineTo(w, h); ctx.lineTo(0, size); ctx.closePath();
            }, colors.side);

            drawFace(() => {
                ctx.moveTo(0, 0); ctx.lineTo(-w, -h); ctx.lineTo(-w, h); ctx.lineTo(0, size); ctx.closePath();
            }, colors.main);

            ctx.restore();
        };

        const animate = () => {
            const width = canvas.width / (window.devicePixelRatio || 1);
            const height = canvas.height / (window.devicePixelRatio || 1);
            ctx.clearRect(0, 0, width, height);

            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;
            const isDark = isDarkRef.current;
            const lineColor = isDark ? '249, 115, 22' : '234, 88, 12'; // Joah Orange

            // 1. Draw Network Lines First (Bottom Layer)
            cubesRef.current.forEach((c1, i) => {
                // Mouse logic for lines
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

            // 2. Update and Draw Cubes (Top Layer)
            cubesRef.current.forEach((c) => {
                c.x += c.vx;
                c.y += c.vy;
                c.angle += c.angleV;

                // Mouse repel / twist
                const dx = mx - c.x;
                const dy = my - c.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MOUSE_RADIUS) {
                    const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
                    c.angle += force * 0.05;
                    c.x -= (dx / dist) * force * 2;
                    c.y -= (dy / dist) * force * 2;
                }

                // Wrap
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

            animFrameRef.current = requestAnimationFrame(animate);
        };

        animFrameRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animFrameRef.current);
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            observer.disconnect();
        };
    }, [createCube]);

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
            style={{ zIndex: 0 }}
        />
    );
};

export default RubikNetworkParticles;
