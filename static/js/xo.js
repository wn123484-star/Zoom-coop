const xoContainer = document.getElementById('xo-container');
const xoBoard = document.getElementById('xo-board');
const xoStatus = document.getElementById('xo-status');
const xoBtn = document.getElementById('tool-xo');
const xoResetBtn = document.getElementById('xo-reset-btn');
const xoMinBtn = document.getElementById('xo-min-btn');
const xoCloseBtn = document.getElementById('xo-close-btn');
const xoHeader = document.getElementById('xo-header');

function syncXoWidgetState() {
    socket.emit('widget_state', {
        room_id: ROOM_ID,
        widget: 'xo',
        x: parseFloat(xoContainer.style.left) || 2580,
        y: parseFloat(xoContainer.style.top) || 2260,
        open: xoContainer.style.display !== 'none',
        minimized: xoContainer.classList.contains('minimized')
    });
}

window.bindSafeButton(xoBtn, () => {
    if (xoContainer.style.display === 'none' || !xoContainer.style.display) {
        const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
        xoContainer.style.left = Math.round(center.x - 250) + 'px';
        xoContainer.style.top = Math.round(center.y - 240) + 'px';
        xoContainer.style.display = 'flex';
        xoContainer.classList.remove('minimized');
        xoBtn.classList.add('active');
    } else {
        xoContainer.style.display = 'none';
        xoBtn.classList.remove('active');
    }
    syncXoWidgetState();
});

window.bindSafeButton(xoMinBtn, () => {
    xoContainer.classList.toggle('minimized');
    syncXoWidgetState();
});

window.bindSafeButton(xoCloseBtn, () => {
    xoContainer.style.display = 'none';
    xoBtn.classList.remove('active');
    syncXoWidgetState();
});

window.bindSafeButton(xoResetBtn, () => {
    socket.emit('xo_manual_reset', { room_id: ROOM_ID });
});

let isXoDragging = false;
let xoStartClientX = 0;
let xoStartClientY = 0;
let xoInitialLeft = 2580;
let xoInitialTop = 2260;

xoHeader.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.stopPropagation();
    isXoDragging = true;
    xoStartClientX = e.clientX;
    xoStartClientY = e.clientY;
    xoInitialLeft = parseFloat(xoContainer.style.left) || 2580;
    xoInitialTop = parseFloat(xoContainer.style.top) || 2260;
    xoContainer.style.zIndex = 35;
    if (xoHeader.setPointerCapture) {
        try { xoHeader.setPointerCapture(e.pointerId); } catch (err) {}
    }
});

xoHeader.addEventListener('pointermove', (e) => {
    if (!isXoDragging) return;
    e.stopPropagation();
    const scale = window.workspaceScale || 1;
    const nx = Math.round(xoInitialLeft + (e.clientX - xoStartClientX) / scale);
    const ny = Math.round(xoInitialTop + (e.clientY - xoStartClientY) / scale);
    xoContainer.style.left = nx + 'px';
    xoContainer.style.top = ny + 'px';
    syncXoWidgetState();
});

const stopXoDrag = (e) => {
    if (!isXoDragging) return;
    isXoDragging = false;
    xoContainer.style.zIndex = 15;
    if (e && xoHeader.releasePointerCapture) {
        try { xoHeader.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    syncXoWidgetState();
};

xoHeader.addEventListener('pointerup', stopXoDrag);
xoHeader.addEventListener('pointercancel', stopXoDrag);

xoContainer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
});

function initXoGrid() {
    xoBoard.innerHTML = '';
    for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
            const cell = document.createElement('div');
            cell.className = 'xo-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            window.bindSafeButton(cell, () => {
                socket.emit('xo_click', { room_id: ROOM_ID, row: r, col: c, username: USERNAME });
            });
            xoBoard.appendChild(cell);
        }
    }
}
initXoGrid();

function renderXoGame(game, notice) {
    if (!game || !game.board) return;
    const cells = xoBoard.getElementsByClassName('xo-cell');
    const winningSet = new Set();
    if (game.winning_line && game.winning_line.length > 0) {
        game.winning_line.forEach(pt => winningSet.add(pt[0] + '_' + pt[1]));
    }
    let hasMoves = false;
    for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
            const idx = r * 20 + c;
            const cell = cells[idx];
            if (!cell) continue;
            const val = game.board[r][c];
            if (val) hasMoves = true;
            cell.className = 'xo-cell';
            if (val === 'X') cell.classList.add('x');
            if (val === 'O') cell.classList.add('o');
            if (winningSet.has(r + '_' + c)) cell.classList.add('win');
            cell.innerText = val;
        }
    }
    const pX = (game.players && game.players.X) ? game.players.X : 'Chờ...';
    const pO = (game.players && game.players.O) ? game.players.O : 'Chờ...';
    let statusHTML = `<span style="color:#00d2ff">X: ${pX}</span> vs <span style="color:#ff4757">O: ${pO}</span>`;
    if (game.status === 'playing') {
        const turnColor = game.turn === 'X' ? '#00d2ff' : '#ff4757';
        statusHTML += ` | Lượt: <b style="color:${turnColor}">${game.turn}</b>`;
    } else if (game.status === 'finished') {
        statusHTML += ` | <b style="color:#feca57">🏆 ${game.winner_name} THẮNG!</b>`;
    } else if (game.status === 'draw') {
        statusHTML += ` | <b style="color:#aaa">HÒA!</b>`;
    }
    if (notice) {
        statusHTML += `<br><small style="color:#feca57; font-size:11px;">${notice}</small>`;
    }
    xoStatus.innerHTML = statusHTML;
    if (hasMoves && xoContainer.style.display === 'none') {
        xoContainer.style.display = 'flex';
        xoBtn.classList.add('active');
    }
}

window.loadXoState = function(game) {
    renderXoGame(game, null);
};

socket.on('xo_update', (data) => {
    if (data && data.game) {
        renderXoGame(data.game, data.notice);
    }
});
