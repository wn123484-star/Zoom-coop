(function() {
    const TANK_W = 920;
    const TANK_H = 540;

    const CANNON_LEVELS = [
        { lv: 1, cost: 10, dmg: 14, speed: 9.5, netR: 34, barrels: 1, color: '#00d2ff', name: 'Cấp 1 (10 xu)' },
        { lv: 2, cost: 20, dmg: 28, speed: 10.2, netR: 40, barrels: 1, color: '#2ed573', name: 'Cấp 2 (20 xu)' },
        { lv: 3, cost: 40, dmg: 56, speed: 11.0, netR: 46, barrels: 2, color: '#feca57', name: 'Cấp 3 (40 xu)' },
        { lv: 4, cost: 80, dmg: 115, speed: 11.8, netR: 54, barrels: 2, color: '#ff9f43', name: 'Cấp 4 (80 xu)' },
        { lv: 5, cost: 150, dmg: 220, speed: 12.6, netR: 62, barrels: 3, color: '#ff4757', name: 'Cấp 5 (150 xu)' },
        { lv: 6, cost: 300, dmg: 460, speed: 13.8, netR: 74, barrels: 3, color: '#d6a2e8', name: 'Pháo Thần (300 xu)' }
    ];

    const FISH_SPECIES = [
        { key: 'clown', name: 'Cá Hề Nemo', emoji: '🐠', mult: 2, hp: 20, r: 16, speed: 1.55, weight: 28, glow: '#ff7f50' },
        { key: 'neon', name: 'Cá Neon Xanh', emoji: '🐟', mult: 3, hp: 32, r: 18, speed: 1.75, weight: 24, glow: '#00d2ff' },
        { key: 'puffer', name: 'Cá Nóc Gai', emoji: '🐡', mult: 5, hp: 55, r: 21, speed: 1.25, weight: 18, glow: '#feca57' },
        { key: 'squid', name: 'Mực Ống Đỏ', emoji: '🦑', mult: 7, hp: 78, r: 23, speed: 1.65, weight: 15, glow: '#ff6b81' },
        { key: 'crab', name: 'Cua Hoàng Đế', emoji: '🦀', mult: 10, hp: 110, r: 24, speed: 1.15, weight: 12, glow: '#ff4757' },
        { key: 'jelly', name: 'Sứa Phát Quang', emoji: '🪼', mult: 12, hp: 135, r: 25, speed: 1.05, weight: 11, glow: '#d6a2e8' },
        { key: 'turtle', name: 'Rùa Vàng Kim Quy', emoji: '🐢', mult: 16, hp: 180, r: 28, speed: 0.95, weight: 9, glow: '#2ed573' },
        { key: 'octopus', name: 'Bạch Tuộc Đại Dương', emoji: '🐙', mult: 22, hp: 250, r: 31, speed: 1.12, weight: 7, glow: '#a55eea' },
        { key: 'dolphin', name: 'Cá Heo Ngọc Bích', emoji: '🐬', mult: 30, hp: 340, r: 34, speed: 1.6, weight: 5, glow: '#70a1ff' },
        { key: 'shark', name: 'Cá Mập Đầu Búa', emoji: '🦈', mult: 45, hp: 520, r: 39, speed: 1.38, weight: 4, glow: '#94a3b8', isElite: true },
        { key: 'whale', name: 'Cá Voi Cổ Đại', emoji: '🐋', mult: 75, hp: 880, r: 46, speed: 0.88, weight: 2, glow: '#1e90ff', isBoss: true },
        { key: 'dragon', name: 'Hải Vương Rồng Vàng', emoji: '🐉', mult: 120, hp: 1450, r: 52, speed: 1.05, weight: 1, glow: '#ffd32a', isBoss: true }
    ];

    const SPECIES_MAP = {};
    FISH_SPECIES.forEach(s => { SPECIES_MAP[s.key] = s; });

    const SEAT_CONFIGS = [
        { idx: 0, code: 'D1 (Dưới-Trái)', edge: 'bottom', x: TANK_W * 0.30, y: TANK_H - 18, baseAngle: -Math.PI / 2 },
        { idx: 1, code: 'D2 (Dưới-Phải)', edge: 'bottom', x: TANK_W * 0.70, y: TANK_H - 18, baseAngle: -Math.PI / 2 },
        { idx: 2, code: 'T1 (Trên-Trái)', edge: 'top', x: TANK_W * 0.30, y: 18, baseAngle: Math.PI / 2 },
        { idx: 3, code: 'T2 (Trên-Phải)', edge: 'top', x: TANK_W * 0.70, y: 18, baseAngle: Math.PI / 2 },
        { idx: 4, code: 'L1 (Trái-Trên)', edge: 'left', x: 18, y: TANK_H * 0.33, baseAngle: 0 },
        { idx: 5, code: 'L2 (Trái-Dưới)', edge: 'left', x: 18, y: TANK_H * 0.67, baseAngle: 0 },
        { idx: 6, code: 'R1 (Phải-Trên)', edge: 'right', x: TANK_W - 18, y: TANK_H * 0.33, baseAngle: Math.PI },
        { idx: 7, code: 'R2 (Phải-Dưới)', edge: 'right', x: TANK_W - 18, y: TANK_H * 0.67, baseAngle: Math.PI }
    ];

    function pickWeightedSpecies(forceBoss) {
        if (forceBoss) {
            return Math.random() < 0.55 ? SPECIES_MAP.dragon : SPECIES_MAP.whale;
        }
        let totalW = 0;
        for (let i = 0; i < FISH_SPECIES.length; i++) totalW += FISH_SPECIES[i].weight;
        let roll = Math.random() * totalW;
        for (let i = 0; i < FISH_SPECIES.length; i++) {
            roll -= FISH_SPECIES[i].weight;
            if (roll <= 0) return FISH_SPECIES[i];
        }
        return FISH_SPECIES[0];
    }

    function createSingleFish(forceBoss) {
        const spec = pickWeightedSpecies(forceBoss);
        const side = Math.floor(Math.random() * 4);
        const pad = spec.r + 36;
        let x = 0;
        let y = 0;
        let targetX = TANK_W * (0.25 + Math.random() * 0.5);
        let targetY = TANK_H * (0.25 + Math.random() * 0.5);

        if (side === 0) {
            x = -pad;
            y = 70 + Math.random() * (TANK_H - 140);
            targetX = TANK_W + pad;
        } else if (side === 1) {
            x = TANK_W + pad;
            y = 70 + Math.random() * (TANK_H - 140);
            targetX = -pad;
        } else if (side === 2) {
            x = 90 + Math.random() * (TANK_W - 180);
            y = -pad;
            targetY = TANK_H + pad;
        } else {
            x = 90 + Math.random() * (TANK_W - 180);
            y = TANK_H + pad;
            targetY = -pad;
        }

        const ang = Math.atan2(targetY - y, targetX - x);
        return {
            id: 'f_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 9999),
            key: spec.key,
            x: Math.round(x),
            y: Math.round(y),
            vx: Number((Math.cos(ang) * spec.speed).toFixed(2)),
            vy: Number((Math.sin(ang) * spec.speed).toFixed(2)),
            hp: spec.hp,
            maxHp: spec.hp,
            swayAmp: Number((0.25 + Math.random() * 0.55).toFixed(2)),
            swayPhase: Number((Math.random() * Math.PI * 2).toFixed(2))
        };
    }

    function createInitialFishingData() {
        const seats = SEAT_CONFIGS.map(cfg => ({
            idx: cfg.idx,
            occupantId: null,
            occupantName: null,
            isBot: false,
            coins: 1200,
            cannonLv: 2,
            angle: cfg.baseAngle,
            score: 0
        }));

        const myId = window.CLIENT_ID || 'local_user';
        const myName = window.USERNAME || 'Thành viên';
        seats[0].occupantId = myId;
        seats[0].occupantName = myName;

        const initialFishes = [];
        for (let i = 0; i < 16; i++) {
            const f = createSingleFish(i === 15);
            f.x = Math.round(120 + Math.random() * (TANK_W - 240));
            f.y = Math.round(90 + Math.random() * (TANK_H - 180));
            initialFishes.push(f);
        }

        return {
            seats: seats,
            fishes: initialFishes,
            updatedAt: Date.now()
        };
    }

    function buildFishingTemplateHtml() {
        return `
        <div class="fishing-root">
            <div class="fishing-hud-bar">
                <div class="fishing-hud-group">
                    <span class="fish-pill" title="Xu vàng hiện tại của bạn">🪙 Xu: <b class="fish-my-coins">1200</b></span>
                    <span class="fish-pill" title="Vị trí súng của bạn trên thành bể">🎯 Ghế: <b class="fish-my-seat-label">D1</b></span>
                    <button type="button" class="fish-btn fish-cannon-down" title="Giảm cấp đại bác">➖</button>
                    <span class="fish-pill" title="Sức mạnh đại bác">🔫 <b class="fish-cannon-lv">Cấp 2 (20 xu)</b></span>
                    <button type="button" class="fish-btn fish-cannon-up" title="Tăng cấp đại bác">➕</button>
                </div>
                <div class="fishing-hud-group">
                    <button type="button" class="fish-btn fish-auto-btn" title="Tự động bắn liên thanh">⚡ Tự bắn: TẮT</button>
                    <button type="button" class="fish-btn fish-lock-btn" title="Khóa mục tiêu vào Cá Lớn / Boss">🎯 Khóa Boss</button>
                    <button type="button" class="fish-btn gold fish-refill-btn" title="Nhận thêm +1000 Xu miễn phí">+1000 Xu</button>
                    <button type="button" class="fish-btn fish-bot-btn" title="Thêm hoặc Gỡ Bot bắn phụ ở các cạnh trống">🤖 +Bot</button>
                    <button type="button" class="fish-btn fish-wave-btn" title="Triệu hồi Đàn Cá & Hải Vương Rồng Vàng">🌊 Gọi Boss</button>
                </div>
            </div>
            <div class="fishing-seats-strip"></div>
            <div class="fishing-arena-wrap">
                <canvas class="fishing-canvas" width="${TANK_W}" height="${TANK_H}"></canvas>
                <div class="fishing-wave-overlay"></div>
                <div class="fishing-boss-banner">🐉 CẢNH BÁO: HẢI VƯƠNG BOSS ĐANG BƠI TRONG BỂ!</div>
            </div>
            <div class="fishing-guide-footer">
                <span>💡 <b>8 Tháp Pháo quanh 4 cạnh bể:</b> Bấm vào ô ghế bất kỳ để đổi vị trí ngồi. Chạm hoặc giữ chuột trong bể để xả đạn!</span>
                <span>🏆 <b>Thưởng:</b> Cá Nhỏ x2-x7 | Rùa Vàng x16 | Cá Heo x30 | Cá Mập x45 | Cá Voi x75 | Rồng Vàng x120</span>
            </div>
        </div>`;
    }

    function mountFishingGame(ctx) {
        const { bodyEl, widgetObj, emitUpdate } = ctx;
        bodyEl.innerHTML = buildFishingTemplateHtml();

        const rootEl = bodyEl.querySelector('.fishing-root');
        const canvas = rootEl.querySelector('.fishing-canvas');
        const gCtx = canvas.getContext('2d');
        const seatsStripEl = rootEl.querySelector('.fishing-seats-strip');
        const myCoinsEl = rootEl.querySelector('.fish-my-coins');
        const mySeatLabelEl = rootEl.querySelector('.fish-my-seat-label');
        const cannonLvEl = rootEl.querySelector('.fish-cannon-lv');
        const bossBannerEl = rootEl.querySelector('.fishing-boss-banner');

        const btnCannonDown = rootEl.querySelector('.fish-cannon-down');
        const btnCannonUp = rootEl.querySelector('.fish-cannon-up');
        const btnAuto = rootEl.querySelector('.fish-auto-btn');
        const btnLock = rootEl.querySelector('.fish-lock-btn');
        const btnRefill = rootEl.querySelector('.fish-refill-btn');
        const btnBot = rootEl.querySelector('.fish-bot-btn');
        const btnWave = rootEl.querySelector('.fish-wave-btn');

        let state = (widgetObj.game_data && Array.isArray(widgetObj.game_data.seats))
            ? JSON.parse(JSON.stringify(widgetObj.game_data))
            : createInitialFishingData();

        let bullets = [];
        let nets = [];
        let floatingTexts = [];
        let coinParticles = [];
        let bgBubbles = [];
        for (let i = 0; i < 24; i++) {
            bgBubbles.push({
                x: Math.random() * TANK_W,
                y: Math.random() * TANK_H,
                r: 1.5 + Math.random() * 3.5,
                vy: -0.35 - Math.random() * 0.55,
                phase: Math.random() * Math.PI * 2
            });
        }

        let isPointerDown = false;
        let pointerTarget = { x: TANK_W / 2, y: TANK_H / 2 };
        let autoFire = false;
        let lockBoss = false;
        let lockedFishId = null;
        let lastShotTime = 0;
        let lastBotShotTime = 0;
        let lastHostSyncTime = Date.now();
        let destroyed = false;
        let animFrameId = null;

        function getMyClientId() {
            return window.CLIENT_ID || 'local_user';
        }

        function getMyUsername() {
            return window.USERNAME || 'Thành viên';
        }

        function findMySeatIndex() {
            const myId = getMyClientId();
            for (let i = 0; i < state.seats.length; i++) {
                if (state.seats[i].occupantId === myId && !state.seats[i].isBot) {
                    return i;
                }
            }
            return -1;
        }

        function ensurePlayerSeated(preferredIdx) {
            let myIdx = findMySeatIndex();
            if (myIdx !== -1 && (typeof preferredIdx !== 'number' || preferredIdx === myIdx)) {
                return myIdx;
            }
            const myId = getMyClientId();
            const myName = getMyUsername();
            let savedCoins = 1200;
            let savedLv = 2;
            let savedScore = 0;

            if (myIdx !== -1) {
                savedCoins = state.seats[myIdx].coins;
                savedLv = state.seats[myIdx].cannonLv;
                savedScore = state.seats[myIdx].score || 0;
                state.seats[myIdx].occupantId = null;
                state.seats[myIdx].occupantName = null;
                state.seats[myIdx].isBot = false;
            }

            let targetSeat = -1;
            if (typeof preferredIdx === 'number' && preferredIdx >= 0 && preferredIdx < 8) {
                if (!state.seats[preferredIdx].occupantId || state.seats[preferredIdx].isBot) {
                    targetSeat = preferredIdx;
                }
            }
            if (targetSeat === -1) {
                for (let i = 0; i < state.seats.length; i++) {
                    if (!state.seats[i].occupantId) {
                        targetSeat = i;
                        break;
                    }
                }
            }
            if (targetSeat === -1) {
                for (let i = 0; i < state.seats.length; i++) {
                    if (state.seats[i].isBot) {
                        targetSeat = i;
                        break;
                    }
                }
            }
            if (targetSeat !== -1) {
                const s = state.seats[targetSeat];
                s.occupantId = myId;
                s.occupantName = myName;
                s.isBot = false;
                s.coins = Math.max(200, savedCoins);
                s.cannonLv = savedLv;
                s.score = savedScore;
                s.angle = SEAT_CONFIGS[targetSeat].baseAngle;
                syncStateToRoom(null, false);
                renderHudAndSeats();
            }
            return targetSeat;
        }

        function isLocalCoordinator() {
            const myId = getMyClientId();
            for (let i = 0; i < state.seats.length; i++) {
                const s = state.seats[i];
                if (s.occupantId && !s.isBot) {
                    return s.occupantId === myId;
                }
            }
            return true;
        }

        function syncStateToRoom(animPayload, echoSelf) {
            state.updatedAt = Date.now();
            emitUpdate(state, animPayload || null, echoSelf === true);
        }

        function getCannonSpec(lv) {
            const idx = Math.max(0, Math.min(CANNON_LEVELS.length - 1, (lv || 1) - 1));
            return CANNON_LEVELS[idx];
        }

        function renderHudAndSeats() {
            const myIdx = findMySeatIndex();
            if (myIdx !== -1) {
                const mySeat = state.seats[myIdx];
                const cSpec = getCannonSpec(mySeat.cannonLv);
                myCoinsEl.innerText = Math.floor(mySeat.coins).toLocaleString('vi-VN');
                mySeatLabelEl.innerText = SEAT_CONFIGS[myIdx].code;
                cannonLvEl.innerText = cSpec.name;
            } else {
                myCoinsEl.innerText = '---';
                mySeatLabelEl.innerText = 'Chạm ghế để ngồi';
                cannonLvEl.innerText = 'Cấp 2 (20 xu)';
            }

            const hasBoss = state.fishes.some(f => {
                const sp = SPECIES_MAP[f.key];
                return sp && sp.isBoss;
            });
            bossBannerEl.classList.toggle('show', hasBoss);

            seatsStripEl.innerHTML = '';
            state.seats.forEach((s, idx) => {
                const cfg = SEAT_CONFIGS[idx];
                const slot = document.createElement('div');
                const isMine = (idx === myIdx);
                slot.className = 'fish-seat-slot' + (s.occupantId ? ' occupied' : '') + (isMine ? ' my-seat' : '');
                const labelName = s.occupantId
                    ? (s.isBot ? `🤖 ${s.occupantName}` : `👤 ${s.occupantName}`)
                    : '➕ Ngồi ghế này';
                const coinsTxt = s.occupantId ? `🪙 ${Math.floor(s.coins)} | Cấp ${s.cannonLv}` : 'Trống';
                slot.innerHTML = `
                    <span class="seat-pos-tag">${cfg.code}</span>
                    <span class="seat-player-name">${labelName}</span>
                    <span class="seat-coins">${coinsTxt}</span>
                `;
                window.bindSafeButton(slot, () => {
                    ensurePlayerSeated(idx);
                });
                seatsStripEl.appendChild(slot);
            });
        }

        function spawnBulletVisual(seatIdx, angle, cannonLv, isLocalOwner) {
            const cfg = SEAT_CONFIGS[seatIdx];
            if (!cfg) return;
            const cSpec = getCannonSpec(cannonLv);
            const muzzleDist = 34;
            const bx = cfg.x + Math.cos(angle) * muzzleDist;
            const by = cfg.y + Math.sin(angle) * muzzleDist;
            bullets.push({
                seatIdx: seatIdx,
                x: bx,
                y: by,
                vx: Math.cos(angle) * cSpec.speed,
                vy: Math.sin(angle) * cSpec.speed,
                cannonLv: cannonLv,
                color: cSpec.color,
                barrels: cSpec.barrels,
                dmg: cSpec.dmg,
                netR: cSpec.netR,
                isAuthoritative: isLocalOwner
            });
        }

        function fireShotFromSeat(seatIdx, targetX, targetY, isBotShot) {
            const seat = state.seats[seatIdx];
            const cfg = SEAT_CONFIGS[seatIdx];
            if (!seat || !cfg || !seat.occupantId) return;

            const cSpec = getCannonSpec(seat.cannonLv);
            if (seat.coins < cSpec.cost) {
                if (isBotShot) {
                    seat.coins = 1200;
                } else {
                    if (window.showToast) window.showToast('🪙 Hết xu! Hãy bấm "+1000 Xu" trên thanh công cụ để tiếp đạn!');
                    autoFire = false;
                    btnAuto.classList.remove('active');
                    btnAuto.innerText = '⚡ Tự bắn: TẮT';
                    return;
                }
            }

            const ang = Math.atan2(targetY - cfg.y, targetX - cfg.x);
            seat.angle = Number(ang.toFixed(3));
            seat.coins = Math.max(0, seat.coins - cSpec.cost);

            spawnBulletVisual(seatIdx, seat.angle, seat.cannonLv, true);
            renderHudAndSeats();

            syncStateToRoom({
                type: 'shoot',
                sender: getMyClientId(),
                seatIdx: seatIdx,
                angle: seat.angle,
                cannonLv: seat.cannonLv
            }, false);
        }

        function triggerNetExplosion(x, y, bullet) {
            nets.push({
                x: x,
                y: y,
                r: 8,
                maxR: bullet.netR,
                color: bullet.color,
                alpha: 1.0
            });

            if (!bullet.isAuthoritative) return;

            let hitAny = false;
            let stateChanged = false;
            const seat = state.seats[bullet.seatIdx];

            for (let i = state.fishes.length - 1; i >= 0; i--) {
                const f = state.fishes[i];
                const spec = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                const dist = Math.hypot(f.x - x, f.y - y);
                if (dist <= bullet.netR + spec.r * 0.85) {
                    hitAny = true;
                    f.hp -= bullet.dmg;
                    if (f.hp <= 0) {
                        const cSpec = getCannonSpec(bullet.cannonLv);
                        const rewardCoins = cSpec.cost * spec.mult;
                        if (seat) {
                            seat.coins += rewardCoins;
                            seat.score = (seat.score || 0) + rewardCoins;
                        }
                        spawnCatchCelebration(f.x, f.y, rewardCoins, spec.emoji, seat ? seat.idx : 0);
                        state.fishes.splice(i, 1);
                        stateChanged = true;

                        syncStateToRoom({
                            type: 'catch',
                            sender: getMyClientId(),
                            x: Math.round(f.x),
                            y: Math.round(f.y),
                            reward: rewardCoins,
                            emoji: spec.emoji,
                            seatIdx: seat ? seat.idx : 0
                        }, false);
                    }
                }
            }

            if (stateChanged) {
                while (state.fishes.length < 15) {
                    state.fishes.push(createSingleFish(false));
                }
                renderHudAndSeats();
            } else if (hitAny) {
                lastHostSyncTime = 0;
            }
        }

        function spawnCatchCelebration(x, y, reward, emoji, seatIdx) {
            const cfg = SEAT_CONFIGS[seatIdx] || SEAT_CONFIGS[0];
            floatingTexts.push({
                x: x,
                y: y,
                text: `${emoji} +${reward.toLocaleString('vi-VN')} Xu`,
                alpha: 1.0,
                vy: -1.4
            });
            for (let i = 0; i < 10; i++) {
                const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
                const spd = 2 + Math.random() * 3.5;
                coinParticles.push({
                    x: x + Math.cos(a) * 12,
                    y: y + Math.sin(a) * 12,
                    vx: Math.cos(a) * spd,
                    vy: Math.sin(a) * spd,
                    tx: cfg.x,
                    ty: cfg.y,
                    phase: 0
                });
            }
        }

        function getCanvasCoords(clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = TANK_W / Math.max(1, rect.width);
            const scaleY = TANK_H / Math.max(1, rect.height);
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        }

        function findBestTargetFish() {
            if (state.fishes.length === 0) return null;
            if (lockedFishId) {
                const found = state.fishes.find(f => f.id === lockedFishId);
                if (found && found.x > 20 && found.x < TANK_W - 20 && found.y > 20 && found.y < TANK_H - 20) {
                    return found;
                }
            }
            let best = null;
            let bestVal = -1;
            for (let i = 0; i < state.fishes.length; i++) {
                const f = state.fishes[i];
                if (f.x < 15 || f.x > TANK_W - 15 || f.y < 15 || f.y > TANK_H - 15) continue;
                const sp = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                if (sp.mult > bestVal) {
                    bestVal = sp.mult;
                    best = f;
                }
            }
            if (best) lockedFishId = best.id;
            return best;
        }

        canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isPointerDown = true;
            let myIdx = findMySeatIndex();
            if (myIdx === -1) {
                myIdx = ensurePlayerSeated();
            }
            pointerTarget = getCanvasCoords(e.clientX, e.clientY);

            if (lockBoss) {
                for (let i = state.fishes.length - 1; i >= 0; i--) {
                    const f = state.fishes[i];
                    const sp = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                    if (Math.hypot(f.x - pointerTarget.x, f.y - pointerTarget.y) <= sp.r + 14) {
                        lockedFishId = f.id;
                        break;
                    }
                }
            }

            if (myIdx !== -1) {
                const now = Date.now();
                if (now - lastShotTime >= 165) {
                    lastShotTime = now;
                    const tFish = lockBoss ? findBestTargetFish() : null;
                    const tx = tFish ? tFish.x : pointerTarget.x;
                    const ty = tFish ? tFish.y : pointerTarget.y;
                    fireShotFromSeat(myIdx, tx, ty, false);
                }
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            pointerTarget = getCanvasCoords(e.clientX, e.clientY);
            const myIdx = findMySeatIndex();
            if (myIdx !== -1 && !lockBoss) {
                const cfg = SEAT_CONFIGS[myIdx];
                state.seats[myIdx].angle = Math.atan2(pointerTarget.y - cfg.y, pointerTarget.x - cfg.x);
            }
        });

        window.addEventListener('pointerup', () => {
            isPointerDown = false;
        });

        window.bindSafeButton(btnCannonDown, () => {
            const myIdx = ensurePlayerSeated();
            if (myIdx === -1) return;
            const s = state.seats[myIdx];
            s.cannonLv = s.cannonLv <= 1 ? CANNON_LEVELS.length : s.cannonLv - 1;
            renderHudAndSeats();
            syncStateToRoom(null, false);
        });

        window.bindSafeButton(btnCannonUp, () => {
            const myIdx = ensurePlayerSeated();
            if (myIdx === -1) return;
            const s = state.seats[myIdx];
            s.cannonLv = s.cannonLv >= CANNON_LEVELS.length ? 1 : s.cannonLv + 1;
            renderHudAndSeats();
            syncStateToRoom(null, false);
        });

        window.bindSafeButton(btnAuto, () => {
            ensurePlayerSeated();
            autoFire = !autoFire;
            btnAuto.classList.toggle('active', autoFire);
            btnAuto.innerText = autoFire ? '⚡ Tự bắn: BẬT' : '⚡ Tự bắn: TẮT';
        });

        window.bindSafeButton(btnLock, () => {
            ensurePlayerSeated();
            lockBoss = !lockBoss;
            btnLock.classList.toggle('active', lockBoss);
            btnLock.innerText = lockBoss ? '🎯 Đang Khóa Boss' : '🎯 Khóa Boss';
            if (lockBoss) findBestTargetFish();
        });

        window.bindSafeButton(btnRefill, () => {
            const myIdx = ensurePlayerSeated();
            if (myIdx === -1) return;
            state.seats[myIdx].coins += 1000;
            renderHudAndSeats();
            syncStateToRoom(null, false);
            if (window.showToast) window.showToast('🪙 Đã tiếp thêm +1.000 Xu đại dương!');
        });

        window.bindSafeButton(btnBot, () => {
            const emptySeat = state.seats.find(s => !s.occupantId);
            if (emptySeat) {
                const botNames = ['Thợ Săn Cá Mập', 'Vua Thủy Tề', 'Xạ Thủ Đại Dương', 'Hải Tặc Tí Hon', 'Thuyền Trưởng Nemo', 'Ngư Ông Đắc Lợi'];
                emptySeat.occupantId = 'bot_' + emptySeat.idx + '_' + Date.now();
                emptySeat.occupantName = botNames[emptySeat.idx % botNames.length];
                emptySeat.isBot = true;
                emptySeat.coins = 2500;
                emptySeat.cannonLv = 2 + (emptySeat.idx % 3);
            } else {
                state.seats.forEach(s => {
                    if (s.isBot) {
                        s.occupantId = null;
                        s.occupantName = null;
                        s.isBot = false;
                    }
                });
            }
            renderHudAndSeats();
            syncStateToRoom(null, false);
        });

        window.bindSafeButton(btnWave, () => {
            for (let i = 0; i < 5; i++) {
                state.fishes.push(createSingleFish(i < 2));
            }
            if (state.fishes.length > 26) {
                state.fishes = state.fishes.slice(-26);
            }
            renderHudAndSeats();
            syncStateToRoom(null, false);
            if (window.showToast) window.showToast('🐉 Đàn Cá Lớn & Hải Vương Rồng Vàng đã tiến vào bể!');
        });

        function updateSimulation(now) {
            const myIdx = findMySeatIndex();
            if (myIdx !== -1 && (isPointerDown || autoFire)) {
                if (now - lastShotTime >= 185) {
                    lastShotTime = now;
                    const tFish = lockBoss ? findBestTargetFish() : null;
                    const tx = tFish ? tFish.x : pointerTarget.x;
                    const ty = tFish ? tFish.y : pointerTarget.y;
                    fireShotFromSeat(myIdx, tx, ty, false);
                }
            }

            if (isLocalCoordinator() && now - lastBotShotTime >= 620) {
                lastBotShotTime = now;
                state.seats.forEach((s, idx) => {
                    if (s.isBot && s.occupantId && state.fishes.length > 0) {
                        const targetF = state.fishes[Math.floor(Math.random() * state.fishes.length)];
                        if (targetF) {
                            fireShotFromSeat(idx, targetF.x, targetF.y, true);
                        }
                    }
                });
            }

            for (let i = state.fishes.length - 1; i >= 0; i--) {
                const f = state.fishes[i];
                const sp = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                f.swayPhase += 0.045;
                const perpX = -f.vy;
                const perpY = f.vx;
                f.x += f.vx + perpX * Math.sin(f.swayPhase) * f.swayAmp * 0.25;
                f.y += f.vy + perpY * Math.sin(f.swayPhase) * f.swayAmp * 0.25;

                const outMargin = sp.r + 75;
                if (f.x < -outMargin || f.x > TANK_W + outMargin || f.y < -outMargin || f.y > TANK_H + outMargin) {
                    if (isLocalCoordinator()) {
                        state.fishes[i] = createSingleFish(false);
                    } else {
                        if (f.x < -outMargin) f.x = TANK_W + sp.r;
                        if (f.x > TANK_W + outMargin) f.x = -sp.r;
                        if (f.y < -outMargin) f.y = TANK_H + sp.r;
                        if (f.y > TANK_H + outMargin) f.y = -sp.r;
                    }
                }
            }

            if (isLocalCoordinator() && state.fishes.length < 15) {
                while (state.fishes.length < 15) {
                    state.fishes.push(createSingleFish(Math.random() < 0.12));
                }
            }

            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                b.x += b.vx;
                b.y += b.vy;

                if (b.x <= 8 || b.x >= TANK_W - 8) {
                    b.vx = -b.vx;
                    b.x = Math.max(9, Math.min(TANK_W - 9, b.x));
                }
                if (b.y <= 8 || b.y >= TANK_H - 8) {
                    b.vy = -b.vy;
                    b.y = Math.max(9, Math.min(TANK_H - 9, b.y));
                }

                let collided = false;
                for (let j = 0; j < state.fishes.length; j++) {
                    const f = state.fishes[j];
                    const sp = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                    if (Math.hypot(f.x - b.x, f.y - b.y) <= sp.r + 6) {
                        collided = true;
                        triggerNetExplosion(b.x, b.y, b);
                        break;
                    }
                }
                if (collided) {
                    bullets.splice(i, 1);
                }
            }

            for (let i = nets.length - 1; i >= 0; i--) {
                const n = nets[i];
                n.r += (n.maxR - n.r) * 0.28;
                n.alpha -= 0.055;
                if (n.alpha <= 0) nets.splice(i, 1);
            }

            for (let i = coinParticles.length - 1; i >= 0; i--) {
                const cp = coinParticles[i];
                cp.phase += 0.05;
                if (cp.phase < 0.45) {
                    cp.x += cp.vx;
                    cp.y += cp.vy;
                    cp.vy += 0.15;
                } else {
                    cp.x += (cp.tx - cp.x) * 0.16;
                    cp.y += (cp.ty - cp.y) * 0.16;
                }
                if (Math.hypot(cp.tx - cp.x, cp.ty - cp.y) < 16 || cp.phase > 2.4) {
                    coinParticles.splice(i, 1);
                }
            }

            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                const ft = floatingTexts[i];
                ft.y += ft.vy;
                ft.alpha -= 0.022;
                if (ft.alpha <= 0) floatingTexts.splice(i, 1);
            }

            if (isLocalCoordinator() && now - lastHostSyncTime > 2600) {
                lastHostSyncTime = now;
                syncStateToRoom(null, false);
            }
        }

        function drawTankScene() {
            gCtx.clearRect(0, 0, TANK_W, TANK_H);

            gCtx.save();
            gCtx.strokeStyle = 'rgba(0, 210, 255, 0.25)';
            gCtx.lineWidth = 3;
            gCtx.strokeRect(6, 6, TANK_W - 12, TANK_H - 12);
            gCtx.restore();

            for (let i = 0; i < bgBubbles.length; i++) {
                const b = bgBubbles[i];
                b.phase += 0.03;
                b.y += b.vy;
                b.x += Math.sin(b.phase) * 0.3;
                if (b.y < -10) {
                    b.y = TANK_H + 10;
                    b.x = Math.random() * TANK_W;
                }
                gCtx.save();
                gCtx.strokeStyle = 'rgba(130, 227, 245, 0.25)';
                gCtx.lineWidth = 1.2;
                gCtx.beginPath();
                gCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                gCtx.stroke();
                gCtx.restore();
            }

            for (let i = 0; i < state.fishes.length; i++) {
                const f = state.fishes[i];
                const sp = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                const swimAngle = Math.atan2(f.vy, f.vx);

                gCtx.save();
                gCtx.translate(f.x, f.y);

                if (sp.isBoss || sp.isElite) {
                    gCtx.beginPath();
                    gCtx.arc(0, 0, sp.r + 7 + Math.sin(f.swayPhase * 2) * 3, 0, Math.PI * 2);
                    gCtx.strokeStyle = sp.glow;
                    gCtx.lineWidth = sp.isBoss ? 2.5 : 1.5;
                    gCtx.globalAlpha = 0.45;
                    gCtx.stroke();
                    gCtx.globalAlpha = 1;
                }

                if (lockBoss && f.id === lockedFishId) {
                    gCtx.beginPath();
                    gCtx.arc(0, 0, sp.r + 12, 0, Math.PI * 2);
                    gCtx.strokeStyle = '#ff4757';
                    gCtx.lineWidth = 2.2;
                    gCtx.setLineDash([6, 4]);
                    gCtx.stroke();
                    gCtx.setLineDash([]);
                }

                gCtx.save();
                const facingLeft = Math.cos(swimAngle) < 0;
                if (facingLeft) {
                    gCtx.rotate(swimAngle - Math.PI);
                    gCtx.scale(-1, 1);
                } else {
                    gCtx.rotate(swimAngle);
                }
                const wiggle = Math.sin(f.swayPhase * 2.4) * 0.09;
                gCtx.rotate(wiggle);
                gCtx.font = `${Math.round(sp.r * 1.65)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
                gCtx.textAlign = 'center';
                gCtx.textBaseline = 'middle';
                gCtx.shadowColor = sp.glow;
                gCtx.shadowBlur = sp.isBoss ? 16 : 6;
                gCtx.fillText(sp.emoji, 0, 0);
                gCtx.restore();

                if (f.hp < f.maxHp || sp.isBoss) {
                    const bw = Math.max(28, sp.r * 1.3);
                    const bh = 5;
                    const pct = Math.max(0, Math.min(1, f.hp / f.maxHp));
                    gCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                    gCtx.fillRect(-bw / 2, -sp.r - 12, bw, bh);
                    gCtx.fillStyle = pct > 0.45 ? '#2ed573' : '#ff4757';
                    gCtx.fillRect(-bw / 2, -sp.r - 12, bw * pct, bh);
                }

                if (sp.isBoss) {
                    gCtx.font = 'bold 10px Inter, sans-serif';
                    gCtx.fillStyle = '#ffd32a';
                    gCtx.textAlign = 'center';
                    gCtx.fillText(`${sp.name} (x${sp.mult})`, 0, sp.r + 12);
                }

                gCtx.restore();
            }

            for (let i = 0; i < nets.length; i++) {
                const n = nets[i];
                gCtx.save();
                gCtx.globalAlpha = Math.max(0, n.alpha);
                gCtx.strokeStyle = n.color;
                gCtx.fillStyle = n.color;
                gCtx.lineWidth = 2;
                gCtx.beginPath();
                gCtx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                gCtx.stroke();
                gCtx.globalAlpha = Math.max(0, n.alpha * 0.18);
                gCtx.fill();

                gCtx.globalAlpha = Math.max(0, n.alpha * 0.65);
                for (let k = 0; k < 6; k++) {
                    const a = (k * Math.PI) / 3;
                    gCtx.beginPath();
                    gCtx.moveTo(n.x, n.y);
                    gCtx.lineTo(n.x + Math.cos(a) * n.r, n.y + Math.sin(a) * n.r);
                    gCtx.stroke();
                }
                gCtx.restore();
            }

            for (let i = 0; i < bullets.length; i++) {
                const b = bullets[i];
                const ang = Math.atan2(b.vy, b.vx);
                gCtx.save();
                gCtx.translate(b.x, b.y);
                gCtx.rotate(ang);
                gCtx.fillStyle = b.color;
                gCtx.shadowColor = b.color;
                gCtx.shadowBlur = 10;
                const offsets = b.barrels === 3 ? [-6, 0, 6] : (b.barrels === 2 ? [-4, 4] : [0]);
                for (let k = 0; k < offsets.length; k++) {
                    gCtx.beginPath();
                    gCtx.ellipse(0, offsets[k], 7, 3.2, 0, 0, Math.PI * 2);
                    gCtx.fill();
                }
                gCtx.restore();
            }

            const mySeatIdx = findMySeatIndex();
            for (let i = 0; i < SEAT_CONFIGS.length; i++) {
                const cfg = SEAT_CONFIGS[i];
                const s = state.seats[i] || {};
                const isOccupied = !!s.occupantId;
                const isMine = (i === mySeatIdx);
                const cSpec = getCannonSpec(s.cannonLv || 1);
                const turretAngle = typeof s.angle === 'number' ? s.angle : cfg.baseAngle;

                gCtx.save();
                gCtx.translate(cfg.x, cfg.y);

                gCtx.beginPath();
                gCtx.arc(0, 0, 24, 0, Math.PI * 2);
                gCtx.fillStyle = isMine ? 'rgba(46, 213, 115, 0.28)' : (isOccupied ? 'rgba(0, 210, 255, 0.22)' : 'rgba(15, 23, 42, 0.65)');
                gCtx.fill();
                gCtx.lineWidth = isMine ? 2.8 : 1.6;
                gCtx.strokeStyle = isMine ? '#2ed573' : (isOccupied ? cSpec.color : 'rgba(255, 255, 255, 0.22)');
                gCtx.stroke();

                gCtx.save();
                gCtx.rotate(turretAngle);
                const barrelOffsets = cSpec.barrels === 3 ? [-7, 0, 7] : (cSpec.barrels === 2 ? [-4.5, 4.5] : [0]);
                gCtx.fillStyle = isOccupied ? cSpec.color : '#64748b';
                for (let b = 0; b < barrelOffsets.length; b++) {
                    gCtx.fillRect(4, barrelOffsets[b] - 3, 24, 6);
                }
                gCtx.beginPath();
                gCtx.arc(0, 0, 13, 0, Math.PI * 2);
                gCtx.fillStyle = isMine ? '#2ed573' : (isOccupied ? '#feca57' : '#475569');
                gCtx.fill();
                gCtx.restore();

                gCtx.font = 'bold 9.5px Inter, sans-serif';
                gCtx.textAlign = 'center';
                gCtx.fillStyle = isMine ? '#2ed573' : '#ffffff';
                let labelY = cfg.edge === 'top' ? 35 : -29;
                if (cfg.edge === 'left') {
                    gCtx.textAlign = 'left';
                    labelY = -28;
                } else if (cfg.edge === 'right') {
                    gCtx.textAlign = 'right';
                    labelY = -28;
                }
                const dispName = isOccupied
                    ? `${s.isBot ? '🤖' : ''}${s.occupantName.slice(0, 10)} (${Math.floor(s.coins)})`
                    : `${cfg.code.split(' ')[0]} [Trống]`;
                gCtx.fillText(dispName, 0, labelY);
                gCtx.restore();
            }

            for (let i = 0; i < coinParticles.length; i++) {
                const cp = coinParticles[i];
                gCtx.save();
                gCtx.beginPath();
                gCtx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
                gCtx.fillStyle = '#feca57';
                gCtx.strokeStyle = '#ffffff';
                gCtx.lineWidth = 1.5;
                gCtx.fill();
                gCtx.stroke();
                gCtx.restore();
            }

            for (let i = 0; i < floatingTexts.length; i++) {
                const ft = floatingTexts[i];
                gCtx.save();
                gCtx.globalAlpha = Math.max(0, ft.alpha);
                gCtx.font = '900 14px Inter, sans-serif';
                gCtx.fillStyle = '#feca57';
                gCtx.strokeStyle = '#000000';
                gCtx.lineWidth = 3;
                gCtx.textAlign = 'center';
                gCtx.strokeText(ft.text, ft.x, ft.y);
                gCtx.fillText(ft.text, ft.x, ft.y);
                gCtx.restore();
            }
        }

        function loop(now) {
            if (destroyed) return;
            updateSimulation(now || performance.now());
            drawTankScene();
            animFrameId = requestAnimationFrame(loop);
        }

        ensurePlayerSeated();
        renderHudAndSeats();
        animFrameId = requestAnimationFrame(loop);

        return {
            onSync: function(remoteData, animPayload) {
                if (animPayload) {
                    if (animPayload.type === 'shoot' && animPayload.sender !== getMyClientId()) {
                        const sIdx = animPayload.seatIdx;
                        if (state.seats[sIdx]) {
                            state.seats[sIdx].angle = animPayload.angle;
                            state.seats[sIdx].cannonLv = animPayload.cannonLv;
                        }
                        spawnBulletVisual(sIdx, animPayload.angle, animPayload.cannonLv, false);
                    } else if (animPayload.type === 'catch' && animPayload.sender !== getMyClientId()) {
                        spawnCatchCelebration(
                            animPayload.x || TANK_W / 2,
                            animPayload.y || TANK_H / 2,
                            animPayload.reward || 100,
                            animPayload.emoji || '🐠',
                            animPayload.seatIdx || 0
                        );
                    }
                }
                if (remoteData && Array.isArray(remoteData.seats)) {
                    const myIdx = findMySeatIndex();
                    const myLocalAngle = myIdx !== -1 ? state.seats[myIdx].angle : null;
                    state.seats = remoteData.seats;
                    if (myIdx !== -1 && myLocalAngle !== null && state.seats[myIdx]) {
                        state.seats[myIdx].angle = myLocalAngle;
                    }
                    if (Array.isArray(remoteData.fishes) && !isLocalCoordinator()) {
                        state.fishes = remoteData.fishes;
                    }
                    renderHudAndSeats();
                }
            },
            onResize: function() {},
            destroy: function() {
                destroyed = true;
                if (animFrameId) cancelAnimationFrame(animFrameId);
            }
        };
    }

    if (typeof window.registerSyncGameModule === 'function') {
        window.registerSyncGameModule('fishing', {
            title: '🐟 Bể Bắn Cá Đại Dương (8 Súng Quanh 4 Cạnh)',
            defaultWidth: 940,
            defaultHeight: 650,
            minWidth: 680,
            minHeight: 500,
            createInitialData: createInitialFishingData,
            mount: mountFishingGame
        });
    }
})();
