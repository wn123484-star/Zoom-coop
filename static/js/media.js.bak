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

let activeHubMedia = null;
let ytPlayer = null;
let ytApiReady = false;
let isApplyingRemoteSync = false;
let lastYtBufferingTime = 0;
let pendingSyncState = null;
const boardYtPlayers = {};

window.onYouTubeIframeAPIReady = function() {
    ytApiReady = true;
};

function syncMediaWidgetState() {
    socket.emit('widget_state', {
        room_id: ROOM_ID,
        widget: 'media',
        x: parseFloat(mediaContainer.style.left) || 1920,
        y: parseFloat(mediaContainer.style.top) || 2220,
        w: parseFloat(mediaContainer.style.width) || mediaContainer.offsetWidth || 580,
        h: parseFloat(mediaContainer.style.height) || mediaContainer.offsetHeight || 440,
        open: mediaContainer.style.display !== 'none',
        minimized: mediaContainer.classList.contains('minimized')
    });
}

window.makeWidgetResizable(mediaContainer, 340, 280, true, () => {
    syncMediaWidgetState();
});

function openMediaHubAtCenter(showControls) {
    const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
    const w = Math.min(580, window.innerWidth - 24);
    mediaContainer.style.width = w + 'px';
    mediaContainer.style.left = Math.round(center.x - w / 2) + 'px';
    mediaContainer.style.top = Math.round(center.y - 220) + 'px';
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
    if (window.showToast) window.showToast('🔄 Đang đồng bộ thời gian phát với phòng...');
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
        if (window.showToast) window.showToast('Chưa có Media hoặc Tài liệu nào đang mở để ghim!');
        return;
    }
    spawnBoardMediaCard(activeHubMedia.kind || activeHubMedia.type, activeHubMedia.url, activeHubMedia.name || 'Tài liệu');
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

function resolveKind(typeOrKind, url, name) {
    const t = (typeOrKind || '').toLowerCase();
    const u = ((url || '') + ' ' + (name || '')).toLowerCase();
    if (t === 'youtube' || extractYoutubeId(url)) return 'youtube';
    if (t === 'image' || t.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?|$)/i.test(u)) return 'image';
    if (t === 'video' || t.startsWith('video/') || /\.(mp4|webm|ogg|mov|mkv|m4v)(\?|$)/i.test(u)) return 'video';
    if (t === 'audio' || t.startsWith('audio/') || /\.(mp3|wav|flac|aac|m4a|oga)(\?|$)/i.test(u)) return 'audio';
    if (t === 'pdf' || t === 'application/pdf' || /\.pdf(\?|$)/i.test(u)) return 'pdf';
    if (t === 'excel' || /\.(xlsx|xls|csv)(\?|$)/i.test(u)) return 'excel';
    if (t === 'word' || /\.(docx|doc)(\?|$)/i.test(u)) return 'word';
    if (t === 'html' || /\.(html|htm)(\?|$)/i.test(u)) return 'html';
    if (t === 'text' || /\.(txt|md|json|py|js|css|xml|log|sql|sh)(\?|$)/i.test(u)) return 'text';
    return 'file';
}

function getKindIcon(k) {
    if (k === 'youtube') return '▶️';
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

function renderRichContentInto(targetEl, kind, url, name, isHub) {
    const safeName = (name || 'Tài liệu').replace(/[<>]/g, '');
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
    mediaContent.innerHTML = '<div class="empty-media-box"><p class="empty-media-text">📂 Hỗ trợ hiển thị trực tiếp: <b>Ảnh, Video, Nhạc MP3, PDF, Bảng tính Excel (.xlsx/.csv), Word (.docx), Web HTML (.html), Văn bản/Code</b> và <b>YouTube</b>!</p></div>';
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
    activeHubMedia = { kind: kind, type: item.type, url: item.url, name: item.name || 'Tài liệu' };

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
        renderRichContentInto(mediaContent, kind, item.url, item.name, true);
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
        openLink.title = 'Mở tệp ở tab mới';
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
        renderRichContentInto(body, kind, data.url, data.name, false);
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

function spawnBoardMediaCard(kind, url, name) {
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
        name: name || 'Tài liệu',
        owner: window.USERNAME,
        x: x,
        y: y,
        w: 420,
        h: 340
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
    const url = document.getElementById('youtube-link').value.trim();
    if (!url) return;
    const vid = extractYoutubeId(url);
    if (!vid) {
        if (window.showToast) window.showToast('Vui lòng nhập đúng định dạng link YouTube!');
        return;
    }
    openMediaHubAtCenter(false);
    const item = {
        type: 'youtube',
        kind: 'youtube',
        url: url,
        name: 'YouTube (' + vid + ')',
        sender: window.USERNAME
    };
    renderMediaInHub(item);
    socket.emit('media_share', {
        room_id: ROOM_ID,
        type: 'youtube',
        kind: 'youtube',
        url: url,
        name: item.name,
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
                    spawnBoardMediaCard(kind, data.url, name);
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
