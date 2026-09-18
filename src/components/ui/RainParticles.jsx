import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchKm8Weather, subscribeWeather } from '../../utils/weatherService';

/**
 * SmartWeatherParticles
 * Dynamic Particle System:
 * - When raining: Renders realistic Rain FX + Splashes
 * - When dry / sunny: Switches back to Floating Rubik Network Cubes
 * - Shares cached weatherService data (zero redundant API calls, 5-min safe cache)
 */
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

    // Particle references
    const dropsRef = useRef([]);
    const splashesRef = useRef([]);
    const cubesRef = useRef([]);
    const dropCountRef = useRef(30);
    const rainSpeedMultRef = useRef(1.0);

    // Configs
    const CUBE_COUNT = 30;
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

    // Create Raindrop
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

    // Create Splash
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

    // Create Cube (for Sunny / Dry mode)
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

        // Init both pools
        dropsRef.current = Array.from({ length: dropCountRef.current }, () => createDrop(w, h, true));
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
        window.addEventListener('touchmove', (e) => {
            if (e.touches[0]) {
                const rect = canvas.getBoundingClientRect();
                mouseRef.current.x = e.touches[0].clientX - rect.left;
                mouseRef.current.y = e.touches[0].clientY - rect.top;
            }
        }, { passive: true });

        // Cube Isometric Renderer
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

                // Render Raindrops
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

                // Render Splashes
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
            } else {
                // ==========================================
                // ☀️ MODE 2: RUBIK NETWORK CUBES (DRY / SUNNY)
                // ==========================================
                const lineColor = isDark ? '249, 115, 22' : '234, 88, 12';

                // Network lines
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

                // Cubes
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
    }, [createDrop, createCube, weatherData.isRaining]);

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
            style={{ zIndex: 0 }}
        />
    );
};

export default SmartWeatherParticles;
