const socket = io({ reconnection: true, reconnectionAttempts: 25, reconnectionDelay: 800, autoConnect: false });
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
    if (window.loadTextsHistory) window.loadTextsHistory(state.texts || []);
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

socket.on('connect', () => {
    socket.emit('join_room', { room_id: ROOM_ID, username: window.USERNAME || 'Thành viên' });
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
    const nameModal = document.getElementById('name-modal');
    const nameInput = document.getElementById('name-modal-input');
    const nameForm = document.getElementById('name-modal-form');
    const btnEditName = document.getElementById('btn-edit-name');

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
