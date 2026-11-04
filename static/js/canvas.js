const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const draftCanvas = document.getElementById('draft-board');
const draftCtx = draftCanvas.getContext('2d');
const laserCanvas = document.getElementById('laser-board');
const laserCtx = laserCanvas.getContext('2d');
const textLayer = document.getElementById('text-layer');
const workspace = document.getElementById('workspace');
const zoomIndicator = document.getElementById('zoom-indicator');

window.workspaceScale = 1;
window.eraserMode = localStorage.getItem('syncspace_eraser_mode') || 'point';
window.currentStamp = '❤️';
let panX = -(5000 - window.innerWidth) / 2;
let panY = -(5000 - window.innerHeight) / 2;
let targetScale = 1;
let targetPanX = panX;
let targetPanY = panY;

function applyTransformImmediate() {
    workspace.style.transform = `translate3d(${panX.toFixed(1)}px, ${panY.toFixed(1)}px, 0) scale(${window.workspaceScale.toFixed(4)})`;
    if (zoomIndicator) {
        zoomIndicator.innerText = Math.round(window.workspaceScale * 100) + '%';
    }
}
applyTransformImmediate();

window.centerWorkspace = function() {
    targetScale = 1;
    targetPanX = -(5000 - window.innerWidth) / 2;
    targetPanY = -(5000 - window.innerHeight) / 2;
};

window.zoomByStep = function(factor) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const nextScale = Math.min(Math.max(0.25, targetScale * factor), 3.5);
    targetPanX = cx - (cx - targetPanX) * (nextScale / targetScale);
    targetPanY = cy - (cy - targetPanY) * (nextScale / targetScale);
    targetScale = nextScale;
};

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
let lastEmitTime = 0;
let laserTrails = [];

const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowleft: false, arrowdown: false, arrowright: false };

window.addEventListener('keydown', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) return;
    if (e.code === 'Space' && !spacePressed) {
        spacePressed = true;
        canvas.classList.add('pan-mode');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        socket.emit('undo_stroke', { room_id: ROOM_ID });
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
        laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
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

function mainAnimationLoop() {
    const speed = 15;
    if (keys.w || keys.arrowup) targetPanY += speed;
    if (keys.s || keys.arrowdown) targetPanY -= speed;
    if (keys.a || keys.arrowleft) targetPanX += speed;
    if (keys.d || keys.arrowright) targetPanX -= speed;

    const ds = targetScale - window.workspaceScale;
    const dx = targetPanX - panX;
    const dy = targetPanY - panY;
    if (Math.abs(ds) > 0.0005 || Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
        window.workspaceScale += ds * 0.26;
        panX += dx * 0.26;
        panY += dy * 0.26;
        applyTransformImmediate();
    }
    renderLaserLoop();
    requestAnimationFrame(mainAnimationLoop);
}
mainAnimationLoop();

window.addEventListener('wheel', (e) => {
    if (e.target.closest('.xo-board-wrapper') || e.target.closest('.chat-messages') || e.target.closest('.settings-body') || e.target.closest('.scroll-strip') || e.target.closest('.media-content') || e.target.closest('.board-media-body') || e.target.closest('.tool-popover') || e.target.closest('.text-box-editor') || e.target.closest('.sticky-content')) {
        return;
    }
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextScale = Math.min(Math.max(0.25, targetScale * factor), 3.5);
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    targetPanX = mouseX - (mouseX - targetPanX) * (nextScale / targetScale);
    targetPanY = mouseY - (mouseY - targetPanY) * (nextScale / targetScale);
    targetScale = nextScale;
}, { passive: false });

const PEN_TOOLS = ['pen', 'highlighter', 'calligraphy', 'marker', 'neon', 'rainbow', 'dashed', 'spray', 'laser'];
const SHAPE_TOOLS = ['line', 'arrow', 'darrow', 'rect', 'circle', 'triangle', 'diamond'];

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

const colorPicker = document.getElementById('color-picker');
const styleColorDot = document.getElementById('style-color-dot');
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    if (styleColorDot) styleColorDot.style.background = currentColor;
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
    socket.emit('undo_stroke', { room_id: ROOM_ID });
});

window.bindSafeButton(document.getElementById('tool-center'), () => {
    window.centerWorkspace();
    if (window.showToast) window.showToast('Đã đưa góc nhìn về trung tâm bảng (100%)');
});

window.bindSafeButton(document.getElementById('btn-zoom-in'), () => window.zoomByStep(1.2));
window.bindSafeButton(document.getElementById('btn-zoom-out'), () => window.zoomByStep(0.83));
window.bindSafeButton(zoomIndicator, () => window.centerWorkspace());

window.bindSafeButton(document.getElementById('tool-clear'), () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ nét vẽ và khung chữ trên bảng không?')) {
        strokeHistory = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        draftCtx.clearRect(0, 0, draftCanvas.width, draftCanvas.height);
        textLayer.innerHTML = '';
        socket.emit('clear_board', { room_id: ROOM_ID });
    }
});

window.bindSafeButton(document.getElementById('tool-export'), () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = window.innerWidth;
    exportCanvas.height = window.innerHeight;
    const eCtx = exportCanvas.getContext('2d');
    eCtx.fillStyle = document.body.classList.contains('light-theme') ? '#f5f7fb' : '#0f0f13';
    eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    eCtx.save();
    eCtx.translate(panX, panY);
    eCtx.scale(window.workspaceScale, window.workspaceScale);
    eCtx.drawImage(canvas, 0, 0);
    eCtx.restore();
    const link = document.createElement('a');
    link.download = `SyncSpace_${ROOM_ID}_${Date.now()}.png`;
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
        targetCtx.shadowBlur = width * 3 + 10;
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
    }
    targetCtx.restore();
}

function renderStrokeOnContext(targetCtx, stroke) {
    if (!stroke) return;
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
}

function redrawDraftCanvas() {
    draftCtx.clearRect(0, 0, draftCanvas.width, draftCanvas.height);
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
        draftCtx.lineWidth = 2;
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

function redrawAllHistory() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < strokeHistory.length; i++) {
        renderStrokeOnContext(ctx, strokeHistory[i]);
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
    const pts = stroke.points || [];
    if (pts.length === 0) return false;
    const strokeW = parseFloat(stroke.width || 4);
    const hitR = Math.max(12, tolerance + strokeW);
    const hitRSq = hitR * hitR;

    if (stroke.tool === 'rect' || stroke.tool === 'triangle' || stroke.tool === 'diamond') {
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

function eraseStrokeAtPoint(px, py) {
    for (let i = strokeHistory.length - 1; i >= 0; i--) {
        const st = strokeHistory[i];
        if (isPointHittingStroke(px, py, st, currentWidth * 1.5)) {
            const removed = strokeHistory.splice(i, 1)[0];
            redrawAllHistory();
            if (removed && removed.id) {
                socket.emit('delete_stroke', { room_id: ROOM_ID, stroke_id: removed.id });
            }
            return true;
        }
    }
    return false;
}

window.createOrUpdateTextBox = function(data, autoFocus) {
    if (!data || !data.id) return;
    let box = document.getElementById(data.id);
    if (!box) {
        box = document.createElement('div');
        box.className = 'board-text-box';
        box.id = data.id;

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

        const btnColor = document.createElement('button');
        btnColor.type = 'button';
        btnColor.className = 'tbox-btn';
        btnColor.innerText = '🎨';
        btnColor.title = 'Đổi sang màu bút hiện tại';

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'tbox-btn del';
        btnDel.innerText = '✕';

        bar.appendChild(dragHandle);
        bar.appendChild(btnSmaller);
        bar.appendChild(btnBigger);
        bar.appendChild(btnColor);
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
                owner: window.USERNAME
            });
        };

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

        window.bindSafeButton(btnColor, () => {
            editor.style.color = currentColor;
            emitBoxUpdate();
        });

        window.bindSafeButton(btnDel, () => {
            box.remove();
            socket.emit('delete_text_box', { room_id: ROOM_ID, id: data.id });
        });

        const stopBubble = (e) => {
            e.stopPropagation();
        };
        editor.addEventListener('pointerdown', stopBubble);
        editor.addEventListener('mousedown', stopBubble);
        editor.addEventListener('touchstart', stopBubble, { passive: true });
        editor.addEventListener('click', (e) => {
            e.stopPropagation();
            editor.focus();
        });
        editor.addEventListener('focus', () => box.classList.add('editing'));
        editor.addEventListener('blur', () => {
            box.classList.remove('editing');
            emitBoxUpdate();
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
        box.addEventListener('pointerdown', stopBubble);
        box.addEventListener('mousedown', stopBubble);
    }

    if (typeof data.x === 'number') box.style.left = data.x + 'px';
    if (typeof data.y === 'number') box.style.top = data.y + 'px';
    if (typeof data.w === 'number') box.style.width = data.w + 'px';
    if (typeof data.h === 'number') box.style.height = data.h + 'px';

    const editor = box.querySelector('.text-box-editor');
    if (editor) {
        if (data.color) editor.style.color = data.color;
        editor.style.fontSize = (data.fontSize || 20) + 'px';
        if (data.text !== undefined && document.activeElement !== editor) {
            editor.value = data.text;
        }
        if (autoFocus) {
            setTimeout(() => {
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

window.getWorkspaceCoords = function(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.round(((clientX - rect.left) / window.workspaceScale) * 10) / 10,
        y: Math.round(((clientY - rect.top) / window.workspaceScale) * 10) / 10
    };
};

function startPointerAction(clientX, clientY, button) {
    if (window.closeAllPopovers) window.closeAllPopovers();
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
        redrawDraftCanvas();
        return;
    }

    if (currentTool === 'eraser' && window.eraserMode === 'stroke') {
        drawing = true;
        currentStroke = null;
        eraseStrokeAtPoint(pos.x, pos.y);
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
        points: [pos]
    };

    if (currentTool === 'laser') {
        laserTrails.push({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, t: Date.now() });
        socket.emit('laser_point', { room_id: ROOM_ID, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
    } else if (currentTool === 'eraser') {
        renderStrokeOnContext(ctx, currentStroke);
        socket.emit('draw_segment', {
            room_id: ROOM_ID,
            tool: 'eraser',
            color: activeColor,
            width: currentWidth,
            x0: pos.x,
            y0: pos.y,
            x1: pos.x,
            y1: pos.y
        });
    } else {
        redrawDraftCanvas();
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
        redrawDraftCanvas();
        return;
    }

    if (currentTool === 'eraser' && window.eraserMode === 'stroke') {
        eraseStrokeAtPoint(pos.x, pos.y);
        return;
    }
    if (!currentStroke) return;
    const pts = currentStroke.points;
    const prev = pts[pts.length - 1];

    if (isShapeTool(currentTool)) {
        if (pts.length === 1) pts.push(pos);
        else pts[1] = pos;
        redrawDraftCanvas();
        const now = Date.now();
        if (now - lastEmitTime > 30) {
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
        socket.emit('laser_point', { room_id: ROOM_ID, x0: prev.x, y0: prev.y, x1: pos.x, y1: pos.y });
        return;
    }

    if (currentTool === 'eraser') {
        setupStrokeContext(ctx, 'eraser', '#000', currentWidth, 1);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        socket.emit('draw_segment', {
            room_id: ROOM_ID,
            tool: 'eraser',
            color: '#000',
            width: currentWidth,
            x0: prev.x,
            y0: prev.y,
            x1: pos.x,
            y1: pos.y
        });
        return;
    }

    redrawDraftCanvas();
    const now = Date.now();
    if (now - lastEmitTime > 28) {
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
        redrawDraftCanvas();
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
            owner: window.USERNAME
        };
        window.createOrUpdateTextBox(newBox, true);
        socket.emit('new_text_box', newBox);
        window.selectDrawingTool('pan');
        return;
    }

    if (currentStroke && currentStroke.tool !== 'laser') {
        if (currentStroke.tool !== 'eraser') {
            renderStrokeOnContext(ctx, currentStroke);
        }
        strokeHistory.push(currentStroke);
        socket.emit('draw_stroke', { room_id: ROOM_ID, stroke: currentStroke });
    }
    currentStroke = null;
    redrawDraftCanvas();
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

let pinchStartDist = 0;
let pinchStartScale = 1;
let pinchCenter = { x: 0, y: 0 };

canvas.addEventListener('touchstart', (e) => {
    if (e.target !== canvas) return;
    if (e.touches.length === 2) {
        e.preventDefault();
        drawing = false;
        currentStroke = null;
        textDragBox = null;
        redrawDraftCanvas();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        pinchStartScale = targetScale;
        pinchCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        return;
    }
    if (e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        startPointerAction(t.clientX, t.clientY, 0);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const cx = (t1.clientX + t2.clientX) / 2;
        const cy = (t1.clientY + t2.clientY) / 2;
        if (pinchStartDist > 10) {
            const nextScale = Math.min(Math.max(0.25, pinchStartScale * (dist / pinchStartDist)), 3.5);
            targetPanX = cx - (pinchCenter.x - targetPanX) * (nextScale / targetScale) + (cx - pinchCenter.x);
            targetPanY = cy - (pinchCenter.y - targetPanY) * (nextScale / targetScale) + (cy - pinchCenter.y);
            targetScale = nextScale;
            pinchCenter = { x: cx, y: cy };
        }
        return;
    }
    if (e.touches.length === 1 && (drawing || isPanning)) {
        e.preventDefault();
        const t = e.touches[0];
        movePointerAction(t.clientX, t.clientY);
    }
}, { passive: false });

canvas.addEventListener('touchend', () => {
    pinchStartDist = 0;
    endPointerAction();
});

window.loadDrawHistory = function(history) {
    strokeHistory = Array.isArray(history) ? history : [];
    redrawAllHistory();
};

socket.on('laser_point', (d) => {
    laserTrails.push({ x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, t: Date.now() });
});

socket.on('draw_live', (data) => {
    if (!data || !data.stroke) return;
    remoteLiveStrokes[data.sid || 'peer'] = data.stroke;
    redrawDraftCanvas();
});

socket.on('draw_segment', (d) => {
    if (d.tool === 'eraser') {
        setupStrokeContext(ctx, 'eraser', '#000', d.width, 1);
        ctx.beginPath();
        ctx.moveTo(d.x0, d.y0);
        ctx.lineTo(d.x1, d.y1);
        ctx.stroke();
    }
});

socket.on('draw_stroke', (stroke) => {
    if (stroke && stroke.sid) {
        delete remoteLiveStrokes[stroke.sid];
    } else {
        remoteLiveStrokes = {};
    }
    redrawDraftCanvas();
    strokeHistory.push(stroke);
    renderStrokeOnContext(ctx, stroke);
});

socket.on('stroke_deleted', (data) => {
    if (!data || !data.stroke_id) return;
    strokeHistory = strokeHistory.filter(s => s.id !== data.stroke_id);
    redrawAllHistory();
});

socket.on('board_sync', (data) => {
    strokeHistory = data.draw_history || [];
    redrawAllHistory();
});

socket.on('board_cleared', () => {
    strokeHistory = [];
    remoteLiveStrokes = {};
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draftCtx.clearRect(0, 0, draftCanvas.width, draftCanvas.height);
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
