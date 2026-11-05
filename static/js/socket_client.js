const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 600,
    reconnectionDelayMax: 3000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
    upgrade: true,
    autoConnect: false
});
let cachedRoomState = null;
let pingIntervalId = null;
window.ROOM_USERS = [];
window.workspaceScale = 1;

window.getWorkspaceCoords = function(clientX, clientY) {
    const boardEl = document.getElementById('board') || document.getElementById('workspace');
    if (!boardEl) return { x: 2500, y: 2500 };
    const rect = boardEl.getBoundingClientRect();
    const scale = window.workspaceScale || 1;
    return {
        x: Math.round(((clientX - rect.left) / scale) * 10) / 10,
        y: Math.round(((clientY - rect.top) / scale) * 10) / 10
    };
};

window.addEventListener('error', (e) => {
    console.warn('Runtime error:', e.message);
});
window.addEventListener('unhandledrejection', (e) => {
    console.warn('Unhandled rejection:', e.reason);
});

let localClientId = localStorage.getItem('syncspace_client_id');
if (!localClientId) {
    localClientId = 'cid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('syncspace_client_id', localClientId);
}
window.CLIENT_ID = localClientId;

window.bindSafeButton = function(el, handler) {
    if (!el) return;
    let lastTrigger = 0;
    const stopOnly = (e) => {
        e.stopPropagation();
    };
    el.addEventListener('pointerdown', stopOnly);
    el.addEventListener('mousedown', stopOnly);
    el.addEventListener('touchstart', stopOnly, { passive: true });
    const runHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTrigger < 180) return;
        lastTrigger = now;
        try {
            handler(e);
        } catch (err) {
            console.error(err);
        }
    };
    el.addEventListener('click', runHandler);
    el.addEventListener('touchend', runHandler, { passive: false });
};

window.makeWidgetResizable = function(widgetEl, minW, minH, isBoardSpace, onResizeEnd) {
    if (!widgetEl) return;
    let resizer = widgetEl.querySelector('.widget-resizer');
    if (!resizer) {
        resizer = document.createElement('div');
        resizer.className = 'widget-resizer';
        resizer.title = 'Kéo để thay đổi kích thước';
        widgetEl.appendChild(resizer);
    }
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let initW = 0;
    let initH = 0;

    resizer.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        initW = parseFloat(widgetEl.style.width) || widgetEl.offsetWidth || minW;
        initH = parseFloat(widgetEl.style.height) || widgetEl.offsetHeight || minH;
        if (resizer.setPointerCapture) {
            try { resizer.setPointerCapture(e.pointerId); } catch (err) {}
        }
    });

    resizer.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        e.preventDefault();
        e.stopPropagation();
        const scale = isBoardSpace ? (window.workspaceScale || 1) : 1;
        const nw = Math.max(minW, Math.round(initW + (e.clientX - startX) / scale));
        const nh = Math.max(minH, Math.round(initH + (e.clientY - startY) / scale));
        widgetEl.style.width = nw + 'px';
        widgetEl.style.height = nh + 'px';
    });

    const stopResize = (e) => {
        if (!resizing) return;
        resizing = false;
        if (e && resizer.releasePointerCapture) {
            try { resizer.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        if (typeof onResizeEnd === 'function') {
            onResizeEnd(parseFloat(widgetEl.style.width) || widgetEl.offsetWidth, parseFloat(widgetEl.style.height) || widgetEl.offsetHeight);
        }
    };
    resizer.addEventListener('pointerup', stopResize);
    resizer.addEventListener('pointercancel', stopResize);
};

window.showToast = function(text) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    while (container.children.length >= 3) {
        container.firstElementChild.remove();
    }
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.innerText = text;
    container.appendChild(el);
    setTimeout(() => {
        el.remove();
    }, 2600);
};

function updateOnlineUsersBadge(usersList) {
    if (!Array.isArray(usersList)) return;
    window.ROOM_USERS = usersList;
    const countEl = document.getElementById('online-count');
    if (countEl) countEl.innerText = usersList.length;
    const badgeEl = document.getElementById('online-badge');
    if (badgeEl) {
        badgeEl.title = 'Đang online: ' + usersList.join(', ');
    }
}

function applyFullRoomState(state) {
    if (!state) return;
    if (window.loadRoomSettings && state.settings) window.loadRoomSettings(state.settings);
    if (window.loadDrawHistory) window.loadDrawHistory(state.draw_history || []);
    if (window.loadTextsHistory) window.loadTextsHistory(state.texts || []);
    if (window.loadStickiesHistory) window.loadStickiesHistory(state.stickies || []);
    if (window.loadBoardMediaHistory) window.loadBoardMediaHistory(state.board_media || []);
    if (window.loadWidgetsState && state.widgets) window.loadWidgetsState(state.widgets);
    if (window.loadMediaState) window.loadMediaState(state.media, state.media_list || []);
    if (window.loadScreenShareState && state.screen_share) window.loadScreenShareState(state.screen_share);
    if (window.loadXoState && state.xo_game) window.loadXoState(state.xo_game);
    if (window.loadChessState && state.chess_game) window.loadChessState(state.chess_game);
    if (window.loadMemoryState && state.memory_game) window.loadMemoryState(state.memory_game);
    if (window.loadDiceState && state.dice_state) window.loadDiceState(state.dice_state);
    if (window.loadTimerState && state.timer_state) window.loadTimerState(state.timer_state);
    if (window.loadChatHistory && state.chat) window.loadChatHistory(state.chat);
    if (state.users) {
        updateOnlineUsersBadge(state.users);
    }
}

window.connectWithUsername = function(nameStr) {
    const cleanName = (nameStr || '').trim() || 'Thành viên';
    window.USERNAME = cleanName;
    localStorage.setItem('syncspace_username', cleanName);
    const displayEl = document.getElementById('current-user-display');
    if (displayEl) displayEl.innerText = cleanName;
    const newUrl = `${window.location.pathname}?name=${encodeURIComponent(cleanName)}`;
    window.history.replaceState({}, '', newUrl);
    if (!socket.connected) {
        socket.connect();
    } else {
        socket.emit('update_username', { room_id: ROOM_ID, username: cleanName });
    }
};

function startPingMonitor() {
    if (pingIntervalId) clearInterval(pingIntervalId);
    const sendPing = () => {
        if (socket.connected) {
            socket.emit('ping_check', { t: Date.now() });
        }
    };
    sendPing();
    pingIntervalId = setInterval(sendPing, 2500);
}

socket.on('pong_check', (data) => {
    if (!data || !data.t) return;
    const rtt = Math.max(1, Date.now() - data.t);
    const valEl = document.getElementById('ping-val');
    const dotEl = document.getElementById('ping-dot');
    if (valEl) valEl.innerText = rtt + ' ms';
    if (dotEl) {
        dotEl.className = 'ping-dot ' + (rtt < 80 ? 'good' : rtt < 180 ? 'medium' : 'bad');
    }
});

socket.on('connect', () => {
    const valEl = document.getElementById('ping-val');
    const dotEl = document.getElementById('ping-dot');
    if (valEl) valEl.innerText = 'Đã kết nối';
    if (dotEl) dotEl.className = 'ping-dot good';
    socket.emit('join_room', {
        room_id: ROOM_ID,
        username: window.USERNAME || 'Thành viên',
        client_id: window.CLIENT_ID
    });
    startPingMonitor();
});

socket.on('disconnect', () => {
    const valEl = document.getElementById('ping-val');
    const dotEl = document.getElementById('ping-dot');
    if (valEl) valEl.innerText = 'Mất mạng...';
    if (dotEl) dotEl.className = 'ping-dot bad';
});

socket.on('connect_error', () => {
    const valEl = document.getElementById('ping-val');
    const dotEl = document.getElementById('ping-dot');
    if (valEl) valEl.innerText = 'Đang nối lại...';
    if (dotEl) dotEl.className = 'ping-dot bad';
});

socket.on('room_state', (state) => {
    cachedRoomState = state;
    if (window.loadDrawHistory && window.loadStickiesHistory) {
        applyFullRoomState(state);
    }
});

socket.on('room_users', (data) => {
    if (data && data.users) {
        updateOnlineUsersBadge(data.users);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const nameModal = document.getElementById('name-modal');
    const nameInput = document.getElementById('name-modal-input');
    const nameForm = document.getElementById('name-modal-form');
    const btnEditName = document.getElementById('btn-edit-name');
    const onlineBadge = document.getElementById('online-badge');

    if (onlineBadge) {
        onlineBadge.style.cursor = 'pointer';
        window.bindSafeButton(onlineBadge, () => {
            const list = window.ROOM_USERS || [];
            if (list.length > 0 && window.showToast) {
                window.showToast('👥 Đang trong phòng (' + list.length + '): ' + list.join(', '));
            }
        });
    }

    function openNameModal(prefill) {
        if (!nameModal) return;
        nameModal.style.display = 'flex';
        nameInput.value = prefill || localStorage.getItem('syncspace_username') || '';
        setTimeout(() => nameInput.focus(), 60);
    }

    if (nameForm) {
        nameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = nameInput.value.trim();
            if (!val) return;
            nameModal.style.display = 'none';
            window.connectWithUsername(val);
        });
    }

    if (btnEditName) {
        window.bindSafeButton(btnEditName, () => {
            openNameModal(window.USERNAME);
        });
    }

    if (window.USERNAME && window.USERNAME.trim() !== '') {
        window.connectWithUsername(window.USERNAME.trim());
    } else {
        openNameModal('');
    }

    if (cachedRoomState) {
        applyFullRoomState(cachedRoomState);
    }
});
