const stickyContainer = document.getElementById('sticky-container');
const stickyColors = {
    y: '#ffeaa7',
    g: '#55efc4',
    p: '#fd79a8',
    b: '#74b9ff',
    v: '#d6a2e8',
    o: '#fab1a0'
};

window.bindSafeButton(document.getElementById('tool-sticky'), () => {
    const id = 'note_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const centerPos = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
    const offset = (stickyContainer.children.length % 6) * 26;
    const startX = Math.round(centerPos.x - 120 + offset);
    const startY = Math.round(centerPos.y - 90 + offset);
    const payload = {
        room_id: ROOM_ID,
        id: id,
        x: startX + 'px',
        y: startY + 'px',
        w: 245,
        h: 185,
        text: '',
        color: 'y',
        fontSize: 15,
        locked: false,
        owner: window.USERNAME || 'Thành viên'
    };
    createSticky(payload, true);
    socket.emit('new_sticky', payload);
});

function createSticky(data, autoFocus) {
    if (!data || !data.id) return;
    const id = data.id;
    let existing = document.getElementById(id);
    if (existing) {
        existing.style.left = typeof data.x === 'number' ? data.x + 'px' : data.x;
        existing.style.top = typeof data.y === 'number' ? data.y + 'px' : data.y;
        if (data.w) existing.style.width = data.w + 'px';
        if (data.h) existing.style.height = data.h + 'px';
        if (data.color) existing.style.backgroundColor = stickyColors[data.color] || stickyColors.y;
        const cEl = existing.querySelector('.sticky-content');
        if (cEl) {
            if (data.fontSize) cEl.style.fontSize = data.fontSize + 'px';
            if (data.text !== undefined && document.activeElement !== cEl) cEl.value = data.text;
        }
        return;
    }

    const el = document.createElement('div');
    el.className = 'sticky-note';
    el.id = id;
    el.style.left = typeof data.x === 'number' ? data.x + 'px' : data.x;
    el.style.top = typeof data.y === 'number' ? data.y + 'px' : data.y;
    el.style.width = (data.w || 245) + 'px';
    el.style.height = (data.h || 185) + 'px';
    el.style.backgroundColor = stickyColors[data.color] || stickyColors.y;

    const header = document.createElement('div');
    header.className = 'sticky-header';

    const colorsDiv = document.createElement('div');
    colorsDiv.className = 'sticky-colors';
    ['y', 'g', 'p', 'b', 'v', 'o'].forEach(c => {
        const dot = document.createElement('div');
        dot.className = 'scolor ' + c;
        window.bindSafeButton(dot, () => {
            el.style.backgroundColor = stickyColors[c];
            socket.emit('color_sticky', { room_id: ROOM_ID, id: id, color: c });
        });
        colorsDiv.appendChild(dot);
    });

    const rightControls = document.createElement('div');
    rightControls.className = 'sticky-tools-right';

    const btnFontUp = document.createElement('button');
    btnFontUp.type = 'button';
    btnFontUp.className = 'sticky-mini-btn';
    btnFontUp.innerText = 'A+';
    btnFontUp.title = 'Tăng/Giảm cỡ chữ';

    let isLocked = !!data.locked;
    const btnLock = document.createElement('button');
    btnLock.type = 'button';
    btnLock.className = 'sticky-mini-btn';
    btnLock.innerText = isLocked ? '🔒' : '📌';
    btnLock.title = 'Khóa/Mở khóa vị trí ghi chú';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'sticky-del';
    delBtn.innerText = '✕';
    delBtn.title = 'Xóa ghi chú';

    rightControls.appendChild(btnFontUp);
    rightControls.appendChild(btnLock);
    rightControls.appendChild(delBtn);

    header.appendChild(colorsDiv);
    header.appendChild(rightControls);

    const metaBar = document.createElement('div');
    metaBar.className = 'sticky-meta-bar';
    metaBar.innerHTML = `<span>✍️ ${data.owner || 'Thành viên'}</span><span>Ghi chú</span>`;

    const content = document.createElement('textarea');
    content.className = 'sticky-content';
    content.placeholder = 'Viết ghi chú...';
    content.value = data.text || '';
    content.style.fontSize = (data.fontSize || 15) + 'px';

    el.appendChild(header);
    el.appendChild(metaBar);
    el.appendChild(content);
    stickyContainer.appendChild(el);

    const emitStickyMove = () => {
        socket.emit('move_sticky', {
            room_id: ROOM_ID,
            id: id,
            x: el.style.left,
            y: el.style.top,
            w: parseFloat(el.style.width) || 245,
            h: parseFloat(el.style.height) || 185,
            fontSize: parseInt(content.style.fontSize, 10) || 15,
            locked: isLocked
        });
    };

    window.makeWidgetResizable(el, 190, 140, true, () => {
        emitStickyMove();
    });

    window.bindSafeButton(btnFontUp, () => {
        const cur = parseInt(content.style.fontSize, 10) || 15;
        const next = cur >= 24 ? 14 : cur + 3;
        content.style.fontSize = next + 'px';
        emitStickyMove();
    });

    window.bindSafeButton(btnLock, () => {
        isLocked = !isLocked;
        btnLock.innerText = isLocked ? '🔒' : '📌';
        emitStickyMove();
    });

    window.bindSafeButton(delBtn, () => {
        el.remove();
        socket.emit('delete_sticky', { room_id: ROOM_ID, id: id });
    });

    if (autoFocus) {
        setTimeout(() => content.focus(), 60);
    }

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener('pointerdown', (e) => {
        if (isLocked || e.target.closest('button') || e.target.closest('.scolor')) return;
        e.stopPropagation();
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLeft = parseFloat(el.style.left) || 0;
        initialTop = parseFloat(el.style.top) || 0;
        el.classList.add('dragging');
        el.style.zIndex = 100;
        if (header.setPointerCapture) {
            try { header.setPointerCapture(e.pointerId); } catch (err) {}
        }
    });

    header.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.stopPropagation();
        const scale = window.workspaceScale || 1;
        const newX = Math.round(initialLeft + (e.clientX - dragStartX) / scale);
        const newY = Math.round(initialTop + (e.clientY - dragStartY) / scale);
        el.style.left = newX + 'px';
        el.style.top = newY + 'px';
        emitStickyMove();
    });

    const stopStickyDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        el.classList.remove('dragging');
        el.style.zIndex = '';
        if (e && header.releasePointerCapture) {
            try { header.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        emitStickyMove();
    };

    header.addEventListener('pointerup', stopStickyDrag);
    header.addEventListener('pointercancel', stopStickyDrag);

    const stopBubble = (e) => e.stopPropagation();
    content.addEventListener('pointerdown', stopBubble);
    content.addEventListener('mousedown', stopBubble);
    content.addEventListener('touchstart', stopBubble, { passive: true });
    el.addEventListener('pointerdown', stopBubble);

    content.addEventListener('input', () => {
        socket.emit('edit_sticky', { room_id: ROOM_ID, id: id, text: content.value });
    });
}

window.loadStickiesHistory = function(stickiesList) {
    stickyContainer.innerHTML = '';
    if (Array.isArray(stickiesList)) {
        stickiesList.forEach(s => createSticky(s, false));
    }
};

socket.on('sticky_added', (d) => createSticky(d, false));
socket.on('sticky_moved', (d) => createSticky(d, false));
socket.on('sticky_edited', (d) => {
    const el = document.getElementById(d.id);
    if (el) {
        const c = el.querySelector('.sticky-content');
        if (c && document.activeElement !== c) c.value = d.text;
    }
});
socket.on('sticky_deleted', (d) => {
    const el = document.getElementById(d.id);
    if (el) el.remove();
});
socket.on('sticky_colored', (d) => {
    const el = document.getElementById(d.id);
    if (el) el.style.backgroundColor = stickyColors[d.color] || stickyColors.y;
});
