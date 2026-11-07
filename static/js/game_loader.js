window.SyncGameModules = window.SyncGameModules || {};
window.ActiveModularGames = window.ActiveModularGames || {};

window.registerSyncGameModule = function(gameType, moduleDef) {
    if (!gameType || !moduleDef) return;
    window.SyncGameModules[gameType] = moduleDef;
};

window.loadExternalGameAssets = function(gameType) {
    const cssId = 'mod-css-' + gameType;
    if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = `/static/games/${gameType}/${gameType}.css?v=30`;
        document.head.appendChild(link);
    }
};

function getSpawnPositionForGame(defaultW, defaultH) {
    const scale = window.workspaceScale || 1;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const worldCenter = window.getWorkspaceCoords ? window.getWorkspaceCoords(cx, cy) : { x: 2500, y: 2500 };
    const jitterX = Math.floor((Math.random() - 0.5) * 90);
    const jitterY = Math.floor((Math.random() - 0.5) * 90);
    return {
        x: Math.round(worldCenter.x - defaultW / 2 + jitterX),
        y: Math.round(worldCenter.y - defaultH / 2 + jitterY)
    };
}

window.spawnModularGameOnBoard = function(gameType) {
    const mod = window.SyncGameModules[gameType];
    if (!mod) return false;
    const w = mod.defaultWidth || 880;
    const h = mod.defaultHeight || 640;
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
        game_data: initialData
    };
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
            if (now - lastSync > 45) {
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
        window.makeWidgetResizable(el, mod.minWidth || 520, mod.minHeight || 420, true, (nw, nh) => {
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
    const el = document.getElementById(wid);
    if (el) el.remove();
}

function renderOrUpdateModularWidget(widgetObj, animPayload) {
    if (!widgetObj || !widgetObj.id || !widgetObj.type) return false;
    const mod = window.SyncGameModules[widgetObj.type];
    if (!mod) return false;

    const gamesLayer = document.getElementById('games-layer');
    if (!gamesLayer) return false;

    let el = document.getElementById(widgetObj.id);
    if (!el) {
        el = document.createElement('div');
        el.id = widgetObj.id;
        el.className = `board-widget glass-effect modular-game-widget mod-${widgetObj.type}-widget`;
        el.style.left = (widgetObj.x || 2200) + 'px';
        el.style.top = (widgetObj.y || 2100) + 'px';
        el.style.width = (widgetObj.w || mod.defaultWidth || 880) + 'px';
        el.style.height = (widgetObj.h || mod.defaultHeight || 640) + 'px';

        el.innerHTML = `
            <div class="widget-header">
                <span class="widget-title">${widgetObj.title || mod.title || '🎮 Bàn Chơi'}</span>
                <div class="widget-controls">
                    <span class="mod-header-extra"></span>
                    <button type="button" class="widget-btn mod-min-btn" title="Thu gọn hoặc Mở rộng">—</button>
                    <button type="button" class="widget-btn close mod-close-btn" title="Đóng bàn chơi">✕</button>
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
                    socket.emit('multi_widget_event', {
                        room_id: ROOM_ID,
                        action: 'update',
                        id: widgetObj.id,
                        game_data: newGameData,
                        anim: animData || null,
                        echo: echoSelf !== false
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
    return true;
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.create-multi-game-btn');
    if (!btn) return;
    const gType = btn.getAttribute('data-game-type');
    if (gType && window.SyncGameModules[gType]) {
        e.preventDefault();
        e.stopPropagation();
        window.spawnModularGameOnBoard(gType);
    }
}, true);

if (typeof socket !== 'undefined') {
    socket.on('room_state', (data) => {
        if (!data || !Array.isArray(data.multi_widgets)) return;
        const activeIds = new Set();
        data.multi_widgets.forEach(w => {
            if (w && w.type && window.SyncGameModules[w.type]) {
                activeIds.add(w.id);
                renderOrUpdateModularWidget(w, null);
            }
        });
        Object.keys(window.ActiveModularGames).forEach(wid => {
            if (!activeIds.has(wid)) {
                cleanupModularWidget(wid);
            }
        });
    });

    socket.on('multi_widget_synced', (payload) => {
        if (!payload) return;
        if (payload.action === 'create' && payload.widget) {
            if (window.SyncGameModules[payload.widget.type]) {
                renderOrUpdateModularWidget(payload.widget, payload.anim);
            }
        } else if (payload.action === 'update' && payload.widget) {
            if (window.SyncGameModules[payload.widget.type]) {
                renderOrUpdateModularWidget(payload.widget, payload.anim);
            }
        } else if (payload.action === 'delete' && payload.id) {
            if (window.ActiveModularGames[payload.id]) {
                cleanupModularWidget(payload.id);
            }
        }
    });
}
