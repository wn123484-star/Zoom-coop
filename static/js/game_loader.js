window.SyncGameModules = window.SyncGameModules || {};
window.ActiveModularGames = window.ActiveModularGames || {};
window.KnownMultiWidgets = window.KnownMultiWidgets || {};
window.RoomGlobalLeaderboards = window.RoomGlobalLeaderboards || {
    snake: {},
    blockblast: {},
    fishing: {},
    drawguess: {}
};

const MODULAR_TYPES_SET = new Set(['fishing', 'snake', 'blockblast', 'drawguess', 'pvz']);

window.updateGlobalGameScore = function(gameType, playerName, scoreVal) {
    if (!gameType || !playerName) return;
    if (!window.RoomGlobalLeaderboards[gameType]) {
        window.RoomGlobalLeaderboards[gameType] = {};
    }
    const prev = window.RoomGlobalLeaderboards[gameType][playerName] || 0;
    if (scoreVal >= prev) {
        window.RoomGlobalLeaderboards[gameType][playerName] = scoreVal;
    }
};

window.getGlobalLeaderboardSorted = function(gameType, localScoresMap) {
    if (!window.RoomGlobalLeaderboards[gameType]) {
        window.RoomGlobalLeaderboards[gameType] = {};
    }
    const merged = Object.assign({}, window.RoomGlobalLeaderboards[gameType]);
    if (localScoresMap && typeof localScoresMap === 'object') {
        Object.entries(localScoresMap).forEach(([u, sc]) => {
            if (!merged[u] || sc > merged[u]) {
                merged[u] = sc;
                window.RoomGlobalLeaderboards[gameType][u] = sc;
            }
        });
    }
    Object.values(window.KnownMultiWidgets).forEach(w => {
        if (w && w.type === gameType && w.game_data) {
            const gd = w.game_data;
            if (gd.scores && typeof gd.scores === 'object') {
                Object.entries(gd.scores).forEach(([u, sc]) => {
                    if (!merged[u] || sc > merged[u]) {
                        merged[u] = sc;
                        window.RoomGlobalLeaderboards[gameType][u] = sc;
                    }
                });
            }
            if (gameType === 'snake' && gd.snakes && typeof gd.snakes === 'object') {
                Object.values(gd.snakes).forEach(sn => {
                    if (sn && sn.name && typeof sn.score === 'number') {
                        if (!merged[sn.name] || sn.score > merged[sn.name]) {
                            merged[sn.name] = sn.score;
                        }
                    }
                });
            }
        }
    });
    return Object.entries(merged).sort((a, b) => b[1] - a[1]);
};

window.SyncTextUtils = {
    removeAccents: function(str) {
        if (!str) return '';
        return String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },
    cleanKeepAccents: function(str) {
        if (!str) return '';
        return String(str)
            .toLowerCase()
            .replace(/[.,!?;:"'()\[\]{}<>\/\\|+-=*~`@#$%^&]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },
    levenshtein: function(a, b) {
        const m = a.length;
        const n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[m][n];
    },
    evaluateGuess: function(guessRaw, targetRaw) {
        const gClean = this.cleanKeepAccents(guessRaw);
        const tClean = this.cleanKeepAccents(targetRaw);
        if (!gClean || !tClean) return { status: 'wrong', similarity: 0 };
        if (gClean === tClean) {
            return { status: 'exact', similarity: 1.0 };
        }
        const gNoAcc = this.removeAccents(guessRaw);
        const tNoAcc = this.removeAccents(targetRaw);
        if (gNoAcc && gNoAcc === tNoAcc) {
            return { status: 'unaccented', similarity: 0.95 };
        }
        const dist = this.levenshtein(gNoAcc, tNoAcc);
        const maxLen = Math.max(gNoAcc.length, tNoAcc.length, 1);
        const sim = Math.max(0, 1 - dist / maxLen);
        const tWords = tNoAcc.split(' ');
        const gWords = gNoAcc.split(' ');
        const matchedWords = tWords.filter(w => gWords.includes(w)).length;
        const wordRatio = tWords.length > 0 ? matchedWords / tWords.length : 0;
        const bestScore = Math.max(sim, wordRatio * 0.9);

        if (bestScore >= 0.82 && dist <= 2) {
            return { status: 'near_accept', similarity: bestScore };
        }
        if (bestScore >= 0.60) {
            return { status: 'close', similarity: bestScore };
        }
        return { status: 'wrong', similarity: bestScore };
    }
};

window.isWidgetCreator = function(wObj) {
    if (!wObj) return true;
    const myId = window.CLIENT_ID || '';
    const myName = window.USERNAME || '';
    if (wObj.creator_id && myId && wObj.creator_id === myId) return true;
    if (wObj.creator && myName && wObj.creator === myName) return true;
    return false;
};

window.canCurrentUserModifyWidget = function(wObj) {
    if (!wObj) return true;
    if (window.isWidgetCreator(wObj)) return true;
    const myId = window.CLIENT_ID || '';
    const myName = window.USERNAME || '';

    const gd = wObj.game_data || {};
    let humanCount = 0;

    if (Array.isArray(gd.seats)) {
        for (let i = 0; i < gd.seats.length; i++) {
            const s = gd.seats[i];
            if (s && s.occupantId && !s.isBot) {
                humanCount++;
                if ((myId && s.occupantId === myId) || (myName && s.occupantName === myName)) return true;
            }
        }
    } else if (gd.seats && typeof gd.seats === 'object') {
        const vals = Object.values(gd.seats);
        for (let i = 0; i < vals.length; i++) {
            const s = vals[i];
            if (s && s.type === 'human' && (s.id || s.name)) {
                humanCount++;
                if ((myId && s.id === myId) || (myName && s.name === myName)) return true;
            }
        }
    }

    if (Array.isArray(gd.players)) {
        for (let i = 0; i < gd.players.length; i++) {
            const p = gd.players[i];
            if (p && !p.isBot) {
                humanCount++;
                if ((myId && p.id === myId) || (myName && p.name === myName)) return true;
            }
        }
    } else if (gd.players && typeof gd.players === 'object') {
        const vals = Object.values(gd.players);
        for (let i = 0; i < vals.length; i++) {
            const p = vals[i];
            if (p && typeof p === 'object') {
                humanCount++;
                if ((myId && p.id === myId) || (myName && p.name === myName)) return true;
            } else if (typeof p === 'string' && p) {
                humanCount++;
                if (myName && p === myName) return true;
            }
        }
    }

    if (gd.snakes && typeof gd.snakes === 'object') {
        const vals = Object.values(gd.snakes);
        for (let i = 0; i < vals.length; i++) {
            const sk = vals[i];
            if (sk && !sk.isBot) {
                humanCount++;
                if ((myId && sk.id === myId) || (myName && sk.name === myName)) return true;
            }
        }
    }

    if (humanCount === 0 && !wObj.creator_id && !wObj.creator) return true;
    return false;
};

(function interceptSocketForModularIsolation() {
    if (typeof socket === 'undefined' || socket._modularPatched) return;
    socket._modularPatched = true;

    const origEmit = socket.emit.bind(socket);
    socket.emit = function(eventName, payload, ...rest) {
        if (eventName === 'multi_widget_event' && payload && typeof payload === 'object') {
            payload.client_id = window.CLIENT_ID || '';
            payload.username = window.USERNAME || '';
            if (payload.widget && typeof payload.widget === 'object') {
                if (!payload.widget.creator_id) payload.widget.creator_id = window.CLIENT_ID || '';
                if (!payload.widget.creator) payload.widget.creator = window.USERNAME || '';
                window.KnownMultiWidgets[payload.widget.id] = payload.widget;
            }
            if (payload.action === 'delete' && payload.id) {
                const known = window.KnownMultiWidgets[payload.id];
                if (known && !window.canCurrentUserModifyWidget(known)) {
                    if (window.showToast) {
                        window.showToast('🔒 Bàn chơi đang có người chơi! Bạn hãy bấm "➕ Bàn Riêng" để mở bàn của mình nhé.');
                    }
                    return;
                }
            }
        }
        return origEmit(eventName, payload, ...rest);
    };
})();

window.registerSyncGameModule = function(gameType, moduleDef) {
    if (!gameType || !moduleDef) return;
    MODULAR_TYPES_SET.add(gameType);
    window.SyncGameModules[gameType] = moduleDef;
};

function purgeDuplicateBlankCardsForId(wid) {
    const allMatches = document.querySelectorAll(`[id="${wid}"]`);
    if (allMatches.length > 1) {
        allMatches.forEach(node => {
            if (!node.classList.contains('modular-game-widget')) {
                node.remove();
            }
        });
    } else if (allMatches.length === 1) {
        const single = allMatches[0];
        if (!single.classList.contains('modular-game-widget') && window.ActiveModularGames[wid]) {
            single.remove();
        }
    }
}

function getSpawnPositionForGame(defaultW, defaultH, referenceEl) {
    if (referenceEl) {
        const rx = parseFloat(referenceEl.style.left) || 2200;
        const ry = parseFloat(referenceEl.style.top) || 2100;
        const rw = parseFloat(referenceEl.style.width) || defaultW;
        return {
            x: Math.round(rx + rw + 28),
            y: Math.round(ry)
        };
    }
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const worldCenter = window.getWorkspaceCoords ? window.getWorkspaceCoords(cx, cy) : { x: 2500, y: 2500 };
    const jitterX = Math.floor((Math.random() - 0.5) * 70);
    const jitterY = Math.floor((Math.random() - 0.5) * 70);
    return {
        x: Math.round(worldCenter.x - defaultW / 2 + jitterX),
        y: Math.round(worldCenter.y - defaultH / 2 + jitterY)
    };
}

window.spawnModularGameOnBoard = function(gameType, referenceEl) {
    const mod = window.SyncGameModules[gameType];
    if (!mod) return false;
    const w = mod.defaultWidth || 880;
    const h = mod.defaultHeight || 620;
    const pos = getSpawnPositionForGame(w, h, referenceEl);
    const wid = 'mw_' + gameType + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const initialData = typeof mod.createInitialData === 'function' ? mod.createInitialData() : {};
    const myName = window.USERNAME || 'Thành viên';
    const widgetObj = {
        id: wid,
        type: gameType,
        title: `${mod.title || '🎮 Bàn Chơi'} — ${myName}`,
        x: pos.x,
        y: pos.y,
        w: w,
        h: h,
        minimized: false,
        creator: myName,
        creator_id: window.CLIENT_ID || '',
        game_data: initialData
    };
    window.KnownMultiWidgets[wid] = widgetObj;
    renderOrUpdateModularWidget(widgetObj, null);
    socket.emit('multi_widget_event', {
        room_id: ROOM_ID,
        action: 'create',
        widget: widgetObj
    });
    if (window.closeAllPopovers) window.closeAllPopovers();
    if (referenceEl && window.showToast) {
        window.showToast(`➕ Đã mở một bàn ${mod.title} riêng cho bạn ngay bên cạnh!`);
    }
    return true;
};

function bindModularWidgetFrameEvents(el, widgetObj) {
    const header = el.querySelector('.widget-header');
    const cloneBtn = el.querySelector('.mod-clone-btn');
    const minBtn = el.querySelector('.mod-min-btn');
    const closeBtn = el.querySelector('.mod-close-btn');
    const wid = widgetObj.id;

    if (cloneBtn) {
        window.bindSafeButton(cloneBtn, () => {
            window.spawnModularGameOnBoard(widgetObj.type, el);
        });
    }

    if (minBtn) {
        window.bindSafeButton(minBtn, () => {
            const isMin = el.classList.toggle('minimized');
            socket.emit('multi_widget_event', {
                room_id: ROOM_ID,
                action: 'update',
                id: wid,
                minimized: isMin
            });
        });
    }

    if (closeBtn) {
        window.bindSafeButton(closeBtn, () => {
            const latestObj = window.KnownMultiWidgets[wid] || widgetObj;
            if (!window.canCurrentUserModifyWidget(latestObj)) {
                if (window.showToast) {
                    window.showToast('🔒 Bàn này đang có người chơi! Hãy bấm "➕ Bàn Riêng" nếu bạn muốn tạo bàn mới.');
                }
                return;
            }
            if (!confirm('Đóng và xóa bàn chơi này khỏi mặt bảng?')) return;
            cleanupModularWidget(wid);
            socket.emit('multi_widget_event', {
                room_id: ROOM_ID,
                action: 'delete',
                id: wid
            });
        });
    }

    if (header) {
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let origX = 0;
        let origY = 0;
        let lastSync = 0;

        header.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
            e.preventDefault();
            e.stopPropagation();
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = parseFloat(el.style.left) || 0;
            origY = parseFloat(el.style.top) || 0;
            if (header.setPointerCapture) {
                try { header.setPointerCapture(e.pointerId); } catch (err) {}
            }
        });

        header.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            e.stopPropagation();
            const scale = window.workspaceScale || 1;
            const nx = Math.round(origX + (e.clientX - startX) / scale);
            const ny = Math.round(origY + (e.clientY - startY) / scale);
            el.style.left = nx + 'px';
            el.style.top = ny + 'px';
            const now = Date.now();
            if (now - lastSync > 65) {
                lastSync = now;
                socket.emit('multi_widget_event', {
                    room_id: ROOM_ID,
                    action: 'update',
                    id: wid,
                    x: nx,
                    y: ny
                });
            }
        });

        const endDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            if (e && header.releasePointerCapture) {
                try { header.releasePointerCapture(e.pointerId); } catch (err) {}
            }
            socket.emit('multi_widget_event', {
                room_id: ROOM_ID,
                action: 'update',
                id: wid,
                x: parseFloat(el.style.left) || 0,
                y: parseFloat(el.style.top) || 0
            });
            if (window.refreshViewportCulling) window.refreshViewportCulling();
        };
        header.addEventListener('pointerup', endDrag);
        header.addEventListener('pointercancel', endDrag);
    }

    if (window.makeWidgetResizable) {
        const mod = window.SyncGameModules[widgetObj.type] || {};
        window.makeWidgetResizable(el, mod.minWidth || 500, mod.minHeight || 400, true, (nw, nh) => {
            widgetObj.w = nw;
            widgetObj.h = nh;
            const inst = window.ActiveModularGames[wid];
            if (inst && typeof inst.onResize === 'function') {
                inst.onResize(nw, nh);
            }
            socket.emit('multi_widget_event', {
                room_id: ROOM_ID,
                action: 'update',
                id: wid,
                w: nw,
                h: nh
            });
        });
    }
}

function cleanupModularWidget(wid) {
    const inst = window.ActiveModularGames[wid];
    if (inst && typeof inst.destroy === 'function') {
        try { inst.destroy(); } catch (e) {}
    }
    delete window.ActiveModularGames[wid];
    delete window.KnownMultiWidgets[wid];
    document.querySelectorAll(`[id="${wid}"]`).forEach(el => el.remove());
}

function renderOrUpdateModularWidget(widgetObj, animPayload) {
    if (!widgetObj || !widgetObj.id || !widgetObj.type) return false;
    window.KnownMultiWidgets[widgetObj.id] = widgetObj;
    const mod = window.SyncGameModules[widgetObj.type];
    if (!mod) return false;

    const gamesLayer = document.getElementById('games-layer');
    if (!gamesLayer) return false;

    purgeDuplicateBlankCardsForId(widgetObj.id);

    let el = document.querySelector(`.modular-game-widget[id="${widgetObj.id}"]`);
    if (!el) {
        el = document.createElement('div');
        el.id = widgetObj.id;
        el.className = `board-widget glass-effect modular-game-widget mod-${widgetObj.type}-widget`;
        el.style.left = (widgetObj.x || 2200) + 'px';
        el.style.top = (widgetObj.y || 2100) + 'px';
        el.style.width = (widgetObj.w || mod.defaultWidth || 880) + 'px';
        el.style.height = (widgetObj.h || mod.defaultHeight || 620) + 'px';

        el.innerHTML = `
            <div class="widget-header">
                <span class="widget-title">${widgetObj.title || mod.title || '🎮 Bàn Chơi'}</span>
                <div class="widget-controls">
                    <span class="mod-header-extra"></span>
                    <button type="button" class="widget-btn mod-clone-btn" style="background:rgba(46,213,115,0.2); color:#2ed573; border-color:#2ed573;" title="Tạo một bàn chơi riêng bên cạnh để bạn chơi độc lập mà không ảnh hưởng bàn này">➕ Bàn Riêng</button>
                    <button type="button" class="widget-btn mod-min-btn" title="Thu gọn hoặc Mở rộng">—</button>
                    <button type="button" class="widget-btn close mod-close-btn" title="Đóng bàn chơi (Chỉ chủ bàn / người đang chơi)">✕</button>
                </div>
            </div>
            <div class="widget-body modular-widget-body"></div>
            <div class="widget-resizer" title="Kéo giãn để mở rộng không gian bàn chơi"></div>
        `;
        gamesLayer.appendChild(el);
        bindModularWidgetFrameEvents(el, widgetObj);

        const bodyEl = el.querySelector('.modular-widget-body');
        const headerExtraEl = el.querySelector('.mod-header-extra');
        if (typeof mod.mount === 'function') {
            window.ActiveModularGames[widgetObj.id] = mod.mount({
                id: widgetObj.id,
                widgetEl: el,
                bodyEl: bodyEl,
                headerExtraEl: headerExtraEl,
                widgetObj: widgetObj,
                emitUpdate: (newGameData, animData, echoSelf) => {
                    widgetObj.game_data = newGameData;
                    window.KnownMultiWidgets[widgetObj.id] = widgetObj;
                    socket.emit('multi_widget_event', {
                        room_id: ROOM_ID,
                        action: 'update',
                        id: widgetObj.id,
                        game_data: newGameData,
                        anim: animData || null,
                        echo: echoSelf === true
                    });
                }
            });
        }
    } else {
        const prevW = parseFloat(el.style.width) || 0;
        const prevH = parseFloat(el.style.height) || 0;
        if (typeof widgetObj.x === 'number') el.style.left = widgetObj.x + 'px';
        if (typeof widgetObj.y === 'number') el.style.top = widgetObj.y + 'px';
        if (typeof widgetObj.w === 'number') el.style.width = widgetObj.w + 'px';
        if (typeof widgetObj.h === 'number') el.style.height = widgetObj.h + 'px';
        el.classList.toggle('minimized', !!widgetObj.minimized);
        const inst = window.ActiveModularGames[widgetObj.id];
        if (inst) {
            if (typeof widgetObj.w === 'number' && typeof widgetObj.h === 'number' && (Math.abs(widgetObj.w - prevW) > 5 || Math.abs(widgetObj.h - prevH) > 5)) {
                if (typeof inst.onResize === 'function') {
                    inst.onResize(widgetObj.w, widgetObj.h);
                }
            }
            if (typeof inst.onSync === 'function') {
                inst.onSync(widgetObj.game_data || {}, animPayload || null, widgetObj);
            }
        }
    }
    setTimeout(() => purgeDuplicateBlankCardsForId(widgetObj.id), 10);
    return true;
}

window.registerSyncGameModule('pvz', {
    title: '🌻 Plants vs Zombies (71 Cấp Độ Co-op)',
    defaultWidth: 940,
    defaultHeight: 640,
    minWidth: 640,
    minHeight: 460,
    createInitialData: function() {
        return {
            url: '/static/custom_games/plants_vs_zombies_71_levels_ver7_2_complete.html',
            seed: Math.floor(Math.random() * 999999) + 1,
            allowCoopClick: true,
            owner: window.USERNAME || 'Thành viên',
            ownerId: window.CLIENT_ID || ''
        };
    },
    mount: function(ctx) {
        const { id, bodyEl, widgetObj, emitUpdate } = ctx;
        let state = (widgetObj.game_data && widgetObj.game_data.url)
            ? JSON.parse(JSON.stringify(widgetObj.game_data))
            : this.createInitialData();

        bodyEl.innerHTML = `
        <div class="arcade-root">
            <div class="arcade-top-bar">
                <div class="arcade-group">
                    <span class="arcade-pill">🌻 Chủ bàn: <b class="pvz-owner-lbl">${state.owner || 'Thành viên'}</b></span>
                    <button type="button" class="arcade-btn green pvz-coop-toggle">🤝 Co-op: MỌI NGƯỜI CÙNG CHƠI</button>
                    <button type="button" class="arcade-btn pvz-reload-btn">🔄 Đồng Bộ Lại Màn</button>
                </div>
                <div class="arcade-group">
                    <button type="button" class="arcade-btn gold pvz-upload-html-btn" title="Chọn tệp .html từ máy nếu bạn chưa chép vào static/custom_games">📂 Chọn Tệp HTML Khác</button>
                    <input type="file" class="pvz-file-inp" accept=".html,.htm" style="display:none;">
                </div>
            </div>
            <div class="pvz-stage-wrap">
                <iframe class="pvz-iframe" allow="autoplay; fullscreen"></iframe>
                <div class="pvz-cursor-layer"></div>
            </div>
        </div>`;

        const iframe = bodyEl.querySelector('.pvz-iframe');
        const cursorLayer = bodyEl.querySelector('.pvz-cursor-layer');
        const btnCoopToggle = bodyEl.querySelector('.pvz-coop-toggle');
        const btnReload = bodyEl.querySelector('.pvz-reload-btn');
        const btnUploadHtml = bodyEl.querySelector('.pvz-upload-html-btn');
        const fileInp = bodyEl.querySelector('.pvz-file-inp');

        const remoteCursors = {};
        let isCreator = window.isWidgetCreator(widgetObj);

        function updateCoopBtnUI() {
            btnCoopToggle.classList.toggle('green', !!state.allowCoopClick);
            btnCoopToggle.textContent = state.allowCoopClick
                ? '🤝 Co-op: CẢ PHÒNG CÙNG TRỒNG CÂY'
                : '🔒 Chế độ: CHỈ CHỦ BÀN ĐIỀU KHIỂN';
        }
        updateCoopBtnUI();

        window.bindSafeButton(btnCoopToggle, () => {
            if (!window.isWidgetCreator(widgetObj)) {
                if (window.showToast) window.showToast('🔒 Chỉ chủ bàn mới được bật/tắt quyền Co-op!');
                return;
            }
            state.allowCoopClick = !state.allowCoopClick;
            updateCoopBtnUI();
            emitUpdate(state, null, false);
        });

        window.bindSafeButton(btnReload, () => {
            state.seed = Math.floor(Math.random() * 999999) + 1;
            loadPvzIframe();
            emitUpdate(state, { type: 'reload', seed: state.seed }, false);
        });

        window.bindSafeButton(btnUploadHtml, () => {
            fileInp.click();
        });

        fileInp.addEventListener('change', () => {
            if (!fileInp.files || !fileInp.files[0]) return;
            const fd = new FormData();
            fd.append('file', fileInp.files[0]);
            fetch('/upload', { method: 'POST', body: fd })
                .then(r => r.json())
                .then(res => {
                    if (res && res.url) {
                        state.url = res.url;
                        state.seed = Math.floor(Math.random() * 999999) + 1;
                        loadPvzIframe();
                        emitUpdate(state, { type: 'reload', seed: state.seed }, false);
                        if (window.showToast) window.showToast('🌻 Đã nạp tệp Game HTML lên bàn Co-op!');
                    }
                });
        });

        function injectCoopBridgeIntoIframe() {
            try {
                const win = iframe.contentWindow;
                const doc = iframe.contentDocument || (win && win.document);
                if (!win || !doc || win._pvzCoopInjected) return;
                win._pvzCoopInjected = true;

                let sVal = state.seed || 123456;
                win.Math.random = function() {
                    sVal = (sVal * 1664525 + 1013904223) % 4294967296;
                    return sVal / 4294967296;
                };

                let lastMoveSend = 0;
                doc.addEventListener('pointermove', (e) => {
                    const now = Date.now();
                    if (now - lastMoveSend < 55) return;
                    lastMoveSend = now;
                    const w = Math.max(1, win.innerWidth);
                    const h = Math.max(1, win.innerHeight);
                    socket.emit('html_coop_event', {
                        room_id: ROOM_ID,
                        widget_id: id,
                        sender_id: window.CLIENT_ID,
                        username: window.USERNAME || 'Thành viên',
                        ev_type: 'move',
                        rx: Number((e.clientX / w).toFixed(4)),
                        ry: Number((e.clientY / h).toFixed(4))
                    });
                }, true);

                ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(evName => {
                    doc.addEventListener(evName, (e) => {
                        if (e._fromCoopRemote) return;
                        if (!state.allowCoopClick && !window.isWidgetCreator(widgetObj)) {
                            e.stopPropagation();
                            e.preventDefault();
                            if (window.showToast && evName === 'pointerdown') {
                                window.showToast('👀 Bạn đang ở chế độ Khán giả / Trọng tài! Bấm "➕ Bàn Riêng" nếu muốn chơi màn riêng.');
                            }
                            return;
                        }
                        const w = Math.max(1, win.innerWidth);
                        const h = Math.max(1, win.innerHeight);
                        socket.emit('html_coop_event', {
                            room_id: ROOM_ID,
                            widget_id: id,
                            sender_id: window.CLIENT_ID,
                            username: window.USERNAME || 'Thành viên',
                            ev_type: evName,
                            rx: Number((e.clientX / w).toFixed(4)),
                            ry: Number((e.clientY / h).toFixed(4)),
                            button: e.button || 0
                        });
                    }, true);
                });

                doc.addEventListener('keydown', (e) => {
                    if (e._fromCoopRemote) return;
                    if (!state.allowCoopClick && !window.isWidgetCreator(widgetObj)) return;
                    socket.emit('html_coop_event', {
                        room_id: ROOM_ID,
                        widget_id: id,
                        sender_id: window.CLIENT_ID,
                        username: window.USERNAME || 'Thành viên',
                        ev_type: 'keydown',
                        key: e.key,
                        code: e.code,
                        keyCode: e.keyCode
                    });
                }, true);
            } catch (err) {}
        }

        function handleIncomingCoopEvent(data) {
            if (!data || data.widget_id !== id || data.sender_id === window.CLIENT_ID) return;
            const stageRect = cursorLayer.getBoundingClientRect();
            const px = (data.rx || 0.5) * stageRect.width;
            const py = (data.ry || 0.5) * stageRect.height;

            let rc = remoteCursors[data.sender_id];
            if (!rc) {
                rc = document.createElement('div');
                rc.className = 'pvz-remote-cursor';
                rc.innerHTML = `<div class="rc-dot"></div><div class="rc-tag"></div>`;
                cursorLayer.appendChild(rc);
                remoteCursors[data.sender_id] = rc;
            }
            rc.style.left = px + 'px';
            rc.style.top = py + 'px';
            rc.querySelector('.rc-tag').textContent = data.username || 'Đồng đội';

            if (data.ev_type === 'pointerdown' || data.ev_type === 'click') {
                rc.classList.add('clicking');
                setTimeout(() => rc.classList.remove('clicking'), 220);
            }

            try {
                const win = iframe.contentWindow;
                const doc = iframe.contentDocument || (win && win.document);
                if (!win || !doc) return;
                if (data.ev_type === 'keydown') {
                    const ke = new KeyboardEvent('keydown', { key: data.key, code: data.code, keyCode: data.keyCode, bubbles: true });
                    ke._fromCoopRemote = true;
                    doc.dispatchEvent(ke);
                } else if (data.ev_type !== 'move') {
                    const cx = (data.rx || 0.5) * win.innerWidth;
                    const cy = (data.ry || 0.5) * win.innerHeight;
                    const targetEl = doc.elementFromPoint(cx, cy) || doc.body;
                    if (targetEl) {
                        const me = new MouseEvent(data.ev_type === 'pointerdown' ? 'mousedown' : data.ev_type, {
                            bubbles: true,
                            cancelable: true,
                            clientX: cx,
                            clientY: cy,
                            button: data.button || 0
                        });
                        me._fromCoopRemote = true;
                        targetEl.dispatchEvent(me);
                    }
                }
            } catch (err) {}
        }

        socket.on('html_coop_event', handleIncomingCoopEvent);

        function loadPvzIframe() {
            iframe.onload = () => {
                injectCoopBridgeIntoIframe();
            };
            iframe.src = state.url + (state.url.includes('?') ? '&' : '?') + 'seed=' + (state.seed || 1);
        }

        loadPvzIframe();

        return {
            onSync: function(remoteData, animPayload) {
                if (!remoteData) return;
                const urlChanged = remoteData.url && remoteData.url !== state.url;
                const seedChanged = animPayload && animPayload.type === 'reload';
                state = Object.assign(state, remoteData);
                updateCoopBtnUI();
                if (urlChanged || seedChanged) {
                    loadPvzIframe();
                }
            },
            destroy: function() {
                socket.off('html_coop_event', handleIncomingCoopEvent);
            }
        };
    }
});

document.querySelectorAll('.create-mod-game-btn').forEach(btn => {
    window.bindSafeButton(btn, () => {
        const gType = btn.getAttribute('data-game-type');
        if (gType && window.SyncGameModules[gType]) {
            window.spawnModularGameOnBoard(gType, null);
        }
    });
});

document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const card = btn.closest('.board-widget');
    if (!card || !card.id || card.classList.contains('modular-game-widget')) return;
    const known = window.KnownMultiWidgets[card.id];
    if (!known) return;
    const txt = (btn.textContent || '').trim();
    if (txt.includes('Ván mới') || btn.classList.contains('close') || txt === '✕') {
        if (!window.canCurrentUserModifyWidget(known)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (window.showToast) {
                window.showToast('🔒 Chỉ người tạo bàn hoặc người đang ngồi chơi mới được làm mới / xóa bàn này!');
            }
        }
    }
}, true);

if (typeof socket !== 'undefined') {
    socket.on('room_state', (data) => {
        if (!data || !Array.isArray(data.multi_widgets)) return;
        const activeModIds = new Set();
        data.multi_widgets.forEach(w => {
            if (w && w.id) {
                window.KnownMultiWidgets[w.id] = w;
            }
            if (w && w.type && (window.SyncGameModules[w.type] || MODULAR_TYPES_SET.has(w.type))) {
                activeModIds.add(w.id);
                renderOrUpdateModularWidget(w, null);
            }
        });
        Object.keys(window.ActiveModularGames).forEach(wid => {
            if (!activeModIds.has(wid)) {
                cleanupModularWidget(wid);
            }
        });
    });

    socket.on('multi_widget_synced', (payload) => {
        if (!payload) return;
        if (payload.widget && payload.widget.id) {
            window.KnownMultiWidgets[payload.widget.id] = payload.widget;
        }
        if (payload.action === 'create' && payload.widget) {
            if (window.SyncGameModules[payload.widget.type] || MODULAR_TYPES_SET.has(payload.widget.type)) {
                renderOrUpdateModularWidget(payload.widget, payload.anim);
            }
        } else if (payload.action === 'update' && payload.widget) {
            if (window.SyncGameModules[payload.widget.type] || MODULAR_TYPES_SET.has(payload.widget.type)) {
                renderOrUpdateModularWidget(payload.widget, payload.anim);
            }
        } else if (payload.action === 'delete' && payload.id) {
            delete window.KnownMultiWidgets[payload.id];
            if (window.ActiveModularGames[payload.id]) {
                cleanupModularWidget(payload.id);
            }
        }
    });
}
