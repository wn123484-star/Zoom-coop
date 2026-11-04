const mediaContainer = document.getElementById('media-container');
const boardMediaContainer = document.getElementById('board-media-container');
const mediaBtn = document.getElementById('tool-media');
const quickUploadBtn = document.getElementById('tool-upload-quick');
const mediaMinBtn = document.getElementById('media-min-btn');
const mediaCloseBtn = document.getElementById('media-close-btn');
const btnClearMedia = document.getElementById('btn-clear-media');
const btnPinCurrentMedia = document.getElementById('btn-pin-current-media');
const btnSyncNow = document.getElementById('btn-sync-now');
const btnUnlockAudio = document.getElementById('btn-unlock-audio');
const mediaHeader = document.getElementById('media-header');
const mediaContent = document.getElementById('media-content');
const mediaControlsBox = document.getElementById('media-controls-box');
const mediaHistoryBar = document.getElementById('media-history-bar');
const btnToggleControls = document.getElementById('btn-toggle-media-controls');
const fileUploadInput = document.getElementById('file-upload');
const btnStreamWebTab = document.getElementById('btn-stream-web-tab');

const screenContainer = document.getElementById('screen-container');
const screenHeader = document.getElementById('screen-header');
const screenTitle = document.getElementById('screen-title');
const screenVideo = document.getElementById('screen-video');
const screenFallbackImg = document.getElementById('screen-fallback-img');
const screenFullscreenBtn = document.getElementById('screen-fullscreen-btn');
const screenStopBtn = document.getElementById('screen-stop-btn');
const screenMinBtn = document.getElementById('screen-min-btn');
const screenCloseBtn = document.getElementById('screen-close-btn');
const groupScreenBtn = document.getElementById('group-screen-btn');
const stopScreenMenuBtn = document.getElementById('btn-stop-screen-menu');

let activeHubMedia = null;
let ytPlayer = null;
let ytApiReady = false;
let isApplyingRemoteSync = false;
let lastYtBufferingTime = 0;
let pendingSyncState = null;
const boardYtPlayers = {};

let localScreenStream = null;
let hiddenCaptureVideo = null;
let screenWorker = null;
let screenPeers = {};
let viewerPeer = null;
let webRtcRenderingConfirmed = false;
let isEncodingFrame = false;
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

window.onYouTubeIframeAPIReady = function() {
    ytApiReady = true;
};

function createBackgroundTimerWorker(intervalMs, onTick) {
    try {
        const blob = new Blob([
            `let tid = setInterval(() => postMessage('tick'), ${intervalMs}); onmessage = (e) => { if (e.data === 'stop') clearInterval(tid); };`
        ], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = () => onTick();
        return {
            stop: () => {
                try {
                    worker.postMessage('stop');
                    worker.terminate();
                } catch (e) {}
            }
        };
    } catch (err) {
        const id = setInterval(onTick, intervalMs);
        return { stop: () => clearInterval(id) };
    }
}

function setupScreenWidgetInteractions() {
    if (!screenContainer || !screenHeader) return;
    window.makeWidgetResizable(screenContainer, 340, 240, true, (w, h) => {
        socket.emit('screen_widget_move', {
            room_id: ROOM_ID,
            x: parseFloat(screenContainer.style.left) || 1960,
            y: parseFloat(screenContainer.style.top) || 2180,
            w: w,
            h: h
        });
    });

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initL = 1960;
    let initT = 2180;

    screenHeader.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initL = parseFloat(screenContainer.style.left) || 1960;
        initT = parseFloat(screenContainer.style.top) || 2180;
        screenContainer.style.zIndex = 38;
        if (screenHeader.setPointerCapture) {
            try { screenHeader.setPointerCapture(e.pointerId); } catch (err) {}
        }
    });

    screenHeader.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.stopPropagation();
        const scale = window.workspaceScale || 1;
        screenContainer.style.left = Math.round(initL + (e.clientX - startX) / scale) + 'px';
        screenContainer.style.top = Math.round(initT + (e.clientY - startY) / scale) + 'px';
        socket.emit('screen_widget_move', {
            room_id: ROOM_ID,
            x: parseFloat(screenContainer.style.left) || 1960,
            y: parseFloat(screenContainer.style.top) || 2180
        });
    });

    const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        screenContainer.style.zIndex = 18;
        if (e && screenHeader.releasePointerCapture) {
            try { screenHeader.releasePointerCapture(e.pointerId); } catch (err) {}
        }
    };
    screenHeader.addEventListener('pointerup', endDrag);
    screenHeader.addEventListener('pointercancel', endDrag);
    screenContainer.addEventListener('pointerdown', e => e.stopPropagation());
}
setupScreenWidgetInteractions();

function isWebRtcActivelyRendering() {
    if (!webRtcRenderingConfirmed || !viewerPeer || !screenVideo) return false;
    const st = viewerPeer.iceConnectionState;
    if (st !== 'connected' && st !== 'completed') return false;
    if (screenVideo.paused || screenVideo.readyState < 2 || screenVideo.videoWidth < 10) return false;
    return true;
}

function closeViewerPeer() {
    webRtcRenderingConfirmed = false;
    if (viewerPeer) {
        try { viewerPeer.close(); } catch (e) {}
        viewerPeer = null;
    }
    if (screenVideo && !localScreenStream) {
        screenVideo.srcObject = null;
        screenVideo.style.display = 'none';
    }
}

function stopLocalScreenShare(notifyRoom) {
    if (screenWorker) {
        screenWorker.stop();
        screenWorker = null;
    }
    if (hiddenCaptureVideo) {
        try {
            hiddenCaptureVideo.pause();
            hiddenCaptureVideo.srcObject = null;
        } catch (e) {}
        hiddenCaptureVideo = null;
    }
    Object.values(screenPeers).forEach(pc => {
        try { pc.close(); } catch (e) {}
    });
    screenPeers = {};
    if (localScreenStream) {
        localScreenStream.getTracks().forEach(t => {
            try { t.stop(); } catch (e) {}
        });
        localScreenStream = null;
    }
    if (screenVideo) screenVideo.srcObject = null;
    if (screenFallbackImg) screenFallbackImg.style.display = 'none';
    if (screenContainer) screenContainer.style.display = 'none';
    if (screenStopBtn) screenStopBtn.style.display = 'none';
    if (stopScreenMenuBtn) stopScreenMenuBtn.style.display = 'none';
    if (groupScreenBtn) groupScreenBtn.classList.remove('active');
    if (notifyRoom) {
        socket.emit('screen_share_stop', { room_id: ROOM_ID });
    }
}

async function startScreenShareWithMode(mode, modeLabel) {
    if (window.closeAllPopovers) window.closeAllPopovers();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        if (window.showToast) window.showToast('Thiết bị này không hỗ trợ phát chia sẻ màn hình (Chỉ hỗ trợ xem)!');
        return;
    }
    try {
        stopLocalScreenShare(false);
        const videoConstraints = {
            frameRate: { ideal: 20, max: 30 }
        };
        if (mode === 'browser' || mode === 'window' || mode === 'monitor') {
            videoConstraints.displaySurface = mode;
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: videoConstraints,
            audio: mode === 'browser'
        });

        localScreenStream = stream;
        const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
        const x = Math.round(center.x - 320);
        const y = Math.round(center.y - 220);

        screenContainer.style.left = x + 'px';
        screenContainer.style.top = y + 'px';
        screenContainer.style.width = '640px';
        screenContainer.style.height = '440px';
        screenContainer.style.display = 'flex';
        screenContainer.classList.remove('minimized');
        screenTitle.innerText = `🖥️ Bạn đang chia sẻ: ${modeLabel}`;
        screenStopBtn.style.display = 'inline-flex';
        if (stopScreenMenuBtn) stopScreenMenuBtn.style.display = 'flex';
        if (groupScreenBtn) groupScreenBtn.classList.add('active');

        screenFallbackImg.style.display = 'none';
        screenVideo.style.display = 'block';
        screenVideo.muted = true;
        screenVideo.setAttribute('muted', '');
        screenVideo.srcObject = stream;
        screenVideo.play().catch(() => {});

        hiddenCaptureVideo = document.createElement('video');
        hiddenCaptureVideo.muted = true;
        hiddenCaptureVideo.playsInline = true;
        hiddenCaptureVideo.autoplay = true;
        hiddenCaptureVideo.srcObject = stream;
        hiddenCaptureVideo.play().catch(() => {});

        socket.emit('screen_share_start', {
            room_id: ROOM_ID,
            username: window.USERNAME || 'Thành viên',
            mode: mode,
            mode_label: modeLabel,
            x: x,
            y: y,
            w: 640,
            h: 440
        });

        const relayCanvas = document.createElement('canvas');
        const relayCtx = relayCanvas.getContext('2d');
        const sendOneFrame = () => {
            if (!localScreenStream || isEncodingFrame || !socket.connected) return;
            const srcVid = (hiddenCaptureVideo && hiddenCaptureVideo.videoWidth > 0) ? hiddenCaptureVideo : screenVideo;
            if (!srcVid || srcVid.videoWidth === 0) return;
            isEncodingFrame = true;
            try {
                const vw = srcVid.videoWidth;
                const vh = srcVid.videoHeight;
                const targetW = Math.min(880, vw);
                const targetH = Math.max(100, Math.round((vh / vw) * targetW));
                if (relayCanvas.width !== targetW || relayCanvas.height !== targetH) {
                    relayCanvas.width = targetW;
                    relayCanvas.height = targetH;
                }
                relayCtx.drawImage(srcVid, 0, 0, targetW, targetH);
                const dataUrl = relayCanvas.toDataURL('image/jpeg', 0.52);
                socket.emit('screen_frame', {
                    room_id: ROOM_ID,
                    frame: dataUrl,
                    username: window.USERNAME || 'Thành viên',
                    mode_label: modeLabel
                });
            } catch (err) {
            } finally {
                isEncodingFrame = false;
            }
        };

        setTimeout(sendOneFrame, 200);
        screenWorker = createBackgroundTimerWorker(180, sendOneFrame);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.onended = () => {
                stopLocalScreenShare(true);
                if (window.showToast) window.showToast('⏹️ Đã kết thúc chia sẻ màn hình');
            };
        }
    } catch (err) {
        if (window.showToast) window.showToast('Đã hủy chọn chia sẻ màn hình.');
    }
}

window.startScreenShareWithMode = startScreenShareWithMode;

document.querySelectorAll('.screen-mode-btn[data-mode]').forEach(btn => {
    window.bindSafeButton(btn, () => {
        const mode = btn.getAttribute('data-mode');
        const label = btn.getAttribute('data-label') || 'Màn hình';
        startScreenShareWithMode(mode, label);
    });
});

if (btnStreamWebTab) {
    window.bindSafeButton(btnStreamWebTab, () => {
        const rawUrl = document.getElementById('youtube-link').value.trim();
        if (rawUrl) {
            const fullUrl = (/^https?:\/\//i.test(rawUrl)) ? rawUrl : ('https://' + rawUrl);
            window.open(fullUrl, '_blank');
        }
        startScreenShareWithMode('browser', 'Tab Web Đăng Nhập');
    });
}

window.bindSafeButton(screenStopBtn, () => {
    stopLocalScreenShare(true);
});

if (stopScreenMenuBtn) {
    window.bindSafeButton(stopScreenMenuBtn, () => {
        stopLocalScreenShare(true);
        if (window.closeAllPopovers) window.closeAllPopovers();
    });
}

window.bindSafeButton(screenMinBtn, () => {
    screenContainer.classList.toggle('minimized');
});

window.bindSafeButton(screenCloseBtn, () => {
    if (localScreenStream) {
        stopLocalScreenShare(true);
    } else {
        screenContainer.style.display = 'none';
    }
});

window.bindSafeButton(screenFullscreenBtn, () => {
    const bodyEl = document.getElementById('screen-body');
    if (!bodyEl) return;
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    } else if (bodyEl.requestFullscreen) {
        bodyEl.requestFullscreen().catch(() => {});
    }
});

socket.on('screen_viewer_joined', async (data) => {
    if (!localScreenStream || !data || !data.viewer_sid) return;
    const viewerSid = data.viewer_sid;
    if (screenPeers[viewerSid]) {
        try { screenPeers[viewerSid].close(); } catch (e) {}
    }
    const pc = new RTCPeerConnection(rtcConfig);
    screenPeers[viewerSid] = pc;
    localScreenStream.getTracks().forEach(track => {
        pc.addTrack(track, localScreenStream);
    });
    pc.onicecandidate = (ev) => {
        if (ev.candidate) {
            socket.emit('webrtc_ice', {
                target_sid: viewerSid,
                candidate: ev.candidate
            });
        }
    };
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_offer', {
            target_sid: viewerSid,
            sdp: pc.localDescription,
            username: window.USERNAME || 'Thành viên',
            mode_label: screenTitle.innerText.replace('🖥️ Bạn đang chia sẻ: ', '')
        });
    } catch (e) {}
});

function showRemoteScreenWidget(info) {
    if (!info || localScreenStream) return;
    if (typeof info.x === 'number') screenContainer.style.left = info.x + 'px';
    if (typeof info.y === 'number') screenContainer.style.top = info.y + 'px';
    if (typeof info.w === 'number') screenContainer.style.width = info.w + 'px';
    if (typeof info.h === 'number') screenContainer.style.height = info.h + 'px';
    screenContainer.style.display = 'flex';
    screenContainer.classList.remove('minimized');
    screenStopBtn.style.display = 'none';
    screenTitle.innerText = `🖥️ ${info.username || 'Thành viên'} đang chia sẻ (${info.mode_label || 'Màn hình'})`;
    if (info.last_frame && !isWebRtcActivelyRendering()) {
        screenVideo.style.display = 'none';
        screenFallbackImg.style.display = 'block';
        screenFallbackImg.src = info.last_frame;
    }
}

window.loadScreenShareState = function(info) {
    if (info && info.sid) {
        showRemoteScreenWidget(info);
    }
};

socket.on('screen_share_started', (info) => {
    closeViewerPeer();
    showRemoteScreenWidget(info);
    if (window.showToast) {
        window.showToast(`🖥️ ${info.username || 'Thành viên'} vừa bật chia sẻ màn hình!`);
    }
});

socket.on('screen_share_stopped', () => {
    if (localScreenStream) return;
    closeViewerPeer();
    if (screenVideo) screenVideo.srcObject = null;
    if (screenFallbackImg) {
        screenFallbackImg.style.display = 'none';
        screenFallbackImg.src = '';
    }
    if (screenContainer) screenContainer.style.display = 'none';
    if (window.showToast) window.showToast('⏹️ Chia sẻ màn hình đã kết thúc.');
});

socket.on('screen_widget_moved', (data) => {
    if (!data || localScreenStream) return;
    if (typeof data.x === 'number') screenContainer.style.left = data.x + 'px';
    if (typeof data.y === 'number') screenContainer.style.top = data.y + 'px';
    if (typeof data.w === 'number') screenContainer.style.width = data.w + 'px';
    if (typeof data.h === 'number') screenContainer.style.height = data.h + 'px';
});

socket.on('webrtc_offer', async (data) => {
    if (!data || !data.from_sid || !data.sdp || localScreenStream) return;
    closeViewerPeer();
    const pc = new RTCPeerConnection(rtcConfig);
    viewerPeer = pc;

    const checkAndActivateVideo = () => {
        if (!viewerPeer || !screenVideo) return;
        const st = viewerPeer.iceConnectionState;
        if ((st === 'connected' || st === 'completed') && screenVideo.videoWidth > 10 && !screenVideo.paused) {
            webRtcRenderingConfirmed = true;
            screenFallbackImg.style.display = 'none';
            screenVideo.style.display = 'block';
        }
    };

    pc.oniceconnectionstatechange = () => {
        if (!viewerPeer) return;
        const st = viewerPeer.iceConnectionState;
        if (st === 'disconnected' || st === 'failed' || st === 'closed') {
            webRtcRenderingConfirmed = false;
            screenVideo.style.display = 'none';
            screenFallbackImg.style.display = 'block';
        } else {
            checkAndActivateVideo();
        }
    };

    pc.ontrack = (ev) => {
        if (ev.streams && ev.streams[0]) {
            screenVideo.muted = true;
            screenVideo.setAttribute('muted', '');
            screenVideo.setAttribute('playsinline', '');
            screenVideo.srcObject = ev.streams[0];
            screenVideo.onloadeddata = () => {
                screenVideo.play().then(() => {
                    setTimeout(checkAndActivateVideo, 200);
                }).catch(() => {});
            };
            screenVideo.ontimeupdate = () => {
                if (!webRtcRenderingConfirmed && screenVideo.videoWidth > 10) {
                    checkAndActivateVideo();
                }
            };
            screenVideo.play().catch(() => {});
        }
    };

    pc.onicecandidate = (ev) => {
        if (ev.candidate) {
            socket.emit('webrtc_ice', {
                target_sid: data.from_sid,
                candidate: ev.candidate
            });
        }
    };

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', {
            target_sid: data.from_sid,
            sdp: pc.localDescription
        });
    } catch (e) {}
});

socket.on('webrtc_answer', async (data) => {
    if (!data || !data.from_sid || !data.sdp) return;
    const pc = screenPeers[data.from_sid];
    if (pc) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } catch (e) {}
    }
});

socket.on('webrtc_ice', async (data) => {
    if (!data || !data.from_sid || !data.candidate) return;
    const pc = screenPeers[data.from_sid] || viewerPeer;
    if (pc) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {}
    }
});

socket.on('screen_frame', (data) => {
    if (!data || !data.frame || localScreenStream) return;
    if (screenContainer.style.display === 'none') {
        screenContainer.style.display = 'flex';
    }
    screenTitle.innerText = `🖥️ ${data.username || 'Thành viên'} đang chia sẻ (${data.mode_label || 'Màn hình'})`;
    screenFallbackImg.src = data.frame;
    if (!isWebRtcActivelyRendering()) {
        screenVideo.style.display = 'none';
        screenFallbackImg.style.display = 'block';
    }
});

function syncMediaWidgetState() {
    socket.emit('widget_state', {
        room_id: ROOM_ID,
        widget: 'media',
        x: parseFloat(mediaContainer.style.left) || 1920,
        y: parseFloat(mediaContainer.style.top) || 2220,
        w: parseFloat(mediaContainer.style.width) || mediaContainer.offsetWidth || 600,
        h: parseFloat(mediaContainer.style.height) || mediaContainer.offsetHeight || 460,
        open: mediaContainer.style.display !== 'none',
        minimized: mediaContainer.classList.contains('minimized')
    });
}

window.makeWidgetResizable(mediaContainer, 360, 280, true, () => {
    syncMediaWidgetState();
});

function openMediaHubAtCenter(showControls) {
    const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
    const w = Math.min(600, window.innerWidth - 24);
    mediaContainer.style.width = w + 'px';
    mediaContainer.style.left = Math.round(center.x - w / 2) + 'px';
    mediaContainer.style.top = Math.round(center.y - 230) + 'px';
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

window.bindSafeButton(btnSyncNow, () => {
    socket.emit('request_media_sync', { room_id: ROOM_ID });
    if (window.showToast) window.showToast('🔄 Đang đồng bộ với phòng...');
});

window.bindSafeButton(btnUnlockAudio, () => {
    btnUnlockAudio.style.display = 'none';
    if (ytPlayer && typeof ytPlayer.unMute === 'function') {
        try {
            ytPlayer.unMute();
            ytPlayer.setVolume(100);
            ytPlayer.playVideo();
        } catch (e) {}
    }
    const htmlMedia = mediaContent.querySelector('video, audio');
    if (htmlMedia) {
        htmlMedia.muted = false;
        htmlMedia.play().catch(() => {});
    }
    socket.emit('request_media_sync', { room_id: ROOM_ID });
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
    if (fileUploadInput) {
        try { fileUploadInput.click(); } catch (e) {}
    }
});

if (fileUploadInput) {
    fileUploadInput.addEventListener('change', () => {
        if (fileUploadInput.files && fileUploadInput.files.length > 0) {
            performFileUpload(false);
        }
    });
}

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
        if (window.showToast) window.showToast('Chưa có Trang Web hoặc Media nào đang mở để ghim!');
        return;
    }
    spawnBoardMediaCard(activeHubMedia.kind || activeHubMedia.type, activeHubMedia.url, activeHubMedia.name || 'Tài liệu', activeHubMedia.use_proxy);
});

let isMediaDragging = false;
let mediaStartClientX = 0;
let mediaStartClientY = 0;
let mediaInitialLeft = 1920;
let mediaInitialTop = 2220;

mediaHeader.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.stopPropagation();
    isMediaDragging = true;
    mediaStartClientX = e.clientX;
    mediaStartClientY = e.clientY;
    mediaInitialLeft = parseFloat(mediaContainer.style.left) || 1920;
    mediaInitialTop = parseFloat(mediaContainer.style.top) || 2220;
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
mediaContainer.addEventListener('pointerdown', e => e.stopPropagation());

function extractYoutubeId(url) {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

function normalizeWebUrl(raw) {
    const s = (raw || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
    return 'https://' + s;
}

function resolveKind(typeOrKind, url, name) {
    const t = (typeOrKind || '').toLowerCase();
    const u = ((url || '') + ' ' + (name || '')).toLowerCase();
    if (t === 'youtube' || extractYoutubeId(url)) return 'youtube';
    if (t === 'website') return 'website';
    if (t === 'image' || t.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?|$)/i.test(u)) return 'image';
    if (t === 'video' || t.startsWith('video/') || /\.(mp4|webm|ogg|mov|mkv|m4v)(\?|$)/i.test(u)) return 'video';
    if (t === 'audio' || t.startsWith('audio/') || /\.(mp3|wav|flac|aac|m4a|oga)(\?|$)/i.test(u)) return 'audio';
    if (t === 'pdf' || t === 'application/pdf' || /\.pdf(\?|$)/i.test(u)) return 'pdf';
    if (t === 'excel' || /\.(xlsx|xls|csv)(\?|$)/i.test(u)) return 'excel';
    if (t === 'word' || /\.(docx|doc)(\?|$)/i.test(u)) return 'word';
    if (t === 'html' || /\.(html|htm)(\?|$)/i.test(u)) return 'html';
    if (t === 'text' || /\.(txt|md|json|py|js|css|xml|log|sql|sh)(\?|$)/i.test(u)) return 'text';
    if (/^https?:\/\//i.test(url || '')) return 'website';
    return 'file';
}

function getKindIcon(k) {
    if (k === 'youtube') return '▶️';
    if (k === 'website') return '🌐';
    if (k === 'image') return '🖼️';
    if (k === 'video') return '🎬';
    if (k === 'audio') return '🎵';
    if (k === 'pdf') return '📕';
    if (k === 'excel') return '📊';
    if (k === 'word') return '📝';
    if (k === 'html') return '🌐';
    if (k === 'text') return '📄';
    return '📁';
}

function renderWebsiteViewerInto(targetEl, rawUrl, name, useProxyDefault, isHub) {
    const fullUrl = normalizeWebUrl(rawUrl);
    let useProxy = !!useProxyDefault;
    const getFrameSrc = () => useProxy ? (`/web-proxy?url=${encodeURIComponent(fullUrl)}`) : fullUrl;

    targetEl.innerHTML = `
        <div class="doc-viewer-wrapper">
            <div class="doc-toolbar-bar" style="flex-wrap:wrap; gap:6px;">
                <input type="text" class="web-url-nav-input" value="${fullUrl.replace(/"/g, '&quot;')}" style="flex:1; min-width:140px; padding:4px 8px; border-radius:6px; border:1px solid #444; background:#0f111a; color:#00d2ff; font-size:11px;">
                <button type="button" class="widget-btn btn-web-go" title="Đi tới địa chỉ này và đồng bộ cho phòng">Đi tới</button>
                <button type="button" class="widget-btn btn-web-mode" title="Đổi giữa Nhúng trực tiếp và Cổng Proxy vượt chặn">${useProxy ? '🛡️ Đang dùng Proxy' : '⚡ Trực tiếp'}</button>
                <button type="button" class="widget-btn btn-web-stream" style="background:#feca57; color:#000;" title="Mở web ở tab mới và chiếu trực tiếp màn hình đã đăng nhập của bạn">📡 Chiếu Tab Đăng Nhập</button>
                <a href="${fullUrl}" target="_blank" style="font-size:11px;">↗ Tab mới</a>
            </div>
            <iframe class="html-preview-frame" src="${getFrameSrc()}" allow="autoplay; encrypted-media; fullscreen; clipboard-read; clipboard-write" allowfullscreen></iframe>
        </div>
    `;

    const navInput = targetEl.querySelector('.web-url-nav-input');
    const goBtn = targetEl.querySelector('.btn-web-go');
    const modeBtn = targetEl.querySelector('.btn-web-mode');
    const streamBtn = targetEl.querySelector('.btn-web-stream');
    const iframe = targetEl.querySelector('.html-preview-frame');

    const navigateAndSync = (nextUrl, nextProxy) => {
        const cleanUrl = normalizeWebUrl(nextUrl);
        if (!cleanUrl) return;
        let hostLabel = cleanUrl;
        try {
            hostLabel = new URL(cleanUrl).hostname;
        } catch (e) {}
        if (isHub) {
            socket.emit('media_share', {
                room_id: ROOM_ID,
                type: 'website',
                kind: 'website',
                url: cleanUrl,
                use_proxy: nextProxy,
                name: 'Web: ' + hostLabel,
                sender: window.USERNAME,
                x: parseFloat(mediaContainer.style.left) || 1920,
                y: parseFloat(mediaContainer.style.top) || 2220
            });
        } else {
            iframe.src = nextProxy ? (`/web-proxy?url=${encodeURIComponent(cleanUrl)}`) : cleanUrl;
        }
    };

    if (goBtn && navInput) {
        window.bindSafeButton(goBtn, () => {
            navigateAndSync(navInput.value, useProxy);
        });
        navInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                navigateAndSync(navInput.value, useProxy);
            }
        });
        navInput.addEventListener('pointerdown', e => e.stopPropagation());
    }

    if (modeBtn) {
        window.bindSafeButton(modeBtn, () => {
            useProxy = !useProxy;
            modeBtn.innerText = useProxy ? '🛡️ Đang dùng Proxy' : '⚡ Trực tiếp';
            navigateAndSync(navInput ? navInput.value : fullUrl, useProxy);
        });
    }

    if (streamBtn) {
        window.bindSafeButton(streamBtn, () => {
            const target = navInput ? normalizeWebUrl(navInput.value) : fullUrl;
            window.open(target, '_blank');
            startScreenShareWithMode('browser', 'Tab Web: ' + target.slice(0, 28));
        });
    }
}

function renderRichContentInto(targetEl, kind, url, name, isHub, useProxy) {
    const safeName = (name || 'Tài liệu').replace(/[<>]/g, '');
    if (kind === 'website') {
        renderWebsiteViewerInto(targetEl, url, safeName, useProxy, isHub);
        return;
    }
    if (kind === 'image') {
        targetEl.innerHTML = `<div class="doc-viewer-wrapper" style="background:#0b0b10;"><div class="doc-toolbar-bar"><span>🖼️ ${safeName}</span><a href="${url}" target="_blank">🔍 Mở ảnh gốc</a></div><div style="padding:8px; flex:1; display:flex; align-items:center; justify-content:center; overflow:auto;"><img src="${url}" alt="${safeName}" style="max-width:100%; max-height:100%; border-radius:6px;"></div></div>`;
        return;
    }
    if (kind === 'video') {
        const idAttr = isHub ? 'id="hub-html5-media"' : '';
        targetEl.innerHTML = `<video ${idAttr} src="${url}" controls autoplay playsinline style="width:100%; height:100%; background:#000;"></video>`;
        return;
    }
    if (kind === 'audio') {
        const idAttr = isHub ? 'id="hub-html5-media"' : '';
        targetEl.innerHTML = `<div class="audio-player-box"><div class="audio-player-title">🎵 ${safeName}</div><audio ${idAttr} src="${url}" controls autoplay></audio></div>`;
        return;
    }
    if (kind === 'pdf') {
        targetEl.innerHTML = `<div class="doc-viewer-wrapper"><div class="doc-toolbar-bar"><span>📕 ${safeName}</span><a href="${url}" target="_blank">↗ Mở PDF tab mới</a></div><iframe src="${url}#toolbar=1&view=FitH" style="width:100%; flex:1; border:none; background:#fff;"></iframe></div>`;
        return;
    }
    if (kind === 'html') {
        targetEl.innerHTML = `<div class="doc-viewer-wrapper"><div class="doc-toolbar-bar"><span>🌐 Trang HTML trực tiếp: ${safeName}</span><a href="${url}" target="_blank">↗ Mở tab mới</a></div><iframe class="html-preview-frame"></iframe></div>`;
        const frame = targetEl.querySelector('.html-preview-frame');
        fetch(url)
            .then(r => r.text())
            .then(htmlText => {
                frame.srcdoc = htmlText;
            })
            .catch(() => {
                frame.src = url;
            });
        return;
    }
    if (kind === 'excel') {
        targetEl.innerHTML = `<div class="doc-viewer-wrapper"><div class="doc-toolbar-bar"><span>📊 Bảng tính: ${safeName}</span><a href="${url}" download="${safeName}">⬇ Tải về</a></div><div class="excel-sheet-tabs">Đang đọc dữ liệu Excel...</div><div class="excel-table-wrap"></div></div>`;
        const tabsEl = targetEl.querySelector('.excel-sheet-tabs');
        const tableWrap = targetEl.querySelector('.excel-table-wrap');
        fetch(url)
            .then(r => r.arrayBuffer())
            .then(buf => {
                if (typeof XLSX === 'undefined') {
                    tableWrap.innerHTML = `<p style="padding:16px;">Trình duyệt chưa nạp thư viện Excel. <a href="${url}" target="_blank">Tải tệp tại đây</a></p>`;
                    return;
                }
                const wb = XLSX.read(buf, { type: 'array' });
                tabsEl.innerHTML = '';
                wb.SheetNames.forEach((sheetName, idx) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'excel-tab-btn' + (idx === 0 ? ' active' : '');
                    btn.innerText = sheetName;
                    window.bindSafeButton(btn, () => {
                        tabsEl.querySelectorAll('.excel-tab-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        const ws = wb.Sheets[sheetName];
                        tableWrap.innerHTML = XLSX.utils.sheet_to_html(ws);
                    });
                    tabsEl.appendChild(btn);
                });
                if (wb.SheetNames.length > 0) {
                    const firstSheet = wb.Sheets[wb.SheetNames[0]];
                    tableWrap.innerHTML = XLSX.utils.sheet_to_html(firstSheet);
                }
            })
            .catch(() => {
                tableWrap.innerHTML = `<p style="padding:16px;">Không thể đọc bảng tính. <a href="${url}" target="_blank">Tải tệp về máy</a></p>`;
            });
        return;
    }
    if (kind === 'word') {
        targetEl.innerHTML = `<div class="doc-viewer-wrapper"><div class="doc-toolbar-bar"><span>📝 Tài liệu Word: ${safeName}</span><a href="${url}" download="${safeName}">⬇ Tải về</a></div><div class="word-doc-view">Đang hiển thị nội dung Word...</div></div>`;
        const docView = targetEl.querySelector('.word-doc-view');
        fetch(url)
            .then(r => r.arrayBuffer())
            .then(buf => {
                if (typeof mammoth === 'undefined') {
                    docView.innerHTML = `<p>Không thể nạp bộ đọc Word. <a href="${url}" target="_blank">Tải tệp về máy</a></p>`;
                    return;
                }
                return mammoth.convertToHtml({ arrayBuffer: buf });
            })
            .then(result => {
                if (result && result.value !== undefined) {
                    docView.innerHTML = result.value || '<p>Tài liệu trống.</p>';
                }
            })
            .catch(() => {
                docView.innerHTML = `<p>Định dạng .doc cũ hoặc tệp lỗi. <a href="${url}" download="${safeName}" style="color:#0984e3; font-weight:bold;">Nhấn vào đây để tải tệp Word về máy</a></p>`;
            });
        return;
    }
    if (kind === 'text') {
        targetEl.innerHTML = `<div class="doc-viewer-wrapper"><div class="doc-toolbar-bar"><span>📄 Văn bản / Code: ${safeName}</span><a href="${url}" target="_blank">↗ Mở gốc</a></div><pre class="text-doc-view">Đang tải nội dung...</pre></div>`;
        const preEl = targetEl.querySelector('.text-doc-view');
        fetch(url)
            .then(r => r.text())
            .then(txt => {
                preEl.innerText = txt.slice(0, 100000);
            })
            .catch(() => {
                preEl.innerText = 'Không thể đọc tệp văn bản.';
            });
        return;
    }
    targetEl.innerHTML = `<div class="audio-player-box"><div class="audio-player-title">📁 ${safeName}</div><a href="${url}" download="${safeName}" target="_blank" style="background:#00d2ff; color:#000; padding:8px 16px; border-radius:8px; font-weight:bold; text-decoration:none;">⬇ Tải xuống / Mở tệp</a></div>`;
}

function destroyYtPlayer() {
    if (ytPlayer) {
        try { ytPlayer.destroy(); } catch (e) {}
        ytPlayer = null;
    }
}

function clearMediaView() {
    destroyYtPlayer();
    activeHubMedia = null;
    btnUnlockAudio.style.display = 'none';
    mediaContent.innerHTML = '<div class="empty-media-box"><p class="empty-media-text">🌐 Dán <b>URL Trang Web bất kỳ</b>, link <b>YouTube</b> hoặc tải lên <b>Ảnh, Video, MP3, PDF, Excel, Word, HTML</b> để cả phòng cùng xem!<br><small style="color:#00d2ff;">(Nếu trang web cần đăng nhập tài khoản, hãy bấm <b>📡 Chiếu Tab Đăng Nhập</b> để mọi người nhìn thấy giống hệt màn hình của bạn)</small></p></div>';
    mediaControlsBox.classList.remove('collapsed');
}

function applyPlaybackSyncState(syncData) {
    if (!syncData) return;
    const targetTime = parseFloat(syncData.currentTime || 0);
    const shouldPlay = !!syncData.playing;

    if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        isApplyingRemoteSync = true;
        try {
            const cur = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
            if (Math.abs(cur - targetTime) > 2.2 || syncData.force) {
                ytPlayer.seekTo(targetTime, true);
            }
            if (shouldPlay) {
                ytPlayer.playVideo();
            } else {
                ytPlayer.pauseVideo();
            }
        } catch (e) {}
        setTimeout(() => { isApplyingRemoteSync = false; }, 650);
        return;
    }

    const htmlMedia = document.getElementById('hub-html5-media');
    if (htmlMedia) {
        isApplyingRemoteSync = true;
        if (Math.abs((htmlMedia.currentTime || 0) - targetTime) > 2.0 || syncData.force) {
            try { htmlMedia.currentTime = targetTime; } catch (e) {}
        }
        if (shouldPlay) {
            htmlMedia.play().catch(() => {
                htmlMedia.muted = true;
                htmlMedia.play().catch(() => {});
                btnUnlockAudio.style.display = 'block';
            });
        } else {
            htmlMedia.pause();
        }
        setTimeout(() => { isApplyingRemoteSync = false; }, 550);
    }
}

function bindHtml5SyncEvents(mediaEl, startPos, shouldPlay, customEmitFn) {
    if (!mediaEl) return;
    let isBuffering = false;
    let isSeeking = false;

    mediaEl.addEventListener('waiting', () => {
        isBuffering = true;
    });
    mediaEl.addEventListener('playing', () => {
        isBuffering = false;
    });
    mediaEl.addEventListener('seeking', () => {
        isSeeking = true;
    });

    mediaEl.addEventListener('loadedmetadata', () => {
        if (startPos > 0.5) {
            try { mediaEl.currentTime = startPos; } catch (e) {}
        }
        if (shouldPlay) {
            mediaEl.play().catch(() => {
                mediaEl.muted = true;
                mediaEl.play().catch(() => {});
                if (!customEmitFn) btnUnlockAudio.style.display = 'block';
            });
        }
    }, { once: true });

    const sendSync = (action) => {
        if (typeof customEmitFn === 'function') {
            customEmitFn(action, mediaEl.currentTime || 0);
        } else {
            socket.emit('media_playback_sync', {
                room_id: ROOM_ID,
                action: action,
                currentTime: mediaEl.currentTime || 0,
                sender: window.USERNAME
            });
        }
    };

    mediaEl.addEventListener('play', () => {
        if (isApplyingRemoteSync) return;
        sendSync('play');
    });

    mediaEl.addEventListener('pause', () => {
        if (isApplyingRemoteSync || mediaEl.ended || isBuffering || isSeeking || document.hidden || mediaEl.readyState < 3) {
            return;
        }
        sendSync('pause');
    });

    mediaEl.addEventListener('seeked', () => {
        isSeeking = false;
        if (isApplyingRemoteSync) return;
        sendSync(mediaEl.paused ? 'pause' : 'play');
    });
}

function createSyncedYoutubePlayer(videoId, startPos, shouldPlay) {
    destroyYtPlayer();
    mediaContent.innerHTML = '<div id="yt-sync-mount" style="width:100%; height:100%; min-height:310px;"></div>';
    if (!window.YT || !window.YT.Player) {
        mediaContent.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&start=${Math.floor(startPos)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        return;
    }
    ytPlayer = new YT.Player('yt-sync-mount', {
        width: '100%',
        height: '100%',
        videoId: videoId,
        playerVars: {
            autoplay: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            start: Math.floor(startPos || 0),
            origin: window.location.origin
        },
        events: {
            onReady: function(ev) {
                if (startPos > 0.5) {
                    ev.target.seekTo(startPos, true);
                }
                if (shouldPlay) {
                    ev.target.playVideo();
                    setTimeout(() => {
                        try {
                            const st = ev.target.getPlayerState();
                            if (st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) {
                                ev.target.mute();
                                ev.target.playVideo();
                                btnUnlockAudio.style.display = 'block';
                            }
                        } catch (err) {}
                    }, 900);
                }
                if (pendingSyncState) {
                    applyPlaybackSyncState(pendingSyncState);
                    pendingSyncState = null;
                }
            },
            onStateChange: function(ev) {
                if (ev.data === YT.PlayerState.BUFFERING) {
                    lastYtBufferingTime = Date.now();
                    return;
                }
                if (isApplyingRemoteSync || document.hidden) return;
                if (ev.data === YT.PlayerState.PLAYING) {
                    socket.emit('media_playback_sync', {
                        room_id: ROOM_ID,
                        action: 'play',
                        currentTime: ev.target.getCurrentTime() || 0,
                        sender: window.USERNAME
                    });
                } else if (ev.data === YT.PlayerState.PAUSED) {
                    if (Date.now() - lastYtBufferingTime < 1400) return;
                    socket.emit('media_playback_sync', {
                        room_id: ROOM_ID,
                        action: 'pause',
                        currentTime: ev.target.getCurrentTime() || 0,
                        sender: window.USERNAME
                    });
                }
            }
        }
    });
}

function renderMediaInHub(item) {
    if (!item || item.type === 'clear' || !item.url) {
        clearMediaView();
        return;
    }
    btnUnlockAudio.style.display = 'none';
    const kind = resolveKind(item.kind || item.type, item.url, item.name);
    const startPos = parseFloat(item.current_pos || item.position || 0);
    const shouldPlay = item.playing !== undefined ? !!item.playing : true;
    activeHubMedia = {
        kind: kind,
        type: item.type,
        url: item.url,
        name: item.name || 'Tài liệu',
        use_proxy: !!item.use_proxy
    };

    if (mediaContainer.style.display === 'none' || !mediaContainer.style.display) {
        openMediaHubAtCenter(false);
    } else {
        mediaContainer.classList.remove('minimized');
        mediaBtn.classList.add('active');
    }

    if (kind === 'youtube') {
        const videoId = extractYoutubeId(item.url);
        if (!videoId) {
            mediaContent.innerHTML = '<p class="empty-media-text">Link YouTube không hợp lệ</p>';
            return;
        }
        createSyncedYoutubePlayer(videoId, startPos, shouldPlay);
    } else {
        destroyYtPlayer();
        renderRichContentInto(mediaContent, kind, item.url, item.name, true, !!item.use_proxy);
        if (kind === 'video' || kind === 'audio') {
            const mediaEl = document.getElementById('hub-html5-media');
            bindHtml5SyncEvents(mediaEl, startPos, shouldPlay, null);
        }
    }
    mediaControlsBox.classList.add('collapsed');
}

function renderMediaHistoryList(list) {
    if (!mediaHistoryBar) return;
    mediaHistoryBar.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) return;
    list.slice().reverse().forEach(item => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'media-chip';
        const k = resolveKind(item.kind || item.type, item.url, item.name);
        const icon = getKindIcon(k);
        chip.innerText = `${icon} ${item.name || 'Media'}`;
        window.bindSafeButton(chip, () => {
            renderMediaInHub(item);
            socket.emit('media_share', {
                room_id: ROOM_ID,
                type: item.type,
                kind: k,
                url: item.url,
                use_proxy: !!item.use_proxy,
                name: item.name,
                sender: window.USERNAME
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
        if (data.w) existing.style.width = data.w + 'px';
        if (data.h) existing.style.height = data.h + 'px';
        return;
    }
    const kind = resolveKind(data.kind || data.type, data.url, data.name);
    const card = document.createElement('div');
    card.className = 'board-media-card glass-effect';
    card.id = data.id;
    card.style.left = typeof data.x === 'number' ? data.x + 'px' : data.x;
    card.style.top = typeof data.y === 'number' ? data.y + 'px' : data.y;
    if (data.w) card.style.width = data.w + 'px';
    if (data.h) card.style.height = data.h + 'px';

    const header = document.createElement('div');
    header.className = 'widget-header';
    const title = document.createElement('span');
    title.className = 'widget-title';
    const icon = getKindIcon(kind);
    title.innerText = `${icon} ${data.name || 'Tài liệu'} (${data.owner || 'Thành viên'})`;

    const controls = document.createElement('div');
    controls.className = 'widget-controls';

    if (kind === 'video' || kind === 'audio' || kind === 'youtube') {
        const syncCardBtn = document.createElement('button');
        syncCardBtn.type = 'button';
        syncCardBtn.className = 'widget-btn';
        syncCardBtn.innerText = '🔄 Đồng bộ';
        syncCardBtn.title = 'Đồng bộ thời gian phát với mọi người';
        window.bindSafeButton(syncCardBtn, () => {
            socket.emit('request_board_media_sync', { room_id: ROOM_ID, id: data.id });
            if (window.showToast) window.showToast('🔄 Đang đồng bộ thẻ Media...');
        });
        controls.appendChild(syncCardBtn);
    }

    if (kind !== 'youtube') {
        const openLink = document.createElement('a');
        openLink.href = data.url;
        openLink.target = '_blank';
        openLink.className = 'widget-btn';
        openLink.style.textDecoration = 'none';
        openLink.title = 'Mở ở tab mới';
        openLink.innerText = '↗';
        openLink.addEventListener('pointerdown', e => e.stopPropagation());
        controls.appendChild(openLink);
    }
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'widget-btn close';
    delBtn.innerText = '✕';
    delBtn.title = 'Xóa thẻ này khỏi bảng';
    window.bindSafeButton(delBtn, () => {
        if (boardYtPlayers[data.id]) {
            try { boardYtPlayers[data.id].destroy(); } catch (e) {}
            delete boardYtPlayers[data.id];
        }
        card.remove();
        socket.emit('delete_board_media', { room_id: ROOM_ID, id: data.id });
    });
    controls.appendChild(delBtn);

    header.appendChild(title);
    header.appendChild(controls);

    const body = document.createElement('div');
    body.className = 'board-media-body';
    card.appendChild(header);
    card.appendChild(body);
    boardMediaContainer.appendChild(card);

    const startPos = parseFloat(data.current_pos || data.position || 0);
    const shouldPlay = data.playing !== undefined ? !!data.playing : true;

    if (kind === 'youtube') {
        const vid = extractYoutubeId(data.url);
        const mountId = 'yt_card_' + data.id;
        body.innerHTML = `<div id="${mountId}" style="width:100%; height:100%;"></div>`;
        if (vid && window.YT && window.YT.Player) {
            let cardBufferingTime = 0;
            boardYtPlayers[data.id] = new YT.Player(mountId, {
                width: '100%',
                height: '100%',
                videoId: vid,
                playerVars: {
                    autoplay: 1,
                    playsinline: 1,
                    rel: 0,
                    start: Math.floor(startPos || 0),
                    origin: window.location.origin
                },
                events: {
                    onReady: function(ev) {
                        if (startPos > 0.5) ev.target.seekTo(startPos, true);
                        if (shouldPlay) ev.target.playVideo();
                    },
                    onStateChange: function(ev) {
                        if (ev.data === YT.PlayerState.BUFFERING) {
                            cardBufferingTime = Date.now();
                            return;
                        }
                        if (isApplyingRemoteSync || document.hidden) return;
                        if (ev.data === YT.PlayerState.PLAYING) {
                            socket.emit('board_media_playback_sync', {
                                room_id: ROOM_ID,
                                id: data.id,
                                action: 'play',
                                currentTime: ev.target.getCurrentTime() || 0
                            });
                        } else if (ev.data === YT.PlayerState.PAUSED) {
                            if (Date.now() - cardBufferingTime < 1400) return;
                            socket.emit('board_media_playback_sync', {
                                room_id: ROOM_ID,
                                id: data.id,
                                action: 'pause',
                                currentTime: ev.target.getCurrentTime() || 0
                            });
                        }
                    }
                }
            });
        } else if (vid) {
            body.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?playsinline=1&start=${Math.floor(startPos)}" allowfullscreen></iframe>`;
        }
    } else {
        renderRichContentInto(body, kind, data.url, data.name, false, !!data.use_proxy);
        if (kind === 'video' || kind === 'audio') {
            const mediaEl = body.querySelector('video, audio');
            bindHtml5SyncEvents(mediaEl, startPos, shouldPlay, (action, curTime) => {
                socket.emit('board_media_playback_sync', {
                    room_id: ROOM_ID,
                    id: data.id,
                    action: action,
                    currentTime: curTime
                });
            });
        }
    }

    const emitCardMove = () => {
        socket.emit('move_board_media', {
            room_id: ROOM_ID,
            id: data.id,
            x: card.style.left,
            y: card.style.top,
            w: parseFloat(card.style.width) || 420,
            h: parseFloat(card.style.height) || 340
        });
    };

    window.makeWidgetResizable(card, 260, 180, true, () => {
        emitCardMove();
    });

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
        emitCardMove();
    });

    const endCardDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        card.style.zIndex = '';
        if (e && header.releasePointerCapture) {
            try { header.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        emitCardMove();
    };
    header.addEventListener('pointerup', endCardDrag);
    header.addEventListener('pointercancel', endCardDrag);
    card.addEventListener('pointerdown', e => e.stopPropagation());
}

function spawnBoardMediaCard(kind, url, name, useProxy) {
    const id = 'bmedia_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
    const offset = (boardMediaContainer.children.length % 5) * 30;
    const x = Math.round(center.x - 210 + offset) + 'px';
    const y = Math.round(center.y - 170 + offset) + 'px';
    const payload = {
        room_id: ROOM_ID,
        id: id,
        kind: kind,
        url: url,
        use_proxy: !!useProxy,
        name: name || 'Tài liệu',
        owner: window.USERNAME,
        x: x,
        y: y,
        w: 440,
        h: 360
    };
    createBoardMediaDOM(payload);
    socket.emit('new_board_media', payload);
    if (window.showToast) window.showToast('📌 Đã ghim "' + (name || 'Tài liệu') + '" lên mặt bảng!');
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
    const rawInput = document.getElementById('youtube-link').value.trim();
    if (!rawInput) {
        if (window.showToast) window.showToast('Hãy nhập link YouTube hoặc địa chỉ URL Trang Web!');
        return;
    }
    openMediaHubAtCenter(false);
    const vid = extractYoutubeId(rawInput);
    if (vid) {
        const item = {
            type: 'youtube',
            kind: 'youtube',
            url: rawInput,
            name: 'YouTube (' + vid + ')',
            sender: window.USERNAME
        };
        renderMediaInHub(item);
        socket.emit('media_share', {
            room_id: ROOM_ID,
            type: 'youtube',
            kind: 'youtube',
            url: rawInput,
            name: item.name,
            sender: window.USERNAME,
            x: parseFloat(mediaContainer.style.left) || 1920,
            y: parseFloat(mediaContainer.style.top) || 2220
        });
        return;
    }

    const webUrl = normalizeWebUrl(rawInput);
    let hostLabel = webUrl;
    try {
        hostLabel = new URL(webUrl).hostname;
    } catch (e) {}
    const webItem = {
        type: 'website',
        kind: 'website',
        url: webUrl,
        use_proxy: true,
        name: 'Web: ' + hostLabel,
        sender: window.USERNAME
    };
    renderMediaInHub(webItem);
    socket.emit('media_share', {
        room_id: ROOM_ID,
        type: 'website',
        kind: 'website',
        url: webUrl,
        use_proxy: true,
        name: webItem.name,
        sender: window.USERNAME,
        x: parseFloat(mediaContainer.style.left) || 1920,
        y: parseFloat(mediaContainer.style.top) || 2220
    });
});

function performFileUpload(pinDirectlyToBoard) {
    if (!fileUploadInput || !fileUploadInput.files || fileUploadInput.files.length === 0) {
        if (window.showToast) window.showToast('Hãy chọn tệp Ảnh, Video, PDF, Excel, Word hoặc HTML!');
        if (fileUploadInput) {
            try { fileUploadInput.click(); } catch (e) {}
        }
        return;
    }
    const file = fileUploadInput.files[0];
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
            uploadBtn.innerText = '📤 Mở Xem Chung';
            uploadBtn.disabled = false;
            if (pinBtn) pinBtn.disabled = false;
            if (data && data.url) {
                const kind = data.kind || resolveKind(data.type, data.url, data.name || file.name);
                const name = data.name || file.name;
                if (pinDirectlyToBoard) {
                    spawnBoardMediaCard(kind, data.url, name, false);
                } else {
                    openMediaHubAtCenter(false);
                    const item = { type: data.type, kind: kind, url: data.url, name: name, sender: window.USERNAME };
                    renderMediaInHub(item);
                    socket.emit('media_share', {
                        room_id: ROOM_ID,
                        type: data.type,
                        kind: kind,
                        url: data.url,
                        name: name,
                        sender: window.USERNAME,
                        x: parseFloat(mediaContainer.style.left) || 1920,
                        y: parseFloat(mediaContainer.style.top) || 2220
                    });
                }
                fileUploadInput.value = '';
                if (window.showToast) window.showToast('Đã tải lên thành công: ' + name);
            } else {
                if (window.showToast) window.showToast((data && data.error) || 'Tải tệp thất bại!');
            }
        })
        .catch(() => {
            uploadBtn.innerText = '📤 Mở Xem Chung';
            uploadBtn.disabled = false;
            if (pinBtn) pinBtn.disabled = false;
            if (window.showToast) window.showToast('Lỗi kết nối máy chủ khi tải tệp!');
        });
}

window.bindSafeButton(document.getElementById('btn-upload'), () => performFileUpload(false));
window.bindSafeButton(document.getElementById('btn-upload-board'), () => performFileUpload(true));

socket.on('media_shared', (data) => {
    if (!data) return;
    if (Array.isArray(data.media_list)) {
        renderMediaHistoryList(data.media_list);
    }
    if (data.widget_state && typeof data.widget_state.x === 'number') {
        mediaContainer.style.left = data.widget_state.x + 'px';
        mediaContainer.style.top = data.widget_state.y + 'px';
    }
    if (data.type === 'clear') {
        clearMediaView();
    } else if (data.media) {
        renderMediaInHub(data.media);
    } else if (data.url) {
        renderMediaInHub(data);
    }
});

socket.on('media_playback_sync', (data) => {
    pendingSyncState = data;
    applyPlaybackSyncState(data);
});

socket.on('board_media_playback_sync', (data) => {
    if (!data || !data.id) return;
    const card = document.getElementById(data.id);
    if (!card) return;
    const targetTime = parseFloat(data.currentTime || 0);
    const shouldPlay = !!data.playing;

    if (boardYtPlayers[data.id] && typeof boardYtPlayers[data.id].seekTo === 'function') {
        isApplyingRemoteSync = true;
        try {
            const p = boardYtPlayers[data.id];
            const cur = p.getCurrentTime ? p.getCurrentTime() : 0;
            if (Math.abs(cur - targetTime) > 2.2 || data.force) {
                p.seekTo(targetTime, true);
            }
            if (shouldPlay) p.playVideo();
            else p.pauseVideo();
        } catch (e) {}
        setTimeout(() => { isApplyingRemoteSync = false; }, 650);
        return;
    }

    const mediaEl = card.querySelector('video, audio');
    if (mediaEl) {
        isApplyingRemoteSync = true;
        if (Math.abs((mediaEl.currentTime || 0) - targetTime) > 2.0 || data.force) {
            try { mediaEl.currentTime = targetTime; } catch (e) {}
        }
        if (shouldPlay) {
            mediaEl.play().catch(() => {
                mediaEl.muted = true;
                mediaEl.play().catch(() => {});
            });
        } else {
            mediaEl.pause();
        }
        setTimeout(() => { isApplyingRemoteSync = false; }, 550);
    }
});

socket.on('board_media_added', (d) => createBoardMediaDOM(d));
socket.on('board_media_moved', (d) => createBoardMediaDOM(d));
socket.on('board_media_deleted', (d) => {
    if (d && d.id) {
        if (boardYtPlayers[d.id]) {
            try { boardYtPlayers[d.id].destroy(); } catch (e) {}
            delete boardYtPlayers[d.id];
        }
        const el = document.getElementById(d.id);
        if (el) el.remove();
    }
});
