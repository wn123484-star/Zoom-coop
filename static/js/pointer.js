const cursorsContainer = document.getElementById('cursors-container');
const cursors = {};
let lastSend = 0;

document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastSend > 35) {
        const ws = document.getElementById('workspace');
        if (!ws) return;
        const rect = ws.getBoundingClientRect();
        const scale = window.workspaceScale || 1;
        const wx = Math.round((e.clientX - rect.left) / scale);
        const wy = Math.round((e.clientY - rect.top) / scale);
        socket.emit('mouse_move', { room_id: ROOM_ID, x: wx, y: wy, username: USERNAME });
        lastSend = now;
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
        name.innerText = data.username || 'Khách';
        el.appendChild(dot);
        el.appendChild(name);
        cursorsContainer.appendChild(el);
        cursors[data.sid] = el;
    }
    cursors[data.sid].style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;
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
