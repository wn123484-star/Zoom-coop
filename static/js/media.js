const mediaContainer = document.getElementById('media-container');
const boardMediaContainer = document.getElementById('board-media-container');
const mediaBtn = document.getElementById('tool-media');
const quickUploadBtn = document.getElementById('tool-upload-quick');
const mediaMinBtn = document.getElementById('media-min-btn');
const mediaCloseBtn = document.getElementById('media-close-btn');
const btnClearMedia = document.getElementById('btn-clear-media');
const btnPinCurrentMedia = document.getElementById('btn-pin-current-media');
const mediaHeader = document.getElementById('media-header');
const mediaContent = document.getElementById('media-content');
const mediaControlsBox = document.getElementById('media-controls-box');
const mediaHistoryBar = document.getElementById('media-history-bar');
const btnToggleControls = document.getElementById('btn-toggle-media-controls');

let activeHubMedia = null;

function syncMediaWidgetState() {
    socket.emit('widget_state', {
        room_id: ROOM_ID,
        widget: 'media',
        x: parseFloat(mediaContainer.style.left) || 1950,
        y: parseFloat(mediaContainer.style.top) || 2250,
        open: mediaContainer.style.display !== 'none',
        minimized: mediaContainer.classList.contains('minimized')
    });
}

function openMediaHubAtCenter(showControls) {
    const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
    mediaContainer.style.left = Math.round(center.x - 260) + 'px';
    mediaContainer.style.top = Math.round(center.y - 210) + 'px';
    mediaContainer.style.display = 'flex';
    mediaContainer.classList.remove('minimized');
    if (showControls) {
        mediaControlsBox.classList.remove('collapsed');
    }
    mediaBtn.classList.add('active');
    syncMediaWidgetState();
}

window.bindSafeButton(btnToggleControls, () => {
    mediaControlsBox.classList.toggle('collapsed');
});

window.bindSafeButton(mediaBtn, () => {
    if (mediaContainer.style.display === 'none' || !mediaContainer.style.display) {
        openMediaHubAtCenter(false);
    } else {
        mediaContainer.style.display = 'none';
        mediaBtn.classList.remove('active');
        syncMediaWidgetState();
    }
});

window.bindSafeButton(quickUploadBtn, () => {
    openMediaHubAtCenter(true);
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
        try { fileInput.click(); } catch (e) {}
    }
});

window.bindSafeButton(mediaMinBtn, () => {
    mediaContainer.classList.toggle('minimized');
    syncMediaWidgetState();
});

window.bindSafeButton(mediaCloseBtn, () => {
    mediaContainer.style.display = 'none';
    mediaBtn.classList.remove('active');
    syncMediaWidgetState();
});

window.bindSafeButton(btnClearMedia, () => {
    clearMediaView();
    socket.emit('media_share', { room_id: ROOM_ID, type: 'clear' });
});

window.bindSafeButton(btnPinCurrentMedia, () => {
    if (!activeHubMedia || !activeHubMedia.url) {
        if (window.showToast) window.showToast('Chưa có Media nào đang phát để ghim!');
        return;
    }
    spawnBoardMediaCard(activeHubMedia.kind || activeHubMedia.type, activeHubMedia.url, activeHubMedia.name || 'Media');
});

let isMediaDragging = false;
let mediaStartClientX = 0;
let mediaStartClientY = 0;
let mediaInitialLeft = 1950;
let mediaInitialTop = 2250;

mediaHeader.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.stopPropagation();
    isMediaDragging = true;
    mediaStartClientX = e.clientX;
    mediaStartClientY = e.clientY;
    mediaInitialLeft = parseFloat(mediaContainer.style.left) || 1950;
    mediaInitialTop = parseFloat(mediaContainer.style.top) || 2250;
    mediaContainer.style.zIndex = 35;
    if (mediaHeader.setPointerCapture) {
        try { mediaHeader.setPointerCapture(e.pointerId); } catch (err) {}
    }
});

mediaHeader.addEventListener('pointermove', (e) => {
    if (!isMediaDragging) return;
    e.stopPropagation();
    const scale = window.workspaceScale || 1;
    const nx = Math.round(mediaInitialLeft + (e.clientX - mediaStartClientX) / scale);
    const ny = Math.round(mediaInitialTop + (e.clientY - mediaStartClientY) / scale);
    mediaContainer.style.left = nx + 'px';
    mediaContainer.style.top = ny + 'px';
    syncMediaWidgetState();
});

const stopMediaDrag = (e) => {
    if (!isMediaDragging) return;
    isMediaDragging = false;
    mediaContainer.style.zIndex = 15;
    if (e && mediaHeader.releasePointerCapture) {
        try { mediaHeader.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    syncMediaWidgetState();
};

mediaHeader.addEventListener('pointerup', stopMediaDrag);
mediaHeader.addEventListener('pointercancel', stopMediaDrag);

mediaContainer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
});

function extractYoutubeId(url) {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

function resolveKind(typeOrKind, url) {
    const t = (typeOrKind || '').toLowerCase();
    const u = (url || '').toLowerCase();
    if (t === 'youtube' || extractYoutubeId(url)) return 'youtube';
    if (t === 'image' || t.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(u)) return 'image';
    if (t === 'video' || t.startsWith('video/') || /\.(mp4|webm|ogg|mov|mkv)$/i.test(u)) return 'video';
    if (t === 'audio' || t.startsWith('audio/') || /\.(mp3|wav|flac|aac|m4a|oga)$/i.test(u)) return 'audio';
    if (t === 'pdf' || t === 'application/pdf' || /\.pdf$/i.test(u)) return 'pdf';
    return 'file';
}

function buildMediaElementHTML(kind, url, name) {
    const safeName = (name || 'Tệp chia sẻ').replace(/[<>]/g, '');
    if (kind === 'youtube') {
        const videoId = extractYoutubeId(url);
        if (!videoId) return '<p class="empty-media-text">Link YouTube không hợp lệ</p>';
        return `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    }
    if (kind === 'image') {
        return `<img src="${url}" alt="${safeName}">`;
    }
    if (kind === 'video') {
        return `<video src="${url}" controls autoplay playsinline></video>`;
    }
    if (kind === 'audio') {
        return `<div class="audio-player-box"><div class="audio-player-title">🎵 ${safeName}</div><audio src="${url}" controls autoplay></audio></div>`;
    }
    if (kind === 'pdf') {
        return `<embed src="${url}" type="application/pdf" width="100%" height="100%"><div style="padding:6px; background:#111; width:100%; text-align:center;"><a href="${url}" target="_blank" style="color:#00d2ff; font-size:12px; font-weight:bold;">📄 Mở PDF toàn màn hình (${safeName})</a></div>`;
    }
    return `<div class="audio-player-box"><div class="audio-player-title">📁 ${safeName}</div><a href="${url}" target="_blank" style="color:#00d2ff; font-weight:bold;">Tải xuống / Mở tệp</a></div>`;
}

function clearMediaView() {
    activeHubMedia = null;
    mediaContent.innerHTML = '<div class="empty-media-box"><p class="empty-media-text">🎬 Chọn <b>Ảnh, Video, Nhạc MP3, Tài liệu PDF</b> hoặc dán link <b>YouTube</b> ở trên để mọi người trong phòng cùng xem và nghe trực tiếp!</p></div>';
    mediaControlsBox.classList.remove('collapsed');
}

function renderMediaInHub(item) {
    if (!item || item.type === 'clear' || !item.url) {
        clearMediaView();
        return;
    }
    const kind = resolveKind(item.kind || item.type, item.url);
    activeHubMedia = { kind: kind, type: item.type, url: item.url, name: item.name || 'Media' };
    mediaContent.innerHTML = buildMediaElementHTML(kind, item.url, item.name);
    if (mediaContainer.style.display === 'none' || !mediaContainer.style.display) {
        mediaContainer.style.display = 'flex';
        mediaBtn.classList.add('active');
    }
}

function renderMediaHistoryList(list) {
    if (!mediaHistoryBar) return;
    mediaHistoryBar.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) return;
    list.slice().reverse().forEach(item => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'media-chip';
        const k = resolveKind(item.kind || item.type, item.url);
        const icon = k === 'youtube' ? '▶️' : k === 'image' ? '🖼️' : k === 'video' ? '🎬' : k === 'audio' ? '🎵' : '📄';
        chip.innerText = `${icon} ${item.name || 'Media'}`;
        window.bindSafeButton(chip, () => {
            renderMediaInHub(item);
            socket.emit('media_share', {
                room_id: ROOM_ID,
                type: item.type,
                kind: k,
                url: item.url,
                name: item.name,
                sender: USERNAME
            });
        });
        mediaHistoryBar.appendChild(chip);
    });
}

function createBoardMediaDOM(data) {
    if (!data || !data.id) return;
    let existing = document.getElementById(data.id);
    if (existing) {
        existing.style.left = typeof data.x === 'number' ? data.x + 'px' : data.x;
        existing.style.top = typeof data.y === 'number' ? data.y + 'px' : data.y;
        return;
    }
    const kind = resolveKind(data.kind || data.type, data.url);
    const card = document.createElement('div');
    card.className = 'board-media-card glass-effect';
    card.id = data.id;
    card.style.left = typeof data.x === 'number' ? data.x + 'px' : data.x;
    card.style.top = typeof data.y === 'number' ? data.y + 'px' : data.y;

    const header = document.createElement('div');
    header.className = 'widget-header';
    const title = document.createElement('span');
    title.className = 'widget-title';
    const icon = kind === 'youtube' ? '▶️' : kind === 'image' ? '🖼️' : kind === 'video' ? '🎬' : kind === 'audio' ? '🎵' : '📄';
    title.innerText = `${icon} ${data.name || 'Media'} (${data.owner || 'Khách'})`;

    const controls = document.createElement('div');
    controls.className = 'widget-controls';
    if (kind !== 'youtube') {
        const openLink = document.createElement('a');
        openLink.href = data.url;
        openLink.target = '_blank';
        openLink.className = 'widget-btn';
        openLink.style.textDecoration = 'none';
        openLink.title = 'Mở tệp ở tab mới';
        openLink.innerText = '↗';
        openLink.addEventListener('pointerdown', e => e.stopPropagation());
        controls.appendChild(openLink);
    }
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'widget-btn close';
    delBtn.innerText = '✕';
    delBtn.title = 'Xóa thẻ Media này khỏi bảng';
    window.bindSafeButton(delBtn, () => {
        card.remove();
        socket.emit('delete_board_media', { room_id: ROOM_ID, id: data.id });
    });
    controls.appendChild(delBtn);

    header.appendChild(title);
    header.appendChild(controls);

    const body = document.createElement('div');
    body.className = 'board-media-body';
    body.innerHTML = buildMediaElementHTML(kind, data.url, data.name);

    card.appendChild(header);
    card.appendChild(body);
    boardMediaContainer.appendChild(card);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let initL = 0;
    let initT = 0;

    header.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        e.stopPropagation();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initL = parseFloat(card.style.left) || 0;
        initT = parseFloat(card.style.top) || 0;
        card.style.zIndex = 40;
        if (header.setPointerCapture) {
            try { header.setPointerCapture(e.pointerId); } catch (err) {}
        }
    });

    header.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        e.stopPropagation();
        const scale = window.workspaceScale || 1;
        const nx = Math.round(initL + (e.clientX - startX) / scale);
        const ny = Math.round(initT + (e.clientY - startY) / scale);
        card.style.left = nx + 'px';
        card.style.top = ny + 'px';
        socket.emit('move_board_media', { room_id: ROOM_ID, id: data.id, x: card.style.left, y: card.style.top });
    });

    const endCardDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        card.style.zIndex = '';
        if (e && header.releasePointerCapture) {
            try { header.releasePointerCapture(e.pointerId); } catch (err) {}
        }
    };
    header.addEventListener('pointerup', endCardDrag);
    header.addEventListener('pointercancel', endCardDrag);
    card.addEventListener('pointerdown', e => e.stopPropagation());
}

function spawnBoardMediaCard(kind, url, name) {
    const id = 'bmedia_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
    const offset = (boardMediaContainer.children.length % 5) * 30;
    const x = Math.round(center.x - 180 + offset) + 'px';
    const y = Math.round(center.y - 140 + offset) + 'px';
    const payload = {
        room_id: ROOM_ID,
        id: id,
        kind: kind,
        url: url,
        name: name || 'Media',
        owner: USERNAME,
        x: x,
        y: y
    };
    createBoardMediaDOM(payload);
    socket.emit('new_board_media', payload);
    if (window.showToast) window.showToast('Đã ghim Media lên mặt bảng chung!');
}

window.loadMediaState = function(mediaData, mediaList) {
    if (Array.isArray(mediaList)) {
        renderMediaHistoryList(mediaList);
    }
    if (mediaData && mediaData.url) {
        renderMediaInHub(mediaData);
    }
};

window.loadBoardMediaHistory = function(list) {
    boardMediaContainer.innerHTML = '';
    if (Array.isArray(list)) {
        list.forEach(item => createBoardMediaDOM(item));
    }
};

window.bindSafeButton(document.getElementById('btn-play-yt'), () => {
    const url = document.getElementById('youtube-link').value.trim();
    if (!url) return;
    const vid = extractYoutubeId(url);
    if (!vid) {
        if (window.showToast) window.showToast('Vui lòng nhập đúng định dạng link YouTube!');
        return;
    }
    const item = { type: 'youtube', kind: 'youtube', url: url, name: 'YouTube (' + vid + ')', sender: USERNAME };
    renderMediaInHub(item);
    socket.emit('media_share', { room_id: ROOM_ID, type: 'youtube', kind: 'youtube', url: url, name: item.name, sender: USERNAME });
});

function performFileUpload(pinDirectlyToBoard) {
    const fileInput = document.getElementById('file-upload');
    if (!fileInput.files || fileInput.files.length === 0) {
        if (window.showToast) window.showToast('Hãy chọn tệp Ảnh, Video, Nhạc MP3 hoặc PDF trước!');
        try { fileInput.click(); } catch (e) {}
        return;
    }
    const file = fileInput.files[0];
    if (file.size > 100 * 1024 * 1024) {
        if (window.showToast) window.showToast('Tệp vượt quá giới hạn 100MB!');
        return;
    }
    const formData = new FormData();
    formData.append('file', file);
    const uploadBtn = document.getElementById('btn-upload');
    const pinBtn = document.getElementById('btn-upload-board');
    uploadBtn.innerText = '⏳ Đang tải...';
    uploadBtn.disabled = true;
    if (pinBtn) pinBtn.disabled = true;

    fetch('/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            uploadBtn.innerText = '📤 Phát Chung';
            uploadBtn.disabled = false;
            if (pinBtn) pinBtn.disabled = false;
            if (data && data.url) {
                const kind = data.kind || resolveKind(data.type, data.url);
                const name = data.name || file.name;
                if (pinDirectlyToBoard) {
                    spawnBoardMediaCard(kind, data.url, name);
                } else {
                    renderMediaInHub({ type: data.type, kind: kind, url: data.url, name: name });
                }
                socket.emit('media_share', {
                    room_id: ROOM_ID,
                    type: data.type,
                    kind: kind,
                    url: data.url,
                    name: name,
                    sender: USERNAME
                });
                fileInput.value = '';
                if (window.showToast) window.showToast('Đã tải lên: ' + name);
            } else {
                if (window.showToast) window.showToast(data.error || 'Tải tệp thất bại!');
            }
        })
        .catch(() => {
            uploadBtn.innerText = '📤 Phát Chung';
            uploadBtn.disabled = false;
            if (pinBtn) pinBtn.disabled = false;
            if (window.showToast) window.showToast('Lỗi kết nối khi tải tệp!');
        });
}

window.bindSafeButton(document.getElementById('btn-upload'), () => performFileUpload(false));
window.bindSafeButton(document.getElementById('btn-upload-board'), () => performFileUpload(true));

socket.on('media_shared', (data) => {
    if (!data) return;
    if (Array.isArray(data.media_list)) {
        renderMediaHistoryList(data.media_list);
    }
    if (data.type === 'clear') {
        clearMediaView();
    } else if (data.media) {
        renderMediaInHub(data.media);
    } else if (data.url) {
        renderMediaInHub(data);
    }
});

socket.on('board_media_added', (d) => createBoardMediaDOM(d));
socket.on('board_media_moved', (d) => {
    const el = document.getElementById(d.id);
    if (el) { el.style.left = d.x; el.style.top = d.y; }
});
socket.on('board_media_deleted', (d) => {
    const el = document.getElementById(d.id);
    if (el) el.remove();
});
