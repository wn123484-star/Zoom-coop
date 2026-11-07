window.SyncGameModules = window.SyncGameModules || {};
window.ActiveModularGames = window.ActiveModularGames || {};
window.KnownMultiWidgets = window.KnownMultiWidgets || {};

const MODULAR_TYPES_SET = new Set(['fishing', 'snake', 'blockblast', 'drawguess']);

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

        if (bestScore >= 0.84 && dist <= 2) {
            return { status: 'near_accept', similarity: bestScore };
        }
        if (bestScore >= 0.62) {
            return { status: 'close', similarity: bestScore };
        }
        return { status: 'wrong', similarity: bestScore };
    }
};

window.canCurrentUserModifyWidget = function(wObj) {
    if (!wObj) return true;
    const myId = window.CLIENT_ID || '';
    const myName = window.USERNAME || '';
    if (wObj.creator_id && myId && wObj.creator_id === myId) return true;
    if (wObj.creator && myName && wObj.creator === myName) return true;

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
                        window.showToast('🔒 Chỉ người tạo bàn hoặc người đang ngồi chơi mới được đóng bàn này!');
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

function getSpawnPositionForGame(defaultW, defaultH) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const worldCenter = window.getWorkspaceCoords ? window.getWorkspaceCoords(cx, cy) : { x: 2500, y: 2500 };
    const jitterX = Math.floor((Math.random() - 0.5) * 80);
    const jitterY = Math.floor((Math.random() - 0.5) * 80);
    return {
        x: Math.round(worldCenter.x - defaultW / 2 + jitterX),
        y: Math.round(worldCenter.y - defaultH / 2 + jitterY)
    };
}

window.spawnModularGameOnBoard = function(gameType) {
    const mod = window.SyncGameModules[gameType];
    if (!mod) return false;
    const w = mod.defaultWidth || 880;
    const h = mod.defaultHeight || 620;
    const pos = getSpawnPositionForGame(w, h);
    const wid = 'mw_' + gameType + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const initialData = typeof mod.createInitialData === 'function' ? mod.createInitialData() : {};
    const widgetObj = {
        id: wid,
        type: gameType,
        title: mod.title || '🎮 Bàn Chơi Mới',
        x: pos.x,
        y: pos.y,
        w: w,
        h: h,
        minimized: false,
        creator: window.USERNAME || 'Thành viên',
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
    return true;
};

function bindModularWidgetFrameEvents(el, widgetObj) {
    const header = el.querySelector('.widget-header');
    const minBtn = el.querySelector('.mod-min-btn');
    const closeBtn = el.querySelector('.mod-close-btn');
    const wid = widgetObj.id;

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
                    window.showToast('🔒 Bạn không ngồi chơi trong bàn này nên không thể đóng bàn của người khác!');
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
            if (now - lastSync > 60) {
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
            socket.emit('multi_widget_event', {
                room_id: ROOM_ID,
                action: 'update',
                id: wid,
                w: nw,
                h: nh
            });
            const inst = window.ActiveModularGames[wid];
            if (inst && typeof inst.onResize === 'function') {
                inst.onResize(nw, nh);
            }
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

        const ownerTag = widgetObj.creator ? `<small style="opacity:0.75; font-size:10px; margin-left:6px;">(Chủ bàn: ${widgetObj.creator})</small>` : '';
        el.innerHTML = `
            <div class="widget-header">
                <span class="widget-title">${widgetObj.title || mod.title || '🎮 Bàn Chơi'}${ownerTag}</span>
                <div class="widget-controls">
                    <span class="mod-header-extra"></span>
                    <button type="button" class="widget-btn mod-min-btn" title="Thu gọn hoặc Mở rộng">—</button>
                    <button type="button" class="widget-btn close mod-close-btn" title="Đóng bàn chơi (Chỉ người chơi trong bàn)">✕</button>
                </div>
            </div>
            <div class="widget-body modular-widget-body"></div>
            <div class="widget-resizer" title="Kéo để chỉnh kích thước bàn chơi"></div>
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
        if (typeof widgetObj.x === 'number') el.style.left = widgetObj.x + 'px';
        if (typeof widgetObj.y === 'number') el.style.top = widgetObj.y + 'px';
        if (typeof widgetObj.w === 'number') el.style.width = widgetObj.w + 'px';
        if (typeof widgetObj.h === 'number') el.style.height = widgetObj.h + 'px';
        el.classList.toggle('minimized', !!widgetObj.minimized);
        const inst = window.ActiveModularGames[widgetObj.id];
        if (inst && typeof inst.onSync === 'function') {
            inst.onSync(widgetObj.game_data || {}, animPayload || null, widgetObj);
        }
    }
    setTimeout(() => purgeDuplicateBlankCardsForId(widgetObj.id), 10);
    return true;
}

document.querySelectorAll('.create-mod-game-btn').forEach(btn => {
    window.bindSafeButton(btn, () => {
        const gType = btn.getAttribute('data-game-type');
        if (gType && window.SyncGameModules[gType]) {
            window.spawnModularGameOnBoard(gType);
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
