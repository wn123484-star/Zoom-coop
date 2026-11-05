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
