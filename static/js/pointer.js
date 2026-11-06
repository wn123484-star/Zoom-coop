const cursorsContainer = document.getElementById('cursors-container');
const stampsLayer = document.getElementById('stamps-layer');
const cursors = {};
const pendingCursorUpdates = {};
let cursorRafScheduled = false;
let lastSend = 0;
let localTouchEl = null;
let localTouchTimer = null;

function showLocalTouchIndicator(wx, wy) {
    if (!localTouchEl) {
        localTouchEl = document.createElement('div');
        localTouchEl.className = 'local-touch-badge';
        cursorsContainer.appendChild(localTouchEl);
    }
    localTouchEl.innerText = '👆 ' + (window.USERNAME || 'Bạn');
    localTouchEl.style.display = 'block';
    localTouchEl.style.transform = `translate3d(${wx}px, ${wy}px, 0) translate(-50%, -140%)`;
    if (localTouchTimer) clearTimeout(localTouchTimer);
    localTouchTimer = setTimeout(() => {
        if (localTouchEl) localTouchEl.style.display = 'none';
    }, 1200);
}

window.spawnFloatingStamp = function(x, y, emoji, sender) {
    if (!stampsLayer) return;
    const el = document.createElement('div');
    el.className = 'floating-stamp';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    const em = document.createElement('div');
    em.className = 'stamp-emoji';
    em.innerText = emoji || '❤️';
    const s = document.createElement('div');
    s.className = 'stamp-sender';
    s.innerText = sender || 'Thành viên';
    el.appendChild(em);
    el.appendChild(s);
    stampsLayer.appendChild(el);
    setTimeout(() => {
        el.remove();
    }, 2800);
};

function broadcastPointerPosition(clientX, clientY, isTouch) {
    if (!socket || !socket.connected || !window.getWorkspaceCoords) return;
    const pos = window.getWorkspaceCoords(clientX, clientY);
    const wx = Math.round(pos.x);
    const wy = Math.round(pos.y);
    if (isTouch) {
        showLocalTouchIndicator(wx, wy);
    }
    const now = Date.now();
    if (now - lastSend > 35 || isTouch) {
        socket.emit('mouse_move', {
            room_id: ROOM_ID,
            x: wx,
            y: wy,
            touching: !!isTouch,
            username: window.USERNAME || 'Thành viên'
        });
        lastSend = now;
    }
}

document.addEventListener('pointermove', (e) => {
    broadcastPointerPosition(e.clientX, e.clientY, e.pointerType === 'touch');
}, { passive: true });

document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
        broadcastPointerPosition(e.clientX, e.clientY, true);
    }
}, { passive: true });

function flushCursorDOMUpdates() {
    cursorRafScheduled = false;
    const now = Date.now();
    Object.keys(pendingCursorUpdates).forEach(sid => {
        const data = pendingCursorUpdates[sid];
        delete pendingCursorUpdates[sid];
        if (!cursors[sid]) {
            const el = document.createElement('div');
            el.className = 'cursor';
            const dot = document.createElement('div');
            dot.className = 'cursor-dot';
            const name = document.createElement('div');
            name.className = 'cursor-name';
            el.appendChild(dot);
            el.appendChild(name);
            cursorsContainer.appendChild(el);
            cursors[sid] = { el: el, nameEl: name, lastSeen: now };
        }
        const item = cursors[sid];
        item.lastSeen = now;
        const label = (data.touching ? '👆 ' : '') + (data.username || 'Thành viên');
        if (item.nameEl.innerText !== label) {
            item.nameEl.innerText = label;
        }
        item.el.classList.toggle('touching', !!data.touching);
        item.el.style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;
    });
}

socket.on('mouse_update', (data) => {
    if (!data || !data.sid) return;
    pendingCursorUpdates[data.sid] = data;
    if (!cursorRafScheduled) {
        cursorRafScheduled = true;
        requestAnimationFrame(flushCursorDOMUpdates);
    }
});

function removeCursorBySid(sid) {
    delete pendingCursorUpdates[sid];
    if (cursors[sid]) {
        if (cursors[sid].el) cursors[sid].el.remove();
        delete cursors[sid];
    }
}

setInterval(() => {
    const now = Date.now();
    Object.keys(cursors).forEach(sid => {
        if (now - cursors[sid].lastSeen > 45000) {
            removeCursorBySid(sid);
        }
    });
}, 15000);

socket.on('remove_cursor', (data) => {
    if (data && data.sid) removeCursorBySid(data.sid);
});

socket.on('user_disconnected', (data) => {
    if (data && data.users) {
        window.ROOM_USERS = data.users;
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.innerText = data.users.length;
    }
    if (data && data.sid) {
        removeCursorBySid(data.sid);
    }
});

socket.on('stamp_placed', (data) => {
    if (data) {
        window.spawnFloatingStamp(data.x, data.y, data.emoji, data.sender);
    }
});
