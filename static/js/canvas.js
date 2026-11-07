const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const draftCanvas = document.getElementById('draft-board');
const draftCtx = draftCanvas.getContext('2d');
const laserCanvas = document.getElementById('laser-board');
const laserCtx = laserCanvas.getContext('2d');
const textLayer = document.getElementById('text-layer');
const workspace = document.getElementById('workspace');
const zoomIndicator = document.getElementById('zoom-indicator');
const dynamicBgEl = document.getElementById('dynamic-bg');

[canvas, draftCanvas, laserCanvas].forEach((cEl, idx) => {
    if (!cEl) return;
    if (cEl.parentElement !== document.body) {
        document.body.insertBefore(cEl, workspace);
    }
    cEl.style.position = 'fixed';
    cEl.style.top = '0px';
    cEl.style.left = '0px';
    cEl.style.width = '100vw';
    cEl.style.height = '100vh';
    cEl.style.zIndex = String(idx + 1);
});

let bgFxCanvas = document.getElementById('bg-fx-canvas');
let bgFxCtx = null;
if (dynamicBgEl) {
    dynamicBgEl.style.backgroundPosition = '';
    dynamicBgEl.style.transform = 'translate3d(0,0,0)';
    if (!document.getElementById('bg-cosmos-layer')) {
        const cosmosLayer = document.createElement('div');
        cosmosLayer.id = 'bg-cosmos-layer';
        cosmosLayer.className = 'bg-cosmos-layer';
        ['cosmos-nebula-glow', 'cosmos-wheel-outer', 'cosmos-wheel-mid', 'cosmos-wheel-inner', 'cosmos-core'].forEach(cls => {
            const d = document.createElement('div');
            d.className = cls;
            cosmosLayer.appendChild(d);
        });
        dynamicBgEl.appendChild(cosmosLayer);
    }
    if (!bgFxCanvas) {
        bgFxCanvas = document.createElement('canvas');
        bgFxCanvas.id = 'bg-fx-canvas';
        dynamicBgEl.appendChild(bgFxCanvas);
    }
    bgFxCtx = bgFxCanvas.getContext('2d', { alpha: true });
}

window.workspaceScale = 1;
window.eraserMode = localStorage.getItem('syncspace_eraser_mode') || 'point';
window.currentStamp = '❤️';
let panX = -(2500 - window.innerWidth / 2);
let panY = -(2500 - window.innerHeight / 2);
let targetScale = 1;
let targetPanX = panX;
let targetPanY = panY;
let lastCullTime = 0;

let drawing = false;
let isPanning = false;
let spacePressed = false;
let panStartX = 0;
let panStartY = 0;
let currentTool = 'pan';
let currentColor = '#00d2ff';
let currentWidth = 4;
let currentOpacity = 1.0;
let rainbowHue = 0;
let strokeHistory = [];
let currentStroke = null;
let remoteLiveStrokes = {};
let textDragBox = null;
let activeTextBoxId = null;
let lastEmitTime = 0;
let laserTrails = [];

let needsRedrawAll = true;
let needsRedrawDraft = true;
let pendingDeletedStrokeIds = new Set();
let flushDeleteTimer = null;
let pendingEraserPoints = [];
let flushEraserSegmentTimer = null;

const STATIC_BG_THEMES = new Set(['bg-light-dots', 'bg-light-grid', 'bg-light-paper', 'bg-dots', 'bg-grid', 'bg-solid', 'bg-blueprint']);
let currentBgTheme = (dynamicBgEl && dynamicBgEl.className) ? dynamicBgEl.className.trim() : 'bg-light-dots';
let bgAnimEnabled = localStorage.getItem('syncspace_bg_anim') !== '0';
let bgFxWidth = window.innerWidth || 1280;
let bgFxHeight = window.innerHeight || 720;
let bgParticles = [];
let bgMeteors = [];
let bgMatrixCols = [];
let bgSolarPlanets = [];
let bgGlobalAngle = 0;
let lastBgFrameTime = 0;
let bgStaticDrawn = false;

const MATRIX_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ';

function initBgParticlesForTheme(theme) {
    bgParticles = [];
    bgMeteors = [];
    bgMatrixCols = [];
    bgSolarPlanets = [];
    bgStaticDrawn = false;
    const w = bgFxWidth;
    const h = bgFxHeight;
    const maxR = Math.hypot(w, h) * 0.62;

    if (theme === 'bg-galaxy' || theme === 'bg-nebula-vortex') {
        const count = theme === 'bg-galaxy' ? 170 : 130;
        const palette = theme === 'bg-galaxy'
            ? ['#ffffff', '#00d2ff', '#ffd89b', '#ff6b81', '#d6a2e8', '#70a1ff']
            : ['#00f5d4', '#00d2ff', '#ff2e93', '#d6a2e8', '#ffffff'];
        for (let i = 0; i < count; i++) {
            const arm = i % 3;
            const frac = Math.pow(Math.random(), 0.78);
            const r = 18 + frac * maxR;
            const baseAng = (arm * (Math.PI * 2 / 3)) + frac * 4.2 + (Math.random() - 0.5) * 0.65;
            bgParticles.push({
                r: r,
                angle: baseAng,
                speed: (0.0018 + (1 - frac) * 0.0038) * (theme === 'bg-galaxy' ? 1 : -0.85),
                size: 0.9 + Math.random() * 2.2,
                color: palette[i % palette.length],
                alpha: 0.35 + Math.random() * 0.65,
                twinkleSpeed: 0.02 + Math.random() * 0.04,
                phase: Math.random() * Math.PI * 2,
                tilt: theme === 'bg-galaxy' ? 0.58 : 0.85
            });
        }
        for (let i = 0; i < 65; i++) {
            bgParticles.push({
                staticStar: true,
                x: Math.random() * w,
                y: Math.random() * h,
                size: 0.7 + Math.random() * 1.4,
                color: '#ffffff',
                alpha: 0.25 + Math.random() * 0.6,
                twinkleSpeed: 0.015 + Math.random() * 0.03,
                phase: Math.random() * Math.PI * 2
            });
        }
    } else if (theme === 'bg-blackhole') {
        const palette = ['#fff6d6', '#ffbe76', '#ff9f43', '#ff6b6b', '#a55eea', '#00d2ff'];
        const baseHoleR = Math.min(w, h) * 0.11;
        for (let i = 0; i < 165; i++) {
            const frac = Math.pow(Math.random(), 1.25);
            const r = baseHoleR * 1.18 + frac * (maxR * 0.85);
            bgParticles.push({
                r: r,
                angle: Math.random() * Math.PI * 2,
                speed: 0.0045 + (1 - frac) * 0.012,
                size: 1.0 + Math.random() * 2.3,
                color: palette[i % palette.length],
                alpha: 0.4 + Math.random() * 0.6,
                tilt: 0.38,
                lensing: i % 5 === 0
            });
        }
    } else if (theme === 'bg-astral-runes') {
        const palette = ['#feca57', '#00d2ff', '#ff9ff3', '#fff2a3'];
        for (let i = 0; i < 95; i++) {
            const ringIdx = i % 4;
            const ringR = Math.min(w, h) * (0.14 + ringIdx * 0.1);
            bgParticles.push({
                r: ringR + (Math.random() - 0.5) * 26,
                angle: Math.random() * Math.PI * 2,
                speed: (ringIdx % 2 === 0 ? 1 : -1) * (0.002 + ringIdx * 0.0008),
                size: 1.2 + Math.random() * 2.2,
                color: palette[i % palette.length],
                alpha: 0.45 + Math.random() * 0.55,
                phase: Math.random() * Math.PI * 2
            });
        }
    } else if (theme === 'bg-wormhole') {
        const palette = ['#00d2ff', '#70a1ff', '#d6a2e8', '#55efc4', '#ffffff'];
        for (let i = 0; i < 140; i++) {
            bgParticles.push({
                r: 12 + Math.random() * maxR,
                angle: Math.random() * Math.PI * 2,
                speed: 0.006 + Math.random() * 0.008,
                radialSpeed: 0.65 + Math.random() * 1.4,
                maxR: maxR,
                size: 1.1 + Math.random() * 2.2,
                color: palette[i % palette.length],
                alpha: 0.45 + Math.random() * 0.55
            });
        }
    } else if (theme === 'bg-solar-system') {
        const minDim = Math.min(w, h);
        const defs = [
            { name: 'Mercury', rFrac: 0.09, size: 3.2, speed: 0.014, color: '#cbd5e1' },
            { name: 'Venus', rFrac: 0.13, size: 4.6, speed: 0.010, color: '#feca57' },
            { name: 'Earth', rFrac: 0.18, size: 5.2, speed: 0.0075, color: '#00d2ff', hasMoon: true },
            { name: 'Mars', rFrac: 0.23, size: 4.0, speed: 0.0058, color: '#ff6b6b' },
            { name: 'Jupiter', rFrac: 0.30, size: 8.8, speed: 0.0038, color: '#ff9f43' },
            { name: 'Saturn', rFrac: 0.37, size: 7.4, speed: 0.0028, color: '#ffeaa7', hasRing: true },
            { name: 'Uranus', rFrac: 0.43, size: 5.8, speed: 0.0020, color: '#7bed9f' },
            { name: 'Neptune', rFrac: 0.48, size: 5.6, speed: 0.0015, color: '#5352ed' }
        ];
        bgSolarPlanets = defs.map((d, idx) => ({
            ...d,
            orbitR: minDim * d.rFrac,
            angle: idx * 1.1 + Math.random() * Math.PI * 2,
            moonAngle: Math.random() * Math.PI * 2
        }));
        for (let i = 0; i < 120; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 0.8 + Math.random() * 1.6,
                color: i % 4 === 0 ? '#a8e6cf' : '#ffffff',
                alpha: 0.3 + Math.random() * 0.65,
                twinkleSpeed: 0.02 + Math.random() * 0.03,
                phase: Math.random() * Math.PI * 2
            });
        }
    } else if (theme === 'bg-magical' || theme === 'bg-stars') {
        const count = theme === 'bg-stars' ? 145 : 95;
        for (let i = 0; i < count; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 0.8 + Math.random() * 1.9,
                color: i % 5 === 0 ? '#00d2ff' : (i % 7 === 0 ? '#ffeaa7' : '#ffffff'),
                alpha: 0.3 + Math.random() * 0.7,
                twinkleSpeed: 0.018 + Math.random() * 0.035,
                phase: Math.random() * Math.PI * 2
            });
        }
    } else if (theme === 'bg-fireflies' || theme === 'bg-forest') {
        const count = theme === 'bg-fireflies' ? 68 : 36;
        const palette = ['#b8ff01', '#feca57', '#55efc4', '#7bed9f'];
        for (let i = 0; i < count; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.55,
                vy: -0.15 - Math.random() * 0.45,
                size: 2.0 + Math.random() * 3.2,
                color: palette[i % palette.length],
                phase: Math.random() * Math.PI * 2,
                twinkleSpeed: 0.025 + Math.random() * 0.035
            });
        }
    } else if (theme === 'bg-deep-abyss' || theme === 'bg-light-ocean' || theme === 'bg-light-mint' || theme === 'bg-light-pastel' || theme === 'bg-light-sunset') {
        const isLight = theme.startsWith('bg-light-');
        const palette = theme === 'bg-deep-abyss'
            ? ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5']
            : (theme === 'bg-light-ocean' ? ['rgba(255,255,255,0.75)', 'rgba(9,132,227,0.28)', 'rgba(0,210,255,0.38)']
            : (theme === 'bg-light-mint' ? ['rgba(255,255,255,0.8)', 'rgba(0,184,148,0.28)', 'rgba(85,239,196,0.45)']
            : (theme === 'bg-light-sunset' ? ['rgba(255,255,255,0.7)', 'rgba(255,159,67,0.35)', 'rgba(255,107,107,0.3)']
            : ['rgba(255,255,255,0.75)', 'rgba(165,94,234,0.26)', 'rgba(0,210,255,0.26)'])));
        for (let i = 0; i < 56; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vy: -0.25 - Math.random() * 0.65,
                swayAmp: 0.3 + Math.random() * 0.8,
                size: isLight ? (4 + Math.random() * 14) : (2.2 + Math.random() * 4.8),
                color: palette[i % palette.length],
                phase: Math.random() * Math.PI * 2,
                isBubble: isLight
            });
        }
    } else if (theme === 'bg-lava-ember' || theme === 'bg-crystal-cave' || theme === 'bg-cyberpunk') {
        const palette = theme === 'bg-lava-ember'
            ? ['#ff4757', '#ffa502', '#ff6348', '#ffeaa7']
            : (theme === 'bg-crystal-cave' ? ['#d6a2e8', '#00d2ff', '#ff9ff3', '#ffffff'] : ['#00d2ff', '#ff2e93', '#feca57']);
        for (let i = 0; i < 65; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.45,
                vy: theme === 'bg-lava-ember' ? (-0.5 - Math.random() * 1.1) : ((Math.random() - 0.5) * 0.35),
                size: 1.5 + Math.random() * 3.0,
                color: palette[i % palette.length],
                phase: Math.random() * Math.PI * 2
            });
        }
    } else if (theme === 'bg-matrix') {
        const colW = 22;
        const cols = Math.min(90, Math.floor(w / colW));
        for (let i = 0; i < cols; i++) {
            bgMatrixCols.push({
                x: i * colW + 6,
                y: Math.random() * h,
                speed: 1.8 + Math.random() * 3.2,
                len: 6 + Math.floor(Math.random() * 10),
                seed: Math.floor(Math.random() * 100)
            });
        }
    } else if (theme === 'bg-light-sakura') {
        const palette = ['#ffb7c5', '#ff8da1', '#ffc9d6', '#fff0f5'];
        for (let i = 0; i < 46; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: 0.35 + Math.random() * 0.65,
                vy: 0.55 + Math.random() * 0.95,
                size: 5 + Math.random() * 6,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.03,
                swayPhase: Math.random() * Math.PI * 2,
                color: palette[i % palette.length]
            });
        }
    } else if (theme === 'bg-light-clouds') {
        for (let i = 0; i < 14; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: (0.06 + Math.random() * 0.78) * h,
                vx: 0.12 + Math.random() * 0.25,
                r: 45 + Math.random() * 75,
                alpha: 0.42 + Math.random() * 0.35
            });
        }
    }
}

function resizeBgFxCanvas() {
    if (!bgFxCanvas) return;
    bgFxWidth = window.innerWidth || 1280;
    bgFxHeight = window.innerHeight || 720;
    if (bgFxCanvas.width !== bgFxWidth || bgFxCanvas.height !== bgFxHeight) {
        bgFxCanvas.width = bgFxWidth;
        bgFxCanvas.height = bgFxHeight;
        initBgParticlesForTheme(currentBgTheme);
    }
}

function syncThemeStateFromDom() {
    if (!dynamicBgEl) return;
    const cls = (dynamicBgEl.className || 'bg-light-dots').trim().split(/\s+/)[0] || 'bg-light-dots';
    const isLight = cls.startsWith('bg-light-');
    document.body.classList.toggle('light-theme', isLight);
    document.querySelectorAll('.bg-opt-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-bg') === cls);
    });
    if (cls !== currentBgTheme) {
        currentBgTheme = cls;
        initBgParticlesForTheme(currentBgTheme);
    }
}

if (dynamicBgEl && typeof MutationObserver !== 'undefined') {
    const bgObserver = new MutationObserver(() => {
        syncThemeStateFromDom();
    });
    bgObserver.observe(dynamicBgEl, { attributes: true, attributeFilter: ['class'] });
}

const toggleBgAnimCheckbox = document.getElementById('toggle-bg-anim');
if (toggleBgAnimCheckbox) {
    toggleBgAnimCheckbox.checked = bgAnimEnabled;
    document.body.classList.toggle('pause-bg-anim', !bgAnimEnabled);
    toggleBgAnimCheckbox.addEventListener('change', (e) => {
        bgAnimEnabled = !!e.target.checked;
        localStorage.setItem('syncspace_bg_anim', bgAnimEnabled ? '1' : '0');
        document.body.classList.toggle('pause-bg-anim', !bgAnimEnabled);
        bgStaticDrawn = false;
    });
}

function renderBgFxFrame(now) {
    if (!bgFxCtx || !bgFxCanvas) return;
    if (document.hidden) return;
    if (STATIC_BG_THEMES.has(currentBgTheme)) {
        if (!bgStaticDrawn) {
            bgFxCtx.clearRect(0, 0, bgFxWidth, bgFxHeight);
            bgStaticDrawn = true;
        }
        return;
    }
    if (!bgAnimEnabled && bgStaticDrawn) return;

    const busyInteraction = isPanning || drawing || globalPinchActive;
    const minInterval = busyInteraction ? 36 : 22;
    if (now - lastBgFrameTime < minInterval) return;
    lastBgFrameTime = now;
    bgGlobalAngle += 0.0025;

    const w = bgFxWidth;
    const h = bgFxHeight;
    const cx = w * 0.5;
    const cy = h * 0.5;
    bgFxCtx.clearRect(0, 0, w, h);

    if (currentBgTheme === 'bg-galaxy' || currentBgTheme === 'bg-nebula-vortex') {
        const armAngleOffset = currentBgTheme === 'bg-galaxy' ? 0.52 : -0.35;
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            if (p.staticStar) {
                p.phase += p.twinkleSpeed;
                const al = p.alpha * (0.55 + 0.45 * Math.sin(p.phase));
                bgFxCtx.fillStyle = p.color;
                bgFxCtx.globalAlpha = al;
                bgFxCtx.beginPath();
                bgFxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                bgFxCtx.fill();
                continue;
            }
            p.angle += p.speed;
            p.phase += p.twinkleSpeed;
            const lx = Math.cos(p.angle) * p.r;
            const ly = Math.sin(p.angle) * p.r * p.tilt;
            const rx = cx + lx * Math.cos(armAngleOffset) - ly * Math.sin(armAngleOffset);
            const ry = cy + lx * Math.sin(armAngleOffset) + ly * Math.cos(armAngleOffset);
            if (rx < -10 || rx > w + 10 || ry < -10 || ry > h + 10) continue;
            bgFxCtx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.phase));
            bgFxCtx.fillStyle = p.color;
            bgFxCtx.beginPath();
            bgFxCtx.arc(rx, ry, p.size, 0, Math.PI * 2);
            bgFxCtx.fill();
        }
    } else if (currentBgTheme === 'bg-blackhole') {
        const tiltAngle = -0.22;
        const cosT = Math.cos(tiltAngle);
        const sinT = Math.sin(tiltAngle);
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.angle += p.speed;
            const lx = Math.cos(p.angle) * p.r;
            const ly = Math.sin(p.angle) * p.r * (p.lensing ? 0.92 : p.tilt);
            const rx = cx + lx * cosT - ly * sinT;
            const ry = cy + lx * sinT + ly * cosT;
            const doppler = 0.65 + 0.35 * Math.cos(p.angle);
            bgFxCtx.globalAlpha = Math.min(1, p.alpha * doppler);
            bgFxCtx.fillStyle = p.color;
            bgFxCtx.beginPath();
            bgFxCtx.arc(rx, ry, p.size, 0, Math.PI * 2);
            bgFxCtx.fill();
        }
    } else if (currentBgTheme === 'bg-astral-runes') {
        bgFxCtx.save();
        bgFxCtx.translate(cx, cy);
        bgFxCtx.rotate(bgGlobalAngle * 0.8);
        bgFxCtx.strokeStyle = 'rgba(254, 202, 87, 0.22)';
        bgFxCtx.lineWidth = 1.4;
        const polyR = Math.min(w, h) * 0.27;
        for (let s = 0; s < 2; s++) {
            bgFxCtx.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = (k * Math.PI / 3) + (s * Math.PI / 6);
                const px = Math.cos(a) * polyR;
                const py = Math.sin(a) * polyR;
                if (k === 0) bgFxCtx.moveTo(px, py);
                else bgFxCtx.lineTo(px, py);
            }
            bgFxCtx.closePath();
            bgFxCtx.stroke();
        }
        bgFxCtx.restore();

        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.angle += p.speed;
            p.phase += 0.03;
            const rx = cx + Math.cos(p.angle) * p.r;
            const ry = cy + Math.sin(p.angle) * p.r;
            bgFxCtx.globalAlpha = p.alpha * (0.55 + 0.45 * Math.sin(p.phase));
            bgFxCtx.fillStyle = p.color;
            bgFxCtx.beginPath();
            bgFxCtx.arc(rx, ry, p.size, 0, Math.PI * 2);
            bgFxCtx.fill();
        }
    } else if (currentBgTheme === 'bg-wormhole') {
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.angle += p.speed;
            p.r -= p.radialSpeed;
            if (p.r < 14) {
                p.r = p.maxR;
                p.angle = Math.random() * Math.PI * 2;
            }
            const rx0 = cx + Math.cos(p.angle) * p.r;
            const ry0 = cy + Math.sin(p.angle) * p.r;
            const rx1 = cx + Math.cos(p.angle - 0.04) * (p.r + 12);
            const ry1 = cy + Math.sin(p.angle - 0.04) * (p.r + 12);
            const fade = Math.min(1, p.r / (p.maxR * 0.45));
            bgFxCtx.globalAlpha = p.alpha * fade;
            bgFxCtx.strokeStyle = p.color;
            bgFxCtx.lineWidth = p.size;
            bgFxCtx.beginPath();
            bgFxCtx.moveTo(rx0, ry0);
            bgFxCtx.lineTo(rx1, ry1);
            bgFxCtx.stroke();
        }
    } else if (currentBgTheme === 'bg-solar-system') {
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.phase += p.twinkleSpeed;
            bgFxCtx.globalAlpha = p.alpha * (0.55 + 0.45 * Math.sin(p.phase));
            bgFxCtx.fillStyle = p.color;
            bgFxCtx.beginPath();
            bgFxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            bgFxCtx.fill();
        }
        bgFxCtx.globalAlpha = 0.16;
        bgFxCtx.strokeStyle = '#70a1ff';
        bgFxCtx.lineWidth = 1;
        for (let i = 0; i < bgSolarPlanets.length; i++) {
            const pl = bgSolarPlanets[i];
            bgFxCtx.beginPath();
            bgFxCtx.ellipse(cx, cy, pl.orbitR, pl.orbitR * 0.62, -0.18, 0, Math.PI * 2);
            bgFxCtx.stroke();
        }
        const cosTilt = Math.cos(-0.18);
        const sinTilt = Math.sin(-0.18);
        for (let i = 0; i < bgSolarPlanets.length; i++) {
            const pl = bgSolarPlanets[i];
            pl.angle += pl.speed;
            const ox = Math.cos(pl.angle) * pl.orbitR;
            const oy = Math.sin(pl.angle) * pl.orbitR * 0.62;
            const px = cx + ox * cosTilt - oy * sinTilt;
            const py = cy + ox * sinTilt + oy * cosTilt;
            bgFxCtx.globalAlpha = 0.95;
            bgFxCtx.fillStyle = pl.color;
            bgFxCtx.beginPath();
            bgFxCtx.arc(px, py, pl.size, 0, Math.PI * 2);
            bgFxCtx.fill();
            if (pl.hasRing) {
                bgFxCtx.strokeStyle = 'rgba(255, 234, 167, 0.75)';
                bgFxCtx.lineWidth = 1.8;
                bgFxCtx.beginPath();
                bgFxCtx.ellipse(px, py, pl.size * 2.1, pl.size * 0.7, 0.35, 0, Math.PI * 2);
                bgFxCtx.stroke();
            }
            if (pl.hasMoon) {
                pl.moonAngle += 0.045;
                const mx = px + Math.cos(pl.moonAngle) * (pl.size * 2.3);
                const my = py + Math.sin(pl.moonAngle) * (pl.size * 1.5);
                bgFxCtx.fillStyle = '#ffffff';
                bgFxCtx.beginPath();
                bgFxCtx.arc(mx, my, 1.8, 0, Math.PI * 2);
                bgFxCtx.fill();
            }
        }
    } else if (currentBgTheme === 'bg-magical' || currentBgTheme === 'bg-stars') {
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.phase += p.twinkleSpeed;
            bgFxCtx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
            bgFxCtx.fillStyle = p.color;
            bgFxCtx.beginPath();
            bgFxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            bgFxCtx.fill();
        }
        if (currentBgTheme === 'bg-magical') {
            for (let band = 0; band < 2; band++) {
                bgFxCtx.beginPath();
                const baseY = h * (0.28 + band * 0.16);
                for (let x = 0; x <= w; x += 48) {
                    const y = baseY + Math.sin(x * 0.004 + bgGlobalAngle * 2.2 + band) * 34 + Math.cos(x * 0.009 - bgGlobalAngle * 1.5) * 18;
                    if (x === 0) bgFxCtx.moveTo(x, y);
                    else bgFxCtx.lineTo(x, y);
                }
                bgFxCtx.strokeStyle = band === 0 ? 'rgba(0, 245, 212, 0.16)' : 'rgba(165, 94, 234, 0.15)';
                bgFxCtx.lineWidth = 36;
                bgFxCtx.lineCap = 'round';
                bgFxCtx.globalAlpha = 1;
                bgFxCtx.stroke();
            }
        }
        if (Math.random() < (currentBgTheme === 'bg-stars' ? 0.055 : 0.025) && bgMeteors.length < 4) {
            bgMeteors.push({
                x: Math.random() * w * 0.85 + w * 0.1,
                y: Math.random() * h * 0.45,
                vx: -6.5 - Math.random() * 4.5,
                vy: 3.2 + Math.random() * 2.8,
                len: 55 + Math.random() * 45,
                life: 1.0
            });
        }
        for (let i = bgMeteors.length - 1; i >= 0; i--) {
            const m = bgMeteors[i];
            m.x += m.vx;
            m.y += m.vy;
            m.life -= 0.028;
            if (m.life <= 0 || m.x < -100 || m.y > h + 100) {
                bgMeteors.splice(i, 1);
                continue;
            }
            const grad = bgFxCtx.createLinearGradient(m.x, m.y, m.x - m.vx * 8, m.y - m.vy * 8);
            grad.addColorStop(0, `rgba(255, 255, 255, ${m.life})`);
            grad.addColorStop(1, 'rgba(0, 210, 255, 0)');
            bgFxCtx.globalAlpha = 1;
            bgFxCtx.strokeStyle = grad;
            bgFxCtx.lineWidth = 2.1;
            bgFxCtx.beginPath();
            bgFxCtx.moveTo(m.x, m.y);
            bgFxCtx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8);
            bgFxCtx.stroke();
        }
    } else if (currentBgTheme === 'bg-fireflies' || currentBgTheme === 'bg-forest') {
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.phase += p.twinkleSpeed;
            p.x += p.vx + Math.sin(p.phase * 0.7) * 0.35;
            p.y += p.vy;
            if (p.y < -15) p.y = h + 15;
            if (p.x < -15) p.x = w + 15;
            if (p.x > w + 15) p.x = -15;
            const glow = 0.3 + 0.7 * Math.abs(Math.sin(p.phase));
            bgFxCtx.globalAlpha = glow * 0.25;
            bgFxCtx.fillStyle = p.color;
            bgFxCtx.beginPath();
            bgFxCtx.arc(p.x, p.y, p.size * 3.2, 0, Math.PI * 2);
            bgFxCtx.fill();
            bgFxCtx.globalAlpha = glow;
            bgFxCtx.beginPath();
            bgFxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            bgFxCtx.fill();
        }
    } else if (currentBgTheme === 'bg-deep-abyss' || currentBgTheme === 'bg-light-ocean' || currentBgTheme === 'bg-light-mint' || currentBgTheme === 'bg-light-pastel' || currentBgTheme === 'bg-light-sunset') {
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.phase += 0.022;
            p.y += p.vy;
            p.x += Math.sin(p.phase) * p.swayAmp;
            if (p.y < -30) {
                p.y = h + 30;
                p.x = Math.random() * w;
            }
            bgFxCtx.globalAlpha = p.isBubble ? 0.55 : (0.35 + 0.45 * Math.sin(p.phase));
            if (p.isBubble) {
                bgFxCtx.strokeStyle = p.color;
                bgFxCtx.lineWidth = 1.4;
                bgFxCtx.beginPath();
                bgFxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                bgFxCtx.stroke();
            } else {
                bgFxCtx.fillStyle = p.color;
                bgFxCtx.beginPath();
                bgFxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                bgFxCtx.fill();
            }
        }
    } else if (currentBgTheme === 'bg-lava-ember' || currentBgTheme === 'bg-crystal-cave' || currentBgTheme === 'bg-cyberpunk') {
        if (currentBgTheme === 'bg-cyberpunk') {
            const horizonY = h * 0.68;
            bgFxCtx.globalAlpha = 0.22;
            bgFxCtx.strokeStyle = '#ff2e93';
            bgFxCtx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                const gy = horizonY + Math.pow(i / 7, 1.7) * (h - horizonY);
                bgFxCtx.beginPath();
                bgFxCtx.moveTo(0, gy);
                bgFxCtx.lineTo(w, gy);
                bgFxCtx.stroke();
            }
            bgFxCtx.strokeStyle = '#00d2ff';
            for (let i = -6; i <= 6; i++) {
                bgFxCtx.beginPath();
                bgFxCtx.moveTo(cx + i * 35, horizonY);
                bgFxCtx.lineTo(cx + i * 195, h);
                bgFxCtx.stroke();
            }
        }
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.phase += 0.03;
            p.x += p.vx + Math.sin(p.phase) * 0.25;
            p.y += p.vy;
            if (p.y < -15) p.y = h + 15;
            if (p.y > h + 15) p.y = -15;
            if (p.x < -15) p.x = w + 15;
            if (p.x > w + 15) p.x = -15;
            bgFxCtx.globalAlpha = 0.4 + 0.55 * Math.abs(Math.sin(p.phase));
            bgFxCtx.fillStyle = p.color;
            bgFxCtx.beginPath();
            bgFxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            bgFxCtx.fill();
        }
    } else if (currentBgTheme === 'bg-matrix') {
        bgFxCtx.font = 'bold 14px monospace';
        for (let i = 0; i < bgMatrixCols.length; i++) {
            const col = bgMatrixCols[i];
            col.y += col.speed;
            if (col.y - col.len * 16 > h) {
                col.y = -20;
                col.seed = Math.floor(Math.random() * 100);
            }
            for (let k = 0; k < col.len; k++) {
                const cyPos = col.y - k * 16;
                if (cyPos < -16 || cyPos > h + 16) continue;
                const chIdx = (col.seed + k * 7 + Math.floor(now * 0.01)) % MATRIX_CHARS.length;
                const ch = MATRIX_CHARS[chIdx];
                bgFxCtx.fillStyle = k === 0 ? '#a8ffdb' : '#00ff88';
                bgFxCtx.globalAlpha = (1 - k / col.len) * 0.55;
                bgFxCtx.fillText(ch, col.x, cyPos);
            }
        }
    } else if (currentBgTheme === 'bg-light-sakura') {
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.swayPhase += 0.025;
            p.rot += p.rotSpeed;
            p.x += p.vx + Math.sin(p.swayPhase) * 0.45;
            p.y += p.vy;
            if (p.y > h + 20) {
                p.y = -20;
                p.x = Math.random() * w;
            }
            if (p.x > w + 20) p.x = -20;
            bgFxCtx.save();
            bgFxCtx.translate(p.x, p.y);
            bgFxCtx.rotate(p.rot);
            bgFxCtx.globalAlpha = 0.72;
            bgFxCtx.fillStyle = p.color;
            bgFxCtx.beginPath();
            bgFxCtx.ellipse(0, 0, p.size, p.size * 0.58, 0, 0, Math.PI * 2);
            bgFxCtx.fill();
            bgFxCtx.restore();
        }
    } else if (currentBgTheme === 'bg-light-clouds') {
        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.x += p.vx;
            if (p.x - p.r * 2 > w) p.x = -p.r * 2;
            bgFxCtx.globalAlpha = p.alpha;
            bgFxCtx.fillStyle = '#ffffff';
            bgFxCtx.beginPath();
            bgFxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            bgFxCtx.arc(p.x + p.r * 0.75, p.y + p.r * 0.1, p.r * 0.78, 0, Math.PI * 2);
            bgFxCtx.arc(p.x - p.r * 0.72, p.y + p.r * 0.14, p.r * 0.72, 0, Math.PI * 2);
            bgFxCtx.fill();
        }
    }

    bgFxCtx.globalAlpha = 1;
    if (!bgAnimEnabled) {
        bgStaticDrawn = true;
    }
}

function scheduleRedrawAll() {
    needsRedrawAll = true;
}

function scheduleRedrawDraft() {
    needsRedrawDraft = true;
}

function resizeViewportCanvases() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        draftCanvas.width = w;
        draftCanvas.height = h;
        laserCanvas.width = w;
        laserCanvas.height = h;
        scheduleRedrawAll();
        scheduleRedrawDraft();
    }
    resizeBgFxCanvas();
}
window.addEventListener('resize', resizeViewportCanvases);

window.getWorkspaceCoords = function(clientX, clientY) {
    const scale = window.workspaceScale || 1;
    return {
        x: Math.round(((clientX - panX) / scale) * 10) / 10,
        y: Math.round(((clientY - panY) / scale) * 10) / 10
    };
};

function getVisibleWorldBounds(padPx) {
    const scale = window.workspaceScale || 1;
    const pad = (padPx || 300) / scale;
    const minX = (-panX) / scale - pad;
    const minY = (-panY) / scale - pad;
    const maxX = (window.innerWidth - panX) / scale + pad;
    const maxY = (window.innerHeight - panY) / scale + pad;
    return { minX, minY, maxX, maxY };
}

function cullDOMWorkspaceElements(forceNow) {
    const now = Date.now();
    if (!forceNow && now - lastCullTime < 110) return;
    lastCullTime = now;
    const bounds = getVisibleWorldBounds(600);
    const items = workspace.querySelectorAll('.board-widget, .board-media-card, .sticky-note, .board-text-box');
    for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (el.style.display === 'none') {
            el.classList.remove('culled-offscreen');
            continue;
        }
        if (document.activeElement && el.contains(document.activeElement)) {
            el.classList.remove('culled-offscreen');
            continue;
        }
        const x = parseFloat(el.style.left) || 0;
        const y = parseFloat(el.style.top) || 0;
        const w = parseFloat(el.style.width) || el.offsetWidth || 450;
        const h = parseFloat(el.style.height) || el.offsetHeight || 380;
        const inView = !(x + w < bounds.minX || x > bounds.maxX || y + h < bounds.minY || y > bounds.maxY);
        el.classList.toggle('culled-offscreen', !inView);
    }
}
window.refreshViewportCulling = function() {
    cullDOMWorkspaceElements(true);
};

function applyTransformImmediate() {
    workspace.style.transform = `translate3d(${panX.toFixed(1)}px, ${panY.toFixed(1)}px, 0) scale(${window.workspaceScale.toFixed(4)})`;
    if (zoomIndicator) {
        zoomIndicator.innerText = Math.round(window.workspaceScale * 100) + '%';
    }
    scheduleRedrawAll();
    scheduleRedrawDraft();
    cullDOMWorkspaceElements(false);
}

window.centerWorkspace = function() {
    targetScale = 1;
    targetPanX = -(2500 - window.innerWidth / 2);
    targetPanY = -(2500 - window.innerHeight / 2);
};

window.zoomByStep = function(factor, pivotX, pivotY) {
    const cx = typeof pivotX === 'number' ? pivotX : window.innerWidth / 2;
    const cy = typeof pivotY === 'number' ? pivotY : window.innerHeight / 2;
    const nextScale = Math.min(Math.max(0.15, targetScale * factor), 4.0);
    targetPanX = cx - (cx - targetPanX) * (nextScale / targetScale);
    targetPanY = cy - (cy - targetPanY) * (nextScale / targetScale);
    targetScale = nextScale;
};

resizeViewportCanvases();
syncThemeStateFromDom();
initBgParticlesForTheme(currentBgTheme);
applyTransformImmediate();

function queueStrokeDeletion(strokeId) {
    if (!strokeId) return;
    pendingDeletedStrokeIds.add(strokeId);
    if (!flushDeleteTimer) {
        flushDeleteTimer = setTimeout(() => {
            flushDeleteTimer = null;
            if (pendingDeletedStrokeIds.size > 0) {
                const batch = Array.from(pendingDeletedStrokeIds);
                pendingDeletedStrokeIds.clear();
                socket.emit('delete_strokes_batch', {
                    room_id: ROOM_ID,
                    stroke_ids: batch
                });
            }
        }, 40);
    }
}

function queueEraserPointSegment(pt, widthVal) {
    pendingEraserPoints.push(pt);
    if (!flushEraserSegmentTimer) {
        flushEraserSegmentTimer = setTimeout(() => {
            flushEraserSegmentTimer = null;
            if (pendingEraserPoints.length > 0) {
                const ptsToSend = pendingEraserPoints.slice();
                const lastPt = pendingEraserPoints[pendingEraserPoints.length - 1];
                pendingEraserPoints = [lastPt];
                socket.emit('draw_segment', {
                    room_id: ROOM_ID,
                    tool: 'eraser',
                    width: widthVal,
                    points: ptsToSend
                });
            }
        }, 35);
    }
}

const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowleft: false, arrowdown: false, arrowright: false };

function deselectAllTextBoxes(exceptId) {
    document.querySelectorAll('.board-text-box.editing').forEach(el => {
        if (el.id !== exceptId) {
            el.classList.remove('editing');
            const ed = el.querySelector('.text-box-editor');
            if (ed && document.activeElement === ed) ed.blur();
        }
    });
    if (!exceptId) activeTextBoxId = null;
}

document.addEventListener('pointerdown', (e) => {
    const tb = e.target.closest('.board-text-box');
    const stylePop = e.target.closest('#popover-style') || e.target.closest('#group-style-btn');
    if (!tb && !stylePop) {
        deselectAllTextBoxes(null);
    }
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === '0')) {
        e.preventDefault();
        if (e.key === '0') {
            window.centerWorkspace();
        } else if (e.key === '-' || e.key === '_') {
            window.zoomByStep(0.85);
        } else {
            window.zoomByStep(1.18);
        }
        return;
    }
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
        if (e.key === 'Escape') {
            deselectAllTextBoxes(null);
        }
        return;
    }
    if (e.code === 'Space' && !spacePressed) {
        spacePressed = true;
        canvas.classList.add('pan-mode');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        socket.emit('undo_stroke', { room_id: ROOM_ID, client_id: window.CLIENT_ID, username: window.USERNAME });
        return;
    }
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        spacePressed = false;
        isPanning = false;
        if (currentTool !== 'pan') canvas.classList.remove('pan-mode');
    }
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = false;
});

function renderLaserLoop() {
    if (laserTrails.length > 0) {
        const now = Date.now();
        laserCtx.setTransform(1, 0, 0, 1, 0, 0);
        laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
        laserCtx.setTransform(window.workspaceScale, 0, 0, window.workspaceScale, panX, panY);
        laserTrails = laserTrails.filter(p => now - p.t < 1100);
        for (let i = 0; i < laserTrails.length; i++) {
            const pt = laserTrails[i];
            const alpha = Math.max(0, 1 - (now - pt.t) / 1100);
            laserCtx.save();
            laserCtx.beginPath();
            laserCtx.strokeStyle = `rgba(255, 45, 85, ${alpha})`;
            laserCtx.shadowColor = '#ff2d55';
            laserCtx.shadowBlur = 14;
            laserCtx.lineWidth = 5 * alpha + 2;
            laserCtx.lineCap = 'round';
            laserCtx.moveTo(pt.x0, pt.y0);
            laserCtx.lineTo(pt.x1, pt.y1);
            laserCtx.stroke();
            laserCtx.restore();
        }
    }
}

let globalPinchActive = false;
let globalPinchDist = 0;
let globalPinchScale = 1;
let globalPinchCenter = { x: 0, y: 0 };

function mainAnimationLoop(now) {
    const speed = 16;
    if (keys.w || keys.arrowup) targetPanY += speed;
    if (keys.s || keys.arrowdown) targetPanY -= speed;
    if (keys.a || keys.arrowleft) targetPanX += speed;
    if (keys.d || keys.arrowright) targetPanX -= speed;

    const ds = targetScale - window.workspaceScale;
    const dx = targetPanX - panX;
    const dy = targetPanY - panY;
    if (Math.abs(ds) > 0.0004 || Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
        window.workspaceScale += ds * 0.28;
        panX += dx * 0.28;
        panY += dy * 0.28;
        applyTransformImmediate();
    }
    if (needsRedrawAll) {
        needsRedrawAll = false;
        performRedrawAllHistory();
    }
    if (needsRedrawDraft) {
        needsRedrawDraft = false;
        performRedrawDraftCanvas();
    }
    renderLaserLoop();
    renderBgFxFrame(now || performance.now());
    requestAnimationFrame(mainAnimationLoop);
}
requestAnimationFrame(mainAnimationLoop);

window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const rawDelta = Math.max(-60, Math.min(60, e.deltaY));
        const factor = Math.exp(-rawDelta * 0.012);
        window.zoomByStep(factor, e.clientX, e.clientY);
        return;
    }
    if (e.target.closest('.xo-board-wrapper') || e.target.closest('.chat-messages') || e.target.closest('.settings-body') || e.target.closest('.scroll-strip') || e.target.closest('.media-content') || e.target.closest('.board-media-body') || e.target.closest('.tool-popover') || e.target.closest('.text-box-editor') || e.target.closest('.sticky-content') || e.target.closest('.noitu-history-box') || e.target.closest('.uno-hand-cards') || e.target.closest('.ludo-board-wrap')) {
        return;
    }
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    window.zoomByStep(factor, e.clientX, e.clientY);
}, { passive: false, capture: true });

let gestureStartScale = 1;
window.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    gestureStartScale = targetScale;
}, { passive: false, capture: true });

window.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    if (typeof e.scale === 'number' && e.scale > 0) {
        const desired = Math.min(Math.max(0.15, gestureStartScale * e.scale), 4.0);
        window.zoomByStep(desired / targetScale, e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);
    }
}, { passive: false, capture: true });

window.addEventListener('gestureend', (e) => {
    e.preventDefault();
}, { passive: false, capture: true });

window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length >= 2) {
        e.preventDefault();
        globalPinchActive = true;
        drawing = false;
        isPanning = false;
        currentStroke = null;
        textDragBox = null;
        scheduleRedrawDraft();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        globalPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        globalPinchScale = targetScale;
        globalPinchCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    }
}, { passive: false, capture: true });

window.addEventListener('touchmove', (e) => {
    if (globalPinchActive && e.touches && e.touches.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const cx = (t1.clientX + t2.clientX) / 2;
        const cy = (t1.clientY + t2.clientY) / 2;
        if (globalPinchDist > 10) {
            const nextScale = Math.min(Math.max(0.15, globalPinchScale * (dist / globalPinchDist)), 4.0);
            targetPanX = cx - (globalPinchCenter.x - targetPanX) * (nextScale / targetScale) + (cx - globalPinchCenter.x);
            targetPanY = cy - (globalPinchCenter.y - targetPanY) * (nextScale / targetScale) + (cy - globalPinchCenter.y);
            targetScale = nextScale;
            globalPinchCenter = { x: cx, y: cy };
        }
    }
}, { passive: false, capture: true });

window.addEventListener('touchend', (e) => {
    if (!e.touches || e.touches.length < 2) {
        globalPinchActive = false;
        globalPinchDist = 0;
    }
}, { passive: false, capture: true });

const PEN_TOOLS = ['pen', 'highlighter', 'calligraphy', 'marker', 'neon', 'rainbow', 'dashed', 'spray', 'laser'];
const SHAPE_TOOLS = ['line', 'arrow', 'darrow', 'rect', 'circle', 'triangle', 'diamond', 'star', 'hexagon'];

window.selectDrawingTool = function(toolName) {
    currentTool = toolName;
    document.querySelectorAll('.tool-btn, #top-strip .group-trigger-btn').forEach(b => b.classList.remove('active'));
    if (toolName === 'pan') {
        const panBtn = document.getElementById('tool-pan');
        if (panBtn) panBtn.classList.add('active');
        canvas.classList.add('pan-mode');
    } else {
        canvas.classList.remove('pan-mode');
    }
    if (toolName === 'text') {
        const tBtn = document.getElementById('tool-text');
        if (tBtn) tBtn.classList.add('active');
    } else if (toolName === 'stamp') {
        const stBtn = document.getElementById('group-stamp-btn');
        if (stBtn) stBtn.classList.add('active');
    } else if (toolName === 'eraser') {
        const eBtn = document.getElementById('group-eraser-btn');
        if (eBtn) eBtn.classList.add('active');
    } else if (PEN_TOOLS.includes(toolName)) {
        const pBtn = document.getElementById('group-pen-btn');
        if (pBtn) pBtn.classList.add('active');
    } else if (SHAPE_TOOLS.includes(toolName)) {
        const sBtn = document.getElementById('group-shape-btn');
        if (sBtn) sBtn.classList.add('active');
    }
};

window.bindSafeButton(document.getElementById('tool-pan'), () => {
    window.selectDrawingTool('pan');
    if (window.closeAllPopovers) window.closeAllPopovers();
});

window.bindSafeButton(document.getElementById('tool-text'), () => {
    window.selectDrawingTool('text');
    if (window.closeAllPopovers) window.closeAllPopovers();
    if (window.showToast) window.showToast('🔤 Kéo thả hoặc chạm trên bảng để tạo Khung Chữ!');
});

function applyColorToActiveTextBox(newColor) {
    if (!activeTextBoxId) return;
    const box = document.getElementById(activeTextBoxId);
    if (!box) return;
    const editor = box.querySelector('.text-box-editor');
    const cInput = box.querySelector('.tbox-color-input');
    if (editor) {
        editor.style.color = newColor;
        if (cInput) cInput.value = newColor;
        socket.emit('update_text_box', {
            room_id: ROOM_ID,
            id: activeTextBoxId,
            color: newColor
        });
    }
}

const colorPicker = document.getElementById('color-picker');
const styleColorDot = document.getElementById('style-color-dot');
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    if (styleColorDot) styleColorDot.style.background = currentColor;
    applyColorToActiveTextBox(currentColor);
});

document.querySelectorAll('.qcolor').forEach(dot => {
    window.bindSafeButton(dot, () => {
        const c = dot.getAttribute('data-color');
        if (c) {
            currentColor = c;
            colorPicker.value = c;
            if (styleColorDot) styleColorDot.style.background = c;
            document.querySelectorAll('.qcolor').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            applyColorToActiveTextBox(c);
        }
    });
});

const lineWidthInput = document.getElementById('line-width');
const lineWidthVal = document.getElementById('line-width-val');
const lineWidthDetail = document.getElementById('line-width-detail');
lineWidthInput.addEventListener('input', (e) => {
    currentWidth = parseInt(e.target.value, 10) || 4;
    if (lineWidthVal) lineWidthVal.innerText = currentWidth + 'px';
    if (lineWidthDetail) lineWidthDetail.innerText = currentWidth + 'px';
});

const lineOpacityInput = document.getElementById('line-opacity');
const lineOpacityDetail = document.getElementById('line-opacity-detail');
if (lineOpacityInput) {
    lineOpacityInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) || 100;
        currentOpacity = val / 100;
        if (lineOpacityDetail) lineOpacityDetail.innerText = val + '%';
    });
}

window.bindSafeButton(document.getElementById('tool-undo'), () => {
    socket.emit('undo_stroke', { room_id: ROOM_ID, client_id: window.CLIENT_ID, username: window.USERNAME });
});

window.bindSafeButton(document.getElementById('tool-center'), () => {
    window.centerWorkspace();
    if (window.showToast) window.showToast('Đã đưa góc nhìn về trung tâm bảng (100%)');
});

window.bindSafeButton(document.getElementById('btn-zoom-in'), () => window.zoomByStep(1.2));
window.bindSafeButton(document.getElementById('btn-zoom-out'), () => window.zoomByStep(0.83));
window.bindSafeButton(zoomIndicator, () => window.centerWorkspace());

window.bindSafeButton(document.getElementById('tool-clear'), () => {
    if (confirm('Xóa toàn bộ nét vẽ và khung chữ CỦA BẠN (giữ nguyên phần của người khác)?')) {
        socket.emit('clear_board', {
            room_id: ROOM_ID,
            client_id: window.CLIENT_ID,
            username: window.USERNAME
        });
        if (window.showToast) window.showToast('🗑️ Đã xóa phần nét vẽ và khung chữ của bạn!');
    }
});

window.bindSafeButton(document.getElementById('tool-export'), () => {
    if (window.closeAllPopovers) window.closeAllPopovers();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = window.innerWidth;
    exportCanvas.height = window.innerHeight;
    const eCtx = exportCanvas.getContext('2d');
    eCtx.fillStyle = document.body.classList.contains('light-theme') ? '#f5f7fb' : '#0f0f13';
    eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    if (bgFxCanvas) {
        eCtx.drawImage(bgFxCanvas, 0, 0);
    }
    eCtx.drawImage(canvas, 0, 0);
    const link = document.createElement('a');
    link.download = `BangChung_${ROOM_ID}_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    if (window.showToast) window.showToast('Đã tải ảnh chụp bảng về máy!');
});

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(0, 210, 255, ${alpha})`;
    if (hex.startsWith('hsl') || hex.startsWith('rgb')) return hex;
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
}

function setupStrokeContext(targetCtx, tool, color, width, opacity) {
    const op = typeof opacity === 'number' ? opacity : 1.0;
    targetCtx.setLineDash([]);
    targetCtx.shadowBlur = 0;
    targetCtx.shadowColor = 'transparent';
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.lineWidth = width;
    targetCtx.globalAlpha = 1.0;

    if (tool === 'eraser') {
        targetCtx.globalCompositeOperation = 'destination-out';
        targetCtx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'highlighter') {
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.lineCap = 'butt';
        targetCtx.lineJoin = 'round';
        targetCtx.lineWidth = Math.max(12, width * 3.2);
        targetCtx.strokeStyle = hexToRgba(color, 0.34 * op);
    } else if (tool === 'marker') {
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.lineWidth = Math.max(6, width * 1.8);
        targetCtx.strokeStyle = hexToRgba(color, 0.72 * op);
    } else if (tool === 'neon') {
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.strokeStyle = hexToRgba(color, op);
        targetCtx.shadowColor = color;
        targetCtx.shadowBlur = width * 2.5 + 8;
    } else if (tool === 'dashed') {
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.strokeStyle = hexToRgba(color, op);
        targetCtx.setLineDash([width * 2.5, width * 1.8]);
    } else {
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.strokeStyle = hexToRgba(color, op);
    }
}

function isShapeTool(t) {
    return SHAPE_TOOLS.includes(t);
}

function drawShapePath(targetCtx, tool, color, width, opacity, p0, p1) {
    targetCtx.save();
    setupStrokeContext(targetCtx, tool, color, width, opacity);
    targetCtx.beginPath();
    if (tool === 'line') {
        targetCtx.moveTo(p0.x, p0.y);
        targetCtx.lineTo(p1.x, p1.y);
        targetCtx.stroke();
    } else if (tool === 'arrow' || tool === 'darrow') {
        const headlen = Math.max(12, width * 3.2);
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        targetCtx.moveTo(p0.x, p0.y);
        targetCtx.lineTo(p1.x, p1.y);
        targetCtx.lineTo(p1.x - headlen * Math.cos(angle - Math.PI / 6), p1.y - headlen * Math.sin(angle - Math.PI / 6));
        targetCtx.moveTo(p1.x, p1.y);
        targetCtx.lineTo(p1.x - headlen * Math.cos(angle + Math.PI / 6), p1.y - headlen * Math.sin(angle + Math.PI / 6));
        if (tool === 'darrow') {
            targetCtx.moveTo(p0.x, p0.y);
            targetCtx.lineTo(p0.x + headlen * Math.cos(angle - Math.PI / 6), p0.y + headlen * Math.sin(angle - Math.PI / 6));
            targetCtx.moveTo(p0.x, p0.y);
            targetCtx.lineTo(p0.x + headlen * Math.cos(angle + Math.PI / 6), p0.y + headlen * Math.sin(angle + Math.PI / 6));
        }
        targetCtx.stroke();
    } else if (tool === 'rect') {
        targetCtx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    } else if (tool === 'circle') {
        const rx = Math.abs(p1.x - p0.x) / 2;
        const ry = Math.abs(p1.y - p0.y) / 2;
        const cx = (p0.x + p1.x) / 2;
        const cy = (p0.y + p1.y) / 2;
        targetCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        targetCtx.stroke();
    } else if (tool === 'triangle') {
        const midX = (p0.x + p1.x) / 2;
        targetCtx.moveTo(midX, p0.y);
        targetCtx.lineTo(p1.x, p1.y);
        targetCtx.lineTo(p0.x, p1.y);
        targetCtx.closePath();
        targetCtx.stroke();
    } else if (tool === 'diamond') {
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        targetCtx.moveTo(midX, p0.y);
        targetCtx.lineTo(p1.x, midY);
        targetCtx.lineTo(midX, p1.y);
        targetCtx.lineTo(p0.x, midY);
        targetCtx.closePath();
        targetCtx.stroke();
    } else if (tool === 'star') {
        const cx = (p0.x + p1.x) / 2;
        const cy = (p0.y + p1.y) / 2;
        const outerR = Math.max(8, Math.hypot(p1.x - p0.x, p1.y - p0.y) / 2);
        const innerR = outerR * 0.42;
        for (let i = 0; i < 10; i++) {
            const r = (i % 2 === 0) ? outerR : innerR;
            const ang = (i * Math.PI) / 5 - Math.PI / 2;
            const x = cx + Math.cos(ang) * r;
            const y = cy + Math.sin(ang) * r;
            if (i === 0) targetCtx.moveTo(x, y);
            else targetCtx.lineTo(x, y);
        }
        targetCtx.closePath();
        targetCtx.stroke();
    } else if (tool === 'hexagon') {
        const cx = (p0.x + p1.x) / 2;
        const cy = (p0.y + p1.y) / 2;
        const r = Math.max(8, Math.hypot(p1.x - p0.x, p1.y - p0.y) / 2);
        for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3 - Math.PI / 6;
            const x = cx + Math.cos(ang) * r;
            const y = cy + Math.sin(ang) * r;
            if (i === 0) targetCtx.moveTo(x, y);
            else targetCtx.lineTo(x, y);
        }
        targetCtx.closePath();
        targetCtx.stroke();
    }
    targetCtx.restore();
}

function renderStrokeOnContext(targetCtx, stroke) {
    if (!stroke) return;
    try {
        if (stroke.tool === 'text' && stroke.text && stroke.points && stroke.points[0]) {
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.fillStyle = stroke.color || '#00d2ff';
            const fontSize = Math.max(16, (stroke.width || 4) * 5);
            targetCtx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
            targetCtx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
            targetCtx.restore();
            return;
        }
        const pts = stroke.points || [];
        if (pts.length === 0) return;
        const op = typeof stroke.opacity === 'number' ? stroke.opacity : 1.0;

        if (isShapeTool(stroke.tool)) {
            if (pts.length >= 2) {
                drawShapePath(targetCtx, stroke.tool, stroke.color, stroke.width, op, pts[0], pts[pts.length - 1]);
            }
            return;
        }

        if (stroke.tool === 'calligraphy') {
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.fillStyle = hexToRgba(stroke.color, op);
            targetCtx.strokeStyle = hexToRgba(stroke.color, op);
            const angle = -Math.PI / 5;
            const dx = Math.cos(angle) * (stroke.width * 1.6);
            const dy = Math.sin(angle) * (stroke.width * 1.6);
            if (pts.length === 1) {
                targetCtx.beginPath();
                targetCtx.moveTo(pts[0].x - dx, pts[0].y - dy);
                targetCtx.lineTo(pts[0].x + dx, pts[0].y + dy);
                targetCtx.lineWidth = Math.max(2, stroke.width * 0.6);
                targetCtx.stroke();
            } else {
                for (let i = 0; i < pts.length - 1; i++) {
                    targetCtx.beginPath();
                    targetCtx.moveTo(pts[i].x - dx, pts[i].y - dy);
                    targetCtx.lineTo(pts[i].x + dx, pts[i].y + dy);
                    targetCtx.lineTo(pts[i + 1].x + dx, pts[i + 1].y + dy);
                    targetCtx.lineTo(pts[i + 1].x - dx, pts[i + 1].y - dy);
                    targetCtx.closePath();
                    targetCtx.fill();
                }
            }
            targetCtx.restore();
            return;
        }

        if (stroke.tool === 'spray') {
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.fillStyle = hexToRgba(stroke.color, 0.35 * op);
            const radius = Math.max(8, stroke.width * 2.2);
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                for (let j = 0; j < 10; j++) {
                    const ang = ((i * 13 + j * 37) % 360) * (Math.PI / 180);
                    const r = (((i * 7 + j * 19) % 100) / 100) * radius;
                    targetCtx.fillRect(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, 2, 2);
                }
            }
            targetCtx.restore();
            return;
        }

        targetCtx.save();
        setupStrokeContext(targetCtx, stroke.tool, stroke.color, stroke.width, op);
        targetCtx.beginPath();
        targetCtx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 1) {
            targetCtx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
        } else if (pts.length === 2) {
            targetCtx.lineTo(pts[1].x, pts[1].y);
        } else {
            for (let i = 1; i < pts.length - 1; i++) {
                const midX = (pts[i].x + pts[i + 1].x) / 2;
                const midY = (pts[i].y + pts[i + 1].y) / 2;
                targetCtx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
            }
            targetCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        }
        targetCtx.stroke();
        targetCtx.restore();
    } catch (err) {}
}

function ensureStrokeBBox(stroke) {
    if (stroke._bbox) return stroke._bbox;
    const pts = stroke.points || [];
    if (pts.length === 0) {
        stroke._bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        return stroke._bbox;
    }
    let minX = pts[0].x;
    let maxX = pts[0].x;
    let minY = pts[0].y;
    let maxY = pts[0].y;
    for (let i = 1; i < pts.length; i++) {
        const x = pts[i].x;
        const y = pts[i].y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    const pad = Math.max(24, (parseFloat(stroke.width) || 4) * 3.8);
    stroke._bbox = {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad
    };
    return stroke._bbox;
}

function isStrokeInViewport(stroke, bounds) {
    const bb = ensureStrokeBBox(stroke);
    return !(bb.maxX < bounds.minX || bb.minX > bounds.maxX || bb.maxY < bounds.minY || bb.minY > bounds.maxY);
}

function performRedrawDraftCanvas() {
    draftCtx.setTransform(1, 0, 0, 1, 0, 0);
    draftCtx.clearRect(0, 0, draftCanvas.width, draftCanvas.height);
    draftCtx.setTransform(window.workspaceScale, 0, 0, window.workspaceScale, panX, panY);
    if (currentStroke && currentStroke.tool !== 'eraser' && currentStroke.tool !== 'laser') {
        renderStrokeOnContext(draftCtx, currentStroke);
    }
    Object.values(remoteLiveStrokes).forEach(st => {
        if (st && st.tool !== 'eraser' && st.tool !== 'laser') {
            renderStrokeOnContext(draftCtx, st);
        }
    });
    if (textDragBox) {
        draftCtx.save();
        draftCtx.strokeStyle = '#00d2ff';
        draftCtx.fillStyle = 'rgba(0, 210, 255, 0.08)';
        draftCtx.lineWidth = 2 / (window.workspaceScale || 1);
        draftCtx.setLineDash([6, 4]);
        const rx = Math.min(textDragBox.x0, textDragBox.x1);
        const ry = Math.min(textDragBox.y0, textDragBox.y1);
        const rw = Math.abs(textDragBox.x1 - textDragBox.x0);
        const rh = Math.abs(textDragBox.y1 - textDragBox.y0);
        draftCtx.fillRect(rx, ry, rw, rh);
        draftCtx.strokeRect(rx, ry, rw, rh);
        draftCtx.restore();
    }
}

function performRedrawAllHistory() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(window.workspaceScale, 0, 0, window.workspaceScale, panX, panY);
    const bounds = getVisibleWorldBounds(180);
    for (let i = 0; i < strokeHistory.length; i++) {
        const st = strokeHistory[i];
        if (isStrokeInViewport(st, bounds)) {
            renderStrokeOnContext(ctx, st);
        }
    }
}

function distToSegmentSquared(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

function isPointHittingStroke(px, py, stroke, tolerance) {
    if (!stroke || stroke.tool === 'eraser') return false;
    const bbox = ensureStrokeBBox(stroke);
    if (px < bbox.minX - tolerance || px > bbox.maxX + tolerance || py < bbox.minY - tolerance || py > bbox.maxY + tolerance) {
        return false;
    }
    const pts = stroke.points || [];
    if (pts.length === 0) return false;
    const strokeW = parseFloat(stroke.width || 4);
    const hitR = Math.max(12, tolerance + strokeW);
    const hitRSq = hitR * hitR;

    if (stroke.tool === 'rect' || stroke.tool === 'triangle' || stroke.tool === 'diamond' || stroke.tool === 'star' || stroke.tool === 'hexagon') {
        if (pts.length < 2) return false;
        const xMin = Math.min(pts[0].x, pts[pts.length - 1].x) - hitR;
        const xMax = Math.max(pts[0].x, pts[pts.length - 1].x) + hitR;
        const yMin = Math.min(pts[0].y, pts[pts.length - 1].y) - hitR;
        const yMax = Math.max(pts[0].y, pts[pts.length - 1].y) + hitR;
        return px >= xMin && px <= xMax && py >= yMin && py <= yMax;
    }
    if (stroke.tool === 'circle' && pts.length >= 2) {
        const cx = (pts[0].x + pts[pts.length - 1].x) / 2;
        const cy = (pts[0].y + pts[pts.length - 1].y) / 2;
        const rx = Math.max(10, Math.abs(pts[pts.length - 1].x - pts[0].x) / 2);
        const ry = Math.max(10, Math.abs(pts[pts.length - 1].y - pts[0].y) / 2);
        const normDist = ((px - cx) * (px - cx)) / ((rx + hitR) * (rx + hitR)) + ((py - cy) * (py - cy)) / ((ry + hitR) * (ry + hitR));
        return normDist <= 1.15;
    }
    if (pts.length === 1) {
        return (px - pts[0].x) * (px - pts[0].x) + (py - pts[0].y) * (py - pts[0].y) <= hitRSq;
    }
    for (let i = 0; i < pts.length - 1; i++) {
        if (distToSegmentSquared(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= hitRSq) {
            return true;
        }
    }
    return false;
}

function eraseStrokesNearPoint(px, py) {
    let anyRemoved = false;
    const tol = Math.max(10, currentWidth * 1.6);
    for (let i = strokeHistory.length - 1; i >= 0; i--) {
        const st = strokeHistory[i];
        if (isPointHittingStroke(px, py, st, tol)) {
            const removed = strokeHistory.splice(i, 1)[0];
            anyRemoved = true;
            if (removed && removed.id) {
                queueStrokeDeletion(removed.id);
            }
        }
    }
    if (anyRemoved) {
        scheduleRedrawAll();
    }
    return anyRemoved;
}

window.createOrUpdateTextBox = function(data, autoFocus) {
    if (!data || !data.id) return;
    let box = document.getElementById(data.id);
    if (!box) {
        box = document.createElement('div');
        box.className = 'board-text-box';
        box.id = data.id;
        box.dataset.ownerId = data.owner_id || '';
        box.dataset.owner = data.owner || '';

        const bar = document.createElement('div');
        bar.className = 'text-box-toolbar';

        const dragHandle = document.createElement('span');
        dragHandle.className = 'tbox-drag-handle';
        dragHandle.innerText = '✥ Kéo';

        const btnSmaller = document.createElement('button');
        btnSmaller.type = 'button';
        btnSmaller.className = 'tbox-btn';
        btnSmaller.innerText = 'A-';

        const btnBigger = document.createElement('button');
        btnBigger.type = 'button';
        btnBigger.className = 'tbox-btn';
        btnBigger.innerText = 'A+';

        const colorWrap = document.createElement('div');
        colorWrap.className = 'tbox-color-wrap';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'tbox-color-input';
        colorInput.title = 'Chọn màu chữ bất kỳ';
        colorInput.value = data.color || currentColor || '#00d2ff';
        colorWrap.appendChild(colorInput);

        ['#00d2ff', '#ff4757', '#2ed573', '#ffa502', '#1e272e'].forEach(hex => {
            const cDot = document.createElement('span');
            cDot.className = 'tbox-color-dot';
            cDot.style.background = hex;
            window.bindSafeButton(cDot, () => {
                editor.style.color = hex;
                colorInput.value = hex;
                currentColor = hex;
                colorPicker.value = hex;
                if (styleColorDot) styleColorDot.style.background = hex;
                emitBoxUpdate();
            });
            colorWrap.appendChild(cDot);
        });

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'tbox-btn del';
        btnDel.innerText = '✕';

        bar.appendChild(dragHandle);
        bar.appendChild(btnSmaller);
        bar.appendChild(btnBigger);
        bar.appendChild(colorWrap);
        bar.appendChild(btnDel);

        const editor = document.createElement('textarea');
        editor.className = 'text-box-editor';
        editor.placeholder = 'Nhập văn bản vào đây...';

        box.appendChild(bar);
        box.appendChild(editor);
        textLayer.appendChild(box);

        const emitBoxUpdate = () => {
            socket.emit('update_text_box', {
                room_id: ROOM_ID,
                id: data.id,
                x: parseFloat(box.style.left) || 0,
                y: parseFloat(box.style.top) || 0,
                w: parseFloat(box.style.width) || 240,
                h: parseFloat(box.style.height) || 70,
                text: editor.value,
                color: editor.style.color || '#00d2ff',
                fontSize: parseInt(editor.style.fontSize, 10) || 20,
                owner: box.dataset.owner || window.USERNAME,
                owner_id: box.dataset.ownerId || window.CLIENT_ID
            });
        };

        colorInput.addEventListener('pointerdown', e => e.stopPropagation());
        colorInput.addEventListener('click', e => e.stopPropagation());
        colorInput.addEventListener('input', (e) => {
            e.stopPropagation();
            const val = e.target.value;
            editor.style.color = val;
            currentColor = val;
            colorPicker.value = val;
            if (styleColorDot) styleColorDot.style.background = val;
            emitBoxUpdate();
        });

        window.makeWidgetResizable(box, 140, 50, true, () => {
            emitBoxUpdate();
        });

        window.bindSafeButton(btnSmaller, () => {
            const cur = parseInt(editor.style.fontSize, 10) || 20;
            editor.style.fontSize = Math.max(12, cur - 3) + 'px';
            emitBoxUpdate();
        });

        window.bindSafeButton(btnBigger, () => {
            const cur = parseInt(editor.style.fontSize, 10) || 20;
            editor.style.fontSize = Math.min(72, cur + 3) + 'px';
            emitBoxUpdate();
        });

        window.bindSafeButton(btnDel, () => {
            if (activeTextBoxId === data.id) activeTextBoxId = null;
            box.remove();
            socket.emit('delete_text_box', { room_id: ROOM_ID, id: data.id });
        });

        const activateBox = (e) => {
            e.stopPropagation();
            deselectAllTextBoxes(data.id);
            activeTextBoxId = data.id;
            box.classList.add('editing');
        };

        editor.addEventListener('pointerdown', activateBox);
        editor.addEventListener('mousedown', activateBox);
        editor.addEventListener('touchstart', activateBox, { passive: true });
        editor.addEventListener('click', (e) => {
            activateBox(e);
            editor.focus();
        });
        editor.addEventListener('focus', () => {
            deselectAllTextBoxes(data.id);
            activeTextBoxId = data.id;
            box.classList.add('editing');
        });
        editor.addEventListener('input', () => emitBoxUpdate());

        let isMoving = false;
        let moveStartX = 0;
        let moveStartY = 0;
        let origLeft = 0;
        let origTop = 0;

        dragHandle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deselectAllTextBoxes(data.id);
            activeTextBoxId = data.id;
            box.classList.add('editing');
            isMoving = true;
            moveStartX = e.clientX;
            moveStartY = e.clientY;
            origLeft = parseFloat(box.style.left) || 0;
            origTop = parseFloat(box.style.top) || 0;
            if (dragHandle.setPointerCapture) {
                try { dragHandle.setPointerCapture(e.pointerId); } catch (err) {}
            }
        });

        dragHandle.addEventListener('pointermove', (e) => {
            if (!isMoving) return;
            e.stopPropagation();
            const scale = window.workspaceScale || 1;
            box.style.left = Math.round(origLeft + (e.clientX - moveStartX) / scale) + 'px';
            box.style.top = Math.round(origTop + (e.clientY - moveStartY) / scale) + 'px';
            emitBoxUpdate();
        });

        const endMove = (e) => {
            if (!isMoving) return;
            isMoving = false;
            if (e && dragHandle.releasePointerCapture) {
                try { dragHandle.releasePointerCapture(e.pointerId); } catch (err) {}
            }
            emitBoxUpdate();
        };
        dragHandle.addEventListener('pointerup', endMove);
        dragHandle.addEventListener('pointercancel', endMove);
        box.addEventListener('pointerdown', activateBox);
        box.addEventListener('mousedown', activateBox);
    }

    if (typeof data.x === 'number') box.style.left = data.x + 'px';
    if (typeof data.y === 'number') box.style.top = data.y + 'px';
    if (typeof data.w === 'number') box.style.width = data.w + 'px';
    if (typeof data.h === 'number') box.style.height = data.h + 'px';
    box.classList.remove('culled-offscreen');

    const editor = box.querySelector('.text-box-editor');
    const cInput = box.querySelector('.tbox-color-input');
    if (editor) {
        if (data.color) {
            editor.style.color = data.color;
            if (cInput && data.color.startsWith('#')) cInput.value = data.color;
        }
        editor.style.fontSize = (data.fontSize || 20) + 'px';
        if (data.text !== undefined && document.activeElement !== editor) {
            editor.value = data.text;
        }
        if (autoFocus) {
            setTimeout(() => {
                deselectAllTextBoxes(data.id);
                activeTextBoxId = data.id;
                box.classList.add('editing');
                editor.focus();
            }, 60);
        }
    }
};

window.loadTextsHistory = function(list) {
    textLayer.innerHTML = '';
    if (Array.isArray(list)) {
        list.forEach(item => window.createOrUpdateTextBox(item, false));
    }
};

function startPointerAction(clientX, clientY, button) {
    if (window.closeAllPopovers) window.closeAllPopovers();
    deselectAllTextBoxes(null);
    const pos = window.getWorkspaceCoords(clientX, clientY);

    if (button === 0 && currentTool === 'stamp') {
        const emoji = window.currentStamp || '❤️';
        if (window.spawnFloatingStamp) {
            window.spawnFloatingStamp(pos.x, pos.y, emoji, window.USERNAME || 'Thành viên');
        }
        socket.emit('place_stamp', {
            room_id: ROOM_ID,
            x: pos.x,
            y: pos.y,
            emoji: emoji,
            sender: window.USERNAME || 'Thành viên'
        });
        return;
    }

    if (button === 1 || button === 2 || spacePressed || currentTool === 'pan') {
        isPanning = true;
        panStartX = clientX - targetPanX;
        panStartY = clientY - targetPanY;
        return;
    }
    if (button !== 0) return;

    if (currentTool === 'text') {
        drawing = true;
        textDragBox = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
        scheduleRedrawDraft();
        return;
    }

    if (currentTool === 'eraser' && window.eraserMode === 'stroke') {
        drawing = true;
        currentStroke = null;
        eraseStrokesNearPoint(pos.x, pos.y);
        return;
    }

    drawing = true;
    let activeColor = currentColor;
    if (currentTool === 'rainbow') {
        rainbowHue = (rainbowHue + 25) % 360;
        activeColor = `hsl(${rainbowHue}, 100%, 60%)`;
    }
    currentStroke = {
        id: 'st_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        tool: currentTool,
        color: activeColor,
        width: currentWidth,
        opacity: currentOpacity,
        owner: window.USERNAME || 'Thành viên',
        owner_id: window.CLIENT_ID,
        points: [pos]
    };

    if (currentTool === 'laser') {
        laserTrails.push({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, t: Date.now() });
        socket.emit('laser_point', { room_id: ROOM_ID, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
    } else if (currentTool === 'eraser') {
        ctx.setTransform(window.workspaceScale, 0, 0, window.workspaceScale, panX, panY);
        renderStrokeOnContext(ctx, currentStroke);
        pendingEraserPoints = [pos];
        queueEraserPointSegment(pos, currentWidth);
    } else {
        scheduleRedrawDraft();
    }
}

function movePointerAction(clientX, clientY) {
    if (isPanning) {
        targetPanX = clientX - panStartX;
        targetPanY = clientY - panStartY;
        panX = targetPanX;
        panY = targetPanY;
        applyTransformImmediate();
        return;
    }
    if (!drawing) return;
    const pos = window.getWorkspaceCoords(clientX, clientY);

    if (currentTool === 'text' && textDragBox) {
        textDragBox.x1 = pos.x;
        textDragBox.y1 = pos.y;
        scheduleRedrawDraft();
        return;
    }

    if (currentTool === 'eraser' && window.eraserMode === 'stroke') {
        eraseStrokesNearPoint(pos.x, pos.y);
        return;
    }
    if (!currentStroke) return;
    const pts = currentStroke.points;
    const prev = pts[pts.length - 1];

    if (isShapeTool(currentTool)) {
        if (pts.length === 1) pts.push(pos);
        else pts[1] = pos;
        scheduleRedrawDraft();
        const now = Date.now();
        if (now - lastEmitTime > 35) {
            socket.emit('draw_live', { room_id: ROOM_ID, stroke: currentStroke });
            lastEmitTime = now;
        }
        return;
    }

    const distSq = (pos.x - prev.x) * (pos.x - prev.x) + (pos.y - prev.y) * (pos.y - prev.y);
    if (distSq < 2.2) return;

    pts.push(pos);

    if (currentTool === 'laser') {
        laserTrails.push({ x0: prev.x, y0: prev.y, x1: pos.x, y1: pos.y, t: Date.now() });
        const now = Date.now();
        if (now - lastEmitTime > 20) {
            socket.emit('laser_point', { room_id: ROOM_ID, x0: prev.x, y0: prev.y, x1: pos.x, y1: pos.y });
            lastEmitTime = now;
        }
        return;
    }

    if (currentTool === 'eraser') {
        ctx.save();
        ctx.setTransform(window.workspaceScale, 0, 0, window.workspaceScale, panX, panY);
        setupStrokeContext(ctx, 'eraser', '#000', currentWidth, 1);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.restore();
        queueEraserPointSegment(pos, currentWidth);
        return;
    }

    scheduleRedrawDraft();
    const now = Date.now();
    if (now - lastEmitTime > 35) {
        socket.emit('draw_live', { room_id: ROOM_ID, stroke: currentStroke });
        lastEmitTime = now;
    }
}

function endPointerAction() {
    if (isPanning) {
        isPanning = false;
        return;
    }
    if (!drawing) return;
    drawing = false;

    if (currentTool === 'text' && textDragBox) {
        const x = Math.round(Math.min(textDragBox.x0, textDragBox.x1));
        const y = Math.round(Math.min(textDragBox.y0, textDragBox.y1));
        const w = Math.max(220, Math.round(Math.abs(textDragBox.x1 - textDragBox.x0)));
        const h = Math.max(68, Math.round(Math.abs(textDragBox.y1 - textDragBox.y0)));
        textDragBox = null;
        scheduleRedrawDraft();
        const newBox = {
            room_id: ROOM_ID,
            id: 'tbox_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            x: x,
            y: y,
            w: w,
            h: h,
            text: '',
            color: currentColor,
            fontSize: Math.max(18, currentWidth * 4),
            owner: window.USERNAME || 'Thành viên',
            owner_id: window.CLIENT_ID
        };
        window.createOrUpdateTextBox(newBox, true);
        socket.emit('new_text_box', newBox);
        window.selectDrawingTool('pan');
        return;
    }

    if (currentStroke && currentStroke.tool !== 'laser') {
        ensureStrokeBBox(currentStroke);
        strokeHistory.push(currentStroke);
        scheduleRedrawAll();
        socket.emit('draw_stroke', { room_id: ROOM_ID, stroke: currentStroke });
    }
    pendingEraserPoints = [];
    currentStroke = null;
    scheduleRedrawDraft();
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', (e) => {
    if (e.target !== canvas) return;
    e.preventDefault();
    startPointerAction(e.clientX, e.clientY, e.button);
});

window.addEventListener('mousemove', (e) => {
    if (!drawing && !isPanning) return;
    movePointerAction(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
    endPointerAction();
});

canvas.addEventListener('touchstart', (e) => {
    if (e.target !== canvas) return;
    if (e.touches.length === 1 && !globalPinchActive) {
        e.preventDefault();
        const t = e.touches[0];
        startPointerAction(t.clientX, t.clientY, 0);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && !globalPinchActive && (drawing || isPanning)) {
        e.preventDefault();
        const t = e.touches[0];
        movePointerAction(t.clientX, t.clientY);
    }
}, { passive: false });

canvas.addEventListener('touchend', () => {
    endPointerAction();
});

window.loadDrawHistory = function(history) {
    strokeHistory = Array.isArray(history) ? history : [];
    strokeHistory.forEach(s => ensureStrokeBBox(s));
    scheduleRedrawAll();
};

socket.on('laser_point', (d) => {
    if (d) laserTrails.push({ x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, t: Date.now() });
});

socket.on('draw_live', (data) => {
    if (!data || !data.stroke) return;
    remoteLiveStrokes[data.sid || 'peer'] = data.stroke;
    scheduleRedrawDraft();
});

socket.on('draw_segment', (d) => {
    if (!d || d.tool !== 'eraser') return;
    ctx.save();
    ctx.setTransform(window.workspaceScale, 0, 0, window.workspaceScale, panX, panY);
    setupStrokeContext(ctx, 'eraser', '#000', d.width || 4, 1);
    ctx.beginPath();
    if (Array.isArray(d.points) && d.points.length > 0) {
        ctx.moveTo(d.points[0].x, d.points[0].y);
        for (let i = 1; i < d.points.length; i++) {
            ctx.lineTo(d.points[i].x, d.points[i].y);
        }
    } else if (typeof d.x0 === 'number') {
        ctx.moveTo(d.x0, d.y0);
        ctx.lineTo(d.x1, d.y1);
    }
    ctx.stroke();
    ctx.restore();
});

socket.on('draw_stroke', (stroke) => {
    if (!stroke) return;
    if (stroke.sid) {
        delete remoteLiveStrokes[stroke.sid];
    } else {
        remoteLiveStrokes = {};
    }
    scheduleRedrawDraft();
    ensureStrokeBBox(stroke);
    strokeHistory.push(stroke);
    scheduleRedrawAll();
});

socket.on('stroke_deleted', (data) => {
    if (!data) return;
    const ids = Array.isArray(data.stroke_ids) ? new Set(data.stroke_ids) : (data.stroke_id ? new Set([data.stroke_id]) : null);
    if (!ids || ids.size === 0) return;
    strokeHistory = strokeHistory.filter(s => !ids.has(s.id));
    scheduleRedrawAll();
});

socket.on('board_sync', (data) => {
    strokeHistory = (data && data.draw_history) ? data.draw_history : [];
    strokeHistory.forEach(s => ensureStrokeBBox(s));
    scheduleRedrawAll();
    if (data && Array.isArray(data.texts)) {
        window.loadTextsHistory(data.texts);
    }
});

socket.on('board_cleared', () => {
    strokeHistory = [];
    remoteLiveStrokes = {};
    scheduleRedrawAll();
    scheduleRedrawDraft();
    textLayer.innerHTML = '';
});

socket.on('text_box_added', (d) => window.createOrUpdateTextBox(d, false));
socket.on('text_box_updated', (d) => window.createOrUpdateTextBox(d, false));
socket.on('text_box_deleted', (d) => {
    if (d && d.id) {
        const el = document.getElementById(d.id);
        if (el) el.remove();
    }
});
