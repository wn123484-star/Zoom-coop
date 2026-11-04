const stickyContainer = document.getElementById('sticky-container');
const stickyColors = { y: '#ffeaa7', g: '#55efc4', p: '#fd79a8', b: '#74b9ff' };

window.bindSafeButton(document.getElementById('tool-sticky'), () => {
    const id = 'note_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const centerPos = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
    const offset = (stickyContainer.children.length % 6) * 26;
    const startX = Math.round(centerPos.x - 115 + offset);
    const startY = Math.round(centerPos.y - 75 + offset);
    createSticky(id, startX + 'px', startY + 'px', '', 'y', USERNAME, true);
    socket.emit('new_sticky', {
        room_id: ROOM_ID,
        id: id,
        x: startX + 'px',
        y: startY + 'px',
        text: '',
        color: 'y',
        owner: USERNAME
    });
});

function createSticky(id, x, y, text, colorCode, owner, autoFocus) {
    let existing = document.getElementById(id);
    if (existing) {
        existing.style.left = typeof x === 'number' ? x + 'px' : x;
        existing.style.top = typeof y === 'number' ? y + 'px' : y;
        existing.style.backgroundColor = stickyColors[colorCode] || stickyColors.y;
        const cEl = existing.querySelector('.sticky-content');
        if (cEl && document.activeElement !== cEl) cEl.innerText = text || '';
        return;
    }
    const el = document.createElement('div');
    el.className = 'sticky-note';
    el.id = id;
    el.style.left = typeof x === 'number' ? x + 'px' : x;
    el.style.top = typeof y === 'number' ? y + 'px' : y;
    el.style.backgroundColor = stickyColors[colorCode] || stickyColors.y;

    const header = document.createElement('div');
    header.className = 'sticky-header';

    const colorsDiv = document.createElement('div');
    colorsDiv.className = 'sticky-colors';
    ['y', 'g', 'p', 'b'].forEach(c => {
        const dot = document.createElement('div');
        dot.className = 'scolor ' + c;
        window.bindSafeButton(dot, () => {
            el.style.backgroundColor = stickyColors[c];
            socket.emit('color_sticky', { room_id: ROOM_ID, id: id, color: c });
        });
        colorsDiv.appendChild(dot);
    });

    const rightControls = document.createElement('div');
    rightControls.style.display = 'flex';
    rightControls.style.alignItems = 'center';

    const ownerSpan = document.createElement('span');
    ownerSpan.className = 'sticky-owner';
    ownerSpan.innerText = owner || 'Khách';
    rightControls.appendChild(ownerSpan);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'sticky-del';
    delBtn.innerText = '✕';
    delBtn.title = 'Xóa ghi chú';
    window.bindSafeButton(delBtn, () => {
        el.remove();
        socket.emit('delete_sticky', { room_id: ROOM_ID, id: id });
    });
    rightControls.appendChild(delBtn);

    header.appendChild(colorsDiv);
    header.appendChild(rightControls);

    const content = document.createElement('div');
    content.className = 'sticky-content';
    content.contentEditable = 'true';
    content.innerText = text || '';

    el.appendChild(header);
    el.appendChild(content);
    stickyContainer.appendChild(el);

    if (autoFocus) {
        setTimeout(() => content.focus(), 60);
    }

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.sticky-del') || e.target.closest('.scolor')) return;
        e.stopPropagation();
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLeft = parseFloat(el.style.left) || 0;
        initialTop = parseFloat(el.style.top) || 0;
        el.classList.add('dragging');
        el.style.zIndex = 100;
        if (header.setPointerCapture) {
            try { header.setPointerCapture(e.pointerId); } catch (err) {}
        }
    });

    header.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.stopPropagation();
        const scale = window.workspaceScale || 1;
        const newX = Math.round(initialLeft + (e.clientX - dragStartX) / scale);
        const newY = Math.round(initialTop + (e.clientY - dragStartY) / scale);
        el.style.left = newX + 'px';
        el.style.top = newY + 'px';
        socket.emit('move_sticky', { room_id: ROOM_ID, id: id, x: el.style.left, y: el.style.top });
    });

    const stopStickyDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        el.classList.remove('dragging');
        el.style.zIndex = '';
        if (e && header.releasePointerCapture) {
            try { header.releasePointerCapture(e.pointerId); } catch (err) {}
        }
    };

    header.addEventListener('pointerup', stopStickyDrag);
    header.addEventListener('pointercancel', stopStickyDrag);

    content.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
    });

    content.addEventListener('input', () => {
        socket.emit('edit_sticky', { room_id: ROOM_ID, id: id, text: content.innerText });
    });
}

window.loadStickiesHistory = function(stickiesList) {
    stickyContainer.innerHTML = '';
    if (Array.isArray(stickiesList)) {
        stickiesList.forEach(s => {
            createSticky(s.id, s.x, s.y, s.text, s.color, s.owner, false);
        });
    }
};

socket.on('sticky_added', (d) => { createSticky(d.id, d.x, d.y, d.text, d.color, d.owner, false); });
socket.on('sticky_moved', (d) => {
    const el = document.getElementById(d.id);
    if (el) { el.style.left = d.x; el.style.top = d.y; }
});
socket.on('sticky_edited', (d) => {
    const el = document.getElementById(d.id);
    if (el) {
        const c = el.querySelector('.sticky-content');
        if (c && document.activeElement !== c) c.innerText = d.text;
    }
});
socket.on('sticky_deleted', (d) => {
    const el = document.getElementById(d.id);
    if (el) el.remove();
});
socket.on('sticky_colored', (d) => {
    const el = document.getElementById(d.id);
    if (el) el.style.backgroundColor = stickyColors[d.color] || stickyColors.y;
});
