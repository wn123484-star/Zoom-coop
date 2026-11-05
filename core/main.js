let popupCloseCallback = null;
let placeholderRotationTimer = null;

const ALL_PLATFORM_CATEGORIES = [
    { key: 'gpu', label: 'Card đồ họa (GPU)', keywords: ['gpu', 'rtx', 'card', 'vga', 'do hoa'] },
    { key: 'watch', label: 'Đồng hồ & Sức khỏe', keywords: ['dong ho', 'watch', 'massage', 'suc khoe', 'binh giu nhiet'] },
    { key: 'keyboard', label: 'Bàn phím', keywords: ['ban phim', 'keyboard', 'phim co', 'switch'] },
    { key: 'mouse', label: 'Chuột', keywords: ['chuot', 'mouse', 'wireless', 'dpi'] },
    { key: 'headphones', label: 'Tai nghe', keywords: ['tai nghe', 'headphone', 'anc', 'bluetooth'] },
    { key: 'speaker', label: 'Đèn & Gia dụng', keywords: ['den', 'loa', 'speaker', 'gia dung', 'loc khong khi'] },
    { key: 'bag', label: 'Balo & Phụ kiện', keywords: ['balo', 'tui', 'bag', 'laptop'] },
    { key: 'cpu', label: 'Vi xử lý (CPU)', keywords: ['cpu', 'core i', 'ryzen', 'vi xu ly'] },
    { key: 'mainboard', label: 'Mainboard', keywords: ['mainboard', 'bo mach', 'z790', 'b650'] },
    { key: 'ram', label: 'RAM', keywords: ['ram', 'ddr5', 'ddr4', 'bo nho'] }
];

function getAuthUser() {
    try {
        const raw = localStorage.getItem('auth_user') || localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function setAuthUser(user) {
    if (!user) {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('user');
        return;
    }
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('user', JSON.stringify(user));
}

function logoutUser() {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthUser(null);
    window.location.href = '/services/home/index.html';
}

function formatVND(val) {
    return Number(val || 0).toLocaleString('vi-VN') + ' Xu';
}

function trackCategoryInterest(catKey, weight = 2) {
    if (!catKey) return;
    try {
        const scores = JSON.parse(localStorage.getItem('nivida_cat_scores') || '{}');
        scores[catKey] = Number(scores[catKey] || 0) + Number(weight);
        localStorage.setItem('nivida_cat_scores', JSON.stringify(scores));
    } catch {}
}

function getCategoryInterestScores() {
    try {
        return JSON.parse(localStorage.getItem('nivida_cat_scores') || '{}');
    } catch {
        return {};
    }
}

function getFavoriteIds() {
    try {
        return JSON.parse(localStorage.getItem('favorite_ids') || '[]').map(Number).filter(Boolean);
    } catch {
        return [];
    }
}

function saveFavoriteIds(ids) {
    const clean = [...new Set((ids || []).map(Number).filter(Boolean))];
    localStorage.setItem('favorite_ids', JSON.stringify(clean));
    localStorage.setItem('compare_ids', JSON.stringify(clean.slice(0, 3)));
}

function isProductFavorited(id) {
    return getFavoriteIds().includes(Number(id));
}

async function syncUserFavoritesFromSql() {
    const user = getAuthUser();
    if (!user || !user.id) return;
    try {
        const res = await fetch(`/api/compare/favorites?user_id=${user.id}`);
        if (res.ok) {
            const data = await res.json();
            saveFavoriteIds(data.favorite_ids || []);
        }
    } catch {}
}

async function toggleFavoriteGlobal(productOrId, btnEl = null) {
    const pid = typeof productOrId === 'object' ? Number(productOrId.id) : Number(productOrId);
    if (!pid) return;

    let current = getFavoriteIds();
    const wasFav = current.includes(pid);
    if (wasFav) {
        current = current.filter(x => x !== pid);
    } else {
        current.unshift(pid);
        if (typeof productOrId === 'object' && productOrId.category) {
            trackCategoryInterest(productOrId.category, 4);
        }
    }
    saveFavoriteIds(current);

    const prefPct = Number(localStorage.getItem('wishlist_target_pct') || 10);
    const user = getAuthUser();
    if (user && user.id) {
        try {
            const res = await fetch('/api/compare/favorites/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, product_id: pid, target_discount_pct: prefPct })
            });
            if (res.ok) {
                const data = await res.json();
                saveFavoriteIds(data.favorite_ids || current);
                notifyToast(data.message, data.is_favorite ? 'success' : 'info');
                await refreshHeaderNotifications();
            }
        } catch {}
    } else {
        notifyToast(
            wasFav ? 'Đã bỏ khỏi danh sách Yêu thích (Wishlist)' : `❤️ Đã lưu vào Wishlist & Bật báo khi giảm ≥ ${prefPct}%!`,
            wasFav ? 'info' : 'success'
        );
    }

    if (btnEl) {
        const nowFav = isProductFavorited(pid);
        btnEl.className = nowFav ? 'btn btn-danger btn-sm py-1 px-2' : 'btn btn-outline-danger btn-sm py-1 px-2';
    }
}

async function clearCompareSelectionGlobal() {
    localStorage.removeItem('favorite_ids');
    localStorage.removeItem('compare_ids');
    sessionStorage.setItem('compare_bar_dismissed', '1');

    const bar = document.getElementById('floatingCompareBar');
    if (bar) {
        bar.classList.add('d-none');
    }

    const user = getAuthUser();
    if (user && user.id) {
        try {
            await fetch('/api/compare/favorites/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            });
        } catch {}
    }

    document.querySelectorAll('button[title*="Ưa thích"], button[title*="Wishlist"]').forEach(btn => {
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-outline-danger');
    });
    notifyToast('Đã xóa danh sách chờ so sánh!', 'info');
}

function getCart() {
    try {
        return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch {
        return [];
    }
}

function saveCart(cart) {
    const cleanCart = cart || [];
    localStorage.setItem('cart', JSON.stringify(cleanCart));
    const badge = document.getElementById('headerCartCount');
    if (badge) {
        const count = cleanCart.reduce((sum, i) => sum + Number(i.quantity || 1), 0);
        badge.textContent = count;
    }
    const user = getAuthUser();
    if (user && user.id) {
        fetch('/api/compare/cart/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, items: cleanCart })
        }).catch(() => {});
    }
}

function addToCartGlobal(product) {
    if (!product || !product.id) return;
    if (product.category) {
        trackCategoryInterest(product.category, 5);
    }
    const cart = getCart();
    const existing = cart.find(i => Number(i.id) === Number(product.id));
    if (existing) {
        existing.quantity = Number(existing.quantity || 1) + 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price || 0),
            image_url: product.image_url || '',
            category: product.category || 'gpu',
            unit: product.unit || 'Chiếc',
            warranty_policy: product.warranty_policy || 'Bảo hành 12 tháng tại Shop',
            quantity: 1
        });
    }
    saveCart(cart);
    notifyToast(`🛒 Đã thêm "${product.name}" vào Giỏ hàng!`, 'success');
}

function getProductImageUrl(p, isFallback = false) {
    if (!isFallback && p && p.image_url && p.image_url.trim() !== '') {
        return p.image_url;
    }
    const cat = (p && p.category ? p.category : 'gpu').toLowerCase();
    const icons = {
        watch: '⌚',
        bag: '🎒',
        speaker: '🔊',
        headphones: '🎧',
        keyboard: '⌨️',
        mouse: '🖱',
        gpu: '🖥',
        cpu: '⚡',
        mainboard: '🎛',
        ram: '💾',
        psu: '🔋'
    };
    const icon = icons[cat] || '🎁';
    const title = encodeURIComponent((p && p.name ? p.name : 'Nivida').substring(0, 22));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220"><rect width="100%" height="100%" fill="rgb(22,27,36)"/><circle cx="160" cy="92" r="44" fill="rgba(118,185,0,0.16)" stroke="rgb(118,185,0)" stroke-width="2"/><text x="160" y="106" font-size="38" text-anchor="middle">${icon}</text><text x="160" y="172" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="rgb(118,185,0)" text-anchor="middle">${decodeURIComponent(title)}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getViewedProductIds() {
    try {
        return JSON.parse(localStorage.getItem('viewed_products') || '[]');
    } catch {
        return [];
    }
}

function addViewedProductId(id) {
    if (!id) return;
    let list = getViewedProductIds().filter(x => Number(x) !== Number(id));
    list.unshift(Number(id));
    localStorage.setItem('viewed_products', JSON.stringify(list.slice(0, 10)));
}

function getSearchHistoryKeywords() {
    try {
        return JSON.parse(localStorage.getItem('nivida_search_history') || '[]');
    } catch {
        return [];
    }
}

function addSearchHistoryKeyword(kw) {
    const clean = String(kw || '').trim();
    if (!clean || clean.length < 2) return;
    let list = getSearchHistoryKeywords().filter(x => x.toLowerCase() !== clean.toLowerCase());
    list.unshift(clean);
    localStorage.setItem('nivida_search_history', JSON.stringify(list.slice(0, 8)));

    const lowerKw = clean.toLowerCase();
    ALL_PLATFORM_CATEGORIES.forEach(c => {
        if (c.keywords.some(k => lowerKw.includes(k))) {
            trackCategoryInterest(c.key, 3);
        }
    });
}

function clearSearchHistoryKeywords() {
    localStorage.removeItem('nivida_search_history');
    renderSearchHistoryLinks([]);
}

function recordInterestKeyword(kw) {
    if (!kw) return;
    localStorage.setItem('last_interest_kw', String(kw));
}

function applySavedTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const stylePreset = localStorage.getItem('bs_style') || 'nvidia';
    const presets = {
        nvidia: { color: 'rgb(118, 185, 0)', radius: '10px' },
        shopee: { color: 'rgb(249, 115, 22)', radius: '8px' },
        cyberpunk: { color: 'rgb(236, 72, 153)', radius: '4px' },
        ocean: { color: 'rgb(14, 165, 233)', radius: '16px' }
    };
    if (stylePreset === 'custom') {
        const c = localStorage.getItem('custom_accent_color') || 'rgb(118, 185, 0)';
        const r = (localStorage.getItem('custom_card_radius') || '10') + 'px';
        document.documentElement.style.setProperty('--primary-accent', c);
        document.documentElement.style.setProperty('--card-radius', r);
    } else if (presets[stylePreset]) {
        document.documentElement.style.setProperty('--primary-accent', presets[stylePreset].color);
        document.documentElement.style.setProperty('--card-radius', presets[stylePreset].radius);
    }
}

function toggleQuickThemeMode() {
    const current = localStorage.getItem('theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applySavedTheme();
    notifyToast(`Đã chuyển sang giao diện ${next === 'light' ? 'Sáng (Light Mode)' : 'Tối (Dark Mode)'}!`, 'info');
}

function renderDynamicCategoryBar(serverTrendingCats = []) {
    const barContainer = document.getElementById('dynamicCategoryNavLinks');
    if (!barContainer) return;

    const urlCat = new URLSearchParams(window.location.search).get('category') || '';
    if (urlCat) {
        trackCategoryInterest(urlCat, 3);
    }

    const interestScores = getCategoryInterestScores();
    const cartItems = getCart();
    cartItems.forEach(it => {
        if (it.category) {
            interestScores[it.category] = Number(interestScores[it.category] || 0) + 4;
        }
    });

    (serverTrendingCats || []).forEach((cKey, idx) => {
        interestScores[cKey] = Number(interestScores[cKey] || 0) + Math.max(2, 8 - idx);
    });

    const scoredCats = ALL_PLATFORM_CATEGORIES.map((cat, defaultIdx) => {
        const score = Number(interestScores[cat.key] || 0);
        return {
            ...cat,
            score,
            defaultIdx
        };
    });

    scoredCats.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.defaultIdx - b.defaultIdx;
    });

    const primaryCats = scoredCats.slice(0, 5);
    const secondaryCats = scoredCats.slice(5);

    const allActiveClass = !urlCat && window.location.pathname.includes('/home/') ? 'cat-active' : '';
    let html = `<a href="/services/home/index.html" class="${allActiveClass}">Tất cả</a>`;

    primaryCats.forEach((c, idx) => {
        const isCurrent = urlCat === c.key;
        const hotIcon = (c.score > 0 && idx < 3) ? '🔥 ' : '';
        html += `<a href="/services/home/index.html?category=${c.key}" class="cat-priority ${isCurrent ? 'cat-active' : ''}" title="Danh mục xu hướng & bạn quan tâm">${hotIcon}${c.label}</a>`;
    });

    if (secondaryCats.length > 0) {
        html += `<span class="cat-divider-dot">|</span>`;
        secondaryCats.forEach(c => {
            const isCurrent = urlCat === c.key;
            html += `<a href="/services/home/index.html?category=${c.key}" class="cat-secondary ${isCurrent ? 'cat-active' : ''}" title="Danh mục phụ">${c.label}</a>`;
        });
    }

    barContainer.innerHTML = html;
}

function renderGlobalHeaderAndFooter() {
    const headerHolder = document.getElementById('header-placeholder');
    if (headerHolder) {
        headerHolder.innerHTML = `
        <header class="nividax-header-wrap">
            <div class="nividax-topbar">
                <div class="container d-flex justify-content-between align-items-center gap-2 overflow-auto">
                    <div class="d-flex align-items-center gap-3">
                        <a href="/services/seller/seller-dashboard.html">🏪 Kênh Người Bán</a>
                        <a href="/services/pc_builder/pc-builder.html">🛠 Build Cấu Hình PC <span class="badge bg-secondary" style="font-size:0.6rem;">Đang phát triển</span></a>
                        <a href="/services/compare/compare.html">📊 So Sánh &amp; Wishlist</a>
                        <a href="/services/vouchers_deals/vouchers.html">🎟 Kho Voucher</a>
                        <a href="/services/minigame/farm.html" class="text-nvidia fw-bold">🌱 Nông Trại Voucher</a>
                        <a href="/services/minigame/minigame.html" class="text-warning fw-bold">🎡 Vòng Quay</a>
                    </div>
                    <div class="d-flex align-items-center gap-3">
                        <a href="/services/order_tracking/tracking.html">🚚 Tra Cứu Mã Vận Đơn</a>
                        <a href="/services/legal/terms.html">📜 Điều Khoản Dịch Vụ</a>
                        <button type="button" class="btn btn-sm btn-outline-light py-0 px-2" style="font-size:0.7rem;" onclick="toggleQuickThemeMode()">🌓 Sáng/Tối</button>
                    </div>
                </div>
            </div>

            <div class="container py-2">
                <div class="nividax-mainbar">
                    <a href="/services/home/index.html" class="nividax-brand-box">
                        <img id="headerBrandLogoImg" alt="Nivida Logo" style="height: 38px; width: auto; object-fit: contain; display: none;">
                        <span id="headerFallbackLogoBadge" class="nividax-logo-badge">N</span>
                        <div>
                            <strong class="fs-5 d-block lh-1 text-nvidia">Nivida</strong>
                            <small class="text-secondary" style="font-size:0.65rem;">Công Nghệ &amp; Đời Sống</small>
                        </div>
                    </a>

                    <div class="nividax-search-wrap">
                        <form onsubmit="submitGlobalSearch(event)" class="w-100">
                            <div class="input-group input-group-sm">
                                <input type="search" id="globalSearchInput" class="form-control" autocomplete="off" placeholder="Đang tải gợi ý vật phẩm dành cho bạn...">
                                <button type="submit" class="btn btn-nvidia px-3">🔍</button>
                            </div>
                        </form>
                        <div id="headerSearchHistoryBar" class="search-history-bar"></div>
                    </div>

                    <div class="nividax-actions-box">
                        <button type="button" id="headerNotifBellBtn" class="header-notif-btn" onclick="toggleGlobalNotifDrawer()" title="Thông báo Giảm giá Wishlist, Mã vận đơn &amp; Pháp lý">
                            <span>🔔</span>
                            <span id="headerNotifCount" class="badge bg-danger rounded-pill" style="font-size:0.65rem;">0</span>
                        </button>

                        <button type="button" id="headerCompactCheckinBtn" class="btn-checkin-sparkle d-none" onclick="triggerHeaderCheckin()" title="Điểm danh nhận Xu &amp; Lượt quay">
                            <span class="sparkle-dot"></span>
                            <span id="headerCheckinLabel">✨ Điểm danh</span>
                        </button>

                        <a href="/services/settings/settings.html" id="headerXuBalanceBadge" class="header-xu-pill d-none" title="Số dư Xu sở hữu">
                            <span>🪙</span>
                            <span id="headerXuAmountText">0 Xu</span>
                        </a>

                        <div id="headerAuthArea" class="d-flex align-items-center gap-1">
                            <a href="/services/auth/auth.html" class="btn btn-outline-light btn-sm py-1 px-2" style="font-size:0.76rem;">Đăng nhập</a>
                            <a href="/services/auth/auth.html?tab=register" class="btn btn-nvidia btn-sm py-1 px-2" style="font-size:0.76rem;">+100K Xu</a>
                        </div>

                        <a href="/services/cart_checkout/cart.html" class="btn btn-nvidia btn-sm py-1 px-2 position-relative" style="font-size:0.78rem;">
                            🛒 <span class="badge bg-dark" id="headerCartCount">0</span>
                        </a>
                    </div>
                </div>
            </div>

            <div class="nividax-catbar">
                <div class="container d-flex justify-content-between align-items-center gap-2 overflow-auto">
                    <div id="dynamicCategoryNavLinks" class="d-flex align-items-center gap-1"></div>
                    <div class="d-flex gap-2 flex-shrink-0">
                        <a href="/services/compare/compare.html" class="text-nvidia fw-semibold">📊 So Sánh &amp; Wishlist</a>
                    </div>
                </div>
            </div>
        </header>

        <div id="globalNotifDrawer" class="notif-drawer-panel d-none">
            <div class="p-2 px-3 bg-dark text-white d-flex justify-content-between align-items-center border-bottom">
                <div>
                    <strong class="small text-nvidia d-block">🔔 Trung Tâm Thông Báo Tự Động</strong>
                    <small class="text-secondary" style="font-size:0.7rem;">Cảnh báo Giảm giá Wishlist • Mã Vận Đơn • Điều Khoản Pháp Lý</small>
                </div>
                <button type="button" class="btn-close btn-close-white btn-sm" onclick="toggleGlobalNotifDrawer(false)"></button>
            </div>
            <div class="p-2 border-bottom bg-surface small">
                <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
                    <span class="fw-bold text-nvidia">❤️ Báo khi Wishlist giảm từ:</span>
                    <div class="d-flex gap-1">
                        <select id="headerWishlistPctSelect" class="form-select form-select-sm py-0" style="width:95px;" onchange="saveWishlistThresholdSetting(this.value)">
                            <option value="5">≥ 5%</option>
                            <option value="10" selected>≥ 10%</option>
                            <option value="15">≥ 15%</option>
                            <option value="20">≥ 20%</option>
                            <option value="30">≥ 30%</option>
                        </select>
                        <button type="button" class="btn btn-warning btn-sm py-0 fw-bold text-dark" onclick="simulateHeaderWishlistDrop()" title="Mô phỏng Shop giảm giá món bạn yêu thích để kiểm thử thông báo">
                            ⚡ Test Giảm Giá
                        </button>
                    </div>
                </div>
            </div>
            <div id="globalNotifListBox" class="p-2 flex-fill" style="overflow-y:auto; max-height: 330px; font-size:0.8rem;">
                <div class="text-center text-muted py-3">Đang tải thông báo...</div>
            </div>
            <div class="p-2 border-top d-flex justify-content-between align-items-center bg-surface small">
                <button type="button" class="btn btn-outline-secondary btn-sm py-0" onclick="markAllHeaderNotifsRead()">✔ Đánh dấu đã đọc hết</button>
                <a href="/services/compare/compare.html" class="btn btn-nvidia btn-sm py-0">Xem toàn bộ Wishlist →</a>
            </div>
        </div>`;
        renderDynamicCategoryBar();
    }

    const footerHolder = document.getElementById('footer-placeholder');
    if (footerHolder) {
        footerHolder.innerHTML = `
        <footer class="bg-surface border-top mt-5 py-4 small">
            <div class="container">
                <div class="row g-3">
                    <div class="col-md-5">
                        <h6 class="fw-bold text-nvidia mb-2">Nivida - Sàn Thương Mại Công Nghệ &amp; Đa Ngành Hàng</h6>
                        <p class="text-muted mb-1">Mua sắm trực tuyến đa dạng ngành hàng, áp dụng trực tiếp Xu và Mã giảm giá khi thanh toán, tích hợp Mèo Lỏng Trợ Lý AI hỗ trợ tìm đồ &amp; bỏ giỏ hàng.</p>
                    </div>
                    <div class="col-md-4">
                        <h6 class="fw-bold mb-2">Tiện Ích Mua Sắm</h6>
                        <div class="d-flex flex-column gap-1">
                            <a href="/services/minigame/farm.html" class="text-decoration-none text-muted">🌱 Nông Trại Cây Voucher (Vốn 0 Xu)</a>
                            <a href="/services/minigame/minigame.html" class="text-decoration-none text-muted">🎡 Vòng Quay May Mắn</a>
                            <a href="/services/order_tracking/tracking.html" class="text-decoration-none text-muted">🚚 Tra Cứu Mã Vận Đơn &amp; Hành Trình</a>
                            <a href="/services/vouchers_deals/vouchers.html" class="text-decoration-none text-muted">🎟 Săn Mã Giảm Giá Toàn Sàn</a>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <h6 class="fw-bold mb-2">Cam Kết Dịch Vụ</h6>
                        <div class="p-2 border rounded">
                            <div class="fw-bold text-nvidia">Giao Nhanh &amp; Mèo Trợ Lý AI</div>
                            <small class="text-muted">Bấm vào Mèo Lỏng để nhờ tìm đồ, bỏ giỏ hàng hoặc đổi chế độ Sáng/Tối.</small>
                        </div>
                    </div>
                </div>
            </div>
        </footer>

        <button type="button" class="store-chat-fab" onclick="toggleGlobalChatDrawer()">
            <span>💬 Chat Gian Hàng</span>
            <span id="globalChatUnreadBadge" class="badge bg-danger rounded-pill d-none">0</span>
        </button>

        <div id="globalChatDrawer" class="store-chat-drawer d-none">
            <div class="p-2 px-3 bg-dark text-white d-flex justify-content-between align-items-center border-bottom">
                <div>
                    <strong class="small text-nvidia d-block">💬 Trung Tâm Chat Gian Hàng</strong>
                    <small class="text-secondary" style="font-size:0.7rem;">Hỗ trợ trực tuyến bởi Chủ Shop &amp; Trợ lý tự động</small>
                </div>
                <button type="button" class="btn-close btn-close-white btn-sm" onclick="toggleGlobalChatDrawer(false)"></button>
            </div>
            <div class="p-2 border-bottom d-flex gap-2 align-items-center bg-surface">
                <small class="fw-semibold text-nowrap">Chọn Shop:</small>
                <select id="globalChatSellerSelect" class="form-select form-select-sm" onchange="loadGlobalSellerChatMessages()"></select>
            </div>
            <div id="globalChatMessagesBox" class="flex-fill p-3" style="overflow-y: auto; font-size: 0.83rem;"></div>
            <form onsubmit="submitGlobalChatMessage(event)" class="p-2 border-top d-flex gap-1 bg-surface">
                <input type="text" id="globalChatInput" class="form-control form-control-sm" placeholder="Nhập tin nhắn hỏi Shop..." required>
                <button type="submit" class="btn btn-nvidia btn-sm px-3">Gửi</button>
            </form>
        </div>`;
    }

    if (!document.getElementById('nividaxGlobalPopup')) {
        const popupWrap = document.createElement('div');
        popupWrap.innerHTML = `
        <div id="nividaxGlobalPopup" class="nividax-modal-overlay d-none" role="dialog" aria-modal="true">
            <div class="nividax-modal-card text-center">
                <div id="nividaxPopupIcon" class="fs-1 mb-2">✨</div>
                <h5 id="nividaxPopupTitle" class="fw-bold text-nvidia mb-2">Thông Báo</h5>
                <div id="nividaxPopupBody" class="small mb-4" style="white-space: pre-line; line-height: 1.6;"></div>
                <button type="button" id="nividaxPopupConfirmBtn" class="btn btn-nvidia w-100 py-2 fw-bold" onclick="closeNividaXPopup()">Đồng Ý</button>
            </div>
        </div>
        <div id="nividaxToastContainer" class="nividax-toast-container"></div>`;
        document.body.appendChild(popupWrap);
    }
}

async function refreshHeaderNotifications() {
    const user = getAuthUser();
    const countEl = document.getElementById('headerNotifCount');
    const bellBtn = document.getElementById('headerNotifBellBtn');
    const listBox = document.getElementById('globalNotifListBox');
    if (!countEl || !bellBtn) return;

    const savedPct = localStorage.getItem('wishlist_target_pct') || '10';
    const pctSel = document.getElementById('headerWishlistPctSelect');
    if (pctSel) pctSel.value = savedPct;

    if (!user || !user.id) {
        countEl.textContent = '0';
        bellBtn.classList.remove('has-unread');
        if (listBox) {
            listBox.innerHTML = '<div class="text-center text-muted py-3">Hãy đăng nhập và bấm ❤️ Yêu thích sản phẩm để nhận thông báo giảm giá &amp; cập nhật điều khoản!</div>';
        }
        return;
    }

    try {
        const res = await fetch(`/api/compare/notifications?user_id=${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const unread = Number(data.unread_count || 0);
        const notifs = data.notifications || [];
        countEl.textContent = String(unread);
        bellBtn.classList.toggle('has-unread', unread > 0);

        const unreadLegal = notifs.find(n => n.notif_type === 'legal_update' && Number(n.is_read || 0) === 0);
        if (unreadLegal) {
            const seenLegalKey = `seen_legal_notif_${unreadLegal.id}`;
            if (!sessionStorage.getItem(seenLegalKey)) {
                sessionStorage.setItem(seenLegalKey, '1');
                notifyToast(`${unreadLegal.title}: ${unreadLegal.message.substring(0, 95)}...`, 'warning');
            }
        }

        if (listBox) {
            if (!notifs.length) {
                listBox.innerHTML = `
                    <div class="text-center text-muted py-3">
                        Chưa có thông báo mới.<br>
                        <small>Hệ thống sẽ tự động báo 🔔 khi sản phẩm Wishlist giảm giá, khi đơn có Mã vận chuyển hoặc khi Sàn cập nhật Điều khoản Pháp lý!</small>
                    </div>
                `;
            } else {
                listBox.innerHTML = notifs.map(n => {
                    const isUnread = Number(n.is_read || 0) === 0;
                    const nType = n.notif_type || 'wishlist_sale';
                    let borderColor = 'rgb(236, 72, 153)';
                    let typeBadge = '<span class="badge bg-danger" style="font-size:0.6rem;">🔥 GIẢM GIÁ WISHLIST</span>';
                    let bgStyle = isUnread ? 'rgba(118,185,0,0.12)' : 'transparent';

                    if (nType === 'legal_update') {
                        borderColor = 'rgb(245, 158, 11)';
                        typeBadge = '<span class="badge bg-warning text-dark fw-bold" style="font-size:0.62rem;">⚖️ THÔNG BÁO PHÁP LÝ ĐẶC BIỆT</span>';
                        bgStyle = isUnread ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.05)';
                    } else if (nType === 'shipping_code') {
                        borderColor = 'rgb(14, 165, 233)';
                        typeBadge = '<span class="badge bg-info text-dark" style="font-size:0.6rem;">🚚 MÃ VẬN ĐƠN</span>';
                    }

                    return `
                        <a href="${n.link_url || '/services/home/index.html'}"
                           onclick="markSingleNotifRead(${n.id})"
                           class="d-block p-2 mb-2 border rounded text-decoration-none text-reset"
                           style="background:${bgStyle}; border-left: 4px solid ${borderColor} !important;">
                            <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                                ${typeBadge}
                                ${isUnread ? '<span class="badge bg-nvidia" style="font-size:0.6rem;">MỚI</span>' : '<small class="text-muted" style="font-size:0.62rem;">Đã xem</small>'}
                            </div>
                            <strong class="small text-nvidia d-block mb-1">${n.title}</strong>
                            <div class="small text-muted">${n.message}</div>
                        </a>
                    `;
                }).join('');
            }
        }
    } catch {}
}

function toggleGlobalNotifDrawer(forceState = null) {
    const drawer = document.getElementById('globalNotifDrawer');
    if (!drawer) return;
    const willOpen = forceState !== null ? forceState : drawer.classList.contains('d-none');
    drawer.classList.toggle('d-none', !willOpen);
    if (willOpen) {
        refreshHeaderNotifications();
    }
}

async function saveWishlistThresholdSetting(pctVal) {
    localStorage.setItem('wishlist_target_pct', String(pctVal));
    const user = getAuthUser();
    if (!user || !user.id) {
        notifyToast(`Đã lưu ngưỡng báo giảm giá ≥ ${pctVal}%!`, 'info');
        return;
    }
    const res = await fetch('/api/compare/wishlist-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, target_discount_pct: Number(pctVal), notify_enabled: true })
    });
    const data = await res.json();
    if (res.ok) {
        notifyToast(data.message, 'success');
    }
}

async function simulateHeaderWishlistDrop(productId = null) {
    const user = getAuthUser();
    if (!user || !user.id) {
        showNividaXPopup('Vui lòng đăng nhập tài khoản để kích hoạt thông báo giảm giá Wishlist!', 'Cần Đăng Nhập', '🔔');
        return;
    }
    const pct = Number(localStorage.getItem('wishlist_target_pct') || 15);
    const dropPct = Math.max(10, pct + 5);
    const res = await fetch('/api/compare/wishlist-simulate-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, product_id: productId, drop_pct: dropPct })
    });
    const data = await res.json();
    if (res.ok) {
        await refreshHeaderNotifications();
        showNividaXPopup(data.message, '🔥 Cảnh Báo Giảm Giá Wishlist!', '🔔');
        if (typeof loadStreamsAndInitCompare === 'function') {
            loadStreamsAndInitCompare(true);
        }
    } else {
        alert(data.error || 'Lỗi mô phỏng giảm giá');
    }
}

async function markSingleNotifRead(notifId) {
    const user = getAuthUser();
    if (!user || !user.id) return;
    await fetch('/api/compare/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, notif_id: notifId })
    }).catch(() => {});
}

async function markAllHeaderNotifsRead() {
    const user = getAuthUser();
    if (!user || !user.id) return;
    await fetch('/api/compare/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
    });
    await refreshHeaderNotifications();
    notifyToast('Đã đánh dấu đọc toàn bộ thông báo!', 'info');
}

function renderSearchHistoryLinks(recommendedItems = []) {
    const bar = document.getElementById('headerSearchHistoryBar');
    if (!bar) return;
    const historyKws = getSearchHistoryKeywords();
    const recKws = (recommendedItems || []).map(p => {
        const words = String(p.name || '').split(/\s+/).slice(0, 4).join(' ');
        return words;
    }).filter(Boolean);

    const combined = [];
    const seen = new Set();

    historyKws.forEach(k => {
        const low = k.toLowerCase();
        if (!seen.has(low)) {
            seen.add(low);
            combined.push({ text: k, isHistory: true });
        }
    });

    recKws.forEach(k => {
        const low = k.toLowerCase();
        if (!seen.has(low) && combined.length < 6) {
            seen.add(low);
            combined.push({ text: k, isHistory: false });
        }
    });

    if (!combined.length) {
        const defaults = ['RTX 4070 Super', 'Đồng hồ AMOLED', 'Máy massage cổ', 'Balo chống nước', 'Bàn phím cơ'];
        defaults.forEach(d => combined.push({ text: d, isHistory: false }));
    }

    const linksHtml = combined.slice(0, 6).map(item => {
        const safeKw = item.text.replace(/'/g, "\\'");
        const prefix = item.isHistory ? '🕒 ' : '✨ ';
        return `<a class="search-kw-link" onclick="quickSearchByKeyword('${safeKw}')" title="${item.isHistory ? 'Từ khóa bạn từng tìm kiếm' : 'Vật phẩm đề xuất cho bạn'}">${prefix}${item.text}</a>`;
    }).join('');

    const clearBtnHtml = historyKws.length > 0
        ? `<span class="search-kw-clear ms-1" onclick="clearSearchHistoryKeywords()" title="Xóa lịch sử tìm kiếm">[Xóa lịch sử]</span>`
        : '';

    bar.innerHTML = `<span class="text-secondary" style="font-size:0.68rem;">Tìm nhanh:</span> ${linksHtml} ${clearBtnHtml}`;
}

async function initSmartSearchBar() {
    const input = document.getElementById('globalSearchInput');
    if (!input) return;

    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) {
        input.value = urlQ;
        addSearchHistoryKeyword(urlQ);
    }

    let recProducts = [];
    let activeTrendCats = [];
    try {
        const user = getAuthUser();
        const uid = user && user.id ? user.id : '';
        const viewed = getViewedProductIds().join(',');
        const res = await fetch(`/api/home/products?user_id=${uid}&viewed_ids=${viewed}`);
        if (res.ok) {
            const data = await res.json();
            recProducts = data.recommended_products || data.products || [];
            activeTrendCats = (data.algorithm_metadata && data.algorithm_metadata.active_categories) || [];
            recProducts.slice(0, 4).forEach(p => {
                if (p.category) activeTrendCats.push(p.category);
            });
        }
    } catch {}

    renderDynamicCategoryBar(activeTrendCats);
    renderSearchHistoryLinks(recProducts);

    const historyList = getSearchHistoryKeywords();
    const dynamicPlaceholders = [];
    if (recProducts.length > 0) {
        recProducts.slice(0, 5).forEach(p => {
            dynamicPlaceholders.push(`✨ Đề xuất cho bạn: ${p.name.substring(0, 42)}...`);
        });
    }
    if (historyList.length > 0) {
        dynamicPlaceholders.push(`🕒 Tìm lại gần đây: ${historyList[0]}`);
    }
    if (!dynamicPlaceholders.length) {
        dynamicPlaceholders.push('✨ Gợi ý: Set Đồng Hồ Thông Minh AMOLED...');
        dynamicPlaceholders.push('🔎 Thử tìm: Máy Massage Cổ Vai Gáy...');
        dynamicPlaceholders.push('🔥 Đề xuất: Card Đồ Họa RTX 4070 Super...');
    }

    let idx = 0;
    input.placeholder = dynamicPlaceholders[0];
    if (placeholderRotationTimer) clearInterval(placeholderRotationTimer);
    placeholderRotationTimer = setInterval(() => {
        if (document.activeElement !== input) {
            idx = (idx + 1) % dynamicPlaceholders.length;
            input.placeholder = dynamicPlaceholders[idx];
        }
    }, 3800);
}

function quickSearchByKeyword(kw) {
    const clean = String(kw || '').trim();
    if (!clean) return;
    addSearchHistoryKeyword(clean);
    const input = document.getElementById('globalSearchInput');
    if (input) input.value = clean;
    window.location.href = `/services/home/index.html?q=${encodeURIComponent(clean)}`;
}

function showNividaXPopup(message, title = 'Thông Báo', icon = '✨', onClose = null) {
    if (!document.getElementById('nividaxGlobalPopup')) {
        renderGlobalHeaderAndFooter();
    }
    const modal = document.getElementById('nividaxGlobalPopup');
    if (!modal) return;
    document.getElementById('nividaxPopupTitle').textContent = title;
    document.getElementById('nividaxPopupBody').textContent = String(message || '');
    document.getElementById('nividaxPopupIcon').textContent = icon;
    popupCloseCallback = typeof onClose === 'function' ? onClose : null;
    modal.classList.remove('d-none');
}

function closeNividaXPopup() {
    const modal = document.getElementById('nividaxGlobalPopup');
    if (modal) modal.classList.add('d-none');
    if (popupCloseCallback) {
        const cb = popupCloseCallback;
        popupCloseCallback = null;
        cb();
    }
}

window.alert = function(msg) {
    const text = String(msg || '');
    let title = 'Thông Báo Nivida';
    let icon = '✨';
    if (text.toLowerCase().includes('lỗi') || text.toLowerCase().includes('thất bại') || text.toLowerCase().includes('không')) {
        title = 'Lưu Ý';
        icon = '⚠️';
    } else if (text.toLowerCase().includes('thành công') || text.toLowerCase().includes('chúc mừng') || text.toLowerCase().includes('đã')) {
        title = 'Hoàn Tất Thành Công';
        icon = '🎉';
    }
    showNividaXPopup(text, title, icon);
};

function notifyToast(msg, type = 'success') {
    if (!document.getElementById('nividaxToastContainer')) {
        renderGlobalHeaderAndFooter();
    }
    const box = document.getElementById('nividaxToastContainer');
    if (!box) {
        showNividaXPopup(msg);
        return;
    }
    const el = document.createElement('div');
    el.className = 'nividax-toast-item';
    if (type === 'error' || type === 'danger') el.style.borderLeftColor = 'rgb(220, 38, 38)';
    else if (type === 'warning') el.style.borderLeftColor = 'rgb(245, 158, 11)';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
        el.remove();
    }, 3200);
}

function submitGlobalSearch(e) {
    e.preventDefault();
    const q = document.getElementById('globalSearchInput')?.value.trim() || '';
    if (q) {
        addSearchHistoryKeyword(q);
    }
    window.location.href = `/services/home/index.html?q=${encodeURIComponent(q)}`;
}

async function setupHeaderState() {
    saveCart(getCart());
    await syncUserFavoritesFromSql();
    await refreshHeaderNotifications();
    try {
        const assetRes = await fetch('/api/home/site-assets');
        if (assetRes.ok) {
            const assetData = await assetRes.json();
            const logoImg = document.getElementById('headerBrandLogoImg');
            const fallbackBadge = document.getElementById('headerFallbackLogoBadge');
            if (logoImg && assetData.logo_url) {
                logoImg.onload = () => {
                    logoImg.style.display = 'inline-block';
                    if (fallbackBadge) fallbackBadge.classList.add('d-none');
                };
                logoImg.onerror = () => {
                    logoImg.style.display = 'none';
                    if (fallbackBadge) fallbackBadge.classList.remove('d-none');
                };
                logoImg.src = assetData.logo_url;
            }
        }
    } catch {}

    const user = getAuthUser();
    const authArea = document.getElementById('headerAuthArea');
    const xuBadge = document.getElementById('headerXuBalanceBadge');
    const xuText = document.getElementById('headerXuAmountText');
    const checkinBtn = document.getElementById('headerCompactCheckinBtn');
    const checkinLabel = document.getElementById('headerCheckinLabel');

    if (!user || !user.id) {
        if (xuBadge) xuBadge.classList.add('d-none');
        if (checkinBtn) checkinBtn.classList.add('d-none');
        if (authArea) {
            authArea.innerHTML = `
                <a href="/services/auth/auth.html" class="btn btn-outline-light btn-sm py-1 px-2" style="font-size:0.75rem;">Đăng nhập</a>
                <a href="/services/auth/auth.html?tab=register" class="btn btn-nvidia btn-sm py-1 px-2" style="font-size:0.75rem;">+100K Xu</a>
            `;
        }
        return;
    }

    if (xuBadge && xuText) {
        xuBadge.classList.remove('d-none');
        xuText.textContent = formatVND(user.wallet_balance || 0);
    }

    const adminBtnHtml = user.role === 'admin'
        ? `<a href="/services/admin_dispute/admin-center.html" class="btn btn-warning btn-sm py-1 px-2 fw-bold text-dark" style="font-size:0.75rem;">🛠 Quản Trị</a>`
        : '';

    if (authArea) {
        authArea.innerHTML = `
            ${adminBtnHtml}
            <a href="/services/settings/settings.html" class="btn btn-outline-light btn-sm py-1 px-2 fw-semibold" style="font-size:0.75rem;">
                👤 ${user.username || user.full_name}
            </a>
            <button type="button" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size:0.75rem;" onclick="logoutUser()" title="Đăng xuất">Thoát</button>
        `;
    }

    try {
        const res = await fetch(`/api/minigame/status?user_id=${user.id}`, {
            headers: { 'X-User-Id': String(user.id) }
        });
        if (res.ok) {
            const st = await res.json();
            user.wallet_balance = st.wallet_balance;
            setAuthUser(user);
            if (xuText) xuText.textContent = formatVND(st.wallet_balance);

            if (checkinBtn && checkinLabel) {
                checkinBtn.classList.remove('d-none');
                if (st.can_checkin) {
                    checkinBtn.className = 'btn-checkin-sparkle';
                    checkinLabel.textContent = '✨ Điểm danh';
                } else {
                    checkinBtn.className = 'btn-checkin-done';
                    checkinLabel.textContent = `🔥 ${st.streak_count || 1} ngày`;
                }
            }
        }
    } catch {}
}

async function triggerHeaderCheckin() {
    const user = getAuthUser();
    if (!user || !user.id) {
        window.location.href = '/services/auth/auth.html';
        return;
    }
    try {
        const res = await fetch('/api/minigame/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': String(user.id) },
            body: JSON.stringify({ user_id: user.id })
        });
        const data = await res.json();
        if (res.ok) {
            showNividaXPopup(data.message, '🎉 Điểm Danh Hàng Ngày Thành Công!', '🪙');
            await setupHeaderState();
        } else {
            showNividaXPopup(
                `${data.error}\nBạn có thể vào Nông Trại Cây Voucher hoặc Vòng Quay để săn thêm Xu!`,
                '🔥 Đã Điểm Danh Hôm Nay',
                '📅'
            );
        }
    } catch {
        notifyToast('Không thể kết nối máy chủ điểm danh', 'error');
    }
}

async function initGlobalStoreChat() {
    const sel = document.getElementById('globalChatSellerSelect');
    if (!sel) return;
    try {
        const res = await fetch('/api/seller/list-stores');
        if (res.ok) {
            const stores = await res.json();
            sel.innerHTML = stores.map(s => `<option value="${s.id}">🏪 ${s.company_name || s.full_name}</option>`).join('');
        }
    } catch {}
}

function toggleGlobalChatDrawer(forceState = null) {
    const drawer = document.getElementById('globalChatDrawer');
    if (!drawer) return;
    const willOpen = forceState !== null ? forceState : drawer.classList.contains('d-none');
    drawer.classList.toggle('d-none', !willOpen);
    if (willOpen) {
        const badge = document.getElementById('globalChatUnreadBadge');
        if (badge) badge.classList.add('d-none');
        loadGlobalSellerChatMessages();
    }
}

function openChatWithSeller(sellerId) {
    const sel = document.getElementById('globalChatSellerSelect');
    if (sel && sellerId) {
        sel.value = String(sellerId);
    }
    toggleGlobalChatDrawer(true);
}

async function loadGlobalSellerChatMessages() {
    const sel = document.getElementById('globalChatSellerSelect');
    const box = document.getElementById('globalChatMessagesBox');
    if (!sel || !box) return;
    const sellerId = sel.value || 1;
    const user = getAuthUser();
    const buyerId = user ? user.id : 1;
    const buyerName = user ? (user.full_name || user.username) : 'Khách vãng lai';

    try {
        const res = await fetch(`/api/admin-dispute/store-chat/history?buyer_id=${buyerId}&buyer_name=${encodeURIComponent(buyerName)}&seller_id=${sellerId}`);
        const data = await res.json();
        const msgs = data.messages || [];
        if (!msgs.length) {
            box.innerHTML = `<div class="text-center text-muted small py-4">Hãy gửi tin nhắn đầu tiên cho Gian hàng để được tư vấn sản phẩm &amp; chế độ bảo hành!</div>`;
            return;
        }
        box.innerHTML = msgs.map(m => `
            <div class="mb-2 p-2 rounded ${m.sender_role === 'buyer' ? 'bg-nvidia text-white ms-4' : 'border me-4'}">
                <div class="fw-bold" style="font-size:0.72rem;">${m.sender_name}</div>
                <div>${m.message}</div>
            </div>
        `).join('');
        box.scrollTop = box.scrollHeight;
    } catch {
        box.innerHTML = '<div class="text-muted small">Không thể tải hội thoại.</div>';
    }
}

async function submitGlobalChatMessage(e) {
    e.preventDefault();
    const input = document.getElementById('globalChatInput');
    const sel = document.getElementById('globalChatSellerSelect');
    if (!input || !sel) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    const user = getAuthUser();
    const buyerId = user ? user.id : 1;
    const buyerName = user ? (user.full_name || user.username) : 'Khách hàng';
    await fetch('/api/admin-dispute/store-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            buyer_id: buyerId,
            buyer_name: buyerName,
            seller_id: Number(sel.value || 1),
            message: msg
        })
    });
    await loadGlobalSellerChatMessages();
}

function ensureLiquidCatWidgetLoaded() {
    if (document.getElementById('nividaCatWidgetScript')) return;
    const s = document.createElement('script');
    s.id = 'nividaCatWidgetScript';
    s.src = '/core/cat_widget.js?v=23';
    document.body.appendChild(s);
}

document.addEventListener('DOMContentLoaded', async () => {
    applySavedTheme();
    renderGlobalHeaderAndFooter();
    ensureLiquidCatWidgetLoaded();
    await setupHeaderState();
    await initSmartSearchBar();
    await initGlobalStoreChat();
    const bar = document.getElementById('floatingCompareBar');
    if (bar) bar.classList.add('d-none');
});
