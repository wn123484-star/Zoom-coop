function renderWebsiteViewerInto(targetEl, rawUrl, name, useProxyDefault, isHub, cardId) {
    const fullUrl = normalizeWebUrl(rawUrl);
    const isGoogleMapsEmbed = fullUrl.includes('maps.google.com/maps') && fullUrl.includes('output=embed');
    let useProxy = isGoogleMapsEmbed ? false : !!useProxyDefault;
    const getFrameSrc = () => useProxy ? (`/web-proxy?url=${encodeURIComponent(fullUrl)}`) : fullUrl;

    targetEl.innerHTML = `
        <div class="doc-viewer-wrapper">
            <div class="doc-toolbar-bar" style="flex-wrap:wrap; gap:6px;">
                <input type="text" class="web-url-nav-input" value="${fullUrl.replace(/"/g, '&quot;')}" style="flex:1; min-width:140px; padding:4px 8px; border-radius:6px; border:1px solid #444; background:#0f111a; color:#00d2ff; font-size:11px;">
                <button type="button" class="widget-btn btn-web-go" title="Đi tới địa chỉ này">Đi tới</button>
                <button type="button" class="widget-btn btn-web-mode" title="Đổi giữa Nhúng trực tiếp và Cổng Proxy vượt chặn">${useProxy ? '🛡️ Proxy' : '⚡ Trực tiếp'}</button>
                <button type="button" class="widget-btn btn-web-stream" style="background:#feca57; color:#000;" title="Mở web ở tab mới và chiếu trực tiếp màn hình đã đăng nhập của bạn">📡 Chiếu Tab</button>
                <a href="${rawUrl}" target="_blank" style="font-size:11px;">↗ Tab mới</a>
            </div>
            <iframe class="html-preview-frame" src="${getFrameSrc()}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-read; clipboard-write"></iframe>
        </div>
    `;

    const navInput = targetEl.querySelector('.web-url-nav-input');
    const goBtn = targetEl.querySelector('.btn-web-go');
    const modeBtn = targetEl.querySelector('.btn-web-mode');
    const streamBtn = targetEl.querySelector('.btn-web-stream');
    const iframe = targetEl.querySelector('.html-preview-frame');

    const navigateAndSync = (nextUrl, nextProxy) => {
        const cleanUrl = normalizeWebUrl(nextUrl);
        if (!cleanUrl) return;
        const autoDirect = cleanUrl.includes('maps.google.com/maps') && cleanUrl.includes('output=embed');
        const effectiveProxy = autoDirect ? false : nextProxy;
        let hostLabel = cleanUrl;
        try {
            hostLabel = new URL(cleanUrl).hostname;
        } catch (e) {}
        if (isHub) {
            socket.emit('media_share', {
                room_id: ROOM_ID,
                type: 'website',
                kind: 'website',
                url: cleanUrl,
                use_proxy: effectiveProxy,
                name: 'Web: ' + hostLabel,
                sender: window.USERNAME,
                x: parseFloat(mediaContainer.style.left) || 1920,
                y: parseFloat(mediaContainer.style.top) || 2220
            });
        } else {
            iframe.src = effectiveProxy ? (`/web-proxy?url=${encodeURIComponent(cleanUrl)}`) : cleanUrl;
        }
    };

    if (goBtn && navInput) {
        window.bindSafeButton(goBtn, () => {
            navigateAndSync(navInput.value, useProxy);
        });
        navInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                navigateAndSync(navInput.value, useProxy);
            }
        });
        navInput.addEventListener('pointerdown', e => e.stopPropagation());
    }

    if (modeBtn) {
        window.bindSafeButton(modeBtn, () => {
            useProxy = !useProxy;
            modeBtn.innerText = useProxy ? '🛡️ Proxy' : '⚡ Trực tiếp';
            navigateAndSync(navInput ? navInput.value : fullUrl, useProxy);
        });
    }

    if (streamBtn) {
        window.bindSafeButton(streamBtn, () => {
            const target = navInput ? normalizeWebUrl(navInput.value) : fullUrl;
            window.open(target, '_blank');
            startScreenShareWithMode('browser', 'Tab Web: ' + target.slice(0, 28));
        });
    }
}
