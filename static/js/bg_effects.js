(function() {
    const dynamicBgEl = document.getElementById('dynamic-bg');
    if (!dynamicBgEl) return;

    const legacyCosmos = document.getElementById('bg-cosmos-layer');
    if (legacyCosmos) {
        legacyCosmos.style.display = 'none';
    }
    const legacyFxCanvas = document.getElementById('bg-fx-canvas');
    if (legacyFxCanvas) {
        legacyFxCanvas.style.display = 'none';
        legacyFxCanvas.width = 1;
        legacyFxCanvas.height = 1;
    }

    let ultraCanvas = document.getElementById('bg-ultra-canvas');
    if (!ultraCanvas) {
        ultraCanvas = document.createElement('canvas');
        ultraCanvas.id = 'bg-ultra-canvas';
        dynamicBgEl.appendChild(ultraCanvas);
    }
    const uCtx = ultraCanvas.getContext('2d', { alpha: true });

    const STATIC_THEMES = new Set([
        'bg-light-dots', 'bg-light-grid', 'bg-light-paper',
        'bg-dots', 'bg-grid', 'bg-solid', 'bg-blueprint'
    ]);

    const RUNE_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '۞', '⚝', '❖', '✧'];
    const MATRIX_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ';

    const glowSpriteCache = {};
    function getGlowSprite(rgbStr, radius) {
        const key = rgbStr + '_' + radius;
        if (glowSpriteCache[key]) return glowSpriteCache[key];
        const sz = radius * 2;
        const off = document.createElement('canvas');
        off.width = sz;
        off.height = sz;
        const c = off.getContext('2d');
        const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
        g.addColorStop(0.0, `rgba(${rgbStr}, 1)`);
        g.addColorStop(0.22, `rgba(${rgbStr}, 0.65)`);
        g.addColorStop(0.52, `rgba(${rgbStr}, 0.22)`);
        g.addColorStop(0.82, `rgba(${rgbStr}, 0.04)`);
        g.addColorStop(1.0, `rgba(${rgbStr}, 0)`);
        c.fillStyle = g;
        c.fillRect(0, 0, sz, sz);
        glowSpriteCache[key] = off;
        return off;
    }

    let width = window.innerWidth || 1280;
    let height = window.innerHeight || 720;
    let currentTheme = (dynamicBgEl.className || 'bg-light-dots').trim().split(/\s+/)[0] || 'bg-light-dots';
    let animEnabled = localStorage.getItem('syncspace_bg_anim') !== '0';
    let staticCleared = false;
    let lastFrameTime = 0;
    let globalTime = 0;

    let stars = [];
    let nebulaClouds = [];
    let spiralParticles = [];
    let meteors = [];
    let wormholeRings = [];
    let solarPlanets = [];
    let asteroidBelt = [];
    let matrixCols = [];
    let floaters = [];

    function initSceneForTheme(theme) {
        stars = [];
        nebulaClouds = [];
        spiralParticles = [];
        meteors = [];
        wormholeRings = [];
        solarPlanets = [];
        asteroidBelt = [];
        matrixCols = [];
        floaters = [];
        staticCleared = false;

        const w = width;
        const h = height;
        const maxDim = Math.max(w, h);
        const minDim = Math.min(w, h);

        if (theme === 'bg-galaxy') {
            for (let i = 0; i < 190; i++) {
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.5 + Math.random() * 1.4,
                    alpha: 0.2 + Math.random() * 0.7,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.015 + Math.random() * 0.03,
                    color: i % 5 === 0 ? '#a5f3fc' : (i % 7 === 0 ? '#fde68a' : '#ffffff')
                });
            }
            const cloudColors = ['157, 78, 221', '0, 210, 255', '255, 71, 126', '254, 202, 87', '112, 161, 255'];
            for (let i = 0; i < 64; i++) {
                const arm = i % 4;
                const frac = Math.pow(Math.random(), 0.82);
                const dist = 28 + frac * (maxDim * 0.52);
                const armAngle = (arm * Math.PI * 0.5) + frac * 3.8 + (Math.random() - 0.5) * 0.45;
                nebulaClouds.push({
                    dist: dist,
                    angle: armAngle,
                    orbitSpeed: (0.0008 + (1 - frac) * 0.0018),
                    rgb: cloudColors[i % cloudColors.length],
                    size: Math.round(75 + (1 - frac * 0.4) * 115),
                    alpha: 0.11 + (1 - frac) * 0.14
                });
            }
            const starPal = ['#ffffff', '#00d2ff', '#ffeaa7', '#ff6b81', '#d6a2e8', '#70a1ff'];
            for (let i = 0; i < 420; i++) {
                const arm = i % 4;
                const frac = Math.pow(Math.random(), 0.75);
                const dist = 12 + frac * (maxDim * 0.56);
                const spread = (Math.random() - 0.5) * (0.35 + frac * 0.45);
                const angle = (arm * Math.PI * 0.5) + frac * 4.1 + spread;
                spiralParticles.push({
                    dist: dist,
                    angle: angle,
                    orbitSpeed: 0.0012 + (1 - frac) * 0.0032,
                    size: 0.8 + (1 - frac) * 1.9 + Math.random() * 0.8,
                    color: starPal[i % starPal.length],
                    alpha: 0.35 + Math.random() * 0.65,
                    phase: Math.random() * Math.PI * 2
                });
            }
        } else if (theme === 'bg-blackhole') {
            for (let i = 0; i < 160; i++) {
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.5 + Math.random() * 1.3,
                    alpha: 0.2 + Math.random() * 0.6,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.02 + Math.random() * 0.03,
                    color: '#ffffff'
                });
            }
            const bhRadius = minDim * 0.095;
            const diskPal = ['255, 245, 214', '255, 180, 67', '255, 110, 45', '255, 71, 87', '165, 94, 234', '0, 210, 255'];
            for (let i = 0; i < 55; i++) {
                const frac = Math.pow(Math.random(), 1.15);
                const dist = bhRadius * 1.25 + frac * (maxDim * 0.42);
                nebulaClouds.push({
                    dist: dist,
                    angle: Math.random() * Math.PI * 2,
                    orbitSpeed: 0.004 + (1 - frac) * 0.009,
                    rgb: diskPal[i % diskPal.length],
                    size: Math.round(55 + frac * 85),
                    alpha: 0.14 + (1 - frac) * 0.16
                });
            }
            const pColors = ['#fff8e7', '#ffd32a', '#ff9f43', '#ff6b6b', '#ff4757', '#70a1ff'];
            for (let i = 0; i < 360; i++) {
                const frac = Math.pow(Math.random(), 1.35);
                const dist = bhRadius * 1.12 + frac * (maxDim * 0.46);
                spiralParticles.push({
                    dist: dist,
                    angle: Math.random() * Math.PI * 2,
                    orbitSpeed: 0.0055 + (1 - frac) * 0.015,
                    size: 0.9 + (1 - frac) * 2.0,
                    color: pColors[i % pColors.length],
                    alpha: 0.45 + Math.random() * 0.55,
                    lensingHalo: i % 6 === 0
                });
            }
        } else if (theme === 'bg-nebula-vortex') {
            for (let i = 0; i < 140; i++) {
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.6 + Math.random() * 1.5,
                    alpha: 0.25 + Math.random() * 0.65,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.02 + Math.random() * 0.03,
                    color: '#ffffff'
                });
            }
            const nebRgb = ['0, 245, 212', '0, 187, 249', '155, 93, 229', '241, 91, 181', '254, 202, 87'];
            for (let i = 0; i < 72; i++) {
                const frac = Math.random();
                const dist = 20 + frac * (maxDim * 0.5);
                nebulaClouds.push({
                    dist: dist,
                    angle: (i % 3) * (Math.PI * 2 / 3) + frac * 3.2,
                    orbitSpeed: (i % 2 === 0 ? 1 : -0.8) * (0.001 + (1 - frac) * 0.0022),
                    rgb: nebRgb[i % nebRgb.length],
                    size: Math.round(90 + Math.random() * 120),
                    alpha: 0.12 + (1 - frac) * 0.12
                });
            }
            const vortexPal = ['#00f5d4', '#00d2ff', '#ff2e93', '#d6a2e8', '#ffffff'];
            for (let i = 0; i < 280; i++) {
                const frac = Math.random();
                spiralParticles.push({
                    dist: 15 + frac * (maxDim * 0.52),
                    angle: Math.random() * Math.PI * 2,
                    orbitSpeed: -0.002 - (1 - frac) * 0.004,
                    radialSpeed: 0.25 + Math.random() * 0.45,
                    maxDist: maxDim * 0.52,
                    size: 1.0 + Math.random() * 2.2,
                    color: vortexPal[i % vortexPal.length],
                    alpha: 0.4 + Math.random() * 0.6,
                    phase: Math.random() * Math.PI * 2
                });
            }
        } else if (theme === 'bg-astral-runes') {
            for (let i = 0; i < 110; i++) {
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.6 + Math.random() * 1.4,
                    alpha: 0.2 + Math.random() * 0.5,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.02 + Math.random() * 0.03,
                    color: i % 2 === 0 ? '#fde68a' : '#a5f3fc'
                });
            }
            const runePal = ['#feca57', '#00d2ff', '#ff9ff3', '#ffffff'];
            for (let i = 0; i < 130; i++) {
                const rFrac = 0.1 + (i % 5) * 0.085;
                spiralParticles.push({
                    dist: minDim * rFrac + (Math.random() - 0.5) * 24,
                    angle: Math.random() * Math.PI * 2,
                    orbitSpeed: ((i % 2 === 0) ? 1 : -1) * (0.0018 + (i % 5) * 0.0006),
                    size: 1.1 + Math.random() * 2.2,
                    color: runePal[i % runePal.length],
                    alpha: 0.45 + Math.random() * 0.55,
                    phase: Math.random() * Math.PI * 2
                });
            }
        } else if (theme === 'bg-wormhole') {
            for (let i = 0; i < 24; i++) {
                wormholeRings.push({
                    z: (i / 24) * 1000 + 40,
                    hue: (i * 15) % 360,
                    rot: i * 0.22
                });
            }
            const whPal = ['#00d2ff', '#00f5d4', '#a55eea', '#ff6b81', '#ffffff'];
            for (let i = 0; i < 260; i++) {
                spiralParticles.push({
                    angle: Math.random() * Math.PI * 2,
                    z: 40 + Math.random() * 960,
                    speedZ: 6.5 + Math.random() * 7.5,
                    spin: 0.012 + Math.random() * 0.015,
                    color: whPal[i % whPal.length],
                    size: 1.2 + Math.random() * 2.0
                });
            }
        } else if (theme === 'bg-solar-system') {
            for (let i = 0; i < 160; i++) {
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.5 + Math.random() * 1.4,
                    alpha: 0.25 + Math.random() * 0.65,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.018 + Math.random() * 0.03,
                    color: '#ffffff'
                });
            }
            const pDefs = [
                { name: 'Thủy Tinh', rFrac: 0.085, size: 3.8, speed: 0.013, c1: '#e2e8f0', c2: '#64748b' },
                { name: 'Kim Tinh', rFrac: 0.125, size: 5.4, speed: 0.0095, c1: '#fef08a', c2: '#d97706' },
                { name: 'Trái Đất', rFrac: 0.175, size: 6.2, speed: 0.0072, c1: '#38bdf8', c2: '#1d4ed8', hasMoon: true },
                { name: 'Hỏa Tinh', rFrac: 0.225, size: 4.8, speed: 0.0056, c1: '#fb7185', c2: '#9f1239' },
                { name: 'Mộc Tinh', rFrac: 0.310, size: 11.2, speed: 0.0036, c1: '#fdba74', c2: '#9a3412', banded: true },
                { name: 'Thổ Tinh', rFrac: 0.385, size: 9.4, speed: 0.0026, c1: '#fde047', c2: '#a16207', hasRing: true },
                { name: 'Thiên Vương', rFrac: 0.445, size: 7.2, speed: 0.0019, c1: '#67e8f9', c2: '#0e7490', thinRing: true },
                { name: 'Hải Vương', rFrac: 0.495, size: 7.0, speed: 0.0014, c1: '#818cf8', c2: '#312e81' }
            ];
            solarPlanets = pDefs.map((d, idx) => ({
                ...d,
                orbitR: minDim * d.rFrac,
                angle: idx * 0.95 + Math.random() * Math.PI * 2,
                moonAngle: Math.random() * Math.PI * 2
            }));
            for (let i = 0; i < 160; i++) {
                asteroidBelt.push({
                    orbitR: minDim * (0.258 + (Math.random() - 0.5) * 0.026),
                    angle: Math.random() * Math.PI * 2,
                    speed: 0.0042 + Math.random() * 0.0012,
                    size: 0.8 + Math.random() * 1.6,
                    alpha: 0.35 + Math.random() * 0.5
                });
            }
        } else if (theme === 'bg-magical' || theme === 'bg-stars') {
            for (let i = 0; i < 170; i++) {
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.6 + Math.random() * 1.8,
                    alpha: 0.25 + Math.random() * 0.75,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.02 + Math.random() * 0.035,
                    color: i % 4 === 0 ? '#00f5d4' : (i % 6 === 0 ? '#fde68a' : '#ffffff')
                });
            }
        } else if (theme === 'bg-deep-abyss') {
            for (let i = 0; i < 8; i++) {
                floaters.push({
                    isJelly: true,
                    x: (0.08 + Math.random() * 0.84) * w,
                    y: Math.random() * h,
                    vy: -0.35 - Math.random() * 0.4,
                    vx: (Math.random() - 0.5) * 0.25,
                    r: 16 + Math.random() * 16,
                    phase: Math.random() * Math.PI * 2,
                    color: i % 2 === 0 ? '#00f5d4' : (i % 3 === 0 ? '#ff6b81' : '#a55eea'),
                    rgb: i % 2 === 0 ? '0, 245, 212' : (i % 3 === 0 ? '255, 107, 129' : '165, 94, 234')
                });
            }
            for (let i = 0; i < 65; i++) {
                floaters.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vy: -0.25 - Math.random() * 0.55,
                    sway: 0.3 + Math.random() * 0.7,
                    r: 1.5 + Math.random() * 3.2,
                    phase: Math.random() * Math.PI * 2,
                    color: i % 2 === 0 ? '#00f5d4' : '#00bbf9'
                });
            }
        } else if (theme === 'bg-fireflies' || theme === 'bg-forest') {
            const cnt = theme === 'bg-fireflies' ? 75 : 42;
            const pal = ['184, 255, 1', '254, 202, 87', '85, 239, 196'];
            for (let i = 0; i < cnt; i++) {
                floaters.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -0.15 - Math.random() * 0.4,
                    r: 2.0 + Math.random() * 2.5,
                    rgb: pal[i % pal.length],
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.025 + Math.random() * 0.035
                });
            }
        } else if (theme === 'bg-lava-ember' || theme === 'bg-crystal-cave' || theme === 'bg-cyberpunk') {
            const pal = theme === 'bg-lava-ember'
                ? ['255, 71, 87', '255, 165, 2', '255, 211, 42']
                : (theme === 'bg-crystal-cave' ? ['214, 162, 232', '0, 210, 255', '255, 159, 243'] : ['0, 210, 255', '255, 46, 147', '254, 202, 87']);
            for (let i = 0; i < 72; i++) {
                floaters.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.45,
                    vy: theme === 'bg-lava-ember' ? (-0.6 - Math.random() * 1.2) : ((Math.random() - 0.5) * 0.35),
                    r: 1.8 + Math.random() * 2.8,
                    rgb: pal[i % pal.length],
                    phase: Math.random() * Math.PI * 2
                });
            }
        } else if (theme === 'bg-matrix') {
            const colW = 20;
            const cols = Math.min(96, Math.floor(w / colW));
            for (let i = 0; i < cols; i++) {
                matrixCols.push({
                    x: i * colW + 4,
                    y: Math.random() * h,
                    speed: 2.0 + Math.random() * 3.4,
                    len: 7 + Math.floor(Math.random() * 12),
                    seed: Math.floor(Math.random() * 100)
                });
            }
        } else if (theme === 'bg-light-sakura') {
            const pal = ['#ffb7c5', '#ff8da1', '#ffc9d6', '#ffdae4'];
            for (let i = 0; i < 52; i++) {
                floaters.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: 0.4 + Math.random() * 0.65,
                    vy: 0.6 + Math.random() * 0.95,
                    r: 5 + Math.random() * 5.5,
                    rot: Math.random() * Math.PI * 2,
                    rotSpd: (Math.random() - 0.5) * 0.03,
                    phase: Math.random() * Math.PI * 2,
                    color: pal[i % pal.length]
                });
            }
        } else if (theme === 'bg-light-clouds') {
            for (let i = 0; i < 15; i++) {
                floaters.push({
                    x: Math.random() * w,
                    y: (0.05 + Math.random() * 0.8) * h,
                    vx: 0.14 + Math.random() * 0.24,
                    r: 48 + Math.random() * 75,
                    alpha: 0.45 + Math.random() * 0.35
                });
            }
        } else if (theme.startsWith('bg-light-')) {
            const rgb = theme === 'bg-light-ocean'
                ? '0, 168, 255'
                : (theme === 'bg-light-mint' ? '0, 184, 148' : (theme === 'bg-light-sunset' ? '255, 127, 80' : '165, 94, 234'));
            for (let i = 0; i < 48; i++) {
                floaters.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vy: -0.25 - Math.random() * 0.5,
                    r: 5 + Math.random() * 14,
                    phase: Math.random() * Math.PI * 2,
                    rgb: rgb
                });
            }
        }
    }

    function resizeUltraCanvas() {
        width = window.innerWidth || 1280;
        height = window.innerHeight || 720;
        if (ultraCanvas.width !== width || ultraCanvas.height !== height) {
            ultraCanvas.width = width;
            ultraCanvas.height = height;
            initSceneForTheme(currentTheme);
        }
    }
    window.addEventListener('resize', resizeUltraCanvas);

    function syncThemeFromClass() {
        const cls = (dynamicBgEl.className || 'bg-light-dots').trim().split(/\s+/)[0] || 'bg-light-dots';
        document.body.classList.toggle('light-theme', cls.startsWith('bg-light-'));
        if (cls !== currentTheme) {
            currentTheme = cls;
            initSceneForTheme(currentTheme);
        }
    }

    if (typeof MutationObserver !== 'undefined') {
        const obs = new MutationObserver(syncThemeFromClass);
        obs.observe(dynamicBgEl, { attributes: true, attributeFilter: ['class'] });
    }

    const animToggle = document.getElementById('toggle-bg-anim');
    if (animToggle) {
        animToggle.addEventListener('change', (e) => {
            animEnabled = !!e.target.checked;
            staticCleared = false;
        });
    }

    try {
        if (typeof STATIC_BG_THEMES !== 'undefined' && STATIC_BG_THEMES.add) {
            [
                'bg-galaxy', 'bg-blackhole', 'bg-nebula-vortex', 'bg-astral-runes',
                'bg-wormhole', 'bg-solar-system', 'bg-magical', 'bg-fireflies',
                'bg-deep-abyss', 'bg-stars', 'bg-lava-ember', 'bg-crystal-cave',
                'bg-cyberpunk', 'bg-matrix', 'bg-forest', 'bg-light-sakura',
                'bg-light-clouds', 'bg-light-ocean', 'bg-light-mint',
                'bg-light-sunset', 'bg-light-pastel'
            ].forEach(t => STATIC_BG_THEMES.add(t));
        }
    } catch (e) {}

    function drawBackgroundStars() {
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            s.phase += s.speed;
            uCtx.globalAlpha = s.alpha * (0.45 + 0.55 * Math.sin(s.phase));
            uCtx.fillStyle = s.color;
            uCtx.beginPath();
            uCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            uCtx.fill();
        }
    }

    function renderGalaxyScene(cx, cy) {
        drawBackgroundStars();
        const tilt = 0.52;
        const rotAngle = -0.32;
        const cosR = Math.cos(rotAngle);
        const sinR = Math.sin(rotAngle);

        uCtx.save();
        uCtx.globalCompositeOperation = 'lighter';

        for (let i = 0; i < nebulaClouds.length; i++) {
            const nc = nebulaClouds[i];
            nc.angle += nc.orbitSpeed;
            const lx = Math.cos(nc.angle) * nc.dist;
            const ly = Math.sin(nc.angle) * nc.dist * tilt;
            const rx = cx + lx * cosR - ly * sinR;
            const ry = cy + lx * sinR + ly * cosR;
            const spr = getGlowSprite(nc.rgb, nc.size);
            uCtx.globalAlpha = nc.alpha;
            uCtx.drawImage(spr, rx - nc.size, ry - nc.size);
        }

        const coreR = Math.round(Math.min(width, height) * 0.28);
        const coreSpr = getGlowSprite('255, 225, 165', coreR);
        uCtx.globalAlpha = 0.72 + 0.12 * Math.sin(globalTime * 2);
        uCtx.drawImage(coreSpr, cx - coreR, cy - coreR);

        const innerSpr = getGlowSprite('255, 255, 255', Math.round(coreR * 0.45));
        uCtx.globalAlpha = 0.85;
        uCtx.drawImage(innerSpr, cx - coreR * 0.45, cy - coreR * 0.45);

        for (let i = 0; i < spiralParticles.length; i++) {
            const p = spiralParticles[i];
            p.angle += p.orbitSpeed;
            p.phase += 0.03;
            const lx = Math.cos(p.angle) * p.dist;
            const ly = Math.sin(p.angle) * p.dist * tilt;
            const rx = cx + lx * cosR - ly * sinR;
            const ry = cy + lx * sinR + ly * cosR;
            if (rx < -10 || rx > width + 10 || ry < -10 || ry > height + 10) continue;
            uCtx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.phase));
            uCtx.fillStyle = p.color;
            uCtx.beginPath();
            uCtx.arc(rx, ry, p.size, 0, Math.PI * 2);
            uCtx.fill();
        }
        uCtx.restore();
    }

    function renderBlackholeScene(cx, cy) {
        drawBackgroundStars();
        const bhR = Math.min(width, height) * 0.095;
        const diskTilt = 0.28;
        const rotAngle = -0.22;
        const cosR = Math.cos(rotAngle);
        const sinR = Math.sin(rotAngle);

        uCtx.save();
        uCtx.globalCompositeOperation = 'lighter';

        const lensOuter = Math.round(bhR * 2.5);
        const lensSpr = getGlowSprite('255, 145, 45', lensOuter);
        uCtx.globalAlpha = 0.65;
        uCtx.drawImage(lensSpr, cx - lensOuter, cy - lensOuter);

        for (let i = 0; i < nebulaClouds.length; i++) {
            const nc = nebulaClouds[i];
            nc.angle += nc.orbitSpeed;
            const sinA = Math.sin(nc.angle);
            if (sinA < 0) {
                const lx = Math.cos(nc.angle) * nc.dist;
                const ly = sinA * nc.dist * diskTilt;
                const rx = cx + lx * cosR - ly * sinR;
                const ry = cy + lx * sinR + ly * cosR;
                const spr = getGlowSprite(nc.rgb, nc.size);
                uCtx.globalAlpha = nc.alpha;
                uCtx.drawImage(spr, rx - nc.size, ry - nc.size);
            }
        }
        uCtx.restore();

        uCtx.save();
        uCtx.beginPath();
        uCtx.arc(cx, cy, bhR * 1.06, 0, Math.PI * 2);
        uCtx.strokeStyle = 'rgba(255, 235, 180, 0.9)';
        uCtx.lineWidth = 2.8;
        uCtx.shadowColor = '#ff9f43';
        uCtx.shadowBlur = 22;
        uCtx.stroke();

        uCtx.beginPath();
        uCtx.arc(cx, cy, bhR, 0, Math.PI * 2);
        uCtx.fillStyle = '#000000';
        uCtx.fill();
        uCtx.restore();

        uCtx.save();
        uCtx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < nebulaClouds.length; i++) {
            const nc = nebulaClouds[i];
            const sinA = Math.sin(nc.angle);
            if (sinA >= 0) {
                const lx = Math.cos(nc.angle) * nc.dist;
                const ly = sinA * nc.dist * diskTilt;
                const rx = cx + lx * cosR - ly * sinR;
                const ry = cy + lx * sinR + ly * cosR;
                const spr = getGlowSprite(nc.rgb, nc.size);
                uCtx.globalAlpha = nc.alpha * 1.15;
                uCtx.drawImage(spr, rx - nc.size, ry - nc.size);
            }
        }

        for (let i = 0; i < spiralParticles.length; i++) {
            const p = spiralParticles[i];
            p.angle += p.orbitSpeed;
            const lx = Math.cos(p.angle) * p.dist;
            const ly = Math.sin(p.angle) * p.dist * (p.lensingHalo ? 0.92 : diskTilt);
            if (!p.lensingHalo && Math.sin(p.angle) < 0 && Math.hypot(lx, ly) < bhR * 0.98) continue;
            const rx = cx + lx * cosR - ly * sinR;
            const ry = cy + lx * sinR + ly * cosR;
            const doppler = 0.55 + 0.45 * Math.cos(p.angle);
            uCtx.globalAlpha = Math.min(1, p.alpha * doppler);
            uCtx.fillStyle = p.color;
            uCtx.beginPath();
            uCtx.arc(rx, ry, p.size, 0, Math.PI * 2);
            uCtx.fill();
        }
        uCtx.restore();
    }

    function renderNebulaVortexScene(cx, cy) {
        drawBackgroundStars();
        uCtx.save();
        uCtx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < nebulaClouds.length; i++) {
            const nc = nebulaClouds[i];
            nc.angle += nc.orbitSpeed;
            const rx = cx + Math.cos(nc.angle) * nc.dist;
            const ry = cy + Math.sin(nc.angle) * nc.dist * 0.78;
            const spr = getGlowSprite(nc.rgb, nc.size);
            uCtx.globalAlpha = nc.alpha;
            uCtx.drawImage(spr, rx - nc.size, ry - nc.size);
        }

        const eyeSpr = getGlowSprite('0, 245, 212', 140);
        uCtx.globalAlpha = 0.55 + 0.15 * Math.sin(globalTime * 2.5);
        uCtx.drawImage(eyeSpr, cx - 140, cy - 140);

        for (let i = 0; i < spiralParticles.length; i++) {
            const p = spiralParticles[i];
            p.angle += p.orbitSpeed;
            p.dist -= p.radialSpeed;
            if (p.dist < 12) p.dist = p.maxDist;
            const rx = cx + Math.cos(p.angle) * p.dist;
            const ry = cy + Math.sin(p.angle) * p.dist * 0.8;
            uCtx.globalAlpha = p.alpha * Math.min(1, p.dist / 90);
            uCtx.fillStyle = p.color;
            uCtx.beginPath();
            uCtx.arc(rx, ry, p.size, 0, Math.PI * 2);
            uCtx.fill();
        }
        uCtx.restore();
    }

    function renderAstralRunesScene(cx, cy) {
        drawBackgroundStars();
        const minDim = Math.min(width, height);
        const rOuter = minDim * 0.38;
        const rMid = minDim * 0.27;
        const rInner = minDim * 0.15;

        uCtx.save();
        uCtx.globalCompositeOperation = 'lighter';

        const bgGlow = getGlowSprite('254, 202, 87', Math.round(rOuter * 1.15));
        uCtx.globalAlpha = 0.22;
        uCtx.drawImage(bgGlow, cx - rOuter * 1.15, cy - rOuter * 1.15);

        const coreGlow = getGlowSprite('0, 210, 255', Math.round(rInner * 1.2));
        uCtx.globalAlpha = 0.45 + 0.15 * Math.sin(globalTime * 3);
        uCtx.drawImage(coreGlow, cx - rInner * 1.2, cy - rInner * 1.2);

        uCtx.translate(cx, cy);

        uCtx.save();
        uCtx.rotate(globalTime * 0.22);
        uCtx.strokeStyle = 'rgba(254, 202, 87, 0.55)';
        uCtx.lineWidth = 2;
        uCtx.beginPath();
        uCtx.arc(0, 0, rOuter, 0, Math.PI * 2);
        uCtx.stroke();
        uCtx.beginPath();
        uCtx.arc(0, 0, rOuter * 0.92, 0, Math.PI * 2);
        uCtx.stroke();

        uCtx.font = 'bold 15px serif';
        uCtx.fillStyle = 'rgba(254, 202, 87, 0.85)';
        uCtx.textAlign = 'center';
        uCtx.textBaseline = 'middle';
        for (let i = 0; i < 12; i++) {
            const a = (i * Math.PI * 2) / 12;
            const gx = Math.cos(a) * (rOuter * 0.96);
            const gy = Math.sin(a) * (rOuter * 0.96);
            uCtx.fillText(RUNE_GLYPHS[i % RUNE_GLYPHS.length], gx, gy);
        }
        uCtx.restore();

        uCtx.save();
        uCtx.rotate(-globalTime * 0.35);
        uCtx.strokeStyle = 'rgba(0, 210, 255, 0.52)';
        uCtx.lineWidth = 1.8;
        for (let s = 0; s < 2; s++) {
            uCtx.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = (k * Math.PI) / 3 + (s * Math.PI) / 6;
                const px = Math.cos(a) * rMid;
                const py = Math.sin(a) * rMid;
                if (k === 0) uCtx.moveTo(px, py);
                else uCtx.lineTo(px, py);
            }
            uCtx.closePath();
            uCtx.stroke();
        }
        uCtx.restore();

        uCtx.save();
        uCtx.rotate(globalTime * 0.55);
        uCtx.strokeStyle = 'rgba(255, 159, 243, 0.65)';
        uCtx.lineWidth = 1.6;
        uCtx.setLineDash([8, 6]);
        uCtx.beginPath();
        uCtx.arc(0, 0, rInner, 0, Math.PI * 2);
        uCtx.stroke();
        uCtx.setLineDash([]);
        uCtx.restore();

        uCtx.restore();

        uCtx.save();
        uCtx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < spiralParticles.length; i++) {
            const p = spiralParticles[i];
            p.angle += p.orbitSpeed;
            p.phase += 0.035;
            const rx = cx + Math.cos(p.angle) * p.dist;
            const ry = cy + Math.sin(p.angle) * p.dist;
            uCtx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
            uCtx.fillStyle = p.color;
            uCtx.beginPath();
            uCtx.arc(rx, ry, p.size, 0, Math.PI * 2);
            uCtx.fill();
        }
        uCtx.restore();
    }

    function renderWormholeScene(cx, cy) {
        const maxR = Math.hypot(width, height) * 0.58;
        uCtx.save();
        uCtx.globalCompositeOperation = 'lighter';

        const centerSpr = getGlowSprite('0, 210, 255', 165);
        uCtx.globalAlpha = 0.7;
        uCtx.drawImage(centerSpr, cx - 165, cy - 165);

        for (let i = 0; i < wormholeRings.length; i++) {
            const ring = wormholeRings[i];
            ring.z -= 4.2;
            ring.rot += 0.012;
            if (ring.z <= 25) {
                ring.z = 1000;
            }
            const perspective = 260 / ring.z;
            const r = perspective * maxR * 0.45;
            if (r > maxR * 1.1) continue;
            const alpha = Math.min(0.65, (1 - ring.z / 1000) * 0.85);
            const wobbleX = Math.cos(globalTime * 1.8 + ring.z * 0.008) * (18 * (1 - ring.z / 1000));
            const wobbleY = Math.sin(globalTime * 1.5 + ring.z * 0.008) * (18 * (1 - ring.z / 1000));

            uCtx.strokeStyle = `hsla(${(ring.hue + globalTime * 25) % 360}, 90%, 65%, ${alpha})`;
            uCtx.lineWidth = Math.max(1, 3.2 * (1 - ring.z / 1000));
            uCtx.beginPath();
            uCtx.ellipse(cx + wobbleX, cy + wobbleY, r, r * 0.86, ring.rot, 0, Math.PI * 2);
            uCtx.stroke();
        }

        for (let i = 0; i < spiralParticles.length; i++) {
            const p = spiralParticles[i];
            const prevZ = p.z;
            p.z -= p.speedZ;
            p.angle += p.spin;
            if (p.z <= 25) {
                p.z = 1000;
                continue;
            }
            const r0 = (260 / prevZ) * maxR * 0.45;
            const r1 = (260 / p.z) * maxR * 0.45;
            const x0 = cx + Math.cos(p.angle) * r0;
            const y0 = cy + Math.sin(p.angle) * r0 * 0.86;
            const x1 = cx + Math.cos(p.angle) * r1;
            const y1 = cy + Math.sin(p.angle) * r1 * 0.86;
            uCtx.globalAlpha = Math.min(1, (1 - p.z / 1000) * 1.2);
            uCtx.strokeStyle = p.color;
            uCtx.lineWidth = p.size;
            uCtx.beginPath();
            uCtx.moveTo(x0, y0);
            uCtx.lineTo(x1, y1);
            uCtx.stroke();
        }
        uCtx.restore();
    }

    function renderSolarSystemScene(cx, cy) {
        drawBackgroundStars();
        const tilt = 0.58;
        const rot = -0.16;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);

        uCtx.save();
        uCtx.globalCompositeOperation = 'lighter';
        const sunGlow = getGlowSprite('255, 165, 2', 135);
        uCtx.globalAlpha = 0.85 + 0.1 * Math.sin(globalTime * 3);
        uCtx.drawImage(sunGlow, cx - 135, cy - 135);
        uCtx.restore();

        uCtx.save();
        const sunGrad = uCtx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 28);
        sunGrad.addColorStop(0, '#ffffff');
        sunGrad.addColorStop(0.4, '#fff2a3');
        sunGrad.addColorStop(0.8, '#ffa502');
        sunGrad.addColorStop(1, '#ff4757');
        uCtx.fillStyle = sunGrad;
        uCtx.beginPath();
        uCtx.arc(cx, cy, 26, 0, Math.PI * 2);
        uCtx.fill();

        for (let i = 0; i < solarPlanets.length; i++) {
            const pl = solarPlanets[i];
            uCtx.strokeStyle = 'rgba(112, 161, 255, 0.16)';
            uCtx.lineWidth = 1.1;
            uCtx.beginPath();
            uCtx.ellipse(cx, cy, pl.orbitR, pl.orbitR * tilt, rot, 0, Math.PI * 2);
            uCtx.stroke();
        }

        uCtx.fillStyle = 'rgba(203, 213, 225, 0.55)';
        for (let i = 0; i < asteroidBelt.length; i++) {
            const a = asteroidBelt[i];
            a.angle += a.speed;
            const ox = Math.cos(a.angle) * a.orbitR;
            const oy = Math.sin(a.angle) * a.orbitR * tilt;
            const ax = cx + ox * cosR - oy * sinR;
            const ay = cy + ox * sinR + oy * cosR;
            uCtx.globalAlpha = a.alpha;
            uCtx.fillRect(ax, ay, a.size, a.size);
        }
        uCtx.globalAlpha = 1;

        for (let i = 0; i < solarPlanets.length; i++) {
            const pl = solarPlanets[i];
            pl.angle += pl.speed;
            const ox = Math.cos(pl.angle) * pl.orbitR;
            const oy = Math.sin(pl.angle) * pl.orbitR * tilt;
            const px = cx + ox * cosR - oy * sinR;
            const py = cy + ox * sinR + oy * cosR;

            if (pl.hasRing || pl.thinRing) {
                uCtx.save();
                uCtx.strokeStyle = pl.hasRing ? 'rgba(253, 224, 71, 0.65)' : 'rgba(103, 232, 249, 0.45)';
                uCtx.lineWidth = pl.hasRing ? 3.2 : 1.5;
                uCtx.beginPath();
                uCtx.ellipse(px, py, pl.size * 2.2, pl.size * 0.75, 0.32, 0, Math.PI * 2);
                uCtx.stroke();
                uCtx.restore();
            }

            const pGrad = uCtx.createRadialGradient(px - pl.size * 0.3, py - pl.size * 0.3, 1, px, py, pl.size);
            pGrad.addColorStop(0, pl.c1);
            pGrad.addColorStop(1, pl.c2);
            uCtx.fillStyle = pGrad;
            uCtx.beginPath();
            uCtx.arc(px, py, pl.size, 0, Math.PI * 2);
            uCtx.fill();

            if (pl.hasMoon) {
                pl.moonAngle += 0.045;
                const mx = px + Math.cos(pl.moonAngle) * (pl.size * 2.4);
                const my = py + Math.sin(pl.moonAngle) * (pl.size * 1.5);
                uCtx.fillStyle = '#e2e8f0';
                uCtx.beginPath();
                uCtx.arc(mx, my, 2.0, 0, Math.PI * 2);
                uCtx.fill();
            }
        }
        uCtx.restore();
    }

    function renderOtherDynamicThemes(cx, cy, now) {
        if (currentTheme === 'bg-magical' || currentTheme === 'bg-stars') {
            drawBackgroundStars();
            if (currentTheme === 'bg-magical') {
                uCtx.save();
                uCtx.globalCompositeOperation = 'lighter';
                const colors = ['rgba(0, 245, 212, 0.14)', 'rgba(0, 187, 249, 0.12)', 'rgba(155, 93, 229, 0.13)'];
                for (let b = 0; b < 3; b++) {
                    uCtx.beginPath();
                    const baseY = height * (0.24 + b * 0.13);
                    for (let x = 0; x <= width; x += 36) {
                        const y = baseY + Math.sin(x * 0.0035 + globalTime * 1.6 + b) * 38 + Math.cos(x * 0.008 - globalTime * 1.1) * 18;
                        if (x === 0) uCtx.moveTo(x, y);
                        else uCtx.lineTo(x, y);
                    }
                    uCtx.strokeStyle = colors[b];
                    uCtx.lineWidth = 48;
                    uCtx.lineCap = 'round';
                    uCtx.stroke();
                }
                uCtx.restore();
            }
            if (Math.random() < (currentTheme === 'bg-stars' ? 0.065 : 0.03) && meteors.length < 5) {
                meteors.push({
                    x: Math.random() * width * 0.9 + width * 0.1,
                    y: Math.random() * height * 0.4,
                    vx: -7.5 - Math.random() * 4.5,
                    vy: 3.6 + Math.random() * 2.8,
                    life: 1.0
                });
            }
            for (let i = meteors.length - 1; i >= 0; i--) {
                const m = meteors[i];
                m.x += m.vx;
                m.y += m.vy;
                m.life -= 0.025;
                if (m.life <= 0) {
                    meteors.splice(i, 1);
                    continue;
                }
                const g = uCtx.createLinearGradient(m.x, m.y, m.x - m.vx * 9, m.y - m.vy * 9);
                g.addColorStop(0, `rgba(255, 255, 255, ${m.life})`);
                g.addColorStop(1, 'rgba(0, 210, 255, 0)');
                uCtx.strokeStyle = g;
                uCtx.lineWidth = 2.2;
                uCtx.beginPath();
                uCtx.moveTo(m.x, m.y);
                uCtx.lineTo(m.x - m.vx * 9, m.y - m.vy * 9);
                uCtx.stroke();
            }
        } else if (currentTheme === 'bg-deep-abyss') {
            uCtx.save();
            uCtx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < floaters.length; i++) {
                const f = floaters[i];
                f.phase += 0.035;
                if (f.isJelly) {
                    f.y += f.vy * (0.7 + 0.5 * Math.sin(f.phase));
                    f.x += f.vx + Math.sin(f.phase * 0.5) * 0.3;
                    if (f.y < -60) f.y = height + 60;
                    const spr = getGlowSprite(f.rgb, Math.round(f.r * 2.4));
                    uCtx.globalAlpha = 0.35;
                    uCtx.drawImage(spr, f.x - f.r * 2.4, f.y - f.r * 2.4);

                    uCtx.globalAlpha = 0.78;
                    uCtx.strokeStyle = f.color;
                    uCtx.fillStyle = `rgba(${f.rgb}, 0.25)`;
                    uCtx.lineWidth = 2;
                    const domeW = f.r * (0.92 + 0.1 * Math.sin(f.phase * 2));
                    uCtx.beginPath();
                    uCtx.arc(f.x, f.y, domeW, Math.PI, 0, false);
                    uCtx.closePath();
                    uCtx.fill();
                    uCtx.stroke();

                    for (let t = -2; t <= 2; t++) {
                        uCtx.beginPath();
                        const tx = f.x + t * (domeW * 0.32);
                        uCtx.moveTo(tx, f.y);
                        uCtx.quadraticCurveTo(
                            tx + Math.sin(f.phase * 2 + t) * 7,
                            f.y + f.r * 0.9,
                            tx + Math.cos(f.phase * 2 + t) * 5,
                            f.y + f.r * 1.7
                        );
                        uCtx.stroke();
                    }
                } else {
                    f.y += f.vy;
                    f.x += Math.sin(f.phase) * f.sway;
                    if (f.y < -15) f.y = height + 15;
                    uCtx.globalAlpha = 0.4 + 0.45 * Math.sin(f.phase);
                    uCtx.fillStyle = f.color;
                    uCtx.beginPath();
                    uCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                    uCtx.fill();
                }
            }
            uCtx.restore();
        } else if (currentTheme === 'bg-fireflies' || currentTheme === 'bg-forest' || currentTheme === 'bg-lava-ember' || currentTheme === 'bg-crystal-cave' || currentTheme === 'bg-cyberpunk') {
            if (currentTheme === 'bg-cyberpunk') {
                const hz = height * 0.65;
                uCtx.save();
                uCtx.strokeStyle = 'rgba(255, 46, 147, 0.24)';
                uCtx.lineWidth = 1.2;
                for (let i = 0; i < 9; i++) {
                    const gy = hz + Math.pow(i / 8, 1.65) * (height - hz);
                    uCtx.beginPath();
                    uCtx.moveTo(0, gy);
                    uCtx.lineTo(width, gy);
                    uCtx.stroke();
                }
                uCtx.strokeStyle = 'rgba(0, 210, 255, 0.22)';
                for (let i = -7; i <= 7; i++) {
                    uCtx.beginPath();
                    uCtx.moveTo(cx + i * 32, hz);
                    uCtx.lineTo(cx + i * 190, height);
                    uCtx.stroke();
                }
                uCtx.restore();
            }
            uCtx.save();
            uCtx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < floaters.length; i++) {
                const f = floaters[i];
                f.phase += f.speed || 0.03;
                f.x += f.vx + Math.sin(f.phase * 0.7) * 0.3;
                f.y += f.vy;
                if (f.y < -20) f.y = height + 20;
                if (f.y > height + 20) f.y = -20;
                if (f.x < -20) f.x = width + 20;
                if (f.x > width + 20) f.x = -20;
                const spr = getGlowSprite(f.rgb, Math.round(f.r * 5));
                uCtx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(f.phase));
                uCtx.drawImage(spr, f.x - f.r * 5, f.y - f.r * 5);
            }
            uCtx.restore();
        } else if (currentTheme === 'bg-matrix') {
            uCtx.font = 'bold 14px monospace';
            for (let i = 0; i < matrixCols.length; i++) {
                const col = matrixCols[i];
                col.y += col.speed;
                if (col.y - col.len * 16 > height) {
                    col.y = -20;
                    col.seed = Math.floor(Math.random() * 100);
                }
                for (let k = 0; k < col.len; k++) {
                    const cyPos = col.y - k * 16;
                    if (cyPos < -16 || cyPos > height + 16) continue;
                    const ch = MATRIX_CHARS[(col.seed + k * 7 + Math.floor(now * 0.01)) % MATRIX_CHARS.length];
                    uCtx.fillStyle = k === 0 ? '#a8ffdb' : '#00ff88';
                    uCtx.globalAlpha = (1 - k / col.len) * 0.58;
                    uCtx.fillText(ch, col.x, cyPos);
                }
            }
        } else if (currentTheme === 'bg-light-sakura') {
            for (let i = 0; i < floaters.length; i++) {
                const p = floaters[i];
                p.phase += 0.025;
                p.rot += p.rotSpd;
                p.x += p.vx + Math.sin(p.phase) * 0.45;
                p.y += p.vy;
                if (p.y > height + 20) {
                    p.y = -20;
                    p.x = Math.random() * width;
                }
                if (p.x > width + 20) p.x = -20;
                uCtx.save();
                uCtx.translate(p.x, p.y);
                uCtx.rotate(p.rot);
                uCtx.globalAlpha = 0.75;
                uCtx.fillStyle = p.color;
                uCtx.beginPath();
                uCtx.ellipse(0, 0, p.r, p.r * 0.56, 0, 0, Math.PI * 2);
                uCtx.fill();
                uCtx.restore();
            }
        } else if (currentTheme === 'bg-light-clouds') {
            for (let i = 0; i < floaters.length; i++) {
                const p = floaters[i];
                p.x += p.vx;
                if (p.x - p.r * 2 > width) p.x = -p.r * 2;
                uCtx.globalAlpha = p.alpha;
                uCtx.fillStyle = '#ffffff';
                uCtx.beginPath();
                uCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                uCtx.arc(p.x + p.r * 0.75, p.y + p.r * 0.1, p.r * 0.78, 0, Math.PI * 2);
                uCtx.arc(p.x - p.r * 0.72, p.y + p.r * 0.14, p.r * 0.72, 0, Math.PI * 2);
                uCtx.fill();
            }
        } else if (currentTheme.startsWith('bg-light-')) {
            for (let i = 0; i < floaters.length; i++) {
                const p = floaters[i];
                p.phase += 0.02;
                p.y += p.vy;
                p.x += Math.sin(p.phase) * 0.4;
                if (p.y < -30) p.y = height + 30;
                uCtx.globalAlpha = 0.35;
                uCtx.strokeStyle = `rgba(${p.rgb}, 0.45)`;
                uCtx.lineWidth = 1.5;
                uCtx.beginPath();
                uCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                uCtx.stroke();
            }
        }
    }

    function renderLoop(now) {
        requestAnimationFrame(renderLoop);
        if (document.hidden) return;
        if (STATIC_THEMES.has(currentTheme)) {
            if (!staticCleared) {
                uCtx.clearRect(0, 0, width, height);
                staticCleared = true;
            }
            return;
        }
        if (!animEnabled && staticCleared) return;
        if (now - lastFrameTime < 22) return;
        lastFrameTime = now;
        globalTime += 0.016;

        uCtx.clearRect(0, 0, width, height);
        const cx = width * 0.5;
        const cy = height * 0.5;

        if (currentTheme === 'bg-galaxy') {
            renderGalaxyScene(cx, cy);
        } else if (currentTheme === 'bg-blackhole') {
            renderBlackholeScene(cx, cy);
        } else if (currentTheme === 'bg-nebula-vortex') {
            renderNebulaVortexScene(cx, cy);
        } else if (currentTheme === 'bg-astral-runes') {
            renderAstralRunesScene(cx, cy);
        } else if (currentTheme === 'bg-wormhole') {
            renderWormholeScene(cx, cy);
        } else if (currentTheme === 'bg-solar-system') {
            renderSolarSystemScene(cx, cy);
        } else {
            renderOtherDynamicThemes(cx, cy, now);
        }

        uCtx.globalAlpha = 1;
        if (!animEnabled) {
            staticCleared = true;
        }
    }

    resizeUltraCanvas();
    syncThemeFromClass();
    initSceneForTheme(currentTheme);
    requestAnimationFrame(renderLoop);
})();
