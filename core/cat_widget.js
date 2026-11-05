(function () {
    if (window.__nividaLiquidCatV23) return;
    window.__nividaLiquidCatV23 = true;

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

    class LocalSoftBody {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.numNodes = 12;
            this.baseRx = 33;
            this.baseRy = 24;
            this.targetScaleX = 1.10;
            this.targetScaleY = 0.90;
            this.smoothScaleX = 1.10;
            this.smoothScaleY = 0.90;
            this.wobblePhase = 0;
            this.nodes = [];
            for (let i = 0; i < this.numNodes; i++) {
                const ang = (2 * Math.PI * i) / this.numNodes;
                this.nodes.push({
                    ox: this.baseRx * Math.cos(ang),
                    oy: this.baseRy * Math.sin(ang),
                    vx: 0,
                    vy: 0
                });
            }
        }

        resetDeformation() {
            const rx = this.baseRx * this.smoothScaleX;
            const ry = this.baseRy * this.smoothScaleY;
            for (let i = 0; i < this.numNodes; i++) {
                const ang = (2 * Math.PI * i) / this.numNodes;
                this.nodes[i].ox = rx * Math.cos(ang);
                this.nodes[i].oy = ry * Math.sin(ang);
                this.nodes[i].vx = 0;
                this.nodes[i].vy = 0;
            }
        }

        triggerJiggle(impulseX, impulseY) {
            for (let i = 0; i < this.numNodes; i++) {
                const ang = (2 * Math.PI * i) / this.numNodes;
                this.nodes[i].vx += Math.cos(ang) * impulseX;
                this.nodes[i].vy += Math.sin(ang) * impulseY;
            }
        }

        setLiquidState(st) {
            if (st.includes('sploot') || st.includes('melt') || st.includes('puddle')) {
                this.targetScaleX = 1.42;
                this.targetScaleY = 0.60;
            } else if (st.includes('loaf') || st.includes('sleep')) {
                this.targetScaleX = 1.22;
                this.targetScaleY = 0.78;
            } else if (st.includes('run') || st.includes('sprint') || st.includes('zoom')) {
                this.targetScaleX = 1.30;
                this.targetScaleY = 0.72;
            } else if (st.includes('climb')) {
                this.targetScaleX = 0.88;
                this.targetScaleY = 1.18;
            } else if (st.includes('jump') || st.includes('flip') || st.includes('dance')) {
                this.targetScaleX = 0.92;
                this.targetScaleY = 1.16;
            } else {
                this.targetScaleX = 1.08;
                this.targetScaleY = 0.92;
            }
        }

        stepLocalJelly(dt, speedMag) {
            const safeDt = Math.min(0.025, Math.max(0.004, dt));
            this.smoothScaleX = lerpVal(this.smoothScaleX, this.targetScaleX, safeDt * 10);
            this.smoothScaleY = lerpVal(this.smoothScaleY, this.targetScaleY, safeDt * 10);
            this.wobblePhase += safeDt * (6 + Math.min(14, speedMag * 0.04));

            const rx = this.baseRx * this.smoothScaleX;
            const ry = this.baseRy * this.smoothScaleY;

            for (let i = 0; i < this.numNodes; i++) {
                const ang = (2 * Math.PI * i) / this.numNodes;
                const breath = Math.sin(this.wobblePhase + i * 0.55) * 1.2;
                const idealOx = (rx + breath) * Math.cos(ang);
                const idealOy = (ry - breath * 0.6) * Math.sin(ang);

                const n = this.nodes[i];
                const dx = idealOx - n.ox;
                const dy = idealOy - n.oy;
                n.vx = (n.vx + dx * 36 * safeDt) * 0.72;
                n.vy = (n.vy + dy * 36 * safeDt) * 0.72;
                n.ox += n.vx;
                n.oy += n.vy;

                if (Math.abs(n.ox - idealOx) > 9) n.ox = idealOx + Math.sign(n.ox - idealOx) * 9;
                if (Math.abs(n.oy - idealOy) > 9) n.oy = idealOy + Math.sign(n.oy - idealOy) * 9;
            }
        }
    }

    class WebLiquidCatAssistant {
        constructor() {
            const oldCanvas = document.getElementById('nividaLiquidCatCanvas');
            if (oldCanvas) oldCanvas.remove();
            const oldHit = document.getElementById('nividaCatHitbox');
            if (oldHit) oldHit.remove();
            const oldBub = document.getElementById('nividaCatSpeechBubble');
            if (oldBub) oldBub.remove();
            const oldBtn = document.getElementById('nividaCatOpenBtn');
            if (oldBtn) oldBtn.remove();
            const oldDock = document.getElementById('nividaCatControlDock');
            if (oldDock) oldDock.remove();

            const saved = this.loadSavedCatState();
            this.floorY = window.innerHeight - 52;
            this.ceilingY = 64;
            this.leftWallX = 58;
            this.rightWallX = window.innerWidth - 58;

            const startX = saved.x ? Math.min(this.rightWallX, Math.max(this.leftWallX, saved.x)) : Math.round(window.innerWidth * 0.70);
            const startY = saved.y ? Math.min(this.floorY, Math.max(this.ceilingY, saved.y)) : this.floorY;

            this.softBody = new LocalSoftBody(startX, startY);
            this.breedKey = saved.breedKey && CAT_BREEDS[saved.breedKey] ? saved.breedKey : 'nivida_cyber';
            this.breed = CAT_BREEDS[this.breedKey];
            this.state = saved.state || 'sitting';
            this.expr = saved.expr || 'normal';
            this.direction = saved.direction || -1;
            this.surfaceMode = saved.surfaceMode || 'floor';
            this.stateTimer = 4.5;
            this.animTime = 0;

            this.targetX = null;
            this.targetY = null;
            this.isDragging = false;
            this.dragMoved = false;
            this.mousePos = { x: startX, y: startY };
            this.particles = [];
            this.bodyTilt = 0;
            this.blinkTimer = 3.5;
            this.eyeOpen = 1.0;
            this.bubbleTimeout = null;
            this.channel = null;

            this.injectStylesAndDOM();
            this.resizeCanvas();
            this.bindEvents();
            this.initCrossTabSync();

            if (saved.bubbleText && (Date.now() - (saved.ts || 0) < 9000)) {
                this.showBubble(saved.bubbleText, 5500, false);
            } else {
                this.showBubble('Meow~ Em có thể leo tường, đi dọc trần web và nhảy khắp các khung sản phẩm! Bấm vào em để ra lệnh tìm đồ, bỏ giỏ hàng nha! 🐾', 6500, false);
            }

            this.lastTs = performance.now();
            requestAnimationFrame((ts) => this.loop(ts));
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
                    surfaceMode: this.surfaceMode,
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
                            this.softBody.x = Math.min(this.rightWallX, Math.max(this.leftWallX, d.x));
                            this.softBody.y = Math.min(this.floorY, Math.max(this.ceilingY, d.y));
                            this.surfaceMode = d.surfaceMode || 'floor';
                            this.softBody.resetDeformation();
                        }
                        if (d.state) this.setCatState(d.state, 4.5, d.expr || 'normal', false);
                        if (d.bubbleText) this.showBubble(d.bubbleText, 5500, false);
                    };
                }
            } catch {}
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
                    width: 108px;
                    height: 88px;
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
                    max-width: 300px;
                    min-width: 170px;
                    background: rgb(15, 23, 42);
                    color: rgb(248, 250, 252);
                    border: 2px solid rgb(118, 185, 0);
                    border-radius: 14px;
                    padding: 8px 12px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    line-height: 1.4;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.45);
                    z-index: 10048;
                    pointer-events: auto;
                    transition: opacity 0.18s ease;
                }
                .nivida-cat-bubble.d-none {
                    opacity: 0;
                    pointer-events: none;
                }
                .nivida-cat-dock {
                    position: fixed;
                    bottom: 16px;
                    left: 16px;
                    width: min(395px, calc(100vw - 32px));
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
                    bottom: 16px;
                    left: 16px;
                    z-index: 10049;
                    background: linear-gradient(135deg, rgb(15, 23, 42), rgb(30, 41, 59));
                    color: rgb(163, 230, 53);
                    border: 2px solid rgb(118, 185, 0);
                    border-radius: 999px;
                    padding: 7px 15px;
                    font-size: 0.81rem;
                    font-weight: 800;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.45);
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .cat-product-tray {
                    max-height: 160px;
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
                <div id="nividaCatHitbox" class="nivida-cat-hitbox" title="Bấm vào Mèo để Chat hoặc Nắm kéo Mèo thả lên trần / bất kỳ đâu!"></div>
                <div id="nividaCatSpeechBubble" class="nivida-cat-bubble d-none"></div>

                <button type="button" id="nividaCatOpenBtn" class="cat-toggle-pill ${dockMinimized ? '' : 'd-none'}">
                    <span>🐾 Ra Lệnh Cho Mèo AI</span>
                </button>

                <div id="nividaCatControlDock" class="nivida-cat-dock ${dockMinimized ? 'd-none' : ''}">
                    <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom border-secondary flex-wrap gap-1">
                        <strong class="small" style="color:rgb(163, 230, 53);">🐱 Mèo Lỏng Trợ Lý AI</strong>
                        <div class="d-flex gap-1 align-items-center">
                            <button type="button" id="catClimbCeilingBtn" class="cat-action-chip" title="Cho Mèo leo lên đi dọc trần web">🐾 Leo Trần</button>
                            <button type="button" id="catParkourBtn" class="cat-action-chip" title="Cho Mèo nhảy Parkour khắp màn hình">🚀 Nhảy Khắp Màn</button>
                            <button type="button" id="catBreedSwitchBtn" class="cat-action-chip" title="Đổi màu lông & giống mèo">🎨 Đổi Mèo</button>
                            <button type="button" id="catDockCloseBtn" class="cat-action-chip" title="Thu gọn khung chat">Ẩn [–]</button>
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
                        <input type="text" id="nividaCatCmdInput" class="form-control form-control-sm" style="background:rgb(30,41,59); color:rgb(255,255,255); border-color:rgb(118,185,0);" placeholder="💬 Gõ lệnh (VD: kiếm tai nghe, bỏ chuột vào giỏ, nền tối)..." required>
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
            this.floorY = window.innerHeight - 52;
            this.ceilingY = 64;
            this.leftWallX = 58;
            this.rightWallX = window.innerWidth - 58;
            this.softBody.x = Math.min(this.rightWallX, Math.max(this.leftWallX, this.softBody.x));
            this.softBody.y = Math.min(this.floorY, Math.max(this.ceilingY, this.softBody.y));
            this.softBody.resetDeformation();
        }

        pickRandomScreenPerchPoint() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            const domCards = Array.from(document.querySelectorAll('.product-card, .banner-box, .bg-surface'));
            const validRects = [];
            for (let i = 0; i < domCards.length; i++) {
                const r = domCards[i].getBoundingClientRect();
                if (r.width > 120 && r.top > 85 && r.top < h - 90) {
                    validRects.push(r);
                }
            }
            if (validRects.length > 0 && Math.random() < 0.65) {
                const chosen = validRects[Math.floor(Math.random() * validRects.length)];
                const tx = Math.max(this.leftWallX, Math.min(this.rightWallX, chosen.left + chosen.width * (0.25 + Math.random() * 0.5)));
                const ty = Math.max(this.ceilingY, Math.min(this.floorY, chosen.top - 18));
                return { x: tx, y: ty, mode: 'perch' };
            }
            const roll = Math.random();
            if (roll < 0.30) {
                return {
                    x: 120 + Math.random() * Math.max(150, w - 240),
                    y: this.ceilingY,
                    mode: 'ceiling'
                };
            } else if (roll < 0.55) {
                return {
                    x: 100 + Math.random() * Math.max(150, w - 200),
                    y: Math.round(h * (0.25 + Math.random() * 0.45)),
                    mode: 'perch'
                };
            }
            return {
                x: 100 + Math.random() * Math.max(150, w - 200),
                y: this.floorY,
                mode: 'floor'
            };
        }

        goToCeilingWalk() {
            const w = window.innerWidth;
            this.surfaceMode = 'ceiling';
            this.targetX = 120 + Math.random() * Math.max(160, w - 240);
            this.targetY = this.ceilingY;
            this.setCatState('climb_spider_scramble', 6.5, 'starry_hyped_grin');
            this.softBody.triggerJiggle(5, -6);
            this.spawnParticle('sparkle');
        }

        goToRandom2DTarget() {
            const pt = this.pickRandomScreenPerchPoint();
            this.surfaceMode = pt.mode;
            this.targetX = pt.x;
            this.targetY = pt.y;
            this.setCatState('jump_starfish_soar', 5.5, 'pure_joy_beam');
            this.softBody.triggerJiggle(6, -6);
            this.spawnParticle('dust');
        }

        bindEvents() {
            window.addEventListener('resize', () => this.resizeCanvas());

            document.addEventListener('visibilitychange', () => {
                this.lastTs = performance.now();
                this.softBody.resetDeformation();
            });
            window.addEventListener('focus', () => {
                this.lastTs = performance.now();
                this.softBody.resetDeformation();
            });

            window.addEventListener('mousemove', (e) => {
                this.mousePos.x = e.clientX;
                this.mousePos.y = e.clientY;
                if (this.isDragging) {
                    this.dragMoved = true;
                    this.softBody.x = Math.max(this.leftWallX, Math.min(this.rightWallX, e.clientX));
                    this.softBody.y = Math.max(this.ceilingY, Math.min(this.floorY, e.clientY));
                    this.targetX = null;
                    this.targetY = null;
                }
            });

            this.hitbox.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                this.isDragging = true;
                this.dragMoved = false;
                this.targetX = null;
                this.targetY = null;
                this.setCatState('drag', 2.0, 'shocked', false);
            });

            window.addEventListener('mouseup', () => {
                if (!this.isDragging) return;
                this.isDragging = false;
                this.softBody.resetDeformation();
                this.softBody.triggerJiggle(5, 5);
                if (!this.dragMoved) {
                    this.onCatClicked();
                } else {
                    if (this.softBody.y <= this.ceilingY + 28) {
                        this.surfaceMode = 'ceiling';
                        this.softBody.y = this.ceilingY;
                        this.showBubble('Meow~ Đậu trên trần web ngắm xuống thích quá đi! 🐾✨', 4500);
                    } else if (this.softBody.y < this.floorY - 35) {
                        this.surfaceMode = 'perch';
                        this.showBubble('Nyan~ Mèo đứng đậu ngay tại vị trí bạn vừa đặt nè! 🐾', 4500);
                    } else {
                        this.surfaceMode = 'floor';
                        this.softBody.y = this.floorY;
                    }
                    this.setCatState('sitting', 8.0, 'uwu');
                    this.spawnParticle('star');
                    this.saveCatState();
                }
            });

            this.openBtn.addEventListener('click', () => this.toggleDock(true));
            document.getElementById('catDockCloseBtn').addEventListener('click', () => this.toggleDock(false));

            document.getElementById('catClimbCeilingBtn').addEventListener('click', () => {
                this.goToCeilingWalk();
                this.showBubble('Meow~ Đang leo lên trần trang web đi tuần tra nè! 🐾🕷️', 4500);
            });

            document.getElementById('catParkourBtn').addEventListener('click', () => {
                this.goToRandom2DTarget();
                this.showBubble('Hựaaa! Parkour bay nhảy khắp màn hình trình duyệt! 🚀🐾', 4500);
            });

            document.getElementById('catBreedSwitchBtn').addEventListener('click', () => {
                const idx = (BREED_KEYS.indexOf(this.breedKey) + 1) % BREED_KEYS.length;
                this.breedKey = BREED_KEYS[idx];
                this.breed = CAT_BREEDS[this.breedKey];
                this.softBody.resetDeformation();
                this.spawnParticle('sparkle');
                this.showBubble(`Meow~ Đã đổi sang [${this.breed.name}]! 🐾✨`, 4500);
                this.saveCatState();
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
                setTimeout(() => document.getElementById('nividaCatCmdInput')?.focus(), 60);
            }
        }

        onCatClicked() {
            this.spawnParticle('heart');
            this.spawnParticle('sparkle');
            this.softBody.triggerJiggle(6, -6);
            this.setCatState('sit_paw_wave_hi', 5.0, 'lovestruck_sparkle');
            this.showBubble('Meow~ Bạn gõ lệnh vào khung Chat bên trái để bảo Mèo tìm đồ, bỏ giỏ hàng hoặc đổi giao diện nha! 🐾💬', 5500);
            this.toggleDock(true);
        }

        setCatState(newState, duration = 5.0, expr = 'normal', broadcast = true) {
            this.state = newState;
            this.stateTimer = duration;
            this.expr = expr;
            this.softBody.setLiquidState(newState);
            this.softBody.triggerJiggle(4, -4);
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
                    x: this.softBody.x + (Math.random() * 36 - 18),
                    y: this.softBody.y - 32,
                    vx: Math.random() * 36 - 18,
                    vy: -40 - Math.random() * 30,
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
                this.goToRandom2DTarget();
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
                const cartBtn = document.getElementById('headerCartCount');
                if (cartBtn) {
                    const r = cartBtn.getBoundingClientRect();
                    this.targetX = Math.max(this.leftWallX, Math.min(this.rightWallX, r.left));
                    this.targetY = Math.max(this.ceilingY, r.bottom + 24);
                    this.surfaceMode = 'ceiling';
                }
                if (typeof addToCartGlobal === 'function') {
                    addToCartGlobal(p);
                }
                this.renderProductTray([p], '🛒 Mèo vừa tha món này lên Giỏ hàng của bạn:');
            } else if (act === 'SEARCH_PRODUCTS' && Array.isArray(data.products)) {
                this.renderProductTray(data.products, `🔍 Kết quả Mèo tìm thấy cho "${data.search_query || ''}":`);
            } else if (act === 'TRIGGER_CHECKIN') {
                if (typeof triggerHeaderCheckin === 'function') {
                    triggerHeaderCheckin();
                }
            } else if (act === 'NAVIGATE_PAGE' && data.target_url) {
                this.targetX = window.innerWidth - 90;
                this.targetY = this.ceilingY;
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
                        <div class="text-truncate me-2" style="max-width: 235px;">
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
                this.softBody.resetDeformation();
            }
            const dt = Math.min(0.025, Math.max(0.004, rawDt || 0.016));
            this.updateCatBehavior(dt);
            this.renderCatCanvas();
            requestAnimationFrame((nextTs) => this.loop(nextTs));
        }

        updateCatBehavior(dt) {
            this.animTime += dt;
            this.stateTimer -= dt;

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
                const targetTilt = this.surfaceMode === 'ceiling' ? Math.sin(this.animTime * 6) * 4 : 0;
                this.bodyTilt = lerpVal(this.bodyTilt, targetTilt, dt * 10);
            }

            let speedMag = 0;
            if (!this.isDragging) {
                if (this.targetX !== null && this.targetY !== null) {
                    const dx = this.targetX - this.softBody.x;
                    const dy = this.targetY - this.softBody.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < 18) {
                        this.softBody.x = this.targetX;
                        this.softBody.y = this.targetY;
                        this.targetX = null;
                        this.targetY = null;
                        this.softBody.triggerJiggle(5, 5);
                        if (this.state === 'walking' || this.state.includes('jump') || this.state.includes('climb')) {
                            this.setCatState('sitting', 5.5, 'normal', false);
                        }
                    } else {
                        if (Math.abs(dx) > 8) this.direction = dx >= 0 ? 1 : -1;
                        const moveSpd = (this.state.includes('jump') || this.state.includes('run') || this.state === 'carrying') ? 320 : 165;
                        const stepDist = Math.min(dist, moveSpd * dt);
                        this.softBody.x += (dx / dist) * stepDist;
                        this.softBody.y += (dy / dist) * stepDist;
                        speedMag = moveSpd;
                    }
                } else if (this.stateTimer <= 0) {
                    const r = Math.random();
                    if (r < 0.35) {
                        const pt = this.pickRandomScreenPerchPoint();
                        this.surfaceMode = pt.mode;
                        this.targetX = pt.x;
                        this.targetY = pt.y;
                        const moveState = Math.abs(pt.y - this.softBody.y) > 90 ? 'jump_starfish_soar' : 'walking';
                        this.setCatState(moveState, 6.0, 'normal', false);
                    } else if (r < 0.55) {
                        this.targetX = 110 + Math.random() * Math.max(150, window.innerWidth - 220);
                        this.targetY = this.softBody.y;
                        this.setCatState('walking', 5.5, 'normal', false);
                    } else if (r < 0.72) {
                        this.setCatState('loaf_purr_toast', 6.0, 'content_purr', false);
                    } else if (r < 0.86) {
                        this.setCatState('sploot_superman', 5.5, 'uwu', false);
                    } else {
                        this.setCatState('sitting', 5.0, 'normal', false);
                    }
                }
            }

            this.softBody.x = Math.min(this.rightWallX, Math.max(this.leftWallX, this.softBody.x));
            this.softBody.y = Math.min(this.floorY, Math.max(this.ceilingY, this.softBody.y));
            this.softBody.stepLocalJelly(dt, speedMag);

            const cx = this.softBody.x;
            const cy = this.softBody.y;
            if (this.hitbox) {
                this.hitbox.style.left = `${cx - 54}px`;
                this.hitbox.style.top = `${cy - 48}px`;
            }
            if (this.bubbleEl && !this.bubbleEl.classList.contains('d-none')) {
                const bw = this.bubbleEl.offsetWidth || 220;
                const leftPos = Math.max(12, Math.min(window.innerWidth - bw - 16, cx - bw / 2));
                const topPos = cy > 150 ? (cy - 118) : (cy + 42);
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

            const cx = this.softBody.x;
            const cy = this.softBody.y;
            const dir = this.direction;
            const b = this.breed;
            const st = this.state;
            const t = this.animTime;
            const scX = this.softBody.smoothScaleX;
            const scY = this.softBody.smoothScaleY;

            ctx.save();
            ctx.translate(cx, cy);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.beginPath();
            ctx.ellipse(0, 26 * scY, 34 * scX, 5.5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.rotate((this.bodyTilt * Math.PI) / 180);

            const wag = Math.sin(t * (st.includes('dance') || st.includes('happy') ? 16 : 5.5)) * 14;
            const tx = -26 * dir * scX;
            const ty = 3 * scY;
            ctx.save();
            ctx.lineCap = 'round';
            ctx.strokeStyle = b.stroke;
            ctx.lineWidth = b.tailStyle === 'fluffy' ? 13 : 9.5;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.bezierCurveTo(tx - 20 * dir, ty + 8, tx - 38 * dir, ty - 18 + wag, tx - 48 * dir, ty - 5 + wag);
            ctx.stroke();
            ctx.strokeStyle = b.pCol;
            ctx.lineWidth = b.tailStyle === 'fluffy' ? 8.5 : 5.5;
            ctx.stroke();
            ctx.restore();

            if (!st.includes('loaf') && !st.includes('sleep')) {
                const isMoving = (this.targetX !== null || st === 'walking' || st.includes('run') || st === 'carrying');
                const walkSwing = isMoving ? Math.sin(t * 15) * 9 : 0;
                ctx.save();
                ctx.fillStyle = b.body;
                ctx.strokeStyle = b.stroke;
                ctx.lineWidth = 3.8;
                [-15, 15].forEach((ox, idx) => {
                    const lx = ox * dir + (idx === 0 ? -walkSwing : walkSwing) * 0.6;
                    const ly = 11 * scY;
                    ctx.beginPath();
                    ctx.roundRect(lx - 6, ly, 12, 15, 5.5);
                    ctx.fill();
                    ctx.stroke();
                });
                ctx.restore();
            }

            const pts = this.softBody.nodes;
            const num = pts.length;
            const bodyPath = new Path2D();
            const startMidX = (pts[0].ox + pts[num - 1].ox) / 2;
            const startMidY = (pts[0].oy + pts[num - 1].oy) / 2;
            bodyPath.moveTo(startMidX, startMidY);
            for (let i = 0; i < num; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % num];
                bodyPath.quadraticCurveTo(p1.ox, p1.oy, (p1.ox + p2.ox) / 2, (p1.oy + p2.oy) / 2);
            }
            bodyPath.closePath();

            ctx.save();
            ctx.fillStyle = b.body;
            ctx.fill(bodyPath);

            ctx.save();
            ctx.clip(bodyPath);
            if (b.pattern !== 'solid') {
                const bellyPath = new Path2D();
                bellyPath.ellipse(2 * dir, 12 * scY, 21 * scX, 11 * scY, 0, 0, Math.PI * 2);
                ctx.fillStyle = b.belly;
                ctx.fill(bellyPath);
            }
            if (b.pattern === 'calico' || b.pattern === 'cow') {
                const patchPath = new Path2D();
                patchPath.ellipse(-9 * dir, -7 * scY, 14, 11, 0, 0, Math.PI * 2);
                ctx.fillStyle = b.pCol;
                ctx.fill(patchPath);
            } else if (b.pattern === 'stripes') {
                ctx.fillStyle = b.pCol;
                [-11, 0, 11].forEach(off => {
                    ctx.fillRect(off - 2, -24 * scY, 4, 12);
                });
            }
            ctx.restore();

            ctx.lineWidth = 4.2;
            ctx.strokeStyle = b.stroke;
            ctx.stroke(bodyPath);
            ctx.restore();

            const bobY = (this.targetX !== null || st.includes('dance')) ? -Math.abs(Math.sin(t * 13)) * 4 : 0;
            const hx = (st.includes('loaf') || st.includes('sleep') ? 17 : 23) * dir * scX;
            const hy = -(st.includes('sploot') ? 11 : 19) * scY + bobY;

            ctx.save();
            ctx.translate(hx, hy);
            if (st === 'head_tilt' || st.includes('dance')) {
                ctx.rotate(Math.sin(t * 6) * 0.15);
            }

            [-1, 1].forEach(side => {
                ctx.save();
                ctx.translate(side * 13, -15);
                ctx.rotate(side * 0.22);
                const earP = new Path2D();
                earP.moveTo(-10, 4);
                earP.quadraticCurveTo(-6, -17, 0, -20);
                earP.quadraticCurveTo(6, -17, 10, 4);
                earP.closePath();
                ctx.fillStyle = b.pattern === 'points' ? b.pCol : b.body;
                ctx.fill(earP);
                ctx.lineWidth = 4.0;
                ctx.strokeStyle = b.stroke;
                ctx.stroke(earP);

                const innerP = new Path2D();
                innerP.moveTo(-4.5, 2);
                innerP.quadraticCurveTo(0, -12, 4.5, 2);
                innerP.closePath();
                ctx.fillStyle = 'rgb(251, 207, 232)';
                ctx.fill(innerP);
                ctx.restore();
            });

            const chewPuff = (st.includes('eat') || st.includes('boba')) ? Math.abs(Math.sin(t * 15)) * 4.0 : 0;
            const headPath = new Path2D();
            headPath.ellipse(0, 0, 25 + chewPuff, 20, 0, 0, Math.PI * 2);
            ctx.fillStyle = b.body;
            ctx.fill(headPath);
            ctx.lineWidth = 4.2;
            ctx.strokeStyle = b.stroke;
            ctx.stroke(headPath);

            ctx.strokeStyle = b.stroke;
            ctx.lineWidth = 1.9;
            [-1, 1].forEach(wSide => {
                const wx0 = wSide * (19 + chewPuff * 0.5);
                const wx1 = wSide * (31 + chewPuff * 0.7);
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
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.roundRect(-19, -7, 38, 10, 4);
                ctx.fill();
                ctx.stroke();
            } else if (this.expr === 'rich_sunglasses_gold') {
                ctx.fillStyle = 'rgb(250, 204, 21)';
                ctx.strokeStyle = 'rgb(120, 53, 15)';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.roundRect(-18, -8, 15, 10, 3);
                ctx.roundRect(3, -8, 15, 10, 3);
                ctx.fill();
                ctx.stroke();
            } else if (st.includes('sleep') || this.expr === 'content_purr' || this.expr === 'sleepy_drool_bubble') {
                ctx.strokeStyle = b.stroke;
                ctx.lineWidth = 3.0;
                [-9.5, 9.5].forEach(ex => {
                    ctx.beginPath();
                    ctx.arc(ex, -2, 5.0, 0, Math.PI, false);
                    ctx.stroke();
                });
            } else {
                const dx = this.mousePos.x - (cx + hx);
                const dy = this.mousePos.y - (cy + hy);
                const ang = Math.atan2(dy, dx);
                const lookDist = Math.min(2.4, Math.hypot(dx, dy) * 0.012);
                const px = Math.cos(ang) * lookDist;
                const py = Math.sin(ang) * lookDist;

                [-9.5, 9.5].forEach((ex, idxE) => {
                    ctx.fillStyle = idxE === 0 ? b.eyeColor : b.eyeColor2;
                    ctx.beginPath();
                    ctx.ellipse(ex, -2, 6.8, 6.8 * this.eyeOpen, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgb(9, 13, 22)';
                    ctx.beginPath();
                    ctx.ellipse(ex + px, -2 + py, 4.3, 5.2 * this.eyeOpen, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgb(255, 255, 255)';
                    ctx.beginPath();
                    ctx.arc(ex - 1.8 + px, -3.8 + py, 2.1, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            ctx.fillStyle = 'rgba(255, 145, 178, 0.82)';
            ctx.beginPath();
            ctx.ellipse(-15, 5, 4.8, 3.2, 0, 0, Math.PI * 2);
            ctx.ellipse(15, 5, 4.8, 3.2, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgb(255, 107, 129)';
            ctx.beginPath();
            ctx.moveTo(-3.2, 4.2);
            ctx.lineTo(3.2, 4.2);
            ctx.lineTo(0, 8.0);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = b.stroke;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(-5.0, 8.5);
            ctx.quadraticCurveTo(-2.5, 12.2, 0, 8.5);
            ctx.quadraticCurveTo(2.5, 12.2, 5.0, 8.5);
            ctx.stroke();

            if (st === 'drink_boba_tea') {
                ctx.save();
                ctx.translate(11 * dir, 15);
                ctx.fillStyle = 'rgb(253, 230, 138)';
                ctx.strokeStyle = 'rgb(30, 41, 59)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(-7, -2, 14, 16, 3);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgb(15, 23, 42)';
                [-2.5, 0, 2.5].forEach(bx => {
                    ctx.beginPath();
                    ctx.arc(bx, 10, 1.6, 0, Math.PI * 2);
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
