const socket = io({ reconnection: true, reconnectionAttempts: 25, reconnectionDelay: 800 });
let cachedRoomState = null;

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
        if (now - lastTrigger < 200) return;
        lastTrigger = now;
        handler(e);
    };
    el.addEventListener('click', runHandler);
    el.addEventListener('touchend', runHandler, { passive: false });
};

window.showToast = function(text) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.innerText = text;
    container.appendChild(el);
    setTimeout(() => {
        el.remove();
    }, 2600);
};

function applyFullRoomState(state) {
    if (!state) return;
    if (window.loadRoomSettings && state.settings) window.loadRoomSettings(state.settings);
    if (window.loadDrawHistory) window.loadDrawHistory(state.draw_history || []);
    if (window.loadStickiesHistory) window.loadStickiesHistory(state.stickies || []);
    if (window.loadBoardMediaHistory) window.loadBoardMediaHistory(state.board_media || []);
    if (window.loadWidgetsState && state.widgets) window.loadWidgetsState(state.widgets);
    if (window.loadMediaState) window.loadMediaState(state.media, state.media_list || []);
    if (window.loadXoState && state.xo_game) window.loadXoState(state.xo_game);
    if (window.loadChatHistory && state.chat) window.loadChatHistory(state.chat);
    if (state.users) {
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.innerText = state.users.length;
    }
}

socket.on('connect', () => {
    socket.emit('join_room', { room_id: ROOM_ID, username: USERNAME });
});

socket.on('room_state', (state) => {
    cachedRoomState = state;
    if (window.loadDrawHistory && window.loadStickiesHistory) {
        applyFullRoomState(state);
    }
});

socket.on('room_users', (data) => {
    if (data && data.users) {
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.innerText = data.users.length;
    }
});

window.addEventListener('DOMContentLoaded', () => {
    if (cachedRoomState) {
        applyFullRoomState(cachedRoomState);
    }
});
