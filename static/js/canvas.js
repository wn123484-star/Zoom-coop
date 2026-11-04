const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const laserCanvas = document.getElementById('laser-board');
const laserCtx = laserCanvas.getContext('2d');
const workspace = document.getElementById('workspace');
const zoomIndicator = document.getElementById('zoom-indicator');

window.workspaceScale = 1;
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
let currentTool = 'pen';
let currentColor = '#00d2ff';
let currentWidth = 4;
let rainbowHue = 0;
let strokeHistory = [];
let currentStroke = null;
let shapeSnapshot = null;
let lastEmitTime = 0;
let laserTrails = [];

const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowleft: false, arrowdown: false, arrowright: false };

window.addEventListener('keydown', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.isContentEditable)) return;
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
    if (e.target.closest('.xo-board-wrapper') || e.target.closest('.chat-messages') || e.target.closest('.settings-body') || e.target.closest('.top-toolbar')) {
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

const toolBtns = document.querySelectorAll('.tool-btn');
toolBtns.forEach(btn => {
    window.bindSafeButton(btn, () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.id.replace('tool-', '');
        if (currentTool === 'pan') canvas.classList.add('pan-mode');
        else canvas.classList.remove('pan-mode');
    });
});

const colorPicker = document.getElementById('color-picker');
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
});

document.querySelectorAll('.qcolor').forEach(dot => {
    window.bindSafeButton(dot, () => {
        const c = dot.getAttribute('data-color');
        if (c) {
            currentColor = c;
            colorPicker.value = c;
            document.querySelectorAll('.qcolor').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
        }
    });
});

const lineWidthInput = document.getElementById('line-width');
const lineWidthVal = document.getElementById('line-width-val');
lineWidthInput.addEventListener('input', (e) => {
    currentWidth = parseInt(e.target.value, 10) || 4;
    if (lineWidthVal) lineWidthVal.innerText = currentWidth + 'px';
});

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
    if (confirm('Bạn có chắc muốn xóa toàn bộ nét vẽ trên bảng không?')) {
        strokeHistory = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('clear_board', { room_id: ROOM_ID });
    }
});

window.bindSafeButton(document.getElementById('tool-export'), () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = window.innerWidth;
    exportCanvas.height = window.innerHeight;
    const eCtx = exportCanvas.getContext('2d');
    eCtx.fillStyle = document.body.classList.contains('light-theme') ? '#f4f5f9' : '#0f0f13';
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
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
}

function applyBrushSetting(tool, color, width) {
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = width * 2.8;
        ctx.strokeStyle = hexToRgba(color, 0.32);
    } else if (tool === 'neon') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = width * 3.5 + 8;
    } else if (tool === 'dashed') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.setLineDash([width * 2.5, width * 1.8]);
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
    }
}

function drawSegmentImmediate(tool, color, width, x0, y0, x1, y1) {
    if (tool === 'laser') {
        laserTrails.push({ x0, y0, x1, y1, t: Date.now() });
        return;
    }
    ctx.save();
    applyBrushSetting(tool, color, width);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    if (x0 === x1 && y0 === y1) {
        ctx.lineTo(x1 + 0.1, y1 + 0.1);
    } else {
        ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.restore();
}

function drawShapeOnContext(tool, color, width, p0, p1) {
    ctx.save();
    applyBrushSetting(tool, color, width);
    ctx.beginPath();
    if (tool === 'line') {
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
    } else if (tool === 'arrow') {
        const headlen = Math.max(12, width * 3.2);
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p1.x - headlen * Math.cos(angle - Math.PI / 6), p1.y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - headlen * Math.cos(angle + Math.PI / 6), p1.y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    } else if (tool === 'rect') {
        ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    } else if (tool === 'circle') {
        const rx = Math.abs(p1.x - p0.x) / 2;
        const ry = Math.abs(p1.y - p0.y) / 2;
        const cx = (p0.x + p1.x) / 2;
        const cy = (p0.y + p1.y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function renderStrokeObject(stroke) {
    if (!stroke) return;
    if (stroke.tool === 'text' && stroke.text && stroke.points && stroke.points[0]) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = stroke.color || '#00d2ff';
        const fontSize = Math.max(16, (stroke.width || 4) * 5);
        ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
        ctx.restore();
        return;
    }
    const pts = stroke.points || [];
    if (pts.length === 0) return;
    if (stroke.tool === 'line' || stroke.tool === 'arrow' || stroke.tool === 'rect' || stroke.tool === 'circle') {
        if (pts.length >= 2) {
            drawShapeOnContext(stroke.tool, stroke.color, stroke.width, pts[0], pts[pts.length - 1]);
        }
        return;
    }
    ctx.save();
    applyBrushSetting(stroke.tool, stroke.color, stroke.width);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) {
        ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
    } else if (pts.length === 2) {
        ctx.lineTo(pts[1].x, pts[1].y);
    } else {
        for (let i = 1; i < pts.length - 1; i++) {
            const midX = (pts[i].x + pts[i + 1].x) / 2;
            const midY = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
    ctx.stroke();
    ctx.restore();
}

function redrawAllHistory() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < strokeHistory.length; i++) {
        renderStrokeObject(strokeHistory[i]);
    }
}

window.getWorkspaceCoords = function(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.round(((clientX - rect.left) / window.workspaceScale) * 10) / 10,
        y: Math.round(((clientY - rect.top) / window.workspaceScale) * 10) / 10
    };
};

function isShapeTool(t) {
    return t === 'line' || t === 'arrow' || t === 'rect' || t === 'circle';
}

function startPointerAction(clientX, clientY, button) {
    if (button === 1 || button === 2 || spacePressed || currentTool === 'pan') {
        isPanning = true;
        panStartX = clientX - targetPanX;
        panStartY = clientY - targetPanY;
        return;
    }
    if (button !== 0) return;
    const pos = window.getWorkspaceCoords(clientX, clientY);
    if (currentTool === 'text') {
        const txt = prompt('Nhập nội dung chữ muốn chèn lên bảng:');
        if (txt && txt.trim()) {
            const textStroke = {
                id: 'st_' + Date.now(),
                tool: 'text',
                color: currentColor,
                width: currentWidth,
                text: txt.trim(),
                points: [pos]
            };
            renderStrokeObject(textStroke);
            strokeHistory.push(textStroke);
            socket.emit('draw_stroke', { room_id: ROOM_ID, stroke: textStroke });
        }
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
        points: [pos]
    };
    if (isShapeTool(currentTool)) {
        shapeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else if (currentTool === 'laser') {
        drawSegmentImmediate('laser', activeColor, currentWidth, pos.x, pos.y, pos.x, pos.y);
        socket.emit('laser_point', { room_id: ROOM_ID, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
    } else {
        drawSegmentImmediate(currentTool, activeColor, currentWidth, pos.x, pos.y, pos.x, pos.y);
        socket.emit('draw_segment', {
            room_id: ROOM_ID,
            tool: currentTool,
            color: activeColor,
            width: currentWidth,
            x0: pos.x,
            y0: pos.y,
            x1: pos.x,
            y1: pos.y
        });
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
    if (!drawing || !currentStroke) return;
    const pos = window.getWorkspaceCoords(clientX, clientY);
    const pts = currentStroke.points;
    const prev = pts[pts.length - 1];
    if (isShapeTool(currentTool)) {
        if (shapeSnapshot) ctx.putImageData(shapeSnapshot, 0, 0);
        drawShapeOnContext(currentTool, currentStroke.color, currentWidth, pts[0], pos);
        if (pts.length === 1) pts.push(pos);
        else pts[1] = pos;
        return;
    }
    const distSq = (pos.x - prev.x) * (pos.x - prev.x) + (pos.y - prev.y) * (pos.y - prev.y);
    if (distSq < 1.2) return;
    if (currentTool === 'rainbow') {
        rainbowHue = (rainbowHue + 6) % 360;
        currentStroke.color = `hsl(${rainbowHue}, 100%, 60%)`;
    }
    drawSegmentImmediate(currentTool, currentStroke.color, currentWidth, prev.x, prev.y, pos.x, pos.y);
    pts.push(pos);
    const now = Date.now();
    if (now - lastEmitTime > 12) {
        if (currentTool === 'laser') {
            socket.emit('laser_point', { room_id: ROOM_ID, x0: prev.x, y0: prev.y, x1: pos.x, y1: pos.y });
        } else {
            socket.emit('draw_segment', {
                room_id: ROOM_ID,
                tool: currentTool,
                color: currentStroke.color,
                width: currentWidth,
                x0: prev.x,
                y0: prev.y,
                x1: pos.x,
                y1: pos.y
            });
        }
        lastEmitTime = now;
    }
}

function endPointerAction() {
    if (isPanning) {
        isPanning = false;
        return;
    }
    if (!drawing || !currentStroke) return;
    drawing = false;
    shapeSnapshot = null;
    if (currentStroke.tool !== 'laser') {
        strokeHistory.push(currentStroke);
        socket.emit('draw_stroke', { room_id: ROOM_ID, stroke: currentStroke });
    }
    currentStroke = null;
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', (e) => {
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
    if (e.touches.length === 2) {
        e.preventDefault();
        drawing = false;
        currentStroke = null;
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

socket.on('draw_segment', (d) => {
    drawSegmentImmediate(d.tool, d.color, d.width, d.x0, d.y0, d.x1, d.y1);
});

socket.on('draw_stroke', (stroke) => {
    strokeHistory.push(stroke);
    if (isShapeTool(stroke.tool) || stroke.tool === 'text') {
        renderStrokeObject(stroke);
    }
});

socket.on('board_sync', (data) => {
    strokeHistory = data.draw_history || [];
    redrawAllHistory();
});

socket.on('board_cleared', () => {
    strokeHistory = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});
