(function () {
    if (window.__nividaLiquidCatLoaded) return;
    window.__nividaLiquidCatLoaded = true;

    const CAT_BREEDS = {
        nivida_cyber: {
            name: 'Mèo Thần Tài Nivida (Cyber Lime)',
            body: 'rgb(30, 41, 59)',
            belly: 'rgb(118, 185, 0)',
            stroke: 'rgb(15, 23, 42)',
            pCol: 'rgb(132, 204, 22)',
            pattern: 'points',
            eyeColor: 'rgb(16, 185, 129)',
            eyeColor2: 'rgb(16, 185, 129)',
            tailStyle: 'fluffy'
        },
        calico_lucky: {
            name: 'Mèo Tam Thể May Mắn (Calico)',
            body: 'rgb(255, 251, 235)',
            belly: 'rgb(255, 255, 255)',
            stroke: 'rgb(41, 37, 36)',
            pCol: 'rgb(249, 115, 22)',
            pattern: 'calico',
            eyeColor: 'rgb(217, 119, 6)',
            eyeColor2: 'rgb(217, 119, 6)',
            tailStyle: 'normal'
        },
        tuxedo_boss: {
            name: 'Mèo Giám Đốc Vest Đen (Tuxedo)',
            body: 'rgb(39, 39, 42)',
            belly: 'rgb(248, 250, 252)',
            stroke: 'rgb(9, 9, 11)',
            pCol: 'rgb(24, 24, 27)',
            pattern: 'cow',
            eyeColor: 'rgb(234, 179, 8)',
            eyeColor2: 'rgb(234, 179, 8)',
            tailStyle: 'long'
        },
        ginger_boba: {
            name: 'Mèo Cam Mê Trà Sữa (Orange Tabby)',
            body: 'rgb(251, 146, 60)',
            belly: 'rgb(255, 237, 213)',
            stroke: 'rgb(124, 45, 18)',
            pCol: 'rgb(234, 88, 12)',
            pattern: 'stripes',
            eyeColor: 'rgb(217, 119, 6)',
            eyeColor2: 'rgb(217, 119, 6)',
            tailStyle: 'fluffy'
        },
        white_cloud: {
            name: 'Mèo Bạch Tuyết Mắt 2 Màu (Cloud)',
            body: 'rgb(248, 250, 252)',
            belly: 'rgb(255, 255, 255)',
            stroke: 'rgb(71, 85, 105)',
            pCol: 'rgb(226, 232, 240)',
            pattern: 'solid',
            eyeColor: 'rgb(2, 132, 199)',
            eyeColor2: 'rgb(234, 179, 8)',
            tailStyle: 'fluffy'
        }
    };

    const BREED_KEYS = Object.keys(CAT_BREEDS);

    function lerpVal(a, b, t) {
        return a + (b - a) * Math.min(1, Math.max(0, t));
    }

    class LiquidSoftBodyJS {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.numNodes = 12;
            this.baseRx = 34;
            this.baseRy = 25;
            this.targetScaleX = 1.12;
            this.targetScaleY = 0.90;
            this.smoothScaleX = 1.12;
            this.smoothScaleY = 0.90;
            this.nodes = [];
            for (let i = 0; i < this.numNodes; i++) {
                const ang = (2 * Math.PI * i) / this.numNodes;
                this.nodes.push({
                    x: x + this.baseRx * Math.cos(ang),
                    y: y + this.baseRy * Math.sin(ang),
                    vx: 0,
                    vy: 0
                });
            }
        }

        resetNodesExact() {
            const rx = this.baseRx * this.smoothScaleX;
            const ry = this.baseRy * this.smoothScaleY;
            for (let i = 0; i < this.numNodes; i++) {
                const ang = (2 * Math.PI * i) / this.numNodes;
                this.nodes[i].x = this.x + rx * Math.cos(ang);
                this.nodes[i].y = this.y + ry * Math.sin(ang);
                this.nodes[i].vx = 0;
                this.nodes[i].vy = 0;
            }
        }

        setPosition(newX, newY, newVx = null, newVy = null) {
            const dx = newX - this.x;
            const dy = newY - this.y;
            this.x = newX;
            this.y = newY;
            if (newVx !== null) this.vx = newVx;
            if (newVy !== null) this.vy = newVy;
            for (let i = 0; i < this.numNodes; i++) {
                this.nodes[i].x += dx;
                this.nodes[i].y += dy;
                this.nodes[i].vx = 0;
                this.nodes[i].vy = 0;
            }
        }

        setLiquidState(st) {
            if (st.includes('sploot') || st.includes('melt') || st.includes('puddle')) {
                this.targetScaleX = 1.46;
                this.targetScaleY = 0.58;
            } else if (st.includes('loaf') || st.includes('sleep')) {
                this.targetScaleX = 1.24;
                this.targetScaleY = 0.76;
            } else if (st.includes('run') || st.includes('sprint') || st.includes('zoom')) {
                this.targetScaleX = 1.34;
                this.targetScaleY = 0.68;
            } else if (st.includes('jump') || st.includes('flip') || st.includes('reach') || st.includes('dance')) {
                this.targetScaleX = 0.88;
                this.targetScaleY = 1.22;
            } else {
                this.targetScaleX = 1.10;
                this.targetScaleY = 0.90;
            }
        }

        stepPhysics(dt, floorY, perches, minX, maxX, isDragging, passThroughPerch) {
            const safeDt = Math.min(0.025, Math.max(0.004, dt));
            this.smoothScaleX = lerpVal(this.smoothScaleX, this.targetScaleX, safeDt * 9.0);
            this.smoothScaleY = lerpVal(this.smoothScaleY, this.targetScaleY, safeDt * 9.0);

            const prevY = this.y;
            if (!isDragging) {
                const gravity = this.vy > 120 ? 680 : 940;
                this.vy += gravity * safeDt;
                this.x += this.vx * safeDt;
                this.y += this.vy * safeDt;

                if (!passThroughPerch && this.vy >= 0) {
                    for (let i = 0; i < perches.length; i++) {
                        const p = perches[i];
                        if (this.x >= p.x1 && this.x <= p.x2) {
                            if (prevY <= p.y && this.y >= p.y - 4) {
                                if (this.vy > 180) {
                                    this.smoothScaleX = 1.38;
                                    this.smoothScaleY = 0.65;
                                }
                                this.y = p.y;
                                this.vy = 0;
                                this.vx *= 0.80;
                                break;
                            }
                        }
                    }
                }

                if (this.y >= floorY) {
                    if (this.vy > 200) {
                        this.smoothScaleX = 1.44;
                        this.smoothScaleY = 0.60;
                    }
                    this.y = floorY;
                    this.vy = 0;
                    this.vx *= 0.82;
                }
                if (this.y < 58) {
                    this.y = 58;
                    if (this.vy < 0) this.vy = 40;
                }
                if (this.x < minX) {
                    this.x = minX;
                    this.vx = Math.abs(this.vx) * 0.6;
                } else if (this.x > maxX) {
                    this.x = maxX;
                    this.vx = -Math.abs(this.vx) * 0.6;
                }
            }

            const rx = this.baseRx * this.smoothScaleX;
            const ry = this.baseRy * this.smoothScaleY;
            const maxStretch = 16;

            for (let i = 0; i < this.numNodes; i++) {
                const ang = (2 * Math.PI * i) / this.numNodes;
                const idealX = this.x + rx * Math.cos(ang);
                const idealY = this.y + ry * Math.sin(ang);
                const n = this.nodes[i];

                const dx = idealX - n.x;
                const dy = idealY - n.y;
                if (Math.hypot(dx, dy) > maxStretch * 2.2) {
                    n.x = idealX;
                    n.y = idealY;
                    n.vx = 0;
                    n.vy = 0;
                } else {
                    n.vx = (n.vx + dx * 22 * safeDt) * 0.68;
                    n.vy = (n.vy + dy * 22 * safeDt) * 0.68;
                    n.x += n.vx;
                    n.y += n.vy;
                    const errX = n.x - idealX;
                    const errY = n.y - idealY;
                    if (Math.abs(errX) > maxStretch) n.x = idealX + Math.sign(errX) * maxStretch;
                    if (Math.abs(errY) > maxStretch) n.y = idealY + Math.sign(errY) * maxStretch;
                }
            }
        }
    }

    class WebLiquidCatAssistant {
        constructor() {
            const savedState = this.loadSavedCatState();
            this.floorY = window.innerHeight - 54;
            const startX = savedState.x || Math.min(window.innerWidth - 200, Math.max(460, window.innerWidth * 0.65));
            const startY = savedState.y ? Math.min(this.floorY, Math.max(80, savedState.y)) : this.floorY;

            this.softBody = new LiquidSoftBodyJS(startX, startY);
            this.softBody.resetNodesExact();

            this.breedKey = savedState.breedKey && CAT_BREEDS[savedState.breedKey] ? savedState.breedKey : 'nivida_cyber';
            this.breed = CAT_BREEDS[this.breedKey];
            this.state = savedState.state || 'sitting';
            this.expr = savedState.expr || 'normal';
            this.direction = savedState.direction || -1;
            this.stateTimer = 5.0;
            this.animTime = 0;
            this.targetX = null;
            this.targetY = null;
            this.passThroughTimer = 0;
            this.isDragging = false;
            this.dragMoved = false;
            this.mousePos = { x: startX, y: startY - 30 };
            this.particles = [];
            this.bodyTilt = 0;
            this.blinkTimer = 3.5;
            this.eyeOpen = 1.0;
            this.bubbleTimeout = null;
            this.groqReady = false;
            this.channel = null;
            this.perches = [];

            this.injectStylesAndDOM();
            this.resizeCanvas();
            this.bindEvents();
            this.initCrossTabSync();
            this.fetchBackendInit();

            if (savedState.bubbleText && (Date.now() - (savedState.ts || 0) < 10000)) {
                this.showBubble(savedState.bubbleText, 6000, false);
            } else {
                this.showBubble('Meow~ Bấm vào ô Chat góc trái để bảo Mèo tìm đồ, bỏ giỏ hàng, đổi nền tối hoặc kéo thả Mèo nhảy khắp màn hình nha! 🐾', 7000, false);
            }

            this.lastTs = performance.now();
            requestAnimationFrame((ts) => this.loop(ts));
        }

        buildPerches() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.perches = [
                { x1: w * 0.08, x2: w * 0.34, y: h * 0.68 },
                { x1: w * 0.66, x2: w * 0.92, y: h * 0.66 },
                { x1: w * 0.35, x2: w * 0.65, y: h * 0.48 },
                { x1: w * 0.14, x2: w * 0.40, y: h * 0.30 },
                { x1: w * 0.60, x2: w * 0.88, y: h * 0.28 }
            ];
        }

        loadSavedCatState() {
            try {
                return JSON.parse(localStorage.getItem('nivida_liquid_cat_state') || '{}');
            } catch {
                return {};
            }
        }

        saveCatState(bubbleText = '') {
            try {
                const payload = {
                    x: Math.round(this.softBody.x),
                    y: Math.round(this.softBody.y),
                    breedKey: this.breedKey,
                    state: this.state,
                    expr: this.expr,
                    direction: this.direction,
                    bubbleText: bubbleText || this.currentBubbleText || '',
                    ts: Date.now()
                };
                localStorage.setItem('nivida_liquid_cat_state', JSON.stringify(payload));
                if (this.channel) {
                    this.channel.postMessage(payload);
                }
            } catch {}
        }

        initCrossTabSync() {
            try {
                if (typeof BroadcastChannel !== 'undefined') {
                    this.channel = new BroadcastChannel('nivida_liquid_cat_sync');
                    this.channel.onmessage = (ev) => {
                        const d = ev.data || {};
                        if (d.breedKey && CAT_BREEDS[d.breedKey]) {
                            this.breedKey = d.breedKey;
                            this.breed = CAT_BREEDS[this.breedKey];
                        }
                        if (typeof d.x === 'number' && typeof d.y === 'number') {
                            this.softBody.setPosition(
                                Math.min(window.innerWidth - 65, Math.max(65, d.x)),
                                Math.min(this.floorY, Math.max(65, d.y)),
                                0, 0
                            );
                            this.softBody.resetNodesExact();
                        }
                        if (d.state) this.setCatState(d.state, 5.0, d.expr || 'normal', false);
                        if (d.bubbleText) this.showBubble(d.bubbleText, 5500, false);
                    };
                }
            } catch {}
        }

        async fetchBackendInit() {
            try {
                const res = await fetch('/api/settings/cat-assistant/init');
                if (res.ok) {
                    const data = await res.json();
                    this.groqReady = Boolean(data.groq_ready);
                    this.updateGroqBadge();
                }
            } catch {}
        }

        updateGroqBadge() {
            const badge = document.getElementById('catGroqStatusBadge');
            const keyRow = document.getElementById('catGroqKeyInputRow');
            if (!badge) return;
            if (this.groqReady) {
                badge.textContent = '🟢 Groq AI: Đã Kết Nối';
                badge.style.background = 'rgb(22, 163, 74)';
            } else {
                badge.textContent = '🔑 Bấm nhập Groq Key';
                badge.style.background = 'rgb(217, 119, 6)';
                if (keyRow && !sessionStorage.getItem('cat_key_row_closed')) {
                    keyRow.classList.remove('d-none');
                }
            }
        }

        injectStylesAndDOM() {
            const dockMinimized = localStorage.getItem('nivida_cat_dock_minimized') === '1';

            const styleEl = document.createElement('style');
            styleEl.textContent = `
                .nivida-cat-canvas {
                    position: fixed;
                    left: 0;
                    top: 0;
                    width: 100vw;
                    height: 100vh;
                    pointer-events: none;
                    z-index: 10040;
                }
                .nivida-cat-hitbox {
                    position: fixed;
                    width: 112px;
                    height: 92px;
                    cursor: grab;
                    z-index: 10045;
                    border-radius: 50%;
                    user-select: none;
                }
                .nivida-cat-hitbox:active {
                    cursor: grabbing;
                }
                .nivida-cat-bubble {
                    position: fixed;
                    max-width: 310px;
                    min-width: 175px;
                    background: rgb(15, 23, 42);
                    color: rgb(248, 250, 252);
                    border: 2px solid rgb(118, 185, 0);
                    border-radius: 14px;
                    padding: 8px 12px;
                    font-size: 0.79rem;
                    font-weight: 600;
                    line-height: 1.42;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.45);
                    z-index: 10048;
                    pointer-events: auto;
                    transition: opacity 0.18s ease;
                }
                .nivida-cat-bubble::after {
                    content: '';
                    position: absolute;
                    bottom: -9px;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 9px 8px 0;
                    border-style: solid;
                    border-color: rgb(118, 185, 0) transparent;
                    display: block;
                    width: 0;
                }
                .nivida-cat-bubble.d-none {
                    opacity: 0;
                    pointer-events: none;
                }
                .nivida-cat-dock {
                    position: fixed;
                    bottom: 64px;
                    left: 16px;
                    width: min(415px, calc(100vw - 32px));
                    background: rgba(15, 23, 42, 0.96);
                    color: rgb(248, 250, 252);
                    border: 2px solid rgb(118, 185, 0);
                    border-radius: 14px;
                    padding: 10px 12px;
                    box-shadow: 0 16px 40px rgba(0,0,0,0.55);
                    z-index: 10050;
                    backdrop-filter: blur(6px);
                }
                .nivida-cat-dock.d-none {
                    display: none !important;
                }
                .cat-action-chip {
                    background: rgb(30, 41, 59);
                    color: rgb(226, 232, 240);
                    border: 1px solid rgb(71, 85, 105);
                    border-radius: 999px;
                    padding: 3px 9px;
                    font-size: 0.71rem;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.15s;
                }
                .cat-action-chip:hover {
                    background: rgb(118, 185, 0);
                    color: rgb(15, 23, 42);
                    border-color: rgb(118, 185, 0);
                }
                .cat-toggle-pill {
                    position: fixed;
                    bottom: 64px;
                    left: 16px;
                    z-index: 10049;
                    background: linear-gradient(135deg, rgb(15, 23, 42), rgb(30, 41, 59));
                    color: rgb(163, 230, 53);
                    border: 2px solid rgb(118, 185, 0);
                    border-radius: 999px;
                    padding: 7px 15px;
                    font-size: 0.82rem;
                    font-weight: 800;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.45);
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .cat-product-tray {
                    max-height: 165px;
                    overflow-y: auto;
                    margin-top: 8px;
                    padding-top: 6px;
                    border-top: 1px dashed rgb(51, 65, 85);
                }
            `;
            document.head.appendChild(styleEl);

            const wrap = document.createElement('div');
            wrap.innerHTML = `
                <canvas id="nividaLiquidCatCanvas" class="nivida-cat-canvas"></canvas>
                <div id="nividaCatHitbox" class="nivida-cat-hitbox" title="Bấm vào Mèo để Chat hoặc Nắm kéo Mèo nhảy lên cao khắp màn hình!"></div>
                <div id="nividaCatSpeechBubble" class="nivida-cat-bubble d-none"></div>

                <button type="button" id="nividaCatOpenBtn" class="cat-toggle-pill ${dockMinimized ? '' : 'd-none'}">
                    <span>🐱 Mở Khung Chat Mèo AI &amp; Cài Đặt Key</span>
                </button>

                <div id="nividaCatControlDock" class="nivida-cat-dock ${dockMinimized ? 'd-none' : ''}">
                    <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom border-secondary flex-wrap gap-1">
                        <div class="d-flex align-items-center gap-1">
                            <strong class="small" style="color:rgb(163, 230, 53);">🐱 Chat Với Mèo Lỏng AI</strong>
                            <span id="catGroqStatusBadge" class="badge rounded-pill" style="font-size:0.64rem; background:rgb(217, 119, 6); cursor:pointer;" title="Bấm để đóng/mở ô nhập Groq API Key">🔑 Bấm nhập Groq Key</span>
                        </div>
                        <div class="d-flex gap-1 align-items-center">
                            <button type="button" id="catKeyConfigBtn" class="cat-action-chip" style="border-color:rgb(250,204,21); color:rgb(250,204,21);" title="Cấu hình khóa Groq API Key">🔑 Cài Key AI</button>
                            <button type="button" id="catJumpHighBtn" class="cat-action-chip" title="Cho Mèo nhảy vọt lên bậc cao trên màn hình">🚀 Nhảy Cao</button>
                            <button type="button" id="catBreedSwitchBtn" class="cat-action-chip" title="Đổi màu lông & giống mèo">🎨 Đổi Mèo</button>
                            <button type="button" id="catDockCloseBtn" class="cat-action-chip" title="Thu gọn bảng điều khiển">Thu gọn [–]</button>
                        </div>
                    </div>

                    <div id="catGroqKeyInputRow" class="p-2 mb-2 rounded border border-warning d-none" style="background:rgba(234, 179, 8, 0.12);">
                        <div class="small fw-bold text-warning mb-1" style="font-size:0.72rem;">🔑 Cấu hình Khóa Groq AI (Dùng chung cho Mèo &amp; Hệ thống):</div>
                        <div class="input-group input-group-sm">
                            <input type="password" id="catGroqKeyField" class="form-control form-control-sm" style="background:rgb(15,23,42); color:rgb(255,255,255);" placeholder="Dán mã Groq API Key (bắt đầu bằng gsk_...) vào đây">
                            <button type="button" id="catSaveGroqKeyBtn" class="btn btn-warning btn-sm fw-bold text-dark">💾 Lưu Key</button>
                        </div>
                    </div>

                    <div class="d-flex flex-wrap gap-1 mb-2">
                        <button type="button" class="cat-action-chip" data-cmd="Cho ăn cá">🐟 Ăn cá</button>
                        <button type="button" class="cat-action-chip" data-cmd="Uống trà sữa boba">🧋 Trà sữa</button>
                        <button type="button" class="cat-action-chip" data-cmd="Lộn vòng backflip">🤸 Nhào lộn</button>
                        <button type="button" class="cat-action-chip" data-cmd="Nằm ổ bánh mì">🍞 Bánh mì</button>
                        <button type="button" class="cat-action-chip" data-cmd="Tan chảy sploot">🫠 Tan chảy</button>
                        <button type="button" class="cat-action-chip" data-cmd="Nhảy múa">🎵 Nhảy múa</button>
                    </div>

                    <div class="d-flex flex-wrap gap-1 mb-2">
                        <button type="button" class="cat-action-chip" data-cmd="Tìm card RTX 4070">🔍 Tìm RTX 4070</button>
                        <button type="button" class="cat-action-chip" data-cmd="Bỏ bàn phím cơ vào giỏ hàng">🛒 Bỏ phím cơ vào giỏ</button>
                        <button type="button" class="cat-action-chip" data-cmd="Đổi giao diện tối">🌙 Nền Tối</button>
                        <button type="button" class="cat-action-chip" data-cmd="Đổi giao diện sáng">☀️ Nền Sáng</button>
                        <button type="button" class="cat-action-chip" data-cmd="Điểm danh nhận xu">✨ Điểm danh</button>
                    </div>

                    <form id="nividaCatCmdForm" class="d-flex gap-1">
                        <input type="text" id="nividaCatCmdInput" class="form-control form-control-sm" style="background:rgb(30,41,59); color:rgb(255,255,255); border-color:rgb(118,185,0);" placeholder="💬 Gõ lệnh cho Mèo (VD: kiếm tai nghe sony, bỏ balo vào giỏ)..." required>
                        <button type="submit" id="nividaCatSendBtn" class="btn btn-nvidia btn-sm px-3 fw-bold">Gửi</button>
                    </form>

                    <div id="nividaCatProductTray" class="cat-product-tray d-none"></div>
                </div>
            `;
            document.body.appendChild(wrap);

            this.canvas = document.getElementById('nividaLiquidCatCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.hitbox = document.getElementById('nividaCatHitbox');
            this.bubbleEl = document.getElementById('nividaCatSpeechBubble');
            this.dockEl = document.getElementById('nividaCatControlDock');
            this.openBtn = document.getElementById('nividaCatOpenBtn');
        }

        resizeCanvas() {
            if (!this.canvas) return;
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.floorY = window.innerHeight - 54;
            this.buildPerches();
            if (this.softBody.y > this.floorY) {
                this.softBody.setPosition(this.softBody.x, this.floorY, 0, 0);
            }
            this.softBody.resetNodesExact();
        }

        jumpToHighPerch() {
            if (!this.perches.length) this.buildPerches();
            const p = this.perches[Math.floor(Math.random() * this.perches.length)];
            const tx = p.x1 + 40 + Math.random() * Math.max(40, (p.x2 - p.x1 - 80));
            const ty = p.y;
            const dx = tx - this.softBody.x;
            const dy = ty - this.softBody.y;
            this.direction = dx >= 0 ? 1 : -1;
            const flightT = 0.68;
            this.softBody.vx = Math.max(-680, Math.min(680, dx / flightT));
            this.softBody.vy = Math.max(-1350, Math.min(-480, (dy - 0.5 * 940 * flightT * flightT) / flightT));
            this.passThroughTimer = 0.28;
            this.setCatState('jump_starfish_soar', 1.2, 'starry_hyped_grin');
            this.spawnParticle('dust');
            this.spawnParticle('star');
        }

        bindEvents() {
            window.addEventListener('resize', () => this.resizeCanvas());

            document.addEventListener('visibilitychange', () => {
                this.lastTs = performance.now();
                this.softBody.resetNodesExact();
            });
            window.addEventListener('focus', () => {
                this.lastTs = performance.now();
                this.softBody.resetNodesExact();
            });

            window.addEventListener('mousemove', (e) => {
                this.mousePos.x = e.clientX;
                this.mousePos.y = e.clientY;
                if (this.isDragging) {
                    this.dragMoved = true;
                    const nx = Math.max(60, Math.min(window.innerWidth - 60, e.clientX));
                    const ny = Math.max(60, Math.min(this.floorY, e.clientY));
                    this.softBody.setPosition(nx, ny, 0, 0);
                }
            });

            this.hitbox.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                this.isDragging = true;
                this.dragMoved = false;
                this.targetX = null;
                this.setCatState('drag', 2.0, 'shocked', false);
            });

            window.addEventListener('mouseup', () => {
                if (!this.isDragging) return;
                this.isDragging = false;
                this.softBody.resetNodesExact();
                if (!this.dragMoved) {
                    this.onCatClicked();
                } else {
                    this.setCatState('fall_parachute', 2.5, 'uwu');
                    this.spawnParticle('star');
                    this.saveCatState();
                }
            });

            this.openBtn.addEventListener('click', () => this.toggleDock(true));
            document.getElementById('catDockCloseBtn').addEventListener('click', () => this.toggleDock(false));

            document.getElementById('catJumpHighBtn').addEventListener('click', () => {
                this.jumpToHighPerch();
                this.showBubble('Meow~ Nhảy vọt lên tầng cao ngắm toàn cảnh trang web nè! 🚀🐾', 4500);
            });

            document.getElementById('catBreedSwitchBtn').addEventListener('click', () => {
                const idx = (BREED_KEYS.indexOf(this.breedKey) + 1) % BREED_KEYS.length;
                this.breedKey = BREED_KEYS[idx];
                this.breed = CAT_BREEDS[this.breedKey];
                this.softBody.resetNodesExact();
                this.spawnParticle('sparkle');
                this.showBubble(`Meow~ Đã đổi sang [${this.breed.name}]! 🐾✨`, 4500);
                this.saveCatState();
            });

            const toggleKeyRow = () => {
                const row = document.getElementById('catGroqKeyInputRow');
                row.classList.toggle('d-none');
                sessionStorage.setItem('cat_key_row_closed', row.classList.contains('d-none') ? '1' : '0');
                if (!row.classList.contains('d-none')) {
                    document.getElementById('catGroqKeyField')?.focus();
                }
            };
            document.getElementById('catKeyConfigBtn').addEventListener('click', toggleKeyRow);
            document.getElementById('catGroqStatusBadge').addEventListener('click', toggleKeyRow);

            document.getElementById('catSaveGroqKeyBtn').addEventListener('click', async () => {
                const k = document.getElementById('catGroqKeyField').value.trim();
                if (!k) return;
                const res = await fetch('/api/settings/cat-assistant/groq-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: k })
                });
                const data = await res.json();
                if (res.ok) {
                    this.groqReady = true;
                    this.updateGroqBadge();
                    document.getElementById('catGroqKeyInputRow').classList.add('d-none');
                    this.showBubble('Meow~ Đã lưu khóa Groq AI thành công! Giờ bạn gõ lệnh gì vào ô Chat em cũng hiểu hết nha! 🧠🐾', 5500);
                } else {
                    this.showBubble(data.error || 'Khóa chưa hợp lệ!', 4000);
                }
            });

            document.querySelectorAll('.cat-action-chip[data-cmd]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const cmd = btn.getAttribute('data-cmd');
                    this.sendCommandToCat(cmd);
                });
            });

            document.getElementById('nividaCatCmdForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const inp = document.getElementById('nividaCatCmdInput');
                const msg = inp.value.trim();
                if (!msg) return;
                inp.value = '';
                this.sendCommandToCat(msg);
            });
        }

        toggleDock(show) {
            this.dockEl.classList.toggle('d-none', !show);
            this.openBtn.classList.toggle('d-none', show);
            localStorage.setItem('nivida_cat_dock_minimized', show ? '0' : '1');
            if (show) {
                setTimeout(() => document.getElementById('nividaCatCmdInput')?.focus(), 80);
            }
        }

        onCatClicked() {
            this.spawnParticle('heart');
            this.spawnParticle('sparkle');
            this.softBody.vy = -260;
            this.setCatState('sit_paw_wave_hi', 4.5, 'lovestruck_sparkle');
            this.showBubble('Meow~ Khung Chat của Mèo đã mở ở góc trái! Bạn hãy gõ lệnh vào ô "Gõ lệnh cho Mèo" nhé! 🐾💬', 5500);
            this.toggleDock(true);
        }

        setCatState(newState, duration = 5.0, expr = 'normal', broadcast = true) {
            this.state = newState;
            this.stateTimer = duration;
            this.expr = expr;
            this.softBody.setLiquidState(newState);
            if (newState === 'double_flip' || newState === 'backflip') {
                this.softBody.vy = -520;
            }
            if (broadcast) this.saveCatState();
        }

        showBubble(text, durationMs = 6000, broadcast = true) {
            if (!this.bubbleEl) return;
            this.currentBubbleText = text;
            this.bubbleEl.textContent = text;
            this.bubbleEl.classList.remove('d-none');
            if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
            this.bubbleTimeout = setTimeout(() => {
                this.bubbleEl.classList.add('d-none');
            }, durationMs);
            if (broadcast) this.saveCatState(text);
        }

        spawnParticle(type) {
            const symMap = {
                heart: '❤️', zzz: '💤', star: '⭐',
                sparkle: '✨', music: '🎵', crumb: '🐟',
                idea_bulb: '💡', dust: '💨'
            };
            for (let i = 0; i < 2; i++) {
                this.particles.push({
                    sym: symMap[type] || '✨',
                    x: this.softBody.x + (Math.random() * 40 - 20),
                    y: this.softBody.y - 36,
                    vx: Math.random() * 36 - 18,
                    vy: -45 - Math.random() * 35,
                    life: 1.0
                });
            }
        }

        async sendCommandToCat(message) {
            const user = typeof getAuthUser === 'function' ? getAuthUser() : null;
            this.showBubble('Meow~ Đang phân tích lệnh và chạy đi làm ngay... 🐾💭', 10000, false);
            this.setCatState('ai_eureka_lightbulb_perk', 3.0, 'matrix_code_eyes', false);

            try {
                const res = await fetch('/api/settings/cat-assistant/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        user_id: user ? user.id : null
                    })
                });
                const data = await res.json();
                this.executeCommandResponse(data);
            } catch {
                this.showBubble('Meow! Mèo bị vấp cục mạng rồi, bạn thử lại giúp Mèo nhé! 😿', 4500);
            }
        }

        executeCommandResponse(data) {
            if (!data) return;
            const act = data.action_type || 'CHAT_REPLY';
            const st = data.cat_state || 'sit_paw_wave_hi';
            const ex = data.cat_expr || 'uwu';
            const pt = data.particle || 'sparkle';

            if (st === 'double_flip' || st.includes('jump')) {
                this.jumpToHighPerch();
            } else {
                this.setCatState(st, 6.5, ex);
            }
            this.spawnParticle(pt);
            this.showBubble(data.bubble_text || 'Meow~ Đã rõ!', 7500);

            const tray = document.getElementById('nividaCatProductTray');
            if (tray) tray.classList.add('d-none');

            if (act === 'SET_THEME') {
                const mode = data.theme_mode || 'dark';
                localStorage.setItem('theme', mode);
                if (typeof applySavedTheme === 'function') applySavedTheme();
            } else if (act === 'SET_STYLE_PRESET') {
                localStorage.setItem('bs_style', data.style_preset || 'nvidia');
                if (typeof applySavedTheme === 'function') applySavedTheme();
            } else if (act === 'ADD_TO_CART' && data.product) {
                const p = data.product;
                this.targetX = Math.max(120, window.innerWidth - 110);
                if (typeof addToCartGlobal === 'function') {
                    addToCartGlobal(p);
                }
                this.renderProductTray([p], '🛒 Mèo vừa tha món này bỏ vào Giỏ hàng của bạn:');
            } else if (act === 'SEARCH_PRODUCTS' && Array.isArray(data.products)) {
                this.renderProductTray(data.products, `🔍 Kết quả Mèo tìm thấy cho "${data.search_query || ''}":`);
            } else if (act === 'TRIGGER_CHECKIN') {
                if (typeof triggerHeaderCheckin === 'function') {
                    triggerHeaderCheckin();
                }
            } else if (act === 'NAVIGATE_PAGE' && data.target_url) {
                this.targetX = window.innerWidth - 90;
                setTimeout(() => {
                    window.location.href = data.target_url;
                }, 1100);
            }
        }

        renderProductTray(products, titleText) {
            const tray = document.getElementById('nividaCatProductTray');
            if (!tray || !products || !products.length) return;
            this.toggleDock(true);
            tray.classList.remove('d-none');
            window.__catFoundProducts = {};
            products.forEach(p => { window.__catFoundProducts[p.id] = p; });

            tray.innerHTML = `
                <div class="small fw-bold mb-1" style="color:rgb(163, 230, 53); font-size:0.74rem;">${titleText}</div>
                ${products.map(p => `
                    <div class="d-flex justify-content-between align-items-center p-1 mb-1 rounded border border-secondary" style="background:rgb(30,41,59); font-size:0.74rem;">
                        <div class="text-truncate me-2" style="max-width: 240px;">
                            <a href="/services/product/product-detail.html?id=${p.id}" class="text-white text-decoration-none fw-semibold">${p.name}</a>
                            <div style="color:rgb(163, 230, 53); font-weight:700;">${Number(p.price || 0).toLocaleString('vi-VN')} Xu</div>
                        </div>
                        <button type="button" class="btn btn-nvidia btn-sm py-0 px-2" style="font-size:0.7rem;"
                                onclick="window.__catAddProdById(${p.id})">
                            🐾 Mèo Bỏ Giỏ
                        </button>
                    </div>
                `).join('')}
            `;
        }

        loop(ts) {
            const rawDt = (ts - this.lastTs) / 1000;
            this.lastTs = ts;
            if (rawDt > 0.25) {
                this.softBody.resetNodesExact();
            }
            const dt = Math.min(0.025, Math.max(0.004, rawDt || 0.016));
            this.updateCatBehavior(dt);
            this.renderCatCanvas();
            requestAnimationFrame((nextTs) => this.loop(nextTs));
        }

        updateCatBehavior(dt) {
            this.animTime += dt;
            this.stateTimer -= dt;
            if (this.passThroughTimer > 0) {
                this.passThroughTimer = Math.max(0, this.passThroughTimer - dt);
            }

            this.blinkTimer -= dt;
            if (this.blinkTimer <= 0) {
                this.eyeOpen = 0.08;
                if (this.blinkTimer <= -0.16) {
                    this.blinkTimer = 3.0 + Math.random() * 3.5;
                }
            } else {
                this.eyeOpen = lerpVal(this.eyeOpen, 1.0, dt * 14);
            }

            if (this.state === 'double_flip' || this.state === 'backflip') {
                this.bodyTilt += dt * 680 * this.direction;
            } else {
                this.bodyTilt = lerpVal(this.bodyTilt, 0, dt * 10);
            }

            if (!this.isDragging) {
                if (this.targetX !== null) {
                    const dx = this.targetX - this.softBody.x;
                    if (Math.abs(dx) < 28) {
                        this.targetX = null;
                        this.softBody.vx = 0;
                        if (this.state === 'walking' || this.state === 'run_cheetah_sprint') {
                            this.setCatState('sitting', 5.0, 'normal', false);
                        }
                    } else {
                        this.direction = dx >= 0 ? 1 : -1;
                        const spd = this.state.includes('run') || this.state === 'carrying' ? 230 : 115;
                        this.softBody.vx = this.direction * spd;
                    }
                } else if (this.stateTimer <= 0) {
                    const r = Math.random();
                    if (r < 0.26) {
                        this.jumpToHighPerch();
                    } else if (r < 0.56) {
                        if (this.softBody.y < this.floorY - 40 && Math.random() < 0.45) {
                            this.passThroughTimer = 0.65;
                            this.softBody.vy = 90;
                        }
                        this.targetX = 120 + Math.random() * Math.max(180, window.innerWidth - 260);
                        this.setCatState('walking', 5.5, 'normal', false);
                    } else if (r < 0.74) {
                        this.setCatState('loaf_purr_toast', 6.0, 'content_purr', false);
                    } else if (r < 0.88) {
                        this.setCatState('sploot_superman', 5.5, 'uwu', false);
                    } else {
                        this.setCatState('sitting', 5.0, 'normal', false);
                    }
                }
            }

            this.softBody.stepPhysics(
                dt, this.floorY, this.perches, 65, window.innerWidth - 65,
                this.isDragging, this.passThroughTimer > 0
            );

            const cx = this.softBody.x;
            const cy = this.softBody.y;
            if (this.hitbox) {
                this.hitbox.style.left = `${cx - 56}px`;
                this.hitbox.style.top = `${cy - 54}px`;
            }
            if (this.bubbleEl && !this.bubbleEl.classList.contains('d-none')) {
                const bw = this.bubbleEl.offsetWidth || 220;
                const leftPos = Math.max(12, Math.min(window.innerWidth - bw - 16, cx - bw / 2));
                const topPos = cy > 155 ? (cy - 126) : (cy + 42);
                this.bubbleEl.style.left = `${leftPos}px`;
                this.bubbleEl.style.top = `${Math.max(10, topPos)}px`;
            }

            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt * 0.85;
                if (p.life <= 0) this.particles.splice(i, 1);
            }
        }

        renderCatCanvas() {
            const ctx = this.ctx;
            if (!ctx) return;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            const pts = this.softBody.nodes;
            const num = pts.length;
            let avgX = 0;
            let avgY = 0;
            for (let i = 0; i < num; i++) {
                avgX += pts[i].x;
                avgY += pts[i].y;
            }
            const cx = avgX / num;
            const cy = avgY / num;

            const dir = this.direction;
            const b = this.breed;
            const st = this.state;
            const t = this.animTime;

            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 26, 35 * this.softBody.smoothScaleX, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((this.bodyTilt * Math.PI) / 180);
            ctx.translate(-cx, -cy);

            const wag = Math.sin(t * (st.includes('dance') || st.includes('happy') ? 16 : 5.5)) * 14;
            const tx = cx - 28 * dir * this.softBody.smoothScaleX;
            const ty = cy + 4;
            ctx.save();
            ctx.lineCap = 'round';
            ctx.strokeStyle = b.stroke;
            ctx.lineWidth = b.tailStyle === 'fluffy' ? 14 : 10;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.bezierCurveTo(tx - 22 * dir, ty + 8, tx - 42 * dir, ty - 20 + wag, tx - 52 * dir, ty - 6 + wag);
            ctx.stroke();
            ctx.strokeStyle = b.pCol;
            ctx.lineWidth = b.tailStyle === 'fluffy' ? 9 : 6;
            ctx.stroke();
            ctx.restore();

            if (!st.includes('loaf') && !st.includes('sleep')) {
                const walkSwing = (st === 'walking' || st.includes('run') || st === 'carrying')
                    ? Math.sin(t * 14) * 10
                    : 0;
                ctx.save();
                ctx.fillStyle = b.body;
                ctx.strokeStyle = b.stroke;
                ctx.lineWidth = 4;
                [-16, 16].forEach((ox, idx) => {
                    const lx = cx + ox * dir + (idx === 0 ? -walkSwing : walkSwing) * 0.6;
                    const ly = cy + 12;
                    ctx.beginPath();
                    ctx.roundRect(lx - 6.5, ly, 13, 16, 6);
                    ctx.fill();
                    ctx.stroke();
                });
                ctx.restore();
            }

            const bodyPath = new Path2D();
            const startMidX = (pts[0].x + pts[num - 1].x) / 2;
            const startMidY = (pts[0].y + pts[num - 1].y) / 2;
            bodyPath.moveTo(startMidX, startMidY);
            for (let i = 0; i < num; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % num];
                bodyPath.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
            }
            bodyPath.closePath();

            ctx.save();
            ctx.fillStyle = b.body;
            ctx.fill(bodyPath);

            ctx.save();
            ctx.clip(bodyPath);
            if (b.pattern !== 'solid') {
                ctx.fillStyle = b.belly;
                ctx.beginPath();
                ctx.ellipse(cx, cy + 13 * this.softBody.smoothScaleY, 25 * this.softBody.smoothScaleX, 13 * this.softBody.smoothScaleY, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = b.pCol;
            if (b.pattern === 'calico' || b.pattern === 'cow') {
                ctx.beginPath();
                ctx.ellipse(cx - 10 * dir, cy - 8, 15, 12, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (b.pattern === 'stripes') {
                [-12, 0, 12].forEach(off => {
                    ctx.fillRect(cx + off - 2, cy - 24, 4, 14);
                });
            }
            ctx.restore();

            ctx.lineWidth = 4.5;
            ctx.strokeStyle = b.stroke;
            ctx.stroke(bodyPath);
            ctx.restore();

            const bobY = (st === 'walking' || st.includes('dance')) ? -Math.abs(Math.sin(t * 12)) * 5 : 0;
            const hx = cx + (st.includes('loaf') || st.includes('sleep') ? 18 : 26) * dir;
            const hy = cy - (st.includes('sploot') ? 12 : 22) + bobY;

            ctx.save();
            ctx.translate(hx, hy);
            if (st === 'head_tilt' || st.includes('dance')) {
                ctx.rotate(Math.sin(t * 6) * 0.16);
            }

            [-1, 1].forEach(side => {
                ctx.save();
                ctx.translate(side * 14, -16);
                ctx.rotate(side * 0.22);
                ctx.beginPath();
                ctx.moveTo(-11, 4);
                ctx.quadraticCurveTo(-7, -18, 0, -22);
                ctx.quadraticCurveTo(7, -18, 11, 4);
                ctx.closePath();
                ctx.fillStyle = b.pattern === 'points' ? b.pCol : b.body;
                ctx.fill();
                ctx.lineWidth = 4.2;
                ctx.strokeStyle = b.stroke;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(-5, 2);
                ctx.quadraticCurveTo(0, -13, 5, 2);
                ctx.closePath();
                ctx.fillStyle = 'rgb(251, 207, 232)';
                ctx.fill();
                ctx.restore();
            });

            const chewPuff = (st.includes('eat') || st.includes('boba')) ? Math.abs(Math.sin(t * 15)) * 4.5 : 0;
            ctx.beginPath();
            ctx.ellipse(0, 0, 27 + chewPuff, 22, 0, 0, Math.PI * 2);
            ctx.fillStyle = b.body;
            ctx.fill();
            ctx.lineWidth = 4.5;
            ctx.strokeStyle = b.stroke;
            ctx.stroke();

            ctx.strokeStyle = b.stroke;
            ctx.lineWidth = 2;
            [-1, 1].forEach(wSide => {
                const wx0 = wSide * (21 + chewPuff * 0.5);
                const wx1 = wSide * (34 + chewPuff * 0.7);
                ctx.beginPath();
                ctx.moveTo(wx0, 2);
                ctx.lineTo(wx1, 0);
                ctx.moveTo(wx0, 6);
                ctx.lineTo(wx1, 7);
                ctx.stroke();
            });

            if (this.expr === 'cyber_visor_glow') {
                ctx.fillStyle = 'rgba(6, 182, 212, 0.88)';
                ctx.strokeStyle = 'rgb(2, 132, 199)';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.roundRect(-21, -7, 42, 11, 4);
                ctx.fill();
                ctx.stroke();
            } else if (this.expr === 'rich_sunglasses_gold') {
                ctx.fillStyle = 'rgb(250, 204, 21)';
                ctx.strokeStyle = 'rgb(120, 53, 15)';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.roundRect(-20, -8, 17, 11, 3);
                ctx.roundRect(3, -8, 17, 11, 3);
                ctx.fill();
                ctx.stroke();
            } else if (st.includes('sleep') || this.expr === 'content_purr' || this.expr === 'sleepy_drool_bubble') {
                ctx.strokeStyle = b.stroke;
                ctx.lineWidth = 3.2;
                [-10, 10].forEach(ex => {
                    ctx.beginPath();
                    ctx.arc(ex, -2, 5.5, 0, Math.PI, false);
                    ctx.stroke();
                });
            } else {
                const dx = this.mousePos.x - hx;
                const dy = this.mousePos.y - hy;
                const ang = Math.atan2(dy, dx);
                const lookDist = Math.min(2.6, Math.hypot(dx, dy) * 0.015);
                const px = Math.cos(ang) * lookDist;
                const py = Math.sin(ang) * lookDist;

                [-10, 10].forEach((ex, idxE) => {
                    ctx.fillStyle = idxE === 0 ? b.eyeColor : b.eyeColor2;
                    ctx.beginPath();
                    ctx.ellipse(ex, -2, 7.2, 7.2 * this.eyeOpen, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgb(9, 13, 22)';
                    ctx.beginPath();
                    ctx.ellipse(ex + px, -2 + py, 4.6, 5.6 * this.eyeOpen, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgb(255, 255, 255)';
                    ctx.beginPath();
                    ctx.arc(ex - 2 + px, -4 + py, 2.3, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            ctx.fillStyle = 'rgba(255, 145, 178, 0.82)';
            ctx.beginPath();
            ctx.ellipse(-17, 5, 5.2, 3.4, 0, 0, Math.PI * 2);
            ctx.ellipse(17, 5, 5.2, 3.4, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgb(255, 107, 129)';
            ctx.beginPath();
            ctx.moveTo(-3.5, 4.5);
            ctx.lineTo(3.5, 4.5);
            ctx.lineTo(0, 8.5);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = b.stroke;
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(-5.5, 9);
            ctx.quadraticCurveTo(-2.8, 13, 0, 9);
            ctx.quadraticCurveTo(2.8, 13, 5.5, 9);
            ctx.stroke();

            if (st === 'drink_boba_tea') {
                ctx.save();
                ctx.translate(12 * dir, 16);
                ctx.fillStyle = 'rgb(253, 230, 138)';
                ctx.strokeStyle = 'rgb(30, 41, 59)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(-8, -2, 16, 18, 3);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgb(15, 23, 42)';
                [-3, 0, 3].forEach(bx => {
                    ctx.beginPath();
                    ctx.arc(bx, 12, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.restore();
            }

            ctx.restore();
            ctx.restore();

            this.particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
                ctx.font = '16px "Segoe UI Emoji", Arial';
                ctx.fillText(p.sym, p.x, p.y);
                ctx.restore();
            });
        }
    }

    window.__catAddProdById = function (pid) {
        const p = window.__catFoundProducts && window.__catFoundProducts[pid];
        if (!p) return;
        if (typeof addToCartGlobal === 'function') {
            addToCartGlobal(p);
        }
        if (window.__nividaCatInstance) {
            window.__nividaCatInstance.setCatState('carrying', 5.0, 'money_eyes');
            window.__nividaCatInstance.spawnParticle('heart');
            window.__nividaCatInstance.showBubble(`Meow! Đã tha [${p.name.substring(0, 32)}...] bỏ vào Giỏ hàng cho bạn! 🛒🐾`, 5500);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.__nividaCatInstance = new WebLiquidCatAssistant();
        });
    } else {
        window.__nividaCatInstance = new WebLiquidCatAssistant();
    }
})();
