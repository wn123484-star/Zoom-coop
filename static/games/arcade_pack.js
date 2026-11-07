(function() {
    if (typeof window.registerSyncGameModule !== 'function') return;

    const SNAKE_COLORS = ['#00d2ff', '#2ed573', '#ff4757', '#feca57', '#a55eea', '#ff6b81', '#00f5d4', '#ffa502'];
    const POWERUP_TYPES = [
        { type: 'speed', emoji: '⚡', color: '#feca57', label: 'Tăng Tốc 5s' },
        { type: 'magnet', emoji: '🧲', color: '#00d2ff', label: 'Nam Châm Hút Ngọc' },
        { type: 'star', emoji: '💎', color: '#ff6b81', label: '+60 Điểm' }
    ];

    function makeFoodItem(w, h, forcePowerup) {
        if (forcePowerup || Math.random() < 0.12) {
            const p = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
            return {
                x: Math.round(35 + Math.random() * Math.max(100, w - 70)),
                y: Math.round(35 + Math.random() * Math.max(100, h - 70)),
                r: 9,
                val: p.type === 'star' ? 6 : 2,
                color: p.color,
                power: p.type,
                emoji: p.emoji
            };
        }
        const tier = Math.floor(Math.random() * 3);
        return {
            x: Math.round(28 + Math.random() * Math.max(100, w - 56)),
            y: Math.round(28 + Math.random() * Math.max(100, h - 56)),
            r: 4.5 + tier * 1.8,
            val: 1 + tier,
            color: SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)]
        };
    }

    function createInitialSnakeData() {
        const foods = [];
        for (let i = 0; i < 42; i++) {
            foods.push(makeFoodItem(820, 460, i < 4));
        }
        return {
            snakes: {},
            foods: foods,
            scores: {}
        };
    }

    function mountSnakeGame(ctx) {
        const { bodyEl, widgetObj, emitUpdate } = ctx;
        bodyEl.innerHTML = `
        <div class="arcade-root">
            <div class="arcade-top-bar">
                <div class="arcade-group">
                    <span class="arcade-pill">🐍 Điểm của bạn: <b class="sn-my-score">0</b></span>
                    <button type="button" class="arcade-btn green sn-join-btn">▶️ Vào Chơi / Hồi Sinh</button>
                    <button type="button" class="arcade-btn gold sn-boost-btn">⚡ Tăng Tốc (Giữ Chuột)</button>
                </div>
                <div class="arcade-group">
                    <button type="button" class="arcade-btn sn-bot-btn">🤖 +Bot Rắn</button>
                    <button type="button" class="arcade-btn danger sn-clear-bot-btn">🧹 Xóa Bot</button>
                </div>
            </div>
            <div class="snake-stage-wrap">
                <canvas class="snake-canvas" width="820" height="460"></canvas>
                <div class="snake-leaderboard"></div>
            </div>
        </div>`;

        const stageWrapEl = bodyEl.querySelector('.snake-stage-wrap');
        const canvas = bodyEl.querySelector('.snake-canvas');
        const sCtx = canvas.getContext('2d', { alpha: false });
        const myScoreEl = bodyEl.querySelector('.sn-my-score');
        const lbEl = bodyEl.querySelector('.snake-leaderboard');
        const btnJoin = bodyEl.querySelector('.sn-join-btn');
        const btnBoost = bodyEl.querySelector('.sn-boost-btn');
        const btnBot = bodyEl.querySelector('.sn-bot-btn');
        const btnClearBot = bodyEl.querySelector('.sn-clear-bot-btn');

        let arenaW = 820;
        let arenaH = 460;

        function syncArenaDimensions() {
            const rect = stageWrapEl.getBoundingClientRect();
            const scale = window.workspaceScale || 1;
            const rawW = Math.round((rect.width / scale) || stageWrapEl.clientWidth || 820);
            const rawH = Math.round((rect.height / scale) || stageWrapEl.clientHeight || 460);
            const nextW = Math.max(640, Math.min(2200, rawW));
            const nextH = Math.max(360, Math.min(1500, rawH));
            if (Math.abs(nextW - arenaW) > 6 || Math.abs(nextH - arenaH) > 6) {
                arenaW = nextW;
                arenaH = nextH;
                canvas.width = arenaW;
                canvas.height = arenaH;
            }
        }

        let state = (widgetObj.game_data && widgetObj.game_data.snakes)
            ? JSON.parse(JSON.stringify(widgetObj.game_data))
            : createInitialSnakeData();

        const myId = window.CLIENT_ID || 'user_' + Math.floor(Math.random() * 9999);
        let pointerAngle = 0;
        let boosting = false;
        let speedBuffUntil = 0;
        let magnetBuffUntil = 0;
        let dashParticles = [];
        let lastSync = 0;
        let pulsePhase = 0;
        let destroyed = false;
        let rafId = null;

        function spawnSnakeEntity(id, name, isBot, colorIdx) {
            const sx = 100 + Math.random() * Math.max(120, arenaW - 200);
            const sy = 90 + Math.random() * Math.max(100, arenaH - 180);
            const ang = Math.random() * Math.PI * 2;
            const pts = [];
            for (let i = 0; i < 12; i++) {
                pts.push({ x: Math.round(sx - Math.cos(ang) * i * 6), y: Math.round(sy - Math.sin(ang) * i * 6) });
            }
            state.snakes[id] = {
                id: id,
                name: name,
                isBot: !!isBot,
                color: SNAKE_COLORS[colorIdx % SNAKE_COLORS.length],
                angle: ang,
                targetLen: 12,
                score: 0,
                pts: pts
            };
        }

        syncArenaDimensions();
        spawnSnakeEntity(myId, window.USERNAME || 'Thành viên', false, Math.floor(Math.random() * SNAKE_COLORS.length));

        window.bindSafeButton(btnJoin, () => {
            spawnSnakeEntity(myId, window.USERNAME || 'Thành viên', false, Math.floor(Math.random() * SNAKE_COLORS.length));
            emitUpdate(state, null, false);
        });

        window.bindSafeButton(btnBoost, () => {
            boosting = !boosting;
            btnBoost.classList.toggle('active', boosting);
        });

        window.bindSafeButton(btnBot, () => {
            const bid = 'bot_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 99);
            const names = ['Rắn Thần Tốc', 'Mãng Xà Vương', 'Rắn Neon', 'Slither Pro', 'Hổ Mang Chúa'];
            spawnSnakeEntity(bid, names[Object.keys(state.snakes).length % names.length], true, Object.keys(state.snakes).length);
            emitUpdate(state, null, false);
        });

        window.bindSafeButton(btnClearBot, () => {
            Object.keys(state.snakes).forEach(k => {
                if (state.snakes[k].isBot) delete state.snakes[k];
            });
            emitUpdate(state, null, false);
        });

        canvas.addEventListener('pointermove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (arenaW / Math.max(1, rect.width));
            const my = (e.clientY - rect.top) * (arenaH / Math.max(1, rect.height));
            const me = state.snakes[myId];
            if (me && me.pts && me.pts[0]) {
                pointerAngle = Math.atan2(my - me.pts[0].y, mx - me.pts[0].x);
            }
        });

        canvas.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            boosting = true;
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (arenaW / Math.max(1, rect.width));
            const my = (e.clientY - rect.top) * (arenaH / Math.max(1, rect.height));
            const me = state.snakes[myId];
            if (me && me.pts && me.pts[0]) {
                pointerAngle = Math.atan2(my - me.pts[0].y, mx - me.pts[0].x);
            }
        });

        window.addEventListener('pointerup', () => {
            boosting = false;
        });

        function stepSnakeSim(now) {
            pulsePhase += 0.08;
            const ids = Object.keys(state.snakes);
            const isHost = ids.filter(k => !state.snakes[k].isBot)[0] === myId || ids.length === 1;

            ids.forEach(id => {
                const sn = state.snakes[id];
                if (!sn || !sn.pts || sn.pts.length === 0) return;
                if (id !== myId && !(sn.isBot && isHost)) return;

                if (id === myId) {
                    let diff = pointerAngle - sn.angle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    sn.angle += diff * 0.2;
                } else if (sn.isBot) {
                    const head = sn.pts[0];
                    if (head.x < 60 || head.x > arenaW - 60 || head.y < 60 || head.y > arenaH - 60) {
                        const toCenter = Math.atan2(arenaH / 2 - head.y, arenaW / 2 - head.x);
                        sn.angle += (toCenter - sn.angle) * 0.16;
                    } else if (state.foods.length > 0 && Math.random() < 0.14) {
                        const f = state.foods[0];
                        sn.angle = Math.atan2(f.y - head.y, f.x - head.x);
                    }
                }

                const hasSpeedBuff = (id === myId && now < speedBuffUntil);
                const isBoostingNow = (id === myId && (boosting || hasSpeedBuff) && sn.targetLen > 8);
                const spd = isBoostingNow ? 4.6 : 2.7;
                const head = sn.pts[0];
                let nx = head.x + Math.cos(sn.angle) * spd;
                let ny = head.y + Math.sin(sn.angle) * spd;

                if (nx < 12) { nx = 12; sn.angle = Math.PI - sn.angle; }
                if (nx > arenaW - 12) { nx = arenaW - 12; sn.angle = Math.PI - sn.angle; }
                if (ny < 12) { ny = 12; sn.angle = -sn.angle; }
                if (ny > arenaH - 12) { ny = arenaH - 12; sn.angle = -sn.angle; }

                sn.pts.unshift({ x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
                while (sn.pts.length > sn.targetLen) {
                    sn.pts.pop();
                }

                if (isBoostingNow && dashParticles.length < 30) {
                    const tail = sn.pts[sn.pts.length - 1];
                    dashParticles.push({
                        x: tail.x + (Math.random() - 0.5) * 6,
                        y: tail.y + (Math.random() - 0.5) * 6,
                        r: 3.5,
                        color: sn.color,
                        alpha: 0.9
                    });
                }

                const magnetRadius = (id === myId && now < magnetBuffUntil) ? 85 : 16;
                for (let i = state.foods.length - 1; i >= 0; i--) {
                    const fd = state.foods[i];
                    const dist = Math.hypot(fd.x - nx, fd.y - ny);
                    if (dist < magnetRadius + fd.r && dist > 15 + fd.r) {
                        fd.x += (nx - fd.x) * 0.22;
                        fd.y += (ny - fd.y) * 0.22;
                    } else if (dist <= 15 + fd.r) {
                        const addPts = fd.val * 10;
                        sn.score = (sn.score || 0) + addPts;
                        sn.targetLen = Math.min(95, sn.targetLen + fd.val);
                        if (!state.scores) state.scores = {};
                        state.scores[sn.name] = Math.max(state.scores[sn.name] || 0, sn.score);
                        if (window.updateGlobalGameScore) {
                            window.updateGlobalGameScore('snake', sn.name, state.scores[sn.name]);
                        }
                        if (id === myId && fd.power) {
                            if (fd.power === 'speed') speedBuffUntil = now + 5000;
                            if (fd.power === 'magnet') magnetBuffUntil = now + 6500;
                        }
                        state.foods[i] = makeFoodItem(arenaW, arenaH, false);
                    }
                }

                let hitOther = false;
                ids.forEach(otherId => {
                    if (otherId === id) return;
                    const other = state.snakes[otherId];
                    if (!other || !other.pts) return;
                    for (let k = 0; k < other.pts.length; k += 2) {
                        if (Math.hypot(other.pts[k].x - nx, other.pts[k].y - ny) < 11) {
                            hitOther = true;
                            break;
                        }
                    }
                });

                if (hitOther) {
                    for (let k = 0; k < sn.pts.length; k += 3) {
                        if (state.foods.length < 65) {
                            state.foods.push({
                                x: Math.round(sn.pts[k].x),
                                y: Math.round(sn.pts[k].y),
                                r: 7.5,
                                val: 3,
                                color: sn.color
                            });
                        }
                    }
                    delete state.snakes[id];
                    if (id === myId && window.showToast) {
                        window.showToast('💥 Rắn của bạn đã va chạm! Bấm "▶️ Vào Chơi / Hồi Sinh" để tiếp tục!');
                    }
                }
            });

            for (let i = dashParticles.length - 1; i >= 0; i--) {
                dashParticles[i].alpha -= 0.06;
                if (dashParticles[i].alpha <= 0) dashParticles.splice(i, 1);
            }

            const me = state.snakes[myId];
            myScoreEl.textContent = me ? me.score : ((state.scores && state.scores[window.USERNAME]) || 0);

            if (now - lastSync > 130) {
                lastSync = now;
                const globalTop = window.getGlobalLeaderboardSorted
                    ? window.getGlobalLeaderboardSorted('snake', state.scores)
                    : Object.entries(state.scores || {}).sort((a, b) => b[1] - a[1]);

                lbEl.innerHTML = `<div style="color:#00d2ff; font-weight:900; margin-bottom:4px;">🏆 TOP TOÀN PHÒNG</div>` +
                    (globalTop.slice(0, 6).map(([uName, sc], i) => `
                        <div style="display:flex; justify-content:space-between; gap:8px; padding:1px 0;">
                            <span>#${i + 1} <b>${uName}</b></span>
                            <b style="color:#feca57;">${sc}</b>
                        </div>
                    `).join('') || '<div>Chưa có điểm</div>');
                emitUpdate(state, null, false);
            }
        }

        function drawSnakeArena() {
            sCtx.fillStyle = '#060913';
            sCtx.fillRect(0, 0, arenaW, arenaH);

            sCtx.strokeStyle = 'rgba(0, 210, 255, 0.08)';
            sCtx.lineWidth = 1;
            for (let x = 0; x <= arenaW; x += 42) {
                sCtx.beginPath();
                sCtx.moveTo(x, 0);
                sCtx.lineTo(x, arenaH);
                sCtx.stroke();
            }
            for (let y = 0; y <= arenaH; y += 42) {
                sCtx.beginPath();
                sCtx.moveTo(0, y);
                sCtx.lineTo(arenaW, y);
                sCtx.stroke();
            }

            sCtx.strokeStyle = 'rgba(255, 71, 87, 0.45)';
            sCtx.lineWidth = 3;
            sCtx.strokeRect(4, 4, arenaW - 8, arenaH - 8);

            for (let i = 0; i < dashParticles.length; i++) {
                const dp = dashParticles[i];
                sCtx.save();
                sCtx.globalAlpha = Math.max(0, dp.alpha);
                sCtx.fillStyle = dp.color;
                sCtx.beginPath();
                sCtx.arc(dp.x, dp.y, dp.r, 0, Math.PI * 2);
                sCtx.fill();
                sCtx.restore();
            }

            const pulseScale = 1 + Math.sin(pulsePhase) * 0.16;
            for (let i = 0; i < state.foods.length; i++) {
                const f = state.foods[i];
                if (f.emoji) {
                    sCtx.font = '15px sans-serif';
                    sCtx.textAlign = 'center';
                    sCtx.textBaseline = 'middle';
                    sCtx.fillText(f.emoji, f.x, f.y);
                } else {
                    sCtx.fillStyle = f.color;
                    sCtx.beginPath();
                    sCtx.arc(f.x, f.y, f.r * pulseScale, 0, Math.PI * 2);
                    sCtx.fill();
                }
            }

            Object.values(state.snakes).forEach(sn => {
                if (!sn.pts || sn.pts.length === 0) return;
                for (let i = sn.pts.length - 1; i >= 0; i--) {
                    const p = sn.pts[i];
                    const rad = i === 0 ? 10.5 : Math.max(5.2, 9.2 - (i / sn.pts.length) * 3.5);
                    sCtx.fillStyle = (i % 2 === 0) ? sn.color : '#ffffff33';
                    sCtx.beginPath();
                    sCtx.arc(p.x, p.y, rad, 0, Math.PI * 2);
                    sCtx.fill();
                    if (i % 2 !== 0) {
                        sCtx.fillStyle = sn.color;
                        sCtx.beginPath();
                        sCtx.arc(p.x, p.y, rad * 0.82, 0, Math.PI * 2);
                        sCtx.fill();
                    }
                }

                const head = sn.pts[0];
                const ang = sn.angle || 0;
                const ex1 = head.x + Math.cos(ang - 0.5) * 5.2;
                const ey1 = head.y + Math.sin(ang - 0.5) * 5.2;
                const ex2 = head.x + Math.cos(ang + 0.5) * 5.2;
                const ey2 = head.y + Math.sin(ang + 0.5) * 5.2;

                sCtx.fillStyle = '#ffffff';
                sCtx.beginPath();
                sCtx.arc(ex1, ey1, 2.8, 0, Math.PI * 2);
                sCtx.arc(ex2, ey2, 2.8, 0, Math.PI * 2);
                sCtx.fill();

                sCtx.fillStyle = '#090d16';
                sCtx.beginPath();
                sCtx.arc(ex1 + Math.cos(ang), ey1 + Math.sin(ang), 1.4, 0, Math.PI * 2);
                sCtx.arc(ex2 + Math.cos(ang), ey2 + Math.sin(ang), 1.4, 0, Math.PI * 2);
                sCtx.fill();

                sCtx.fillStyle = '#ffffff';
                sCtx.font = 'bold 10.5px Inter, sans-serif';
                sCtx.textAlign = 'center';
                sCtx.fillText(`${sn.name} (${sn.score})`, head.x, head.y - 15);
            });
        }

        function loop(now) {
            if (destroyed) return;
            if (!document.hidden && !ctx.widgetEl.classList.contains('minimized')) {
                stepSnakeSim(now || performance.now());
                drawSnakeArena();
            }
            rafId = requestAnimationFrame(loop);
        }
        rafId = requestAnimationFrame(loop);

        return {
            onSync: function(remoteData) {
                if (!remoteData || !remoteData.snakes) return;
                const myLocalSnake = state.snakes[myId];
                state.foods = remoteData.foods || state.foods;
                state.scores = Object.assign(state.scores || {}, remoteData.scores || {});
                Object.keys(remoteData.snakes).forEach(k => {
                    if (k !== myId) {
                        state.snakes[k] = remoteData.snakes[k];
                    }
                });
                if (myLocalSnake) {
                    state.snakes[myId] = myLocalSnake;
                }
            },
            onResize: function() {
                syncArenaDimensions();
            },
            destroy: function() {
                destroyed = true;
                if (rafId) cancelAnimationFrame(rafId);
            }
        };
    }

    window.registerSyncGameModule('snake', {
        title: '🐍 Rắn Săn Mồi',
        defaultWidth: 850,
        defaultHeight: 550,
        minWidth: 580,
        minHeight: 420,
        createInitialData: createInitialSnakeData,
        mount: mountSnakeGame
    });

    const BB_SHAPES = [
        { cells: [[0, 0]], color: '#00d2ff' },
        { cells: [[0, 0], [0, 1]], color: '#2ed573' },
        { cells: [[0, 0], [1, 0]], color: '#2ed573' },
        { cells: [[0, 0], [0, 1], [0, 2]], color: '#00d2ff' },
        { cells: [[0, 0], [1, 0], [2, 0]], color: '#00d2ff' },
        { cells: [[0, 0], [0, 1], [0, 2], [0, 3]], color: '#ff4757' },
        { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: '#ff4757' },
        { cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: '#feca57' },
        { cells: [[0, 0], [1, 0], [1, 1]], color: '#ff9f43' },
        { cells: [[0, 0], [0, 1], [1, 0]], color: '#ff9f43' },
        { cells: [[0, 0], [0, 1], [0, 2], [1, 1]], color: '#a55eea' },
        { cells: [[0, 0], [1, 0], [2, 0], [2, 1]], color: '#ff6b81' },
        { cells: [[0, 0], [0, 1], [1, 1], [1, 2]], color: '#00f5d4' },
        { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], color: '#ffd32a' }
    ];

    function randomThreeShapes() {
        return [0, 1, 2].map(() => {
            const tpl = BB_SHAPES[Math.floor(Math.random() * BB_SHAPES.length)];
            return { cells: tpl.cells, color: tpl.color, used: false };
        });
    }

    function createInitialBlockBlastData() {
        const grid = Array.from({ length: 8 }, () => Array(8).fill(''));
        return {
            owner: window.USERNAME || 'Thành viên',
            ownerId: window.CLIENT_ID || '',
            grid: grid,
            tray: randomThreeShapes(),
            scores: {},
            combo: 0
        };
    }

    function mountBlockBlastGame(ctx) {
        const { widgetEl, bodyEl, widgetObj, emitUpdate } = ctx;
        let state = (widgetObj.game_data && Array.isArray(widgetObj.game_data.grid))
            ? JSON.parse(JSON.stringify(widgetObj.game_data))
            : createInitialBlockBlastData();

        if (!state.owner && widgetObj.creator) state.owner = widgetObj.creator;
        if (!state.ownerId && widgetObj.creator_id) state.ownerId = widgetObj.creator_id;

        bodyEl.innerHTML = `
        <div class="arcade-root">
            <div class="arcade-top-bar">
                <div class="arcade-group">
                    <span class="arcade-pill">👤 Bàn của: <b class="bb-owner-name">${state.owner || 'Thành viên'}</b></span>
                    <span class="arcade-pill">🧱 Điểm bàn này: <b class="bb-my-score">0</b></span>
                    <span class="arcade-pill">🔥 Combo: <b class="bb-combo">x1</b></span>
                </div>
                <div class="arcade-group">
                    <button type="button" class="arcade-btn gold bb-reroll-btn">🎲 Đổi 3 Khối</button>
                    <button type="button" class="arcade-btn danger bb-reset-btn">🔄 Ván Mới</button>
                </div>
            </div>
            <div class="referee-banner bb-referee-bar" style="display:none;">
                <span>👀 Chế độ Trọng tài / Khán giả: Bạn đang xem trực tiếp <b>${state.owner || 'Thành viên'}</b> xếp khối!</span>
                <button type="button" class="arcade-btn green bb-spawn-mine-btn">➕ Mở Bàn Riêng Đua Top</button>
            </div>
            <div class="bb-layout">
                <div class="bb-center-col">
                    <div class="bb-grid"></div>
                    <div class="bb-tray"></div>
                </div>
                <div class="bb-side-panel">
                    <div style="font-size:12px; font-weight:900; color:#38bdf8;">🏆 BẢNG ĐIỂM TOÀN PHÒNG</div>
                    <div class="bb-scores-list" style="display:flex; flex-direction:column; gap:5px; flex:1; overflow-y:auto;"></div>
                    <div style="font-size:10.5px; color:#cbd5e1; line-height:1.4;">💡 Mỗi người mở <b>➕ Bàn Riêng</b> bên cạnh để cùng thi đấu. Điểm số tự động đồng bộ lên Bảng Xếp Hạng chung!</div>
                </div>
            </div>
        </div>`;

        const gridEl = bodyEl.querySelector('.bb-grid');
        const trayEl = bodyEl.querySelector('.bb-tray');
        const scoresListEl = bodyEl.querySelector('.bb-scores-list');
        const myScoreEl = bodyEl.querySelector('.bb-my-score');
        const comboEl = bodyEl.querySelector('.bb-combo');
        const refereeBar = bodyEl.querySelector('.bb-referee-bar');
        const btnSpawnMine = bodyEl.querySelector('.bb-spawn-mine-btn');
        const btnReroll = bodyEl.querySelector('.bb-reroll-btn');
        const btnReset = bodyEl.querySelector('.bb-reset-btn');

        window.bindSafeButton(btnSpawnMine, () => {
            window.spawnModularGameOnBoard('blockblast', widgetEl);
        });

        function isMyOwnBoard() {
            const myId = window.CLIENT_ID || '';
            const myName = window.USERNAME || '';
            if (state.ownerId && myId && state.ownerId === myId) return true;
            if (state.owner && myName && state.owner === myName) return true;
            return window.isWidgetCreator(widgetObj);
        }

        let selectedTrayIdx = 0;
        let hoverCell = null;
        const cellEls = [];

        for (let r = 0; r < 8; r++) {
            cellEls[r] = [];
            for (let c = 0; c < 8; c++) {
                const cell = document.createElement('div');
                cell.className = 'bb-cell';
                cell.addEventListener('pointerenter', () => {
                    if (!isMyOwnBoard()) return;
                    hoverCell = { r, c };
                    renderGrid();
                });
                window.bindSafeButton(cell, () => {
                    if (!isMyOwnBoard()) {
                        if (window.showToast) {
                            window.showToast(`👀 Đây là bàn thi đấu của ${state.owner}! Hãy bấm "➕ Bàn Riêng" ở thanh trên để mở bàn của bạn.`);
                        }
                        return;
                    }
                    tryPlaceShapeAt(r, c);
                });
                gridEl.appendChild(cell);
                cellEls[r][c] = cell;
            }
        }

        gridEl.addEventListener('pointerleave', () => {
            hoverCell = null;
            renderGrid();
        });

        function canPlace(shape, r0, c0) {
            if (!shape || shape.used) return false;
            for (let i = 0; i < shape.cells.length; i++) {
                const nr = r0 + shape.cells[i][0];
                const nc = c0 + shape.cells[i][1];
                if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return false;
                if (state.grid[nr][nc]) return false;
            }
            return true;
        }

        function animateClearCells(rows, cols) {
            rows.forEach(r => {
                for (let c = 0; c < 8; c++) {
                    const el = cellEls[r][c];
                    if (el) {
                        el.style.transform = 'scale(1.18)';
                        setTimeout(() => { el.style.transform = ''; }, 180);
                    }
                }
            });
            cols.forEach(c => {
                for (let r = 0; r < 8; r++) {
                    const el = cellEls[r][c];
                    if (el) {
                        el.style.transform = 'scale(1.18)';
                        setTimeout(() => { el.style.transform = ''; }, 180);
                    }
                }
            });
        }

        function tryPlaceShapeAt(r0, c0) {
            const shape = state.tray[selectedTrayIdx];
            if (!canPlace(shape, r0, c0)) return;
            const ownerName = state.owner || window.USERNAME || 'Thành viên';

            shape.cells.forEach(([dr, dc]) => {
                state.grid[r0 + dr][c0 + dc] = shape.color;
            });
            shape.used = true;

            const fullRows = [];
            const fullCols = [];
            for (let r = 0; r < 8; r++) {
                if (state.grid[r].every(v => v !== '')) fullRows.push(r);
            }
            for (let c = 0; c < 8; c++) {
                let allFilled = true;
                for (let r = 0; r < 8; r++) {
                    if (!state.grid[r][c]) { allFilled = false; break; }
                }
                if (allFilled) fullCols.push(c);
            }

            const clearedLines = fullRows.length + fullCols.length;
            if (clearedLines > 0) {
                animateClearCells(fullRows, fullCols);
            }
            fullRows.forEach(r => {
                for (let c = 0; c < 8; c++) state.grid[r][c] = '';
            });
            fullCols.forEach(c => {
                for (let r = 0; r < 8; r++) state.grid[r][c] = '';
            });

            if (clearedLines > 0) {
                state.combo = (state.combo || 0) + 1;
            } else {
                state.combo = 0;
            }

            const gained = shape.cells.length * 10 + clearedLines * 120 * Math.max(1, state.combo);
            if (!state.scores) state.scores = {};
            state.scores[ownerName] = (state.scores[ownerName] || 0) + gained;

            if (window.updateGlobalGameScore) {
                window.updateGlobalGameScore('blockblast', ownerName, state.scores[ownerName]);
            }

            if (state.tray.every(s => s.used)) {
                state.tray = randomThreeShapes();
                selectedTrayIdx = 0;
            } else {
                const nextAvail = state.tray.findIndex(s => !s.used);
                if (nextAvail !== -1) selectedTrayIdx = nextAvail;
            }

            hoverCell = null;
            renderAll();
            emitUpdate(state, { type: 'placed', cleared: clearedLines, rows: fullRows, cols: fullCols }, false);
        }

        function renderGrid() {
            const activeShape = state.tray[selectedTrayIdx];
            const previewSet = new Set();
            let previewValid = false;

            if (hoverCell && activeShape && !activeShape.used && isMyOwnBoard()) {
                previewValid = canPlace(activeShape, hoverCell.r, hoverCell.c);
                activeShape.cells.forEach(([dr, dc]) => {
                    const nr = hoverCell.r + dr;
                    const nc = hoverCell.c + dc;
                    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                        previewSet.add(nr + '_' + nc);
                    }
                });
            }

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const cell = cellEls[r][c];
                    const color = state.grid[r][c];
                    const inPrev = previewSet.has(r + '_' + c);
                    cell.className = 'bb-cell' + (color ? ' filled' : '') + (inPrev ? (previewValid ? ' preview-ok' : ' preview-bad') : '');
                    cell.style.background = color || '';
                }
            }
        }

        function renderTrayAndScores() {
            const ownerName = state.owner || window.USERNAME || 'Thành viên';
            const boardScore = (state.scores && state.scores[ownerName]) || 0;
            if (window.updateGlobalGameScore && boardScore > 0) {
                window.updateGlobalGameScore('blockblast', ownerName, boardScore);
            }
            myScoreEl.textContent = boardScore.toLocaleString('vi-VN');
            comboEl.textContent = 'x' + Math.max(1, (state.combo || 0) + 1);
            refereeBar.style.display = isMyOwnBoard() ? 'none' : 'flex';

            trayEl.innerHTML = '';
            state.tray.forEach((sh, idx) => {
                const card = document.createElement('div');
                card.className = 'bb-piece-card' + (idx === selectedTrayIdx && !sh.used ? ' selected' : '') + (sh.used ? ' used' : '');
                let maxR = 0;
                let maxC = 0;
                sh.cells.forEach(([r, c]) => {
                    if (r > maxR) maxR = r;
                    if (c > maxC) maxC = c;
                });
                const mGrid = document.createElement('div');
                mGrid.className = 'bb-mini-grid';
                mGrid.style.gridTemplateColumns = `repeat(${maxC + 1}, 14px)`;
                const setMap = new Set(sh.cells.map(([r, c]) => r + '_' + c));
                for (let r = 0; r <= maxR; r++) {
                    for (let c = 0; c <= maxC; c++) {
                        const mc = document.createElement('div');
                        mc.className = 'bb-mini-cell';
                        if (setMap.has(r + '_' + c)) mc.style.background = sh.color;
                        mGrid.appendChild(mc);
                    }
                }
                card.appendChild(mGrid);
                window.bindSafeButton(card, () => {
                    if (!isMyOwnBoard()) return;
                    if (!sh.used) {
                        selectedTrayIdx = idx;
                        renderAll();
                    }
                });
                trayEl.appendChild(card);
            });

            const globalEntries = window.getGlobalLeaderboardSorted
                ? window.getGlobalLeaderboardSorted('blockblast', state.scores)
                : Object.entries(state.scores || {}).sort((a, b) => b[1] - a[1]);

            scoresListEl.innerHTML = globalEntries.map(([u, sc], i) => `
                <div class="bb-score-row ${u === ownerName ? 'active-me' : ''}">
                    <span>#${i + 1} ${u}</span>
                    <b style="color:#feca57;">${sc.toLocaleString('vi-VN')}</b>
                </div>
            `).join('') || '<div style="font-size:11px; color:#94a3b8;">Chưa có điểm</div>';
        }

        function renderAll() {
            renderGrid();
            renderTrayAndScores();
        }

        window.bindSafeButton(btnReroll, () => {
            if (!isMyOwnBoard()) {
                if (window.showToast) window.showToast('🔒 Chỉ chủ bàn mới được đổi khối!');
                return;
            }
            state.tray = randomThreeShapes();
            selectedTrayIdx = 0;
            renderAll();
            emitUpdate(state, null, false);
        });

        window.bindSafeButton(btnReset, () => {
            if (!isMyOwnBoard()) {
                if (window.showToast) window.showToast('🔒 Chỉ chủ bàn mới được làm mới bàn này!');
                return;
            }
            state.grid = Array.from({ length: 8 }, () => Array(8).fill(''));
            state.tray = randomThreeShapes();
            state.combo = 0;
            renderAll();
            emitUpdate(state, null, false);
        });

        renderAll();
        const lbRefreshTimer = setInterval(renderTrayAndScores, 2200);

        return {
            onSync: function(remoteData, animPayload) {
                if (!remoteData || !Array.isArray(remoteData.grid)) return;
                state = JSON.parse(JSON.stringify(remoteData));
                if (animPayload && animPayload.type === 'placed' && animPayload.cleared > 0) {
                    animateClearCells(animPayload.rows || [], animPayload.cols || []);
                }
                if (state.tray[selectedTrayIdx] && state.tray[selectedTrayIdx].used) {
                    const nxt = state.tray.findIndex(s => !s.used);
                    if (nxt !== -1) selectedTrayIdx = nxt;
                }
                renderAll();
            },
            destroy: function() {
                clearInterval(lbRefreshTimer);
            }
        };
    }

    window.registerSyncGameModule('blockblast', {
        title: '🧱 Xếp Khối 8x8',
        defaultWidth: 650,
        defaultHeight: 540,
        minWidth: 510,
        minHeight: 450,
        createInitialData: createInitialBlockBlastData,
        mount: mountBlockBlastGame
    });

    const DG_WORDS = [
        { word: 'Con cá heo', hint: 'Động vật đại dương' },
        { word: 'Bánh mì kẹp', hint: 'Đồ ăn đường phố' },
        { word: 'Mặt trời mọc', hint: 'Hiện tượng thiên nhiên' },
        { word: 'Xe đạp điện', hint: 'Phương tiện giao thông' },
        { word: 'Kính thiên văn', hint: 'Đồ vật khoa học' },
        { word: 'Trà sữa trân châu', hint: 'Đồ uống yêu thích' },
        { word: 'Con khủng long', hint: 'Sinh vật cổ đại' },
        { word: 'Cầu vồng đôi', hint: 'Bầu trời sau mưa' },
        { word: 'Đàn guitar', hint: 'Nhạc cụ âm nhạc' },
        { word: 'Tàu vũ trụ', hint: 'Khám phá không gian' },
        { word: 'Bạch tuộc đỏ', hint: 'Sinh vật biển' },
        { word: 'Nón lá Việt Nam', hint: 'Biểu tượng truyền thống' },
        { word: 'Quả dưa hấu', hint: 'Trái cây mùa hè' },
        { word: 'Người tuyết', hint: 'Mùa đông lạnh giá' },
        { word: 'Mèo máy Doraemon', hint: 'Nhân vật hoạt hình' }
    ];

    function pickRandomWordObj() {
        return DG_WORDS[Math.floor(Math.random() * DG_WORDS.length)];
    }

    function maskWordPattern(wordStr) {
        return String(wordStr || '').split(' ').map(w => '_'.repeat(w.length)).join('   ');
    }

    function createInitialDrawGuessData() {
        const pick = pickRandomWordObj();
        return {
            drawer: window.USERNAME || 'Thành viên',
            drawerId: window.CLIENT_ID || '',
            word: pick.word,
            hint: pick.hint,
            strokes: [],
            scores: {},
            guesses: [],
            solvedUsers: []
        };
    }

    function mountDrawGuessGame(ctx) {
        const { bodyEl, widgetObj, emitUpdate } = ctx;
        bodyEl.innerHTML = `
        <div class="arcade-root">
            <div class="arcade-top-bar">
                <div class="arcade-group">
                    <span class="arcade-pill">🎨 Họa sĩ: <b class="dg-drawer-name">---</b></span>
                    <button type="button" class="arcade-btn dg-claim-draw-btn">🖌️ Nhận Quyền Vẽ</button>
                    <button type="button" class="arcade-btn gold dg-custom-word-btn">✍️ Tự Đặt Từ Đố</button>
                </div>
                <div class="arcade-group">
                    <button type="button" class="arcade-btn green dg-next-word-btn">⏭️ Đổi Từ Mới</button>
                </div>
            </div>
            <div class="dg-layout">
                <div class="dg-canvas-col">
                    <div class="dg-word-banner">
                        <span class="dg-word-display">Từ khóa: ---</span>
                        <span class="dg-hint-display" style="font-size:11px; color:#feca57;"></span>
                    </div>
                    <div class="dg-canvas-wrap">
                        <canvas class="dg-canvas" width="540" height="360"></canvas>
                    </div>
                    <div class="dg-draw-tools">
                        <div class="arcade-group dg-colors-row"></div>
                        <div class="arcade-group">
                            <button type="button" class="arcade-btn dg-eraser-btn">🧽 Tẩy</button>
                            <button type="button" class="arcade-btn danger dg-clear-canvas-btn">🗑️ Xóa bảng vẽ</button>
                        </div>
                    </div>
                </div>
                <div class="dg-chat-col">
                    <div style="font-size:11px; font-weight:900; color:#38bdf8;">🏆 BẢNG ĐIỂM ĐOÁN CHỮ</div>
                    <div class="dg-players-box"></div>
                    <div class="dg-guesses-list"></div>
                    <form class="dg-guess-form">
                        <input type="text" class="dg-guess-input" placeholder="Gõ đáp án (Có dấu / không dấu)..." autocomplete="off">
                        <button type="submit">Đoán</button>
                    </form>
                </div>
            </div>
        </div>`;

        const canvas = bodyEl.querySelector('.dg-canvas');
        const dCtx = canvas.getContext('2d');
        const drawerNameEl = bodyEl.querySelector('.dg-drawer-name');
        const wordDispEl = bodyEl.querySelector('.dg-word-display');
        const hintDispEl = bodyEl.querySelector('.dg-hint-display');
        const colorsRowEl = bodyEl.querySelector('.dg-colors-row');
        const playersBoxEl = bodyEl.querySelector('.dg-players-box');
        const guessesListEl = bodyEl.querySelector('.dg-guesses-list');
        const guessForm = bodyEl.querySelector('.dg-guess-form');
        const guessInput = bodyEl.querySelector('.dg-guess-input');

        const btnClaimDraw = bodyEl.querySelector('.dg-claim-draw-btn');
        const btnCustomWord = bodyEl.querySelector('.dg-custom-word-btn');
        const btnNextWord = bodyEl.querySelector('.dg-next-word-btn');
        const btnEraser = bodyEl.querySelector('.dg-eraser-btn');
        const btnClearCanvas = bodyEl.querySelector('.dg-clear-canvas-btn');

        let state = (widgetObj.game_data && widgetObj.game_data.word)
            ? JSON.parse(JSON.stringify(widgetObj.game_data))
            : createInitialDrawGuessData();

        let penColor = '#1e272e';
        let penWidth = 4;
        let isDrawing = false;
        let currentStroke = null;

        ['#1e272e', '#ff4757', '#0984e3', '#2ed573', '#ffa502', '#a55eea'].forEach((hex, idx) => {
            const dot = document.createElement('span');
            dot.className = 'dg-color-dot' + (idx === 0 ? ' active' : '');
            dot.style.background = hex;
            window.bindSafeButton(dot, () => {
                penColor = hex;
                penWidth = 4;
                colorsRowEl.querySelectorAll('.dg-color-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            });
            colorsRowEl.appendChild(dot);
        });

        window.bindSafeButton(btnEraser, () => {
            penColor = '#ffffff';
            penWidth = 16;
            colorsRowEl.querySelectorAll('.dg-color-dot').forEach(d => d.classList.remove('active'));
        });

        function isMeDrawer() {
            const myId = window.CLIENT_ID || '';
            const myName = window.USERNAME || '';
            return (myId && state.drawerId === myId) || (myName && state.drawer === myName);
        }

        function redrawCanvas() {
            dCtx.fillStyle = '#ffffff';
            dCtx.fillRect(0, 0, canvas.width, canvas.height);
            dCtx.lineCap = 'round';
            dCtx.lineJoin = 'round';
            const list = state.strokes || [];
            for (let i = 0; i < list.length; i++) {
                const st = list[i];
                if (!st.pts || st.pts.length === 0) continue;
                dCtx.strokeStyle = st.c || '#1e272e';
                dCtx.lineWidth = st.w || 4;
                dCtx.beginPath();
                dCtx.moveTo(st.pts[0][0], st.pts[0][1]);
                for (let k = 1; k < st.pts.length; k++) {
                    dCtx.lineTo(st.pts[k][0], st.pts[k][1]);
                }
                dCtx.stroke();
            }
        }

        function renderUi() {
            const amDrawer = isMeDrawer();
            drawerNameEl.textContent = state.drawer || 'Chưa có';
            const wordCount = String(state.word || '').trim().split(/\s+/).length;
            if (amDrawer) {
                wordDispEl.innerHTML = `Từ cần vẽ: <b style="color:#2ed573;">${state.word}</b>`;
            } else {
                wordDispEl.innerHTML = `Đoán chữ (${wordCount} tiếng): <b style="color:#38bdf8; letter-spacing:1px;">${maskWordPattern(state.word)}</b>`;
            }
            hintDispEl.textContent = `💡 Gợi ý: ${state.hint || 'Tự do'}`;

            const entries = window.getGlobalLeaderboardSorted
                ? window.getGlobalLeaderboardSorted('drawguess', state.scores)
                : Object.entries(state.scores || {}).sort((a, b) => b[1] - a[1]);

            playersBoxEl.innerHTML = entries.map(([u, sc]) => `
                <span class="dg-player-tag ${u === state.drawer ? 'drawer' : ''}">${u}: <b>${sc}đ</b></span>
            `).join('') || '<span style="font-size:10.5px; color:#94a3b8;">Hãy vẽ & đoán từ để ghi điểm!</span>';

            guessesListEl.innerHTML = (state.guesses || []).slice(-25).map(g => `
                <div class="dg-guess-item ${g.cls || ''}"><b>${g.user}:</b> ${g.text}</div>
            `).join('');
            guessesListEl.scrollTop = guessesListEl.scrollHeight;
            redrawCanvas();
        }

        function getDrawCoords(e) {
            const rect = canvas.getBoundingClientRect();
            return [
                Math.round((e.clientX - rect.left) * (canvas.width / Math.max(1, rect.width))),
                Math.round((e.clientY - rect.top) * (canvas.height / Math.max(1, rect.height)))
            ];
        }

        canvas.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            if (!isMeDrawer()) {
                if (window.showToast) window.showToast('🖌️ Bấm "Nhận Quyền Vẽ" nếu bạn muốn trở thành họa sĩ lượt này!');
                return;
            }
            isDrawing = true;
            const pt = getDrawCoords(e);
            currentStroke = { c: penColor, w: penWidth, pts: [pt] };
            state.strokes.push(currentStroke);
            redrawCanvas();
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!isDrawing || !currentStroke) return;
            e.stopPropagation();
            const pt = getDrawCoords(e);
            const last = currentStroke.pts[currentStroke.pts.length - 1];
            if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 3) {
                currentStroke.pts.push(pt);
                redrawCanvas();
            }
        });

        const finishStroke = () => {
            if (!isDrawing) return;
            isDrawing = false;
            currentStroke = null;
            emitUpdate(state, null, false);
        };
        canvas.addEventListener('pointerup', finishStroke);
        canvas.addEventListener('pointercancel', finishStroke);

        window.bindSafeButton(btnClearCanvas, () => {
            if (!isMeDrawer()) return;
            state.strokes = [];
            redrawCanvas();
            emitUpdate(state, null, false);
        });

        window.bindSafeButton(btnClaimDraw, () => {
            state.drawer = window.USERNAME || 'Thành viên';
            state.drawerId = window.CLIENT_ID || '';
            const pick = pickRandomWordObj();
            state.word = pick.word;
            state.hint = pick.hint;
            state.strokes = [];
            state.solvedUsers = [];
            renderUi();
            emitUpdate(state, null, false);
        });

        window.bindSafeButton(btnCustomWord, () => {
            const custom = prompt('Nhập từ khóa tiếng Việt bạn muốn vẽ đố mọi người:', '');
            if (!custom || !custom.trim()) return;
            const customHint = prompt('Nhập gợi ý chủ đề (VD: Động vật, Đồ ăn...):', 'Từ khóa tự chọn') || 'Từ khóa tự chọn';
            state.drawer = window.USERNAME || 'Thành viên';
            state.drawerId = window.CLIENT_ID || '';
            state.word = custom.trim();
            state.hint = customHint.trim();
            state.strokes = [];
            state.solvedUsers = [];
            state.guesses.push({ user: 'Hệ thống', text: `🎨 ${state.drawer} vừa bắt đầu vẽ một từ đố mới!`, cls: 'close-hit' });
            renderUi();
            emitUpdate(state, null, false);
        });

        window.bindSafeButton(btnNextWord, () => {
            if (!isMeDrawer() && !window.canCurrentUserModifyWidget(widgetObj)) {
                if (window.showToast) window.showToast('🔒 Chỉ người đang vẽ hoặc chủ bàn mới được đổi từ!');
                return;
            }
            const pick = pickRandomWordObj();
            state.word = pick.word;
            state.hint = pick.hint;
            state.strokes = [];
            state.solvedUsers = [];
            state.guesses.push({ user: 'Hệ thống', text: '⏭️ Đã chuyển sang từ khóa mới!', cls: 'close-hit' });
            renderUi();
            emitUpdate(state, null, false);
        });

        guessForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = guessInput.value.trim();
            if (!val) return;
            guessInput.value = '';
            const myName = window.USERNAME || 'Thành viên';

            if (isMeDrawer()) {
                state.guesses.push({ user: myName + ' (Họa sĩ)', text: val, cls: '' });
                renderUi();
                emitUpdate(state, null, false);
                return;
            }

            const check = window.SyncTextUtils.evaluateGuess(val, state.word);
            if (!state.scores) state.scores = {};

            if (check.status === 'exact' || check.status === 'unaccented' || check.status === 'near_accept') {
                const pts = check.status === 'exact' ? 100 : (check.status === 'unaccented' ? 90 : 80);
                state.scores[myName] = (state.scores[myName] || 0) + pts;
                if (state.drawer) {
                    state.scores[state.drawer] = (state.scores[state.drawer] || 0) + 25;
                }
                if (window.updateGlobalGameScore) {
                    window.updateGlobalGameScore('drawguess', myName, state.scores[myName]);
                }
                const tagNote = check.status === 'exact'
                    ? 'Chính xác tuyệt đối'
                    : (check.status === 'unaccented' ? 'Đoán đúng không dấu' : 'Đoán gần chuẩn xác');
                state.guesses.push({
                    user: '🎉 ' + myName,
                    text: `Đã đoán đúng đáp án! (${tagNote} +${pts}đ)`,
                    cls: 'correct'
                });
            } else if (check.status === 'close') {
                const pct = Math.round(check.similarity * 100);
                state.guesses.push({
                    user: '🔥 ' + myName,
                    text: `${val} (Rất gần đúng rồi - Khớp ${pct}%!)`,
                    cls: 'close-hit'
                });
            } else {
                state.guesses.push({
                    user: myName,
                    text: val,
                    cls: ''
                });
            }

            if (state.guesses.length > 40) state.guesses = state.guesses.slice(-40);
            renderUi();
            emitUpdate(state, null, false);
        });

        renderUi();

        return {
            onSync: function(remoteData) {
                if (!remoteData || !remoteData.word) return;
                state = JSON.parse(JSON.stringify(remoteData));
                renderUi();
            },
            destroy: function() {}
        };
    }

    window.registerSyncGameModule('drawguess', {
        title: '🎨 Vẽ Đoán Chữ',
        defaultWidth: 800,
        defaultHeight: 520,
        minWidth: 580,
        minHeight: 420,
        createInitialData: createInitialDrawGuessData,
        mount: mountDrawGuessGame
    });
})();
