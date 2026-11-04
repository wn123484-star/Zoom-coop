const mediaContainer = document.getElementById('media-container');
const mediaBtn = document.getElementById('tool-media');
const mediaMinBtn = document.getElementById('media-min-btn');
const mediaCloseBtn = document.getElementById('media-close-btn');
const btnClearMedia = document.getElementById('btn-clear-media');
const mediaHeader = document.getElementById('media-header');
const mediaContent = document.getElementById('media-content');
const mediaControlsBox = document.getElementById('media-controls-box');
const btnToggleControls = document.getElementById('btn-toggle-media-controls');

function syncMediaWidgetState() {
    socket.emit('widget_state', {
        room_id: ROOM_ID,
        widget: 'media',
        x: parseFloat(mediaContainer.style.left) || 1980,
        y: parseFloat(mediaContainer.style.top) || 2260,
        open: mediaContainer.style.display !== 'none',
        minimized: mediaContainer.classList.contains('minimized')
    });
}

window.bindSafeButton(btnToggleControls, () => {
    mediaControlsBox.classList.toggle('collapsed');
});

window.bindSafeButton(mediaBtn, () => {
    if (mediaContainer.style.display === 'none' || !mediaContainer.style.display) {
        const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
        mediaContainer.style.left = Math.round(center.x - 220) + 'px';
        mediaContainer.style.top = Math.round(center.y - 180) + 'px';
        mediaContainer.style.display = 'flex';
        mediaContainer.classList.remove('minimized');
        mediaBtn.classList.add('active');
    } else {
        mediaContainer.style.display = 'none';
        mediaBtn.classList.remove('active');
    }
    syncMediaWidgetState();
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

let isMediaDragging = false;
let mediaStartClientX = 0;
let mediaStartClientY = 0;
let mediaInitialLeft = 1980;
let mediaInitialTop = 2260;

mediaHeader.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.stopPropagation();
    isMediaDragging = true;
    mediaStartClientX = e.clientX;
    mediaStartClientY = e.clientY;
    mediaInitialLeft = parseFloat(mediaContainer.style.left) || 1980;
    mediaInitialTop = parseFloat(mediaContainer.style.top) || 2260;
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
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

function clearMediaView() {
    mediaContent.innerHTML = '<p class="empty-media-text">Chia sẻ video YouTube, ảnh, nhạc hoặc PDF gắn trực tiếp trên bảng chung</p>';
    mediaControlsBox.classList.remove('collapsed');
}

function renderMedia(type, url) {
    if (!type || type === 'clear' || !url) {
        clearMediaView();
        return;
    }
    if (type === 'youtube') {
        const videoId = extractYoutubeId(url);
        if (!videoId) {
            if (window.showToast) window.showToast('Link YouTube không hợp lệ!');
            return;
        }
        mediaContent.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else if (type.startsWith('image/')) {
        mediaContent.innerHTML = `<img src="${url}" alt="Shared Image">`;
    } else if (type.startsWith('video/')) {
        mediaContent.innerHTML = `<video src="${url}" controls autoplay></video>`;
    } else if (type.startsWith('audio/')) {
        mediaContent.innerHTML = `<audio src="${url}" controls autoplay style="width:90%; height:48px;"></audio>`;
    } else if (type === 'application/pdf') {
        mediaContent.innerHTML = `<embed src="${url}" type="application/pdf" width="100%" height="100%">`;
    }
    mediaControlsBox.classList.add('collapsed');
    if (mediaContainer.style.display === 'none' || !mediaContainer.style.display) {
        mediaContainer.style.display = 'flex';
        mediaBtn.classList.add('active');
    }
}

window.loadMediaState = function(mediaData) {
    if (mediaData && mediaData.url) {
        renderMedia(mediaData.type, mediaData.url);
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
    renderMedia('youtube', url);
    socket.emit('media_share', { room_id: ROOM_ID, type: 'youtube', url: url, sender: USERNAME });
});

window.bindSafeButton(document.getElementById('btn-upload'), () => {
    const fileInput = document.getElementById('file-upload');
    if (!fileInput.files || fileInput.files.length === 0) {
        if (window.showToast) window.showToast('Vui lòng chọn tệp trước khi tải lên!');
        return;
    }
    const file = fileInput.files[0];
    if (file.size > 50 * 1024 * 1024) {
        if (window.showToast) window.showToast('Tệp vượt quá giới hạn 50MB!');
        return;
    }
    const formData = new FormData();
    formData.append('file', file);
    const uploadBtn = document.getElementById('btn-upload');
    uploadBtn.innerText = 'Đang tải...';
    uploadBtn.disabled = true;

    fetch('/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            uploadBtn.innerText = 'Tải lên';
            uploadBtn.disabled = false;
            if (data && data.url) {
                renderMedia(data.type, data.url);
                socket.emit('media_share', { room_id: ROOM_ID, type: data.type, url: data.url, sender: USERNAME });
                fileInput.value = '';
            } else {
                if (window.showToast) window.showToast('Tải tệp thất bại!');
            }
        })
        .catch(() => {
            uploadBtn.innerText = 'Tải lên';
            uploadBtn.disabled = false;
            if (window.showToast) window.showToast('Lỗi kết nối khi tải tệp!');
        });
});

socket.on('media_shared', (data) => {
    if (!data || data.type === 'clear') {
        clearMediaView();
    } else {
        renderMedia(data.type, data.url);
    }
});
