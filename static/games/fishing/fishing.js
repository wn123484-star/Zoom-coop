(function() {
    const CANNON_LEVELS = [
        { lv: 1, cost: 10, dmg: 16, speed: 11.0, netR: 38, barrels: 1, color: '#00d2ff', name: 'Cấp 1 (10 xu)' },
        { lv: 2, cost: 20, dmg: 34, speed: 11.8, netR: 44, barrels: 1, color: '#2ed573', name: 'Cấp 2 (20 xu)' },
        { lv: 3, cost: 40, dmg: 68, speed: 12.5, netR: 50, barrels: 2, color: '#feca57', name: 'Cấp 3 (40 xu)' },
        { lv: 4, cost: 80, dmg: 140, speed: 13.2, netR: 58, barrels: 2, color: '#ff9f43', name: 'Cấp 4 (80 xu)' },
        { lv: 5, cost: 150, dmg: 265, speed: 14.0, netR: 66, barrels: 3, color: '#ff4757', name: 'Cấp 5 (150 xu)' },
        { lv: 6, cost: 300, dmg: 550, speed: 15.0, netR: 78, barrels: 3, color: '#d6a2e8', name: 'Pháo Thần (300 xu)' }
    ];

    const FISH_SPECIES = [
        { key: 'clown', name: 'Cá Hề Nemo', emoji: '🐠', mult: 2, hp: 20, r: 16, speed: 1.55, weight: 28, glow: '#ff7f50' },
        { key: 'shrimp', name: 'Tôm Hùm Nhỏ', emoji: '🦐', mult: 3, hp: 28, r: 16, speed: 1.85, weight: 24, glow: '#ff6b81' },
        { key: 'neon', name: 'Cá Neon Xanh', emoji: '🐟', mult: 4, hp: 36, r: 18, speed: 1.75, weight: 22, glow: '#00d2ff' },
        { key: 'puffer', name: 'Cá Nóc Gai', emoji: '🐡', mult: 6, hp: 55, r: 21, speed: 1.3, weight: 18, glow: '#feca57' },
        { key: 'squid', name: 'Mực Ống Đỏ', emoji: '🦑', mult: 8, hp: 76, r: 23, speed: 1.65, weight: 15, glow: '#ff4757' },
        { key: 'crab', name: 'Cua Hoàng Đế', emoji: '🦀', mult: 10, hp: 105, r: 24, speed: 1.2, weight: 13, glow: '#ff6348' },
        { key: 'lobster', name: 'Tôm Hùm Vàng', emoji: '🦞', mult: 14, hp: 140, r: 26, speed: 1.25, weight: 11, glow: '#ffa502' },
        { key: 'jelly', name: 'Sứa Phát Quang', emoji: '🪼', mult: 16, hp: 160, r: 26, speed: 1.05, weight: 10, glow: '#d6a2e8' },
        { key: 'turtle', name: 'Rùa Kim Quy', emoji: '🐢', mult: 20, hp: 200, r: 29, speed: 0.98, weight: 9, glow: '#2ed573' },
        { key: 'octopus', name: 'Bạch Tuộc Khổng Lồ', emoji: '🐙', mult: 28, hp: 280, r: 32, speed: 1.12, weight: 7, glow: '#a55eea' },
        { key: 'dolphin', name: 'Cá Heo Ngọc Bích', emoji: '🐬', mult: 36, hp: 360, r: 35, speed: 1.6, weight: 5, glow: '#70a1ff' },
        { key: 'seal', name: 'Hải Cẩu Ngân Hà', emoji: '🦭', mult: 42, hp: 430, r: 36, speed: 1.35, weight: 4, glow: '#38bdf8', isElite: true },
        { key: 'shark', name: 'Cá Mập Đầu Búa', emoji: '🦈', mult: 55, hp: 560, r: 40, speed: 1.4, weight: 3, glow: '#94a3b8', isElite: true },
        { key: 'whale', name: 'Cá Voi Cổ Đại', emoji: '🐋', mult: 85, hp: 900, r: 46, speed: 0.92, weight: 2, glow: '#1e90ff', isBoss: true },
        { key: 'dragon', name: 'Hải Vương Rồng Vàng', emoji: '🐉', mult: 150, hp: 1500, r: 52, speed: 1.08, weight: 1, glow: '#ffd32a', isBoss: true }
    ];

    const SPECIES_MAP = {};
    FISH_SPECIES.forEach(s => { SPECIES_MAP[s.key] = s; });

    const fishSpriteCache = {};
    function getFishSprite(spec) {
        if (fishSpriteCache[spec.key]) return fishSpriteCache[spec.key];
        const pad = 18;
        const size = Math.ceil((spec.r * 2 + pad * 2));
        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        const c = off.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        if (spec.isBoss || spec.isElite) {
            const grad = c.createRadialGradient(cx, cy, spec.r * 0.15, cx, cy, spec.r + 12);
            grad.addColorStop(0, spec.glow + '77');
            grad.addColorStop(0.65, spec.glow + '28');
            grad.addColorStop(1, 'transparent');
            c.fillStyle = grad;
            c.beginPath();
            c.arc(cx, cy, spec.r + 12, 0, Math.PI * 2);
            c.fill();

            c.strokeStyle = spec.glow;
            c.lineWidth = spec.isBoss ? 2.4 : 1.5;
            c.globalAlpha = 0.65;
            c.beginPath();
            c.arc(cx, cy, spec.r + 5, 0, Math.PI * 2);
            c.stroke();
            c.globalAlpha = 1;
        }

        c.font = `${Math.round(spec.r * 1.65)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(spec.emoji, cx, cy);

        fishSpriteCache[spec.key] = off;
        return off;
    }

    function computeSeatConfigs(w, h) {
        return [
            { idx: 0, code: 'D1 (Dưới-Trái)', edge: 'bottom', x: w * 0.30, y: h - 18, baseAngle: -Math.PI / 2 },
            { idx: 1, code: 'D2 (Dưới-Phải)', edge: 'bottom', x: w * 0.70, y: h - 18, baseAngle: -Math.PI / 2 },
            { idx: 2, code: 'T1 (Trên-Trái)', edge: 'top', x: w * 0.30, y: 18, baseAngle: Math.PI / 2 },
            { idx: 3, code: 'T2 (Trên-Phải)', edge: 'top', x: w * 0.70, y: 18, baseAngle: Math.PI / 2 },
            { idx: 4, code: 'L1 (Trái-Trên)', edge: 'left', x: 18, y: h * 0.33, baseAngle: 0 },
            { idx: 5, code: 'L2 (Trái-Dưới)', edge: 'left', x: 18, y: h * 0.67, baseAngle: 0 },
            { idx: 6, code: 'R1 (Phải-Trên)', edge: 'right', x: w - 18, y: h * 0.33, baseAngle: Math.PI },
            { idx: 7, code: 'R2 (Phải-Dưới)', edge: 'right', x: w - 18, y: h * 0.67, baseAngle: Math.PI }
        ];
    }

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

    function createSingleFish(w, h, forceBoss) {
        const spec = pickWeightedSpecies(forceBoss);
        const side = Math.floor(Math.random() * 4);
        const pad = spec.r + 32;
        let x = 0;
        let y = 0;
        let targetX = w * (0.22 + Math.random() * 0.56);
        let targetY = h * (0.22 + Math.random() * 0.56);

        if (side === 0) {
            x = -pad;
            y = 70 + Math.random() * Math.max(100, h - 140);
            targetX = w + pad;
        } else if (side === 1) {
            x = w + pad;
            y = 70 + Math.random() * Math.max(100, h - 140);
            targetX = -pad;
        } else if (side === 2) {
            x = 90 + Math.random() * Math.max(120, w - 180);
            y = -pad;
            targetY = h + pad;
        } else {
            x = 90 + Math.random() * Math.max(120, w - 180);
            y = h + pad;
            targetY = -pad;
        }

        const ang = Math.atan2(targetY - y, targetX - x);
        return {
            id: 'f_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 99999),
            key: spec.key,
            x: Math.round(x),
            y: Math.round(y),
            vx: Number((Math.cos(ang) * spec.speed).toFixed(2)),
            vy: Number((Math.sin(ang) * spec.speed).toFixed(2)),
            hp: spec.hp,
            maxHp: spec.hp,
            swayAmp: Number((0.25 + Math.random() * 0.45).toFixed(2)),
            swayPhase: Number((Math.random() * Math.PI * 2).toFixed(2))
        };
    }

    function createFishSchoolFormation(w, h) {
        const schoolPool = ['clown', 'shrimp', 'neon', 'puffer', 'squid', 'jelly', 'dolphin'];
        const chosenKey = schoolPool[Math.floor(Math.random() * schoolPool.length)];
        const spec = SPECIES_MAP[chosenKey] || FISH_SPECIES[0];
        const fromLeft = Math.random() < 0.5;
        const baseY = 95 + Math.random() * Math.max(120, h - 190);
        const targetY = 95 + Math.random() * Math.max(120, h - 190);
        const startX = fromLeft ? -spec.r - 30 : w + spec.r + 30;
        const endX = fromLeft ? w + spec.r + 30 : -spec.r - 30;
        const ang = Math.atan2(targetY - baseY, endX - startX);
        const vx = Number((Math.cos(ang) * spec.speed * 1.12).toFixed(2));
        const vy = Number((Math.sin(ang) * spec.speed * 1.12).toFixed(2));

        const formationType = Math.floor(Math.random() * 3);
        const count = formationType === 0 ? 7 : 6;
        const spacing = spec.r * 2.15;
        const dirX = Math.cos(ang);
        const dirY = Math.sin(ang);
        const perpX = -dirY;
        const perpY = dirX;
        const created = [];

        for (let i = 0; i < count; i++) {
            let ox = 0;
            let oy = 0;
            if (formationType === 0) {
                const row = Math.ceil(i / 2);
                const side = (i % 2 === 1) ? 1 : -1;
                ox = -dirX * row * spacing + perpX * (i === 0 ? 0 : side * row * spacing * 0.6);
                oy = -dirY * row * spacing + perpY * (i === 0 ? 0 : side * row * spacing * 0.6);
            } else if (formationType === 1) {
                const col = Math.floor(i / 2);
                const side = (i % 2 === 0) ? -0.55 : 0.55;
                ox = -dirX * col * spacing + perpX * side * spacing;
                oy = -dirY * col * spacing + perpY * side * spacing;
            } else {
                ox = -dirX * i * spacing;
                oy = -dirY * i * spacing;
            }
            created.push({
                id: 'fs_' + Date.now().toString(36) + '_' + i + '_' + Math.floor(Math.random() * 9999),
                key: spec.key,
                x: Math.round(startX + ox),
                y: Math.round(baseY + oy),
                vx: vx,
                vy: vy,
                hp: spec.hp,
                maxHp: spec.hp,
                swayAmp: 0.32,
                swayPhase: Number((i * 0.45).toFixed(2))
            });
        }
        return created;
    }

    function createInitialFishingData() {
        const defaultSeats = computeSeatConfigs(920, 540).map(cfg => ({
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
        defaultSeats[0].occupantId = myId;
        defaultSeats[0].occupantName = myName;

        const initialFishes = createFishSchoolFormation(920, 540);
        for (let i = 0; i < 12; i++) {
            const f = createSingleFish(920, 540, i === 11);
            f.x = Math.round(120 + Math.random() * 680);
            f.y = Math.round(90 + Math.random() * 360);
            initialFishes.push(f);
        }

        return {
            seats: defaultSeats,
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
                    <button type="button" class="fish-btn fish-school-btn" title="Gọi một đàn cá bơi theo đội hình vào bể">🐟 Gọi Đàn Cá</button>
                    <button type="button" class="fish-btn fish-wave-btn" title="Triệu hồi Hải Vương Rồng Vàng & Cá Voi">🐉 Gọi Boss</button>
                </div>
            </div>
            <div class="fishing-seats-strip"></div>
            <div class="fishing-arena-wrap">
                <canvas class="fishing-canvas" width="920" height="540"></canvas>
                <div class="fishing-wave-overlay"></div>
                <div class="fishing-boss-banner">🐉 CẢNH BÁO: HẢI VƯƠNG BOSS ĐANG BƠI TRONG BỂ!</div>
            </div>
            <div class="fishing-guide-footer">
                <span>💡 <b>Kéo giãn góc dưới bên phải</b> để mở rộng bể cá! Chọn 1 trong 8 ghế quanh 4 cạnh để bắn.</span>
                <span>🏆 <b>15 Loài Cá & Đàn Cá:</b> Cá Hề x2 | Tôm Hùm x14 | Rùa Vàng x20 | Cá Heo x36 | Cá Mập x55 | Rồng Vàng x150</span>
            </div>
        </div>`;
    }

    function mountFishingGame(ctx) {
        const { bodyEl, widgetObj, emitUpdate } = ctx;
        bodyEl.innerHTML = buildFishingTemplateHtml();

        const rootEl = bodyEl.querySelector('.fishing-root');
        const arenaWrapEl = rootEl.querySelector('.fishing-arena-wrap');
        const canvas = rootEl.querySelector('.fishing-canvas');
        const gCtx = canvas.getContext('2d', { alpha: false });
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
        const btnSchool = rootEl.querySelector('.fish-school-btn');
        const btnWave = rootEl.querySelector('.fish-wave-btn');

        FISH_SPECIES.forEach(sp => getFishSprite(sp));

        let tankW = 920;
        let tankH = 540;
        let seatConfigs = computeSeatConfigs(tankW, tankH);
        let bgGrad = null;

        function rebuildTankGradient() {
            bgGrad = gCtx.createRadialGradient(tankW * 0.5, tankH * 0.5, 40, tankW * 0.5, tankH * 0.5, Math.max(tankW, tankH) * 0.68);
            bgGrad.addColorStop(0, '#0b446e');
            bgGrad.addColorStop(0.6, '#051f36');
            bgGrad.addColorStop(1, '#020c16');
        }

        function syncTankDimensionsToContainer() {
            const rect = arenaWrapEl.getBoundingClientRect();
            const scale = window.workspaceScale || 1;
            const rawW = Math.round((rect.width / scale) || arenaWrapEl.clientWidth || 920);
            const rawH = Math.round((rect.height / scale) || arenaWrapEl.clientHeight || 540);
            const nextW = Math.max(760, Math.min(2200, rawW));
            const nextH = Math.max(420, Math.min(1500, rawH));
            if (Math.abs(nextW - tankW) > 6 || Math.abs(nextH - tankH) > 6 || !bgGrad) {
                tankW = nextW;
                tankH = nextH;
                canvas.width = tankW;
                canvas.height = tankH;
                seatConfigs = computeSeatConfigs(tankW, tankH);
                rebuildTankGradient();
            }
        }

        let state = (widgetObj.game_data && Array.isArray(widgetObj.game_data.seats))
            ? JSON.parse(JSON.stringify(widgetObj.game_data))
            : createInitialFishingData();

        const seatSlotDOM = [];
        seatConfigs.forEach((cfg, idx) => {
            const slot = document.createElement('div');
            slot.className = 'fish-seat-slot';
            const posSpan = document.createElement('span');
            posSpan.className = 'seat-pos-tag';
            posSpan.textContent = cfg.code;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'seat-player-name';
            const coinsSpan = document.createElement('span');
            coinsSpan.className = 'seat-coins';
            slot.appendChild(posSpan);
            slot.appendChild(nameSpan);
            slot.appendChild(coinsSpan);
            window.bindSafeButton(slot, () => {
                ensurePlayerSeated(idx);
            });
            seatsStripEl.appendChild(slot);
            seatSlotDOM.push({ slot, nameSpan, coinsSpan });
        });

        const turretRecoils = new Array(8).fill(0);
        let bullets = [];
        let nets = [];
        let floatingTexts = [];
        let coinParticles = [];
        let bgBubbles = [];
        for (let i = 0; i < 22; i++) {
            bgBubbles.push({
                x: Math.random() * tankW,
                y: Math.random() * tankH,
                r: 1.5 + Math.random() * 3.2,
                vy: -0.35 - Math.random() * 0.55,
                phase: Math.random() * Math.PI * 2
            });
        }

        let isPointerDown = false;
        let pointerTarget = { x: tankW / 2, y: tankH / 2 };
        let autoFire = false;
        let lockBoss = false;
        let lockedFishId = null;
        let lastShotTime = 0;
        let lastBotShotTime = 0;
        let lastSchoolSpawnTime = Date.now();
        let lastNetSyncTime = Date.now();
        let globalWavePhase = 0;
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
                s.angle = seatConfigs[targetSeat].baseAngle;
                syncStateToRoom(null, false, true);
                renderHudAndSeatsFast();
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

        function syncStateToRoom(animPayload, echoSelf, forceNow) {
            const now = Date.now();
            if (!forceNow && !animPayload && now - lastNetSyncTime < 900) return;
            lastNetSyncTime = now;
            state.updatedAt = now;
            emitUpdate(state, animPayload || null, echoSelf === true);
        }

        function getCannonSpec(lv) {
            const idx = Math.max(0, Math.min(CANNON_LEVELS.length - 1, (lv || 1) - 1));
            return CANNON_LEVELS[idx];
        }

        function renderHudAndSeatsFast() {
            const myIdx = findMySeatIndex();
            if (myIdx !== -1) {
                const mySeat = state.seats[myIdx];
                const cSpec = getCannonSpec(mySeat.cannonLv);
                myCoinsEl.textContent = Math.floor(mySeat.coins).toLocaleString('vi-VN');
                mySeatLabelEl.textContent = seatConfigs[myIdx].code;
                cannonLvEl.textContent = cSpec.name;
                if (window.updateGlobalGameScore && mySeat.occupantName) {
                    window.updateGlobalGameScore('fishing', mySeat.occupantName, Math.floor(mySeat.coins));
                }
            } else {
                myCoinsEl.textContent = '---';
                mySeatLabelEl.textContent = 'Chạm ghế để ngồi';
                cannonLvEl.textContent = 'Cấp 2 (20 xu)';
            }

            const hasBoss = state.fishes.some(f => {
                const sp = SPECIES_MAP[f.key];
                return sp && sp.isBoss;
            });
            bossBannerEl.classList.toggle('show', hasBoss);

            for (let idx = 0; idx < state.seats.length; idx++) {
                const s = state.seats[idx];
                const dom = seatSlotDOM[idx];
                if (!dom) continue;
                const isMine = (idx === myIdx);
                const wantCls = 'fish-seat-slot' + (s.occupantId ? ' occupied' : '') + (isMine ? ' my-seat' : '');
                if (dom.slot.className !== wantCls) dom.slot.className = wantCls;
                const labelName = s.occupantId
                    ? (s.isBot ? `🤖 ${s.occupantName}` : `👤 ${s.occupantName}`)
                    : '➕ Ngồi ghế này';
                const coinsTxt = s.occupantId ? `🪙 ${Math.floor(s.coins)} | Cấp ${s.cannonLv}` : 'Trống';
                if (dom.nameSpan.textContent !== labelName) dom.nameSpan.textContent = labelName;
                if (dom.coinsSpan.textContent !== coinsTxt) dom.coinsSpan.textContent = coinsTxt;
            }
        }

        function spawnBulletVisual(seatIdx, angle, cannonLv, isLocalOwner) {
            if (bullets.length > 48) bullets.shift();
            const cfg = seatConfigs[seatIdx];
            if (!cfg) return;
            turretRecoils[seatIdx] = 7.5;
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
            const cfg = seatConfigs[seatIdx];
            if (!seat || !cfg || !seat.occupantId) return;

            const cSpec = getCannonSpec(seat.cannonLv);
            if (seat.coins < cSpec.cost) {
                if (isBotShot) {
                    seat.coins = 1500;
                } else {
                    if (window.showToast) window.showToast('🪙 Hết xu! Hãy bấm "+1000 Xu" trên thanh công cụ để tiếp đạn!');
                    autoFire = false;
                    btnAuto.classList.remove('active');
                    btnAuto.textContent = '⚡ Tự bắn: TẮT';
                    return;
                }
            }

            const ang = Math.atan2(targetY - cfg.y, targetX - cfg.x);
            seat.angle = Number(ang.toFixed(3));
            seat.coins = Math.max(0, seat.coins - cSpec.cost);

            spawnBulletVisual(seatIdx, seat.angle, seat.cannonLv, true);
            renderHudAndSeatsFast();

            if (!isBotShot && Date.now() - lastNetSyncTime > 380) {
                syncStateToRoom({
                    type: 'shoot',
                    sender: getMyClientId(),
                    seatIdx: seatIdx,
                    angle: seat.angle,
                    cannonLv: seat.cannonLv
                }, false, true);
            }
        }

        function triggerNetExplosion(x, y, bullet) {
            if (nets.length > 20) nets.shift();
            nets.push({
                x: x,
                y: y,
                r: 8,
                maxR: bullet.netR,
                color: bullet.color,
                alpha: 1.0
            });

            if (!bullet.isAuthoritative) return;

            let stateChanged = false;
            const seat = state.seats[bullet.seatIdx];

            for (let i = state.fishes.length - 1; i >= 0; i--) {
                const f = state.fishes[i];
                const spec = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                const dist = Math.hypot(f.x - x, f.y - y);
                if (dist <= bullet.netR + spec.r * 0.85) {
                    f.hp -= bullet.dmg;
                    f.hitFlash = 4;
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
                        }, false, true);
                    }
                }
            }

            if (stateChanged) {
                while (state.fishes.length < 18) {
                    state.fishes.push(createSingleFish(tankW, tankH, false));
                }
                renderHudAndSeatsFast();
            }
        }

        function spawnCatchCelebration(x, y, reward, emoji, seatIdx) {
            const cfg = seatConfigs[seatIdx] || seatConfigs[0];
            if (floatingTexts.length > 16) floatingTexts.shift();
            floatingTexts.push({
                x: x,
                y: y,
                text: `${emoji} +${reward.toLocaleString('vi-VN')}`,
                alpha: 1.0,
                vy: -1.5
            });
            for (let i = 0; i < 7; i++) {
                const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.4;
                const spd = 2.2 + Math.random() * 3.2;
                coinParticles.push({
                    x: x + Math.cos(a) * 10,
                    y: y + Math.sin(a) * 10,
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
            const scaleX = tankW / Math.max(1, rect.width);
            const scaleY = tankH / Math.max(1, rect.height);
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        }

        function findBestTargetFish() {
            if (state.fishes.length === 0) return null;
            if (lockedFishId) {
                const found = state.fishes.find(f => f.id === lockedFishId);
                if (found && found.x > 20 && found.x < tankW - 20 && found.y > 20 && found.y < tankH - 20) {
                    return found;
                }
            }
            let best = null;
            let bestVal = -1;
            for (let i = 0; i < state.fishes.length; i++) {
                const f = state.fishes[i];
                if (f.x < 15 || f.x > tankW - 15 || f.y < 15 || f.y > tankH - 15) continue;
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
                if (now - lastShotTime >= 170) {
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
                const cfg = seatConfigs[myIdx];
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
            renderHudAndSeatsFast();
            syncStateToRoom(null, false, true);
        });

        window.bindSafeButton(btnCannonUp, () => {
            const myIdx = ensurePlayerSeated();
            if (myIdx === -1) return;
            const s = state.seats[myIdx];
            s.cannonLv = s.cannonLv >= CANNON_LEVELS.length ? 1 : s.cannonLv + 1;
            renderHudAndSeatsFast();
            syncStateToRoom(null, false, true);
        });

        window.bindSafeButton(btnAuto, () => {
            ensurePlayerSeated();
            autoFire = !autoFire;
            btnAuto.classList.toggle('active', autoFire);
            btnAuto.textContent = autoFire ? '⚡ Tự bắn: BẬT' : '⚡ Tự bắn: TẮT';
        });

        window.bindSafeButton(btnLock, () => {
            ensurePlayerSeated();
            lockBoss = !lockBoss;
            btnLock.classList.toggle('active', lockBoss);
            btnLock.textContent = lockBoss ? '🎯 Đang Khóa Boss' : '🎯 Khóa Boss';
            if (lockBoss) findBestTargetFish();
        });

        window.bindSafeButton(btnRefill, () => {
            const myIdx = ensurePlayerSeated();
            if (myIdx === -1) return;
            state.seats[myIdx].coins += 1000;
            renderHudAndSeatsFast();
            syncStateToRoom(null, false, true);
            if (window.showToast) window.showToast('🪙 Đã tiếp thêm +1.000 Xu đại dương!');
        });

        window.bindSafeButton(btnBot, () => {
            const emptySeat = state.seats.find(s => !s.occupantId);
            if (emptySeat) {
                const botNames = ['Thợ Săn Cá Mập', 'Vua Thủy Tề', 'Xạ Thủ Đại Dương', 'Hải Tặc Tí Hon', 'Thuyền Trưởng Nemo', 'Ngư Ông'];
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
            renderHudAndSeatsFast();
            syncStateToRoom(null, false, true);
        });

        window.bindSafeButton(btnSchool, () => {
            const newSchool = createFishSchoolFormation(tankW, tankH);
            state.fishes.push(...newSchool);
            if (state.fishes.length > 34) {
                state.fishes = state.fishes.slice(-34);
            }
            renderHudAndSeatsFast();
            syncStateToRoom(null, false, true);
            if (window.showToast) window.showToast('🐟 Một đàn cá lớn đang bơi theo đội hình vào bể!');
        });

        window.bindSafeButton(btnWave, () => {
            for (let i = 0; i < 4; i++) {
                state.fishes.push(createSingleFish(tankW, tankH, i < 2));
            }
            if (state.fishes.length > 32) {
                state.fishes = state.fishes.slice(-32);
            }
            renderHudAndSeatsFast();
            syncStateToRoom(null, false, true);
            if (window.showToast) window.showToast('🐉 Hải Vương Rồng Vàng & Cá Voi Cổ Đại đã xuất hiện!');
        });

        syncTankDimensionsToContainer();

        function updateSimulation(now) {
            globalWavePhase += 0.025;
            for (let i = 0; i < 8; i++) {
                if (turretRecoils[i] > 0) turretRecoils[i] *= 0.78;
            }

            const myIdx = findMySeatIndex();
            if (myIdx !== -1 && (isPointerDown || autoFire)) {
                if (now - lastShotTime >= 180) {
                    lastShotTime = now;
                    const tFish = lockBoss ? findBestTargetFish() : null;
                    const tx = tFish ? tFish.x : pointerTarget.x;
                    const ty = tFish ? tFish.y : pointerTarget.y;
                    fireShotFromSeat(myIdx, tx, ty, false);
                }
            }

            if (isLocalCoordinator()) {
                if (now - lastBotShotTime >= 700) {
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
                if (now - lastSchoolSpawnTime > 14000 && state.fishes.length < 24) {
                    lastSchoolSpawnTime = now;
                    state.fishes.push(...createFishSchoolFormation(tankW, tankH));
                }
            }

            for (let i = state.fishes.length - 1; i >= 0; i--) {
                const f = state.fishes[i];
                const sp = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                f.swayPhase += 0.045;
                if (f.hitFlash > 0) f.hitFlash--;
                const perpX = -f.vy;
                const perpY = f.vx;
                f.x += f.vx + perpX * Math.sin(f.swayPhase) * f.swayAmp * 0.22;
                f.y += f.vy + perpY * Math.sin(f.swayPhase) * f.swayAmp * 0.22;

                const outMargin = sp.r + 110;
                if (f.x < -outMargin || f.x > tankW + outMargin || f.y < -outMargin || f.y > tankH + outMargin) {
                    if (isLocalCoordinator()) {
                        state.fishes[i] = createSingleFish(tankW, tankH, false);
                    } else {
                        if (f.x < -outMargin) f.x = tankW + sp.r;
                        if (f.x > tankW + outMargin) f.x = -sp.r;
                        if (f.y < -outMargin) f.y = tankH + sp.r;
                        if (f.y > tankH + outMargin) f.y = -sp.r;
                    }
                }
            }

            if (isLocalCoordinator() && state.fishes.length < 18) {
                while (state.fishes.length < 18) {
                    state.fishes.push(createSingleFish(tankW, tankH, Math.random() < 0.08));
                }
            }

            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                b.x += b.vx;
                b.y += b.vy;

                if (b.x <= 8 || b.x >= tankW - 8) {
                    b.vx = -b.vx;
                    b.x = Math.max(9, Math.min(tankW - 9, b.x));
                }
                if (b.y <= 8 || b.y >= tankH - 8) {
                    b.vy = -b.vy;
                    b.y = Math.max(9, Math.min(tankH - 9, b.y));
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
                n.r += (n.maxR - n.r) * 0.3;
                n.alpha -= 0.055;
                if (n.alpha <= 0) nets.splice(i, 1);
            }

            for (let i = coinParticles.length - 1; i >= 0; i--) {
                const cp = coinParticles[i];
                cp.phase += 0.055;
                if (cp.phase < 0.4) {
                    cp.x += cp.vx;
                    cp.y += cp.vy;
                    cp.vy += 0.14;
                } else {
                    cp.x += (cp.tx - cp.x) * 0.18;
                    cp.y += (cp.ty - cp.y) * 0.18;
                }
                if (Math.hypot(cp.tx - cp.x, cp.ty - cp.y) < 16 || cp.phase > 2.2) {
                    coinParticles.splice(i, 1);
                }
            }

            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                const ft = floatingTexts[i];
                ft.y += ft.vy;
                ft.alpha -= 0.024;
                if (ft.alpha <= 0) floatingTexts.splice(i, 1);
            }

            if (isLocalCoordinator() && now - lastNetSyncTime > 2400) {
                syncStateToRoom(null, false, true);
            }
        }

        function drawTankScene() {
            gCtx.fillStyle = bgGrad;
            gCtx.fillRect(0, 0, tankW, tankH);

            gCtx.save();
            gCtx.globalAlpha = 0.07;
            gCtx.fillStyle = '#00f5d4';
            for (let i = 0; i < 4; i++) {
                const rx = ((i * 260 + Math.sin(globalWavePhase + i) * 65) % (tankW + 200)) - 100;
                gCtx.beginPath();
                gCtx.moveTo(rx, 0);
                gCtx.lineTo(rx + 95, 0);
                gCtx.lineTo(rx - 45, tankH);
                gCtx.lineTo(rx - 140, tankH);
                gCtx.closePath();
                gCtx.fill();
            }
            gCtx.restore();

            gCtx.strokeStyle = 'rgba(0, 210, 255, 0.28)';
            gCtx.lineWidth = 2;
            gCtx.strokeRect(5, 5, tankW - 10, tankH - 10);

            gCtx.strokeStyle = 'rgba(130, 227, 245, 0.24)';
            gCtx.lineWidth = 1;
            for (let i = 0; i < bgBubbles.length; i++) {
                const b = bgBubbles[i];
                b.phase += 0.025;
                b.y += b.vy;
                b.x += Math.sin(b.phase) * 0.28;
                if (b.y < -10) {
                    b.y = tankH + 10;
                    b.x = Math.random() * tankW;
                }
                gCtx.beginPath();
                gCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                gCtx.stroke();
            }

            for (let i = 0; i < state.fishes.length; i++) {
                const f = state.fishes[i];
                const sp = SPECIES_MAP[f.key] || FISH_SPECIES[0];
                const spr = getFishSprite(sp);
                const swimAngle = Math.atan2(f.vy, f.vx);

                gCtx.save();
                gCtx.translate(f.x, f.y);

                if (lockBoss && f.id === lockedFishId) {
                    gCtx.beginPath();
                    gCtx.arc(0, 0, sp.r + 11, 0, Math.PI * 2);
                    gCtx.strokeStyle = '#ff4757';
                    gCtx.lineWidth = 2.2;
                    gCtx.stroke();
                }

                gCtx.save();
                if (Math.cos(swimAngle) < 0) {
                    gCtx.rotate(swimAngle - Math.PI);
                    gCtx.scale(-1, 1);
                } else {
                    gCtx.rotate(swimAngle);
                }
                gCtx.rotate(Math.sin(f.swayPhase * 2.4) * 0.09);
                if (f.hitFlash > 0) {
                    gCtx.globalAlpha = 0.65;
                }
                gCtx.drawImage(spr, -spr.width / 2, -spr.height / 2);
                gCtx.restore();

                if (f.hp < f.maxHp || sp.isBoss) {
                    const bw = Math.max(26, sp.r * 1.25);
                    const pct = Math.max(0, Math.min(1, f.hp / f.maxHp));
                    gCtx.fillStyle = 'rgba(0, 0, 0, 0.68)';
                    gCtx.fillRect(-bw / 2, -sp.r - 11, bw, 4.5);
                    gCtx.fillStyle = pct > 0.45 ? '#2ed573' : '#ff4757';
                    gCtx.fillRect(-bw / 2, -sp.r - 11, bw * pct, 4.5);
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
                gCtx.lineWidth = 2;
                gCtx.beginPath();
                gCtx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                gCtx.stroke();
                gCtx.beginPath();
                gCtx.arc(n.x, n.y, n.r * 0.62, 0, Math.PI * 2);
                gCtx.stroke();
                gCtx.restore();
            }

            for (let i = 0; i < bullets.length; i++) {
                const b = bullets[i];
                const ang = Math.atan2(b.vy, b.vx);
                gCtx.save();
                gCtx.translate(b.x, b.y);
                gCtx.rotate(ang);
                gCtx.fillStyle = b.color;
                const offsets = b.barrels === 3 ? [-6, 0, 6] : (b.barrels === 2 ? [-4, 4] : [0]);
                for (let k = 0; k < offsets.length; k++) {
                    gCtx.beginPath();
                    gCtx.ellipse(0, offsets[k], 7, 3.2, 0, 0, Math.PI * 2);
                    gCtx.fill();
                }
                gCtx.restore();
            }

            const mySeatIdx = findMySeatIndex();
            for (let i = 0; i < seatConfigs.length; i++) {
                const cfg = seatConfigs[i];
                const s = state.seats[i] || {};
                const isOccupied = !!s.occupantId;
                const isMine = (i === mySeatIdx);
                const cSpec = getCannonSpec(s.cannonLv || 1);
                const turretAngle = typeof s.angle === 'number' ? s.angle : cfg.baseAngle;
                const recoil = turretRecoils[i] || 0;

                gCtx.save();
                gCtx.translate(cfg.x, cfg.y);

                gCtx.beginPath();
                gCtx.arc(0, 0, 23, 0, Math.PI * 2);
                gCtx.fillStyle = isMine ? 'rgba(46, 213, 115, 0.32)' : (isOccupied ? 'rgba(0, 210, 255, 0.22)' : 'rgba(15, 23, 42, 0.72)');
                gCtx.fill();
                gCtx.lineWidth = isMine ? 2.6 : 1.5;
                gCtx.strokeStyle = isMine ? '#2ed573' : (isOccupied ? cSpec.color : 'rgba(255, 255, 255, 0.22)');
                gCtx.stroke();

                gCtx.save();
                gCtx.rotate(turretAngle);
                gCtx.translate(-recoil, 0);
                const barrelOffsets = cSpec.barrels === 3 ? [-6.5, 0, 6.5] : (cSpec.barrels === 2 ? [-4, 4] : [0]);
                gCtx.fillStyle = isOccupied ? cSpec.color : '#64748b';
                for (let b = 0; b < barrelOffsets.length; b++) {
                    gCtx.fillRect(4, barrelOffsets[b] - 2.8, 23, 5.6);
                }
                gCtx.beginPath();
                gCtx.arc(0, 0, 12.5, 0, Math.PI * 2);
                gCtx.fillStyle = isMine ? '#2ed573' : (isOccupied ? '#feca57' : '#475569');
                gCtx.fill();
                gCtx.restore();

                gCtx.font = 'bold 10px Inter, sans-serif';
                gCtx.textAlign = 'center';
                gCtx.fillStyle = isMine ? '#2ed573' : '#ffffff';
                let labelY = cfg.edge === 'top' ? 35 : -28;
                if (cfg.edge === 'left') {
                    gCtx.textAlign = 'left';
                    labelY = -27;
                } else if (cfg.edge === 'right') {
                    gCtx.textAlign = 'right';
                    labelY = -27;
                }
                const dispName = isOccupied
                    ? `${s.isBot ? '🤖' : ''}${(s.occupantName || '').slice(0, 10)} (${Math.floor(s.coins)})`
                    : `${cfg.code.split(' ')[0]} [Trống]`;
                gCtx.fillText(dispName, 0, labelY);
                gCtx.restore();
            }

            gCtx.fillStyle = '#feca57';
            for (let i = 0; i < coinParticles.length; i++) {
                const cp = coinParticles[i];
                gCtx.beginPath();
                gCtx.arc(cp.x, cp.y, 5.5, 0, Math.PI * 2);
                gCtx.fill();
            }

            for (let i = 0; i < floatingTexts.length; i++) {
                const ft = floatingTexts[i];
                gCtx.save();
                gCtx.globalAlpha = Math.max(0, ft.alpha);
                gCtx.font = '900 13.5px Inter, sans-serif';
                gCtx.fillStyle = '#feca57';
                gCtx.textAlign = 'center';
                gCtx.fillText(ft.text, ft.x, ft.y);
                gCtx.restore();
            }
        }

        function loop(now) {
            if (destroyed) return;
            if (!document.hidden && !ctx.widgetEl.classList.contains('minimized') && !ctx.widgetEl.classList.contains('culled-offscreen')) {
                updateSimulation(now || performance.now());
                drawTankScene();
            }
            animFrameId = requestAnimationFrame(loop);
        }

        ensurePlayerSeated();
        renderHudAndSeatsFast();
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
                            animPayload.x || tankW / 2,
                            animPayload.y || tankH / 2,
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
                    renderHudAndSeatsFast();
                }
            },
            onResize: function() {
                syncTankDimensionsToContainer();
            },
            destroy: function() {
                destroyed = true;
                if (animFrameId) cancelAnimationFrame(animFrameId);
            }
        };
    }

    if (typeof window.registerSyncGameModule === 'function') {
        window.registerSyncGameModule('fishing', {
            title: '🐟 Bắn Cá 8 Súng',
            defaultWidth: 940,
            defaultHeight: 640,
            minWidth: 680,
            minHeight: 500,
            createInitialData: createInitialFishingData,
            mount: mountFishingGame
        });
    }
})();
