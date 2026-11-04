const fabSettings = document.getElementById('fab-settings');
const settingsOverlay = document.getElementById('settings-overlay');
const closeSettings = document.getElementById('close-settings');
const dynamicBg = document.getElementById('dynamic-bg');
const bgBtns = document.querySelectorAll('.bg-opt-btn');
const eraserBtns = document.querySelectorAll('.eraser-opt-btn');
const eraserBtnLabel = document.getElementById('eraser-btn-label');
const fabFocus = document.getElementById('fab-focus');
const toggleSyncBg = document.getElementById('toggle-sync-bg');
const btnCopyLink = document.getElementById('btn-copy-link');

const groupTriggers = document.querySelectorAll('.group-trigger-btn');
const popovers = document.querySelectorAll('.tool-popover');

const chatContainer = document.getElementById('chat-container');
const chatBtn = document.getElementById('tool-chat');
const chatMinBtn = document.getElementById('chat-min-btn');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatHeader = document.getElementById('chat-header');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const chatBadge = document.getElementById('chat-badge');
let unreadChat = 0;

window.closeAllPopovers = function() {
    popovers.forEach(p => p.classList.remove('open'));
};

function openPopoverNearButton(popoverEl, triggerBtn) {
    if (!popoverEl || !triggerBtn) return;
    const isAlreadyOpen = popoverEl.classList.contains('open');
    window.closeAllPopovers();
    if (isAlreadyOpen) return;

    const rect = triggerBtn.getBoundingClientRect();
    popoverEl.classList.add('open');
    const popW = popoverEl.offsetWidth || 280;
    let leftPos = rect.left + rect.width / 2 - popW / 2;
    leftPos = Math.max(10, Math.min(window.innerWidth - popW - 10, leftPos));
    popoverEl.style.left = leftPos + 'px';
    popoverEl.style.top = (rect.bottom + 8) + 'px';
    popoverEl.style.transform = 'none';
}

groupTriggers.forEach(btn => {
    window.bindSafeButton(btn, () => {
        const popId = btn.getAttribute('data-popover');
        const popEl = document.getElementById(popId);
        if (popId === 'popover-pen') {
            const activeSub = document.querySelector('#popover-pen .sub-tool-btn.active');
            if (activeSub && window.selectDrawingTool) {
                window.selectDrawingTool(activeSub.getAttribute('data-tool'));
            }
        } else if (popId === 'popover-shape') {
            const activeShape = document.querySelector('#popover-shape .sub-shape-btn.active') || document.querySelector('#popover-shape .sub-shape-btn');
            if (activeShape && window.selectDrawingTool) {
                activeShape.classList.add('active');
                window.selectDrawingTool(activeShape.getAttribute('data-tool'));
            }
        } else if (popId === 'popover-eraser') {
            if (window.selectDrawingTool) window.selectDrawingTool('eraser');
        }
        openPopoverNearButton(popEl, btn);
    });
});

document.querySelectorAll('.sub-tool-btn').forEach(btn => {
    window.bindSafeButton(btn, () => {
        document.querySelectorAll('.sub-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tool = btn.getAttribute('data-tool');
        const icon = btn.getAttribute('data-icon');
        const label = btn.getAttribute('data-label');
        const iconEl = document.getElementById('active-pen-icon');
        const labelEl = document.getElementById('active-pen-label');
        if (iconEl && icon) iconEl.innerText = icon;
        if (labelEl && label) labelEl.innerText = label;
        if (window.selectDrawingTool) window.selectDrawingTool(tool);
        window.closeAllPopovers();
    });
});

document.querySelectorAll('.sub-shape-btn').forEach(btn => {
    window.bindSafeButton(btn, () => {
        document.querySelectorAll('.sub-shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tool = btn.getAttribute('data-tool');
        const icon = btn.getAttribute('data-icon');
        const label = btn.getAttribute('data-label');
        const iconEl = document.getElementById('active-shape-icon');
        const labelEl = document.getElementById('active-shape-label');
        if (iconEl && icon) iconEl.innerText = icon;
        if (labelEl && label) labelEl.innerText = label;
        if (window.selectDrawingTool) window.selectDrawingTool(tool);
        window.closeAllPopovers();
    });
});

function setupScrollStrip(stripId) {
    const strip = document.getElementById(stripId);
    if (!strip) return;
    const leftBtn = document.querySelector(`.scroll-arrow-btn.left[data-target="${stripId}"]`);
    const rightBtn = document.querySelector(`.scroll-arrow-btn.right[data-target="${stripId}"]`);

    function updateArrows() {
        const maxScroll = strip.scrollWidth - strip.clientWidth;
        if (maxScroll <= 4) {
            if (leftBtn) leftBtn.style.display = 'none';
            if (rightBtn) rightBtn.style.display = 'none';
            return;
        }
        if (leftBtn) leftBtn.style.display = strip.scrollLeft > 6 ? 'inline-flex' : 'none';
        if (rightBtn) rightBtn.style.display = strip.scrollLeft < maxScroll - 6 ? 'inline-flex' : 'none';
    }

    if (leftBtn) {
        window.bindSafeButton(leftBtn, () => {
            strip.scrollBy({ left: -220, behavior: 'smooth' });
            setTimeout(updateArrows, 260);
        });
    }
    if (rightBtn) {
        window.bindSafeButton(rightBtn, () => {
            strip.scrollBy({ left: 220, behavior: 'smooth' });
            setTimeout(updateArrows, 260);
        });
    }

    strip.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    setTimeout(updateArrows, 150);
    setTimeout(updateArrows, 600);
}

setupScrollStrip('top-strip');
setupScrollStrip('bottom-strip');

function updateEraserModeUI(mode) {
    window.eraserMode = mode === 'stroke' ? 'stroke' : 'point';
    localStorage.setItem('syncspace_eraser_mode', window.eraserMode);
    eraserBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-eraser') === window.eraserMode);
    });
    if (eraserBtnLabel) {
        eraserBtnLabel.innerText = window.eraserMode === 'stroke' ? 'Tẩy nét' : 'Tẩy điểm';
    }
}

updateEraserModeUI(window.eraserMode || 'point');

eraserBtns.forEach(btn => {
    window.bindSafeButton(btn, () => {
        const mode = btn.getAttribute('data-eraser');
        updateEraserModeUI(mode);
        if (window.selectDrawingTool) {
            window.selectDrawingTool('eraser');
        }
        window.closeAllPopovers();
        if (window.showToast) {
            window.showToast(mode === 'stroke' ? 'Đã bật: ✂️ Tẩy theo nét (Chạm nhẹ xóa nguyên nét)' : 'Đã bật: 🧽 Tẩy theo điểm (Chà tới đâu xóa tới đó)');
        }
    });
});

window.bindSafeButton(fabSettings, () => {
    window.closeAllPopovers();
    settingsOverlay.classList.toggle('active');
    fabSettings.classList.toggle('active', settingsOverlay.classList.contains('active'));
});

window.bindSafeButton(closeSettings, () => {
    settingsOverlay.classList.remove('active');
    fabSettings.classList.remove('active');
});

document.addEventListener('pointerdown', (e) => {
    if (settingsOverlay.classList.contains('active')) {
        if (!settingsOverlay.contains(e.target) && !fabSettings.contains(e.target)) {
            settingsOverlay.classList.remove('active');
            fabSettings.classList.remove('active');
        }
    }
    let clickedInsidePopover = false;
    popovers.forEach(p => {
        if (p.contains(e.target)) clickedInsidePopover = true;
    });
    groupTriggers.forEach(t => {
        if (t.contains(e.target)) clickedInsidePopover = true;
    });
    if (!clickedInsidePopover) {
        window.closeAllPopovers();
    }
});

window.bindSafeButton(fabFocus, () => {
    window.closeAllPopovers();
    const isFocus = document.body.classList.toggle('focus-mode');
    fabFocus.innerText = isFocus ? '🙈' : '👁️';
    if (window.showToast) {
        window.showToast(isFocus ? 'Đã bật Chế độ tập trung (Nhấn 🙈 góc dưới để hiện lại)' : 'Đã hiện thanh công cụ');
    }
});

window.bindSafeButton(btnCopyLink, () => {
    const inviteUrl = window.location.origin + '/room/' + encodeURIComponent(ROOM_ID);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            if (window.showToast) window.showToast('Đã sao chép link phòng: ' + inviteUrl);
        });
    } else {
        prompt('Sao chép link phòng dưới đây:', inviteUrl);
    }
});

function applyBackgroundTheme(themeStr) {
    if (!themeStr) return;
    dynamicBg.className = themeStr;
    bgBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-bg') === themeStr);
    });
    if (themeStr.includes('light')) document.body.classList.add('light-theme');
    else document.body.classList.remove('light-theme');
}

bgBtns.forEach(btn => {
    window.bindSafeButton(btn, () => {
        const themeStr = btn.getAttribute('data-bg');
        applyBackgroundTheme(themeStr);
        if (toggleSyncBg && toggleSyncBg.checked) {
            socket.emit('change_bg', { room_id: ROOM_ID, bg: themeStr });
        }
    });
});

window.loadRoomSettings = function(settings) {
    if (settings && settings.bg) {
        applyBackgroundTheme(settings.bg);
    }
};

function applySingleWidgetState(wName, st) {
    if (!st) return;
    const container = document.getElementById(wName === 'xo' ? 'xo-container' : 'media-container');
    const btn = document.getElementById(wName === 'xo' ? 'tool-xo' : 'tool-media');
    if (!container) return;
    if (typeof st.x === 'number') container.style.left = st.x + 'px';
    if (typeof st.y === 'number') container.style.top = st.y + 'px';
    if (st.open) {
        container.style.display = 'flex';
        if (btn) btn.classList.add('active');
    } else {
        container.style.display = 'none';
        if (btn) btn.classList.remove('active');
    }
    container.classList.toggle('minimized', !!st.minimized);
}

window.loadWidgetsState = function(widgets) {
    if (!widgets) return;
    if (widgets.xo) applySingleWidgetState('xo', widgets.xo);
    if (widgets.media) applySingleWidgetState('media', widgets.media);
};

socket.on('widget_updated', (data) => {
    if (data && data.widget && data.state) {
        applySingleWidgetState(data.widget, data.state);
    }
});

socket.on('bg_updated', (data) => {
    if (data && data.bg) {
        applyBackgroundTheme(data.bg);
    }
});

document.getElementById('toggle-cursors').addEventListener('change', (e) => {
    document.body.classList.toggle('hide-cursors', !e.target.checked);
});

document.getElementById('toggle-names').addEventListener('change', (e) => {
    document.body.classList.toggle('hide-names', !e.target.checked);
});

window.bindSafeButton(chatBtn, () => {
    if (chatContainer.style.display === 'none' || !chatContainer.style.display) {
        chatContainer.style.display = 'flex';
        chatContainer.classList.remove('minimized');
        chatBtn.classList.add('active');
        unreadChat = 0;
        chatBadge.style.display = 'none';
        chatMessages.scrollTop = chatMessages.scrollHeight;
        setTimeout(() => chatInput.focus(), 50);
    } else {
        chatContainer.style.display = 'none';
        chatBtn.classList.remove('active');
    }
});

window.bindSafeButton(chatMinBtn, () => {
    chatContainer.classList.toggle('minimized');
});

window.bindSafeButton(chatCloseBtn, () => {
    chatContainer.style.display = 'none';
    chatBtn.classList.remove('active');
});

let isChatDragging = false;
let chatOffsetX = 0;
let chatOffsetY = 0;

chatHeader.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.stopPropagation();
    isChatDragging = true;
    const rect = chatContainer.getBoundingClientRect();
    chatOffsetX = e.clientX - rect.left;
    chatOffsetY = e.clientY - rect.top;
    chatContainer.style.right = 'auto';
    chatContainer.style.bottom = 'auto';
    chatContainer.style.left = rect.left + 'px';
    chatContainer.style.top = rect.top + 'px';
    if (chatHeader.setPointerCapture) {
        try { chatHeader.setPointerCapture(e.pointerId); } catch (err) {}
    }
});

chatHeader.addEventListener('pointermove', (e) => {
    if (!isChatDragging) return;
    e.stopPropagation();
    const nx = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - chatOffsetX));
    const ny = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - chatOffsetY));
    chatContainer.style.left = nx + 'px';
    chatContainer.style.top = ny + 'px';
});

const stopChatDrag = (e) => {
    if (!isChatDragging) return;
    isChatDragging = false;
    if (e && chatHeader.releasePointerCapture) {
        try { chatHeader.releasePointerCapture(e.pointerId); } catch (err) {}
    }
};

chatHeader.addEventListener('pointerup', stopChatDrag);
chatHeader.addEventListener('pointercancel', stopChatDrag);

function appendChatMessage(msg) {
    if (!msg) return;
    const item = document.createElement('div');
    item.className = 'chat-item' + (msg.username === window.USERNAME ? ' self' : '');
    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    const userSpan = document.createElement('span');
    userSpan.innerText = msg.username || 'Thành viên';
    const timeSpan = document.createElement('span');
    timeSpan.innerText = msg.time || '';
    meta.appendChild(userSpan);
    meta.appendChild(timeSpan);
    const body = document.createElement('div');
    body.innerText = msg.text || '';
    item.appendChild(meta);
    item.appendChild(body);
    chatMessages.appendChild(item);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.loadChatHistory = function(chatList) {
    chatMessages.innerHTML = '';
    if (Array.isArray(chatList)) {
        chatList.forEach(m => appendChatMessage(m));
    }
};

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    socket.emit('chat_message', { room_id: ROOM_ID, username: window.USERNAME, text: text });
    chatInput.value = '';
});

socket.on('chat_received', (msg) => {
    appendChatMessage(msg);
    if (chatContainer.style.display === 'none' || chatContainer.classList.contains('minimized')) {
        unreadChat++;
        chatBadge.innerText = unreadChat;
        chatBadge.style.display = 'inline-block';
    }
});

socket.on('force_leave', (data) => {
    alert(data.msg);
    window.location.href = '/';
});

socket.on('room_error', (data) => {
    alert(data.msg);
    window.location.href = '/';
});
