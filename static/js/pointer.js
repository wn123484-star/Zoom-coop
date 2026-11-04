const cursorsContainer = document.getElementById('cursors-container');
const stampsLayer = document.getElementById('stamps-layer');
const cursors = {};
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
    if (!socket || !socket.connected) return;
    const ws = document.getElementById('workspace');
    if (!ws) return;
    const rect = ws.getBoundingClientRect();
    const scale = window.workspaceScale || 1;
    const wx = Math.round((clientX - rect.left) / scale);
    const wy = Math.round((clientY - rect.top) / scale);
    if (isTouch) {
        showLocalTouchIndicator(wx, wy);
    }
    const now = Date.now();
    if (now - lastSend > 30 || isTouch) {
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
});

document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
        broadcastPointerPosition(e.clientX, e.clientY, true);
    }
});

socket.on('mouse_update', (data) => {
    if (!cursors[data.sid]) {
        const el = document.createElement('div');
        el.className = 'cursor';
        const dot = document.createElement('div');
        dot.className = 'cursor-dot';
        const name = document.createElement('div');
        name.className = 'cursor-name';
        el.appendChild(dot);
        el.appendChild(name);
        cursorsContainer.appendChild(el);
        cursors[data.sid] = el;
    }
    const cursorEl = cursors[data.sid];
    const nameEl = cursorEl.querySelector('.cursor-name');
    if (nameEl) {
        nameEl.innerText = (data.touching ? '👆 ' : '') + (data.username || 'Thành viên');
    }
    cursorEl.classList.toggle('touching', !!data.touching);
    cursorEl.style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;
});

socket.on('remove_cursor', (data) => {
    if (data && data.sid && cursors[data.sid]) {
        cursors[data.sid].remove();
        delete cursors[data.sid];
    }
});

socket.on('user_disconnected', (data) => {
    if (data && data.users) {
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.innerText = data.users.length;
    }
    if (cursors[data.sid]) {
        cursors[data.sid].remove();
        delete cursors[data.sid];
    }
});

socket.on('stamp_placed', (data) => {
    if (data) {
        window.spawnFloatingStamp(data.x, data.y, data.emoji, data.sender);
    }
});
