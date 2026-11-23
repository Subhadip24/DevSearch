// ==========================================================================
// DevSearch: Moving Ship in a Tornado / Maelstrom Background Animation
// Canvas 60FPS animation with Dark & Light mode storm simulation
// ==========================================================================

(function() {
    let canvas, ctx;
    let width = 0, height = 0;
    let dpr = 1;
    let animationFrameId = null;
    let isRunning = true;

    // Theme state
    let isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Particle system for tornado wind & sea spray
    const NUM_PARTICLES = 260;
    const particles = [];

    // Lightning system
    let lightningBolt = null;
    let lightningIntensity = 0;
    let nextLightningTime = Date.now() + 4000;

    // Vortex parameters
    let vortexCenter = { x: 0, y: 0 };
    let vortexRotation = 0;

    // Ship State & Physics
    const ship = {
        x: 0,
        y: 0,
        baseY: 0,
        angle: 0,
        roll: 0,
        pitch: 0,
        speed: 1.1,
        pathAngle: 0, // angular progress along storm orbit
        radiusX: 0,
        radiusY: 0,
        centerX: 0,
        centerY: 0,
        scale: 0.85,
        wakes: []
    };

    // Initialize Canvas
    function init() {
        canvas = document.getElementById('stormCanvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'stormCanvas';
            canvas.className = 'storm-background-canvas';
            document.body.prepend(canvas);
        }
        ctx = canvas.getContext('2d');

        handleResize();
        window.addEventListener('resize', handleResize, { passive: true });

        // Initialize particles
        initParticles();

        // Watch for theme changes (Dark / Light)
        const observer = new MutationObserver(() => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            isDark = currentTheme === 'dark';
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Start animation loop
        lastTime = performance.now();
        animate(lastTime);
    }

    function handleResize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        // Position the tornado slightly to the upper-right center for cinematic balance
        vortexCenter.x = width * 0.72;
        vortexCenter.y = height * 0.42;

        // Ship orbit trajectory around the outer edge of vortex and turbulent seas
        ship.centerX = width * 0.55;
        ship.centerY = height * 0.65;
        ship.radiusX = width * 0.36;
        ship.radiusY = height * 0.24;
    }

    // ----------------------------------------------------------------------
    // Particle System (Tornado Wind, Rain & Sea Foam)
    // ----------------------------------------------------------------------
    function initParticles() {
        particles.length = 0;
        for (let i = 0; i < NUM_PARTICLES; i++) {
            particles.push(createParticle(true));
        }
    }

    function createParticle(randomAge = false) {
        // Height ratio in the tornado funnel (0 = top wide, 1 = bottom sea vortex)
        const yRatio = Math.random();
        // Funnel shape: wide at top, narrows at sea level, flares slightly at waves
        const funnelRadius = (1 - yRatio * 0.75) * (width * 0.26) + Math.random() * 40;
        const angle = Math.random() * Math.PI * 2;

        return {
            angle: angle,
            yRatio: yRatio,
            distance: funnelRadius,
            speed: 0.025 + Math.random() * 0.045 + (1 - yRatio) * 0.02,
            verticalSpeed: 0.002 + Math.random() * 0.004,
            size: Math.random() * 2.5 + 0.8,
            alpha: Math.random() * 0.65 + 0.25,
            length: Math.random() * 14 + 6,
            isDebris: Math.random() < 0.12 // small wooden debris / flying sparks
        };
    }

    function updateParticles() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.angle += p.speed;
            p.yRatio += p.verticalSpeed;

            // When particle reaches bottom ocean, recycle to top cloud bank
            if (p.yRatio > 1.05) {
                p.yRatio = -0.05;
                p.angle = Math.random() * Math.PI * 2;
            }

            // Funnel profile based on height
            const funnelRadius = (1 - Math.sin(p.yRatio * Math.PI * 0.85) * 0.65) * (width * 0.24);
            p.distance = funnelRadius + (Math.sin(p.angle * 3) * 15);
        }
    }

    function drawTornado() {
        vortexRotation += 0.015;

        // 1. Draw Funnel Silhouette & Atmospheric Spiral Glow
        const cx = vortexCenter.x;
        const topY = height * -0.1;
        const bottomY = height * 0.88;
        const funnelH = bottomY - topY;

        ctx.save();

        // Atmospheric vortex core gradient
        const coreGradient = ctx.createLinearGradient(cx, topY, cx, bottomY);
        if (isDark) {
            coreGradient.addColorStop(0, 'rgba(16, 26, 46, 0.4)');
            coreGradient.addColorStop(0.5, 'rgba(25, 42, 70, 0.3)');
            coreGradient.addColorStop(0.85, 'rgba(38, 75, 125, 0.22)');
            coreGradient.addColorStop(1, 'rgba(10, 18, 32, 0.6)');
        } else {
            coreGradient.addColorStop(0, 'rgba(180, 205, 230, 0.35)');
            coreGradient.addColorStop(0.5, 'rgba(145, 180, 215, 0.25)');
            coreGradient.addColorStop(0.85, 'rgba(110, 155, 195, 0.2)');
            coreGradient.addColorStop(1, 'rgba(170, 200, 225, 0.45)');
        }

        // Draw twisting tornado funnel body using bezier bands
        for (let band = 0; band < 5; band++) {
            const bandOffset = (vortexRotation * 0.5 + band * (Math.PI / 2.5));
            const sway = Math.sin(bandOffset) * 28;

            ctx.beginPath();
            ctx.moveTo(cx - width * 0.22 + sway, topY);
            ctx.bezierCurveTo(
                cx - width * 0.12 + sway * 1.5, topY + funnelH * 0.4,
                cx - 35 + sway * 0.8, bottomY - funnelH * 0.25,
                cx - 20, bottomY
            );
            ctx.lineTo(cx + 20, bottomY);
            ctx.bezierCurveTo(
                cx + 35 + sway * 0.8, bottomY - funnelH * 0.25,
                cx + width * 0.12 + sway * 1.5, topY + funnelH * 0.4,
                cx + width * 0.22 + sway, topY
            );
            ctx.closePath();
            ctx.fillStyle = coreGradient;
            ctx.fill();
        }

        // 2. Swirling Tornado Wind Streaks & Particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const py = topY + p.yRatio * funnelH;
            const px = cx + Math.cos(p.angle) * p.distance + Math.sin(p.yRatio * 4 + vortexRotation) * 18;

            // Depth calculation based on angle (foreground vs background of funnel)
            const zDepth = (Math.sin(p.angle) + 1) * 0.5; // 0 = behind funnel, 1 = front
            const alpha = p.alpha * (0.35 + zDepth * 0.65);

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(p.angle + Math.PI / 2);

            if (p.isDebris) {
                // Flying wood splinters / debris
                ctx.fillStyle = isDark 
                    ? `rgba(215, 150, 75, ${alpha * 0.9})` 
                    : `rgba(90, 60, 30, ${alpha * 0.85})`;
                ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 1.5);
            } else {
                // High-speed wind streaks
                const streakGrad = ctx.createLinearGradient(0, -p.length, 0, 0);
                if (isDark) {
                    streakGrad.addColorStop(0, `rgba(130, 205, 255, 0)`);
                    streakGrad.addColorStop(1, `rgba(165, 225, 255, ${alpha})`);
                } else {
                    streakGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
                    streakGrad.addColorStop(1, `rgba(90, 150, 205, ${alpha})`);
                }
                ctx.strokeStyle = streakGrad;
                ctx.lineWidth = p.size * (0.8 + zDepth * 0.8);
                ctx.beginPath();
                ctx.moveTo(0, -p.length);
                ctx.lineTo(0, 0);
                ctx.stroke();
            }

            ctx.restore();
        }

        ctx.restore();
    }

    // ----------------------------------------------------------------------
    // Ocean Waves & Whirlpool
    // ----------------------------------------------------------------------
    function drawWaves(time) {
        const waveBase = height * 0.76;
        const waveLayers = [
            { speed: 1.2, freq: 0.005, amp: 20, alpha: isDark ? 0.35 : 0.45, color: isDark ? '#0c1628' : '#6593b8' },
            { speed: 1.8, freq: 0.009, amp: 16, alpha: isDark ? 0.55 : 0.6, color: isDark ? '#08101e' : '#4f7d9f' },
            { speed: 2.4, freq: 0.014, amp: 12, alpha: isDark ? 0.85 : 0.8, color: isDark ? '#050a14' : '#396383' }
        ];

        for (let l = 0; l < waveLayers.length; l++) {
            const layer = waveLayers[l];
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, height);

            for (let x = 0; x <= width; x += 12) {
                // Maelstrom depression towards vortex bottom
                const distToVortex = Math.abs(x - vortexCenter.x) / (width * 0.35);
                const whirlpoolDip = Math.max(0, 1 - distToVortex) * 35;

                const waveY = waveBase + 
                    Math.sin(x * layer.freq + time * layer.speed) * layer.amp +
                    Math.cos(x * layer.freq * 1.5 - time * layer.speed * 0.7) * (layer.amp * 0.5) +
                    whirlpoolDip * (l === 2 ? 0.7 : 0.3);

                if (x === 0) ctx.lineTo(x, waveY);
                else ctx.lineTo(x, waveY);
            }

            ctx.lineTo(width, height);
            ctx.closePath();

            ctx.fillStyle = layer.color;
            ctx.globalAlpha = layer.alpha;
            ctx.fill();

            // Foam crests along wave tops
            if (l === 1 || l === 2) {
                ctx.strokeStyle = isDark ? 'rgba(150, 220, 255, 0.45)' : 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // ----------------------------------------------------------------------
    // The Moving Ship
    // ----------------------------------------------------------------------
    function updateShip(time) {
        // Orbit through the stormy sea around the perimeter of the vortex
        ship.pathAngle += 0.0075 * ship.speed;

        // Oval orbital path in perspective
        const orbitX = ship.centerX + Math.cos(ship.pathAngle) * ship.radiusX;
        const orbitY = ship.centerY + Math.sin(ship.pathAngle) * ship.radiusY;

        // Wave elevation at ship's position
        const waveElev = Math.sin(orbitX * 0.009 + time * 1.8) * 16 + Math.cos(orbitX * 0.018 - time * 2.4) * 8;

        ship.x = orbitX;
        ship.y = orbitY + waveElev;

        // Heading direction and pitch
        const nextX = ship.centerX + Math.cos(ship.pathAngle + 0.03) * ship.radiusX;
        const nextY = ship.centerY + Math.sin(ship.pathAngle + 0.03) * ship.radiusY;
        const heading = Math.atan2(nextY - orbitY, nextX - orbitX);

        // Ship tilts with wave slope and storm centrifugal forces
        const waveSlope = Math.cos(orbitX * 0.009 + time * 1.8) * 0.18;
        ship.pitch = waveSlope * 0.7;
        ship.roll = Math.sin(time * 3.5) * 0.12 - (Math.sin(ship.pathAngle) * 0.15); // Heeling into wind
        ship.angle = heading + ship.pitch;

        // Perspective scaling (ship appears slightly smaller when far behind in orbit)
        const depth = (Math.sin(ship.pathAngle) + 1) * 0.5; // 0 = far, 1 = near
        ship.scale = 0.65 + depth * 0.45;

        // Generate wake & sea spray behind the ship
        if (Math.random() < 0.8) {
            ship.wakes.push({
                x: ship.x - Math.cos(heading) * (28 * ship.scale),
                y: ship.y + (10 * ship.scale),
                radius: 2 + Math.random() * 4,
                alpha: 0.8,
                vx: -Math.cos(heading) * 0.8 + (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.2
            });
        }

        // Update wakes
        for (let i = ship.wakes.length - 1; i >= 0; i--) {
            const w = ship.wakes[i];
            w.x += w.vx;
            w.y += w.vy;
            w.radius += 0.35;
            w.alpha -= 0.025;
            if (w.alpha <= 0) {
                ship.wakes.splice(i, 1);
            }
        }
    }

    function drawShipWakes() {
        ctx.save();
        for (let i = 0; i < ship.wakes.length; i++) {
            const w = ship.wakes[i];
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
            ctx.fillStyle = isDark 
                ? `rgba(130, 210, 255, ${w.alpha * 0.5})` 
                : `rgba(255, 255, 255, ${w.alpha * 0.75})`;
            ctx.fill();
        }
        ctx.restore();
    }

    function drawShip(time) {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.roll);
        ctx.scale(ship.scale, ship.scale);

        // Direction facing (left vs right based on orbit)
        const facingLeft = Math.cos(ship.pathAngle) > 0;
        if (facingLeft) {
            ctx.scale(-1, 1);
        }

        // Styling based on theme
        const hullColor = isDark ? '#23150d' : '#4a2d18';
        const hullStripe = isDark ? '#b8860b' : '#d4af37';
        const sailColor = isDark ? '#dce5f0' : '#f5f7fa';
        const sailShadow = isDark ? '#7a8c9e' : '#bdcddc';
        const mastColor = isDark ? '#1a1008' : '#331f11';

        // 1. Ship Hull (Sailing Galleon)
        ctx.beginPath();
        ctx.moveTo(-45, -5);     // Stern deck
        ctx.lineTo(-42, 14);     // Stern bottom
        ctx.lineTo(32, 14);      // Keel
        ctx.lineTo(52, -2);      // Bow tip
        ctx.lineTo(44, -10);     // Bow deck
        ctx.lineTo(38, -6);      // Foredeck
        ctx.lineTo(-30, -6);     // Main deck waist
        ctx.lineTo(-45, -14);    // Stern castle
        ctx.closePath();
        ctx.fillStyle = hullColor;
        ctx.fill();
        ctx.strokeStyle = isDark ? '#3d2516' : '#22140a';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Hull golden stripe / gunport line
        ctx.beginPath();
        ctx.moveTo(-40, 2);
        ctx.lineTo(46, 2);
        ctx.strokeStyle = hullStripe;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Bowsprit (front spar sticking out forward)
        ctx.beginPath();
        ctx.moveTo(44, -5);
        ctx.lineTo(72, -18);
        ctx.strokeStyle = mastColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 2. Masts (Fore, Main, Mizzen)
        const masts = [
            { x: -22, h: 48, sailW: 24, sailH: 30, billow: 8 },  // Mizzen (rear)
            { x: 5,   h: 68, sailW: 34, sailH: 42, billow: 12 }, // Main (center)
            { x: 30,  h: 52, sailW: 26, sailH: 32, billow: 9 }   // Fore (front)
        ];

        // Rigging ropes
        ctx.strokeStyle = isDark ? 'rgba(180, 200, 220, 0.25)' : 'rgba(50, 70, 90, 0.35)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        // Stays & Shrouds
        ctx.moveTo(-42, -12); ctx.lineTo(masts[0].x, -masts[0].h + 10);
        ctx.moveTo(masts[0].x, -masts[0].h + 10); ctx.lineTo(masts[1].x, -masts[1].h + 10);
        ctx.moveTo(masts[1].x, -masts[1].h + 10); ctx.lineTo(masts[2].x, -masts[2].h + 10);
        ctx.moveTo(masts[2].x, -masts[2].h + 10); ctx.lineTo(72, -18);
        ctx.stroke();

        // Render each mast and billowing sails
        for (let m = 0; m < masts.length; m++) {
            const mast = masts[m];

            // Wooden Mast pole
            ctx.beginPath();
            ctx.moveTo(mast.x, 0);
            ctx.lineTo(mast.x, -mast.h);
            ctx.strokeStyle = mastColor;
            ctx.lineWidth = 2.4;
            ctx.stroke();

            // Yardarms (crossbars)
            ctx.beginPath();
            ctx.moveTo(mast.x - mast.sailW * 0.5, -mast.h * 0.85);
            ctx.lineTo(mast.x + mast.sailW * 0.5, -mast.h * 0.85);
            ctx.moveTo(mast.x - mast.sailW * 0.6, -mast.h * 0.45);
            ctx.lineTo(mast.x + mast.sailW * 0.6, -mast.h * 0.45);
            ctx.strokeStyle = mastColor;
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // Billowing Sail (animated wind curve)
            const windFlutter = Math.sin(time * 6 + m) * 3;
            const billow = mast.billow + windFlutter;

            // Main square sail
            ctx.beginPath();
            ctx.moveTo(mast.x - mast.sailW * 0.55, -mast.h * 0.85);
            ctx.quadraticCurveTo(
                mast.x + billow, -mast.h * 0.65,
                mast.x + mast.sailW * 0.55, -mast.h * 0.85
            );
            ctx.lineTo(mast.x + mast.sailW * 0.5, -mast.h * 0.45);
            ctx.quadraticCurveTo(
                mast.x + billow * 0.8, -mast.h * 0.35,
                mast.x - mast.sailW * 0.5, -mast.h * 0.45
            );
            ctx.closePath();

            // Sail gradient with storm shadow
            const sailGrad = ctx.createLinearGradient(mast.x - 15, -mast.h, mast.x + 20, 0);
            sailGrad.addColorStop(0, sailColor);
            sailGrad.addColorStop(1, sailShadow);
            ctx.fillStyle = sailGrad;
            ctx.fill();
            ctx.strokeStyle = isDark ? '#4f6277' : '#9bb1c6';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // Masthead Flag / Pennant fluttering vigorously in storm
            if (m === 1) { // Main mast flag
                const flagWave = Math.sin(time * 9) * 6;
                ctx.beginPath();
                ctx.moveTo(mast.x, -mast.h);
                ctx.quadraticCurveTo(mast.x - 12, -mast.h - 3 + flagWave, mast.x - 24, -mast.h + flagWave * 1.5);
                ctx.lineTo(mast.x - 16, -mast.h + 5 + flagWave * 0.5);
                ctx.lineTo(mast.x, -mast.h + 3);
                ctx.closePath();
                ctx.fillStyle = '#ea4335'; // Signature Google Red flag
                ctx.fill();

                // Fluttering CV Parchment Banner attached to mainmast
                const cvY = -mast.h - 22;
                const cvWave = Math.sin(time * 7) * 3;

                // Tether lines connecting to mainmast
                ctx.strokeStyle = isDark ? 'rgba(255, 215, 0, 0.65)' : 'rgba(180, 120, 20, 0.65)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(mast.x, -mast.h);
                ctx.lineTo(mast.x - 18, cvY + 8 + cvWave * 0.5);
                ctx.moveTo(mast.x, -mast.h);
                ctx.lineTo(mast.x + 18, cvY + 8 + cvWave * 0.5);
                ctx.stroke();

                // Glowing parchment scroll
                ctx.save();
                ctx.translate(mast.x, cvY + cvWave);
                ctx.rotate(Math.sin(time * 4.5) * 0.08);

                ctx.shadowColor = '#fbbc05';
                ctx.shadowBlur = isDark ? 16 : 8;

                // Parchment body
                ctx.fillStyle = isDark ? 'rgba(35, 25, 12, 0.95)' : 'rgba(255, 248, 230, 0.95)';
                ctx.strokeStyle = '#fbbc05';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.roundRect(-30, -12, 60, 24, 6);
                ctx.fill();
                ctx.stroke();

                // CV Banner text
                ctx.shadowBlur = 0;
                ctx.fillStyle = isDark ? '#ffd54f' : '#8d5b00';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('📜 CV', 0, 1);
                ctx.restore();
            }
        }

        // Jib sail (triangular sail at the bow)
        ctx.beginPath();
        ctx.moveTo(masts[2].x, -masts[2].h * 0.7);
        ctx.lineTo(65, -16);
        ctx.quadraticCurveTo(42, -26, masts[2].x, -10);
        ctx.closePath();
        ctx.fillStyle = sailColor;
        ctx.fill();
        ctx.strokeStyle = isDark ? '#4f6277' : '#9bb1c6';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Stern Lantern (Warm glowing lantern casting storm light)
        const lanternX = -46;
        const lanternY = -12;
        ctx.beginPath();
        ctx.arc(lanternX, lanternY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffb300';
        ctx.fill();

        // Radial glow from lantern
        const glowGrad = ctx.createRadialGradient(lanternX, lanternY, 1, lanternX, lanternY, isDark ? 22 : 12);
        glowGrad.addColorStop(0, 'rgba(255, 190, 0, 0.7)');
        glowGrad.addColorStop(0.5, 'rgba(255, 140, 0, 0.25)');
        glowGrad.addColorStop(1, 'rgba(255, 140, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(lanternX, lanternY, isDark ? 22 : 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ----------------------------------------------------------------------
    // Lightning System
    // ----------------------------------------------------------------------
    function updateLightning() {
        const now = Date.now();
        if (now > nextLightningTime) {
            triggerLightning();
            nextLightningTime = now + 4500 + Math.random() * 6500;
        }

        if (lightningIntensity > 0) {
            lightningIntensity -= 0.055;
            if (lightningIntensity < 0) lightningIntensity = 0;
        }
    }

    function triggerLightning() {
        lightningIntensity = 1.0;

        // Generate branching lightning bolt
        const startX = vortexCenter.x + (Math.random() - 0.5) * (width * 0.3);
        const startY = height * 0.05;
        const endX = startX + (Math.random() - 0.5) * 120;
        const endY = height * 0.75;

        lightningBolt = createLightningBranch(startX, startY, endX, endY, 6);
    }

    function createLightningBranch(x1, y1, x2, y2, depth) {
        if (depth === 0) {
            return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        }

        const midX = (x1 + x2) * 0.5 + (Math.random() - 0.5) * (depth * 18);
        const midY = (y1 + y2) * 0.5 + (Math.random() - 0.5) * (depth * 10);

        const leftBranch = createLightningBranch(x1, y1, midX, midY, depth - 1);
        const rightBranch = createLightningBranch(midX, midY, x2, y2, depth - 1);

        return leftBranch.concat(rightBranch.slice(1));
    }

    function drawLightning() {
        if (lightningIntensity <= 0 || !lightningBolt) return;

        ctx.save();
        // Atmospheric flash
        const flashAlpha = lightningIntensity * (isDark ? 0.35 : 0.22);
        ctx.fillStyle = isDark 
            ? `rgba(180, 225, 255, ${flashAlpha})` 
            : `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);

        // Draw bolt
        ctx.beginPath();
        for (let i = 0; i < lightningBolt.length; i++) {
            const pt = lightningBolt[i];
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = isDark 
            ? `rgba(220, 245, 255, ${lightningIntensity})` 
            : `rgba(255, 255, 255, ${lightningIntensity * 0.9})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#64b5f6';
        ctx.shadowBlur = 14;
        ctx.stroke();

        ctx.restore();
    }

    // ----------------------------------------------------------------------
    // Main Animation Loop
    // ----------------------------------------------------------------------
    let lastTime = 0;

    function animate(currentTime) {
        if (!isRunning) return;
        animationFrameId = requestAnimationFrame(animate);

        const dt = (currentTime - lastTime) * 0.001;
        lastTime = currentTime;
        const time = currentTime * 0.001;

        // Clear canvas with base atmospheric sky gradient
        ctx.clearRect(0, 0, width, height);

        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        if (isDark) {
            skyGrad.addColorStop(0, '#060a14');
            skyGrad.addColorStop(0.4, '#0a1222');
            skyGrad.addColorStop(0.75, '#101c34');
            skyGrad.addColorStop(1, '#050a12');
        } else {
            skyGrad.addColorStop(0, '#c7dcf0');
            skyGrad.addColorStop(0.35, '#b4cee8');
            skyGrad.addColorStop(0.7, '#9fbfe0');
            skyGrad.addColorStop(1, '#6b98bf');
        }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // 1. Draw swirling tornado vortex
        updateParticles();
        drawTornado();

        // 2. Draw lightning
        updateLightning();
        drawLightning();

        // 3. Update & Draw moving ship and wakes
        updateShip(time);
        drawShipWakes();
        drawShip(time);

        // Update floating interactive CV badge position to track the ship
        const cvBadge = document.getElementById('shipCvBadge');
        if (cvBadge) {
            const badgeX = ship.x;
            const badgeY = ship.y - (100 * ship.scale);
            cvBadge.style.transform = `translate3d(${badgeX}px, ${badgeY}px, 0)`;
        }

        // 4. Draw turbulent ocean waves (layering over lower ship hull)
        drawWaves(time);
    }

    // Start on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

