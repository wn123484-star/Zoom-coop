const gamesLayer = document.getElementById('games-layer');
const multiInstances = {};

const CHESS_PIECE_URLS = {
    wp: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png',
    wn: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png',
    wb: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png',
    wr: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png',
    wq: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png',
    wk: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png',
    bp: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png',
    bn: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png',
    bb: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png',
    br: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png',
    bq: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png',
    bk: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png'
};

const CUBE_FACE_PIPS = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
};

const CUBE_ROTATIONS = {
    1: { x: 0, y: 0 },
    6: { x: 0, y: 180 },
    2: { x: 0, y: 90 },
    5: { x: 0, y: -90 },
    3: { x: 90, y: 0 },
    4: { x: -90, y: 0 }
};

function create3DDiceDOM(initialVal, isSmall) {
    const scene = document.createElement('div');
    scene.className = 'cube-scene' + (isSmall ? ' small-cube' : '');
    const cube = document.createElement('div');
    cube.className = 'cube-3d';

    for (let f = 1; f <= 6; f++) {
        const face = document.createElement('div');
        face.className = 'cube-face f-' + f;
        const activePips = CUBE_FACE_PIPS[f];
        for (let cell = 1; cell <= 9; cell++) {
            const cellDiv = document.createElement('div');
            if (activePips.includes(cell)) {
                cellDiv.className = 'pip' + ((f === 1 || f === 4) ? ' red-pip' : '');
            }
            face.appendChild(cellDiv);
        }
        cube.appendChild(face);
    }
    scene.appendChild(cube);

    function setFace(val, animateSpin) {
        const v = (val >= 1 && val <= 6) ? val : 6;
        const target = CUBE_ROTATIONS[v];
        if (animateSpin) {
            const randSpinsX = (Math.floor(Math.random() * 2) + 2) * 360;
            const randSpinsY = (Math.floor(Math.random() * 2) + 2) * 360;
            cube.style.transition = 'none';
            cube.style.transform = `rotateX(${randSpinsX}deg) rotateY(${randSpinsY}deg) rotateZ(180deg)`;
            void cube.offsetWidth;
            cube.style.transition = 'transform 0.72s cubic-bezier(0.18, 0.89, 0.32, 1.18)';
            cube.style.transform = `rotateX(${target.x}deg) rotateY(${target.y}deg) rotateZ(0deg)`;
        } else {
            cube.style.transition = 'transform 0.25s ease';
            cube.style.transform = `rotateX(${target.x}deg) rotateY(${target.y}deg) rotateZ(0deg)`;
        }
    }

    setFace(initialVal || 6, false);
    return { el: scene, setFace: setFace };
}

const LUDO_TRACK = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
    [0, 7],
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
    [7, 14],
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
    [14, 7],
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
    [7, 0],
    [6, 0]
];

const LUDO_OFFSET = { R: 0, B: 13, Y: 26, G: 39 };
const LUDO_HOME_PATHS = {
    R: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
    B: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
    Y: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
    G: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]
};
const LUDO_STABLE_SLOTS = {
    R: [[1, 1], [1, 4], [4, 1], [4, 4]],
    B: [[1, 10], [1, 13], [4, 10], [4, 13]],
    Y: [[10, 10], [10, 13], [13, 10], [13, 13]],
    G: [[10, 1], [10, 4], [13, 1], [13, 4]]
};
const LUDO_COLORS = ['R', 'B', 'Y', 'G'];
const LUDO_LABELS = { R: '🔴 Đỏ', B: '🔵 Xanh', Y: '🟡 Vàng', G: '🟢 Lá' };

function makeInitialGameData(type, creatorName) {
    const user = creatorName || 'Thành viên';
    if (type === 'noitu') {
        return {
            players: [user],
            scores: { [user]: 0 },
            turn_idx: 0,
            current_word: '',
            prev_word: '',
            last_player: null,
            pending_verify: false,
            history: [],
            used_words: [],
            status_text: `Lượt của ${user}: Hãy nhập từ mở đầu (tối thiểu 2 tiếng)!`
        };
    }
    if (type === 'ludo') {
        return {
            seats: { R: user, B: '🤖 Bot', Y: null, G: null },
            locked_players: { [user]: 'R' },
            started: false,
            horses: { R: [-1, -1, -1, -1], B: [-1, -1, -1, -1], Y: [-1, -1, -1, -1], G: [-1, -1, -1, -1] },
            turn: 'R',
            dice: 6,
            phase: 'roll',
            status_text: `Lượt của 🔴 Đỏ (${user}): Hãy tung xúc xắc!`,
            winner: null
        };
    }
    if (type === 'chess') {
        return {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            turn: 'w',
            players: { w: null, b: null },
            last_move: null,
            history: [],
            status: 'playing',
            winner_text: '',
            notice: ''
        };
    }
    if (type === 'xo') {
        const b = [];
        for (let r = 0; r < 20; r++) {
            const row = [];
            for (let c = 0; c < 20; c++) row.push('');
            b.push(row);
        }
        return {
            board: b,
            turn: 'X',
            win_len: 5,
            players: { X: null, O: null },
            winner: null,
            winner_name: null,
            winning_line: [],
            status: 'playing',
            notice: ''
        };
    }
    if (type === 'memory') {
        const icons = ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍍', '🥝', '🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍍', '🥝'];
        for (let i = icons.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = icons[i];
            icons[i] = icons[j];
            icons[j] = tmp;
        }
        return {
            cards: icons,
            matched: [],
            flipped: [],
            scores: {},
            notice: 'Lật 2 thẻ giống nhau!'
        };
    }
    if (type === 'dice') {
        return {
            count: 2,
            values: [6, 6],
            total: 12,
            roller: user,
            history: []
        };
    }
    if (type === 'timer') {
        return {
            duration: 300,
            remaining: 300,
            running: false,
            updated_at: Date.now() / 1000,
            starter: user
        };
    }
    return {};
}

function getDefaultWidgetMeta(type, idx) {
    if (type === 'noitu') return { title: `🔤 Nối Từ Tiếng Việt #${idx}`, w: 460, h: 480, minW: 360, minH: 380 };
    if (type === 'ludo') return { title: `🐎 Cờ Cá Ngựa #${idx}`, w: 500, h: 640, minW: 450, minH: 560 };
    if (type === 'chess') return { title: `♟️ Cờ Vua Quốc Tế #${idx}`, w: 480, h: 580, minW: 440, minH: 520 };
    if (type === 'xo') return { title: `⭕ Cờ Caro XO #${idx}`, w: 500, h: 580, minW: 380, minH: 440 };
    if (type === 'memory') return { title: `🃏 Lật Thẻ Trí Nhớ #${idx}`, w: 380, h: 440, minW: 340, minH: 400 };
    if (type === 'dice') return { title: `🎲 Bàn Xúc Xắc 3D #${idx}`, w: 380, h: 360, minW: 320, minH: 320 };
    if (type === 'timer') return { title: `⏱️ Đồng Hồ Hẹn Giờ #${idx}`, w: 350, h: 310, minW: 310, minH: 280 };
    return { title: `🎮 Trò Chơi #${idx}`, w: 420, h: 450, minW: 300, minH: 300 };
}

window.createNewGameWidget = function(type) {
    if (window.closeAllPopovers) window.closeAllPopovers();
    const sameTypeCount = Object.values(multiInstances).filter(m => m.data.type === type).length + 1;
    const totalCount = Object.keys(multiInstances).length;
    const offset = (totalCount % 7) * 32;
    const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
    const meta = getDefaultWidgetMeta(type, sameTypeCount);
    const wid = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const widgetObj = {
        id: wid,
        type: type,
        title: meta.title,
        x: Math.round(center.x - meta.w / 2 + offset),
        y: Math.round(center.y - meta.h / 2 + offset),
        w: meta.w,
        h: meta.h,
        minimized: false,
        game_data: makeInitialGameData(type, window.USERNAME || 'Thành viên')
    };

    mountOrUpdateMultiWidget(widgetObj, null);
    socket.emit('multi_widget_event', {
        room_id: ROOM_ID,
        action: 'create',
        widget: widgetObj
    });
    if (window.showToast) window.showToast(`Đã tạo ${meta.title} trên mặt bảng!`);
};

document.querySelectorAll('.create-multi-game-btn').forEach(btn => {
    window.bindSafeButton(btn, () => {
        const gType = btn.getAttribute('data-game-type');
        if (gType) window.createNewGameWidget(gType);
    });
});

function emitWidgetUpdate(wid, extraAnim, echoSelf) {
    const inst = multiInstances[wid];
    if (!inst) return;
    const d = inst.data;
    socket.emit('multi_widget_event', {
        room_id: ROOM_ID,
        action: 'update',
        id: wid,
        x: d.x,
        y: d.y,
        w: d.w,
        h: d.h,
        minimized: d.minimized,
        title: d.title,
        game_data: d.game_data,
        anim: extraAnim || null,
        echo: !!echoSelf
    });
}

function checkXoWin(board, r, c, val, winLen) {
    const reqLen = winLen || 5;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let i = 0; i < dirs.length; i++) {
        const dr = dirs[i][0];
        const dc = dirs[i][1];
        const line = [[r, c]];
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 20 && nc >= 0 && nc < 20 && board[nr][nc] === val) {
            line.push([nr, nc]);
            nr += dr;
            nc += dc;
        }
        nr = r - dr;
        nc = c - dc;
        while (nr >= 0 && nr < 20 && nc >= 0 && nc < 20 && board[nr][nc] === val) {
            line.push([nr, nc]);
            nr -= dr;
            nc -= dc;
        }
        if (line.length >= reqLen) return line;
    }
    return null;
}

function buildNoiTuInstanceUI(inst, bodyEl) {
    const wid = inst.data.id;
    bodyEl.innerHTML = `
        <div class="noitu-players-bar">
            <div class="noitu-p-list"></div>
            <button type="button" class="widget-btn noitu-join-btn">➕ Vào chơi</button>
        </div>
        <div class="noitu-stage-box">
            <div class="noitu-current-word">Bắt đầu ván mới</div>
            <div class="noitu-next-hint">Hãy nhập một từ Tiếng Việt (2 tiếng trở lên)</div>
        </div>
        <div class="noitu-verify-bar" style="display:none;">
            <span class="noitu-verify-text">Kiểm định từ vừa gửi:</span>
            <button type="button" class="noitu-veto-btn">❌ Phủ quyết (Từ sai)</button>
        </div>
        <div class="noitu-history-box"></div>
        <form class="noitu-form-row">
            <input type="text" class="noitu-input" placeholder="Nhập từ nối tiếp..." autocomplete="off">
            <button type="submit">Gửi từ</button>
            <button type="button" class="widget-btn close noitu-pass-btn" title="Bỏ lượt và tạo từ mới">🏳️ Bí từ</button>
        </form>
    `;
    bodyEl.classList.add('noitu-body');
    const pListEl = bodyEl.querySelector('.noitu-p-list');
    const joinBtn = bodyEl.querySelector('.noitu-join-btn');
    const curWordEl = bodyEl.querySelector('.noitu-current-word');
    const hintEl = bodyEl.querySelector('.noitu-next-hint');
    const verifyBar = bodyEl.querySelector('.noitu-verify-bar');
    const verifyText = bodyEl.querySelector('.noitu-verify-text');
    const vetoBtn = bodyEl.querySelector('.noitu-veto-btn');
    const histBox = bodyEl.querySelector('.noitu-history-box');
    const formEl = bodyEl.querySelector('.noitu-form-row');
    const inputEl = bodyEl.querySelector('.noitu-input');
    const passBtn = bodyEl.querySelector('.noitu-pass-btn');

    inputEl.addEventListener('pointerdown', e => e.stopPropagation());
    inputEl.addEventListener('keydown', e => e.stopPropagation());

    function getSyllables(str) {
        return (str || '').trim().toLowerCase().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    }

    window.bindSafeButton(joinBtn, () => {
        const gd = inst.data.game_data;
        const me = window.USERNAME || 'Thành viên';
        if (!Array.isArray(gd.players)) gd.players = [];
        if (!gd.scores) gd.scores = {};
        const idx = gd.players.indexOf(me);
        if (idx === -1) {
            gd.players.push(me);
            if (gd.scores[me] === undefined) gd.scores[me] = 0;
            gd.status_text = `👋 ${me} đã vào bàn Nối Từ!`;
        } else {
            gd.players.splice(idx, 1);
            if (gd.turn_idx >= gd.players.length) {
                gd.turn_idx = 0;
            }
            gd.status_text = `🚪 ${me} đã rời bàn (Điểm được bảo lưu).`;
        }
        inst.render();
        emitWidgetUpdate(wid, null, false);
    });

    window.bindSafeButton(vetoBtn, () => {
        const gd = inst.data.game_data;
        const me = window.USERNAME || 'Thành viên';
        if (!gd.pending_verify || !gd.current_word) return;
        const activeUser = gd.players[gd.turn_idx];
        if (gd.players.length > 1 && me !== activeUser) {
            if (window.showToast) window.showToast(`⏳ Chỉ người chơi kế tiếp (${activeUser}) mới có quyền phủ quyết từ này!`);
            return;
        }
        const rejectedWord = gd.current_word;
        const prevAuthor = gd.last_player;
        if (Array.isArray(gd.used_words)) {
            gd.used_words = gd.used_words.filter(w => w !== rejectedWord);
        }
        if (Array.isArray(gd.history) && gd.history.length > 0) {
            gd.history[gd.history.length - 1].rejected = true;
        }
        gd.current_word = gd.prev_word || '';
        gd.pending_verify = false;
        const prevIdx = gd.players.indexOf(prevAuthor);
        if (prevIdx !== -1) {
            gd.turn_idx = prevIdx;
        }
        gd.status_text = `❌ ${me} đã phủ quyết từ "${rejectedWord}"! Lượt trả về cho ${prevAuthor} nhập lại.`;
        inst.render();
        emitWidgetUpdate(wid, null, false);
    });

    window.bindSafeButton(passBtn, () => {
        const gd = inst.data.game_data;
        const me = window.USERNAME || 'Thành viên';
        const activeUser = gd.players[gd.turn_idx];
        if (me !== activeUser) {
            if (window.showToast) window.showToast(`⏳ Chưa tới lượt của bạn!`);
            return;
        }
        if (gd.pending_verify && gd.last_player) {
            gd.scores[gd.last_player] = (gd.scores[gd.last_player] || 0) + 1;
        }
        gd.current_word = '';
        gd.prev_word = '';
        gd.pending_verify = false;
        gd.turn_idx = gd.players.length > 0 ? ((gd.turn_idx + 1) % gd.players.length) : 0;
        const nextP = gd.players[gd.turn_idx] || 'Thành viên';
        gd.status_text = `🏳️ ${me} chịu bí từ! ${nextP} được quyền mở đầu từ mới.`;
        inst.render();
        emitWidgetUpdate(wid, null, false);
    });

    formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const gd = inst.data.game_data;
        const me = window.USERNAME || 'Thành viên';
        if (!Array.isArray(gd.players) || !gd.players.includes(me)) {
            if (window.showToast) window.showToast('⚠️ Hãy bấm "➕ Vào chơi" ở góc trên bàn để tham gia nối từ!');
            return;
        }
        const activeUser = gd.players[gd.turn_idx];
        if (me !== activeUser) {
            if (window.showToast) window.showToast(`⏳ Đang là lượt của ${activeUser}, vui lòng chờ tới lượt!`);
            return;
        }
        const raw = inputEl.value.trim();
        const syllables = getSyllables(raw);
        if (syllables.length < 2) {
            if (window.showToast) window.showToast('⚠️ Từ Tiếng Việt hợp lệ phải gồm ít nhất 2 tiếng (VD: "học tập")!');
            return;
        }
        const normalizedWord = syllables.join(' ');
        if ((gd.used_words || []).includes(normalizedWord)) {
            if (window.showToast) window.showToast(`⚠️ Từ "${normalizedWord}" đã được sử dụng trong ván này rồi!`);
            return;
        }
        if (gd.current_word) {
            const prevSyllables = getSyllables(gd.current_word);
            const reqSyllable = prevSyllables[prevSyllables.length - 1];
            if (syllables[0] !== reqSyllable) {
                if (window.showToast) window.showToast(`⚠️ Từ mới phải bắt đầu bằng tiếng "${reqSyllable} ..."!`);
                return;
            }
        }

        if (gd.pending_verify && gd.last_player) {
            gd.scores[gd.last_player] = (gd.scores[gd.last_player] || 0) + 1;
        }

        gd.prev_word = gd.current_word || '';
        gd.current_word = normalizedWord;
        gd.last_player = me;
        gd.pending_verify = true;
        if (!Array.isArray(gd.used_words)) gd.used_words = [];
        gd.used_words.push(normalizedWord);
        if (!Array.isArray(gd.history)) gd.history = [];
        gd.history.push({ user: me, word: normalizedWord, rejected: false });
        gd.history = gd.history.slice(-40);

        gd.turn_idx = (gd.turn_idx + 1) % gd.players.length;
        const nextUser = gd.players[gd.turn_idx];
        const nextSyl = syllables[syllables.length - 1];
        gd.status_text = `✅ ${me} nối "${normalizedWord}". Lượt của ${nextUser}: nối tiếp "${nextSyl}..." hoặc Phủ quyết!`;

        inputEl.value = '';
        inst.render();
        emitWidgetUpdate(wid, null, false);
    });

    inst.resetGame = () => {
        const oldPlayers = (inst.data.game_data && inst.data.game_data.players) || [window.USERNAME || 'Thành viên'];
        const newGd = makeInitialGameData('noitu', window.USERNAME);
        newGd.players = oldPlayers.length > 0 ? oldPlayers : [window.USERNAME || 'Thành viên'];
        newGd.scores = {};
        newGd.players.forEach(p => { newGd.scores[p] = 0; });
        inst.data.game_data = newGd;
        inst.render();
        emitWidgetUpdate(wid, null, false);
    };

    inst.render = () => {
        const gd = inst.data.game_data;
        if (!gd) return;
        const me = window.USERNAME || 'Thành viên';
        const players = gd.players || [];
        if (gd.turn_idx >= players.length) gd.turn_idx = 0;
        const activeUser = players[gd.turn_idx] || '';

        pListEl.innerHTML = '';
        if (players.length === 0) {
            pListEl.innerHTML = '<span style="font-size:11px; color:#888;">Chưa có người chơi</span>';
        } else {
            players.forEach((p, idx) => {
                const b = document.createElement('span');
                b.className = 'noitu-p-badge' + (idx === gd.turn_idx ? ' active-turn' : '');
                const sc = (gd.scores && gd.scores[p]) || 0;
                b.innerText = `${idx + 1}. ${p} (${sc}đ)`;
                pListEl.appendChild(b);
            });
        }

        const inGame = players.includes(me);
        joinBtn.innerText = inGame ? '🚪 Rời ván' : '➕ Vào chơi';

        if (gd.current_word) {
            const syls = getSyllables(gd.current_word);
            const lastSyl = syls[syls.length - 1];
            curWordEl.innerText = gd.current_word.toUpperCase();
            hintEl.innerText = `Lượt của ${activeUser || '?'}: Nối tiếp từ bắt đầu bằng "${lastSyl} ..."`;
            if (gd.pending_verify) {
                verifyBar.style.display = 'flex';
                verifyText.innerText = `${gd.last_player} vừa gõ "${gd.current_word}". Hợp lệ không?`;
            } else {
                verifyBar.style.display = 'none';
            }
        } else {
            curWordEl.innerText = '🌟 MỞ ĐẦU TỪ MỚI';
            hintEl.innerText = gd.status_text || `Lượt của ${activeUser || '?'}: Hãy nhập từ ghép bất kỳ!`;
            verifyBar.style.display = 'none';
        }

        histBox.innerHTML = '';
        (gd.history || []).forEach(h => {
            const chip = document.createElement('span');
            chip.className = 'noitu-word-chip' + (h.rejected ? ' rejected' : '');
            chip.innerText = `${h.user}: ${h.word}`;
            histBox.appendChild(chip);
        });
        histBox.scrollTop = histBox.scrollHeight;

        const isMyTurn = (inGame && activeUser === me);
        inputEl.disabled = !isMyTurn;
        inputEl.placeholder = isMyTurn ? 'Nhập từ của bạn rồi nhấn Enter...' : `Đang chờ lượt của ${activeUser || 'người chơi'}...`;
    };

    inst.render();
}

function ludoGlobalTrackIndex(color, relStep) {
    if (relStep < 0 || relStep > 50) return -1;
    return (LUDO_OFFSET[color] + relStep) % 52;
}

function findOccupantOnTrack(gd, globalIdx) {
    for (let cIdx = 0; cIdx < LUDO_COLORS.length; cIdx++) {
        const col = LUDO_COLORS[cIdx];
        const arr = gd.horses[col] || [];
        for (let h = 0; h < 4; h++) {
            if (arr[h] >= 0 && arr[h] <= 50) {
                if (ludoGlobalTrackIndex(col, arr[h]) === globalIdx) {
                    return { color: col, horseIdx: h };
                }
            }
        }
    }
    return null;
}

function canMoveLudoHorse(gd, color, horseIdx, dice) {
    if (!dice || dice < 1 || dice > 6) return false;
    const pos = gd.horses[color][horseIdx];
    if (pos === -1) {
        if (dice !== 6 && dice !== 1) return false;
        const startGlobal = LUDO_OFFSET[color];
        const occ = findOccupantOnTrack(gd, startGlobal);
        if (occ && occ.color === color) return false;
        return true;
    }
    const nextPos = pos + dice;
    if (nextPos > 56) return false;

    for (let step = pos + 1; step < nextPos; step++) {
        if (step <= 50) {
            const gIdx = ludoGlobalTrackIndex(color, step);
            if (findOccupantOnTrack(gd, gIdx)) return false;
        } else {
            if (gd.horses[color].includes(step)) return false;
        }
    }

    if (nextPos <= 50) {
        const destGlobal = ludoGlobalTrackIndex(color, nextPos);
        const destOcc = findOccupantOnTrack(gd, destGlobal);
        if (destOcc && destOcc.color === color) return false;
        return true;
    } else {
        if (gd.horses[color].includes(nextPos)) return false;
        return true;
    }
}

function getNextActiveLudoTurn(gd, currentTurn) {
    const activeColors = LUDO_COLORS.filter(c => gd.seats && gd.seats[c]);
    if (activeColors.length === 0) return 'R';
    const curIdx = LUDO_COLORS.indexOf(currentTurn);
    for (let step = 1; step <= 4; step++) {
        const cand = LUDO_COLORS[(curIdx + step) % 4];
        if (gd.seats && gd.seats[cand]) return cand;
    }
    return activeColors[0];
}

function isDesignatedBotRunner(gd) {
    const me = window.USERNAME || 'Thành viên';
    for (let i = 0; i < LUDO_COLORS.length; i++) {
        const s = gd.seats[LUDO_COLORS[i]];
        if (s && s !== '🤖 Bot') {
            return s === me;
        }
    }
    return false;
}

function buildLudoInstanceUI(inst, bodyEl) {
    const wid = inst.data.id;
    bodyEl.innerHTML = `
        <div class="ludo-seats-bar"></div>
        <div class="ludo-board-wrap">
            <div class="ludo-board"></div>
        </div>
        <div class="ludo-controls-bar">
            <div class="ludo-3d-dice-mount"></div>
            <div class="ludo-info-text">Sẵn sàng</div>
            <button type="button" class="ludo-roll-btn">🎲 Tung Xúc Xắc</button>
        </div>
    `;
    const seatsBar = bodyEl.querySelector('.ludo-seats-bar');
    const boardEl = bodyEl.querySelector('.ludo-board');
    const diceMount = bodyEl.querySelector('.ludo-3d-dice-mount');
    const infoText = bodyEl.querySelector('.ludo-info-text');
    const rollBtn = bodyEl.querySelector('.ludo-roll-btn');

    const ludoCube = create3DDiceDOM(6, true);
    diceMount.appendChild(ludoCube.el);

    const cellsMap = {};
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            const cell = document.createElement('div');
            cell.className = 'ludo-cell';
            if (r < 6 && c < 6) cell.classList.add('stable-R');
            else if (r < 6 && c > 8) cell.classList.add('stable-B');
            else if (r > 8 && c > 8) cell.classList.add('stable-Y');
            else if (r > 8 && c < 6) cell.classList.add('stable-G');
            else if (r === 7 && c === 7) {
                cell.classList.add('center-goal');
                cell.innerText = '🏆';
            }
            cellsMap[`${r}_${c}`] = cell;
            boardEl.appendChild(cell);
        }
    }

    LUDO_TRACK.forEach((pt, idx) => {
        const cell = cellsMap[`${pt[0]}_${pt[1]}`];
        if (!cell) return;
        cell.classList.add('track-cell');
        if (idx === 0) { cell.classList.add('start-R'); cell.innerText = '★'; }
        else if (idx === 13) { cell.classList.add('start-B'); cell.innerText = '★'; }
        else if (idx === 26) { cell.classList.add('start-Y'); cell.innerText = '★'; }
        else if (idx === 39) { cell.classList.add('start-G'); cell.innerText = '★'; }
    });

    LUDO_COLORS.forEach(col => {
        LUDO_HOME_PATHS[col].forEach((pt, idx) => {
            const cell = cellsMap[`${pt[0]}_${pt[1]}`];
            if (cell) {
                cell.classList.add('home-' + col);
                cell.innerText = String(idx + 1);
            }
        });
        LUDO_STABLE_SLOTS[col].forEach(pt => {
            const cell = cellsMap[`${pt[0]}_${pt[1]}`];
            if (cell) cell.classList.add('stable-box');
        });
    });

    function executeLudoHorseMove(color, hIdx, isBotCall) {
        const gd = inst.data.game_data;
        const me = window.USERNAME || 'Thành viên';
        if (gd.winner || gd.turn !== color || gd.phase !== 'move') return;
        if (!isBotCall && gd.seats[color] !== me) {
            if (window.showToast) window.showToast(`⏳ Đây là quân của ${gd.seats[color]}, bạn không thể đi hộ!`);
            return;
        }
        const dice = gd.dice;
        if (!canMoveLudoHorse(gd, color, hIdx, dice)) return;

        const oldPos = gd.horses[color][hIdx];
        const newPos = oldPos === -1 ? 0 : oldPos + dice;
        let kickedMsg = '';

        if (newPos <= 50) {
            const destGlobal = ludoGlobalTrackIndex(color, newPos);
            const occ = findOccupantOnTrack(gd, destGlobal);
            if (occ && occ.color !== color) {
                gd.horses[occ.color][occ.horseIdx] = -1;
                kickedMsg = ` 💥 Đá ngựa ${LUDO_LABELS[occ.color]} về chuồng!`;
            }
        }

        gd.horses[color][hIdx] = newPos;

        const allHome = gd.horses[color].every(p => p >= 53);
        if (allHome) {
            gd.winner = color;
            gd.phase = 'done';
            gd.status_text = `🏆 CHIẾN THẮNG! Đội ${LUDO_LABELS[color]} (${gd.seats[color]}) đã đưa đủ 4 ngựa về đích!`;
            inst.render(false);
            emitWidgetUpdate(wid, null, false);
            return;
        }

        const bonusTurn = (dice === 6 || dice === 1 || kickedMsg !== '');
        if (bonusTurn) {
            gd.phase = 'roll';
            gd.status_text = `${LUDO_LABELS[color]} được thưởng thêm lượt!${kickedMsg} Hãy tung xúc xắc!`;
        } else {
            const nextCol = getNextActiveLudoTurn(gd, color);
            gd.turn = nextCol;
            gd.phase = 'roll';
            gd.status_text = `${kickedMsg} Lượt của ${LUDO_LABELS[nextCol]} (${gd.seats[nextCol] || 'Trống'}): Hãy tung xúc xắc!`;
        }

        inst.render(false);
        emitWidgetUpdate(wid, null, false);
        scheduleBotCheck();
    }

    function triggerLudoDiceRoll(isBotCall) {
        const gd = inst.data.game_data;
        const me = window.USERNAME || 'Thành viên';
        if (gd.winner || gd.phase !== 'roll') return;
        const activeCol = gd.turn;
        const seatOwner = gd.seats[activeCol];

        if (!isBotCall && seatOwner !== me) {
            if (window.showToast) window.showToast(`⏳ Đang là lượt của ${seatOwner || 'người khác'}, bạn không thể tung xúc xắc hộ!`);
            return;
        }

        gd.started = true;
        const val = Math.floor(Math.random() * 6) + 1;
        gd.dice = val;

        const movableIndices = [0, 1, 2, 3].filter(h => canMoveLudoHorse(gd, activeCol, h, val));
        if (movableIndices.length === 0) {
            const bonus = (val === 6 || val === 1);
            if (bonus) {
                gd.phase = 'roll';
                gd.status_text = `${LUDO_LABELS[activeCol]} tung được ${val} (Không có nước đi, được tung lại)!`;
            } else {
                const nextCol = getNextActiveLudoTurn(gd, activeCol);
                gd.turn = nextCol;
                gd.phase = 'roll';
                gd.status_text = `${LUDO_LABELS[activeCol]} tung được ${val} (Không đi được) → Chuyển lượt sang ${LUDO_LABELS[nextCol]}!`;
            }
            inst.render(true);
            emitWidgetUpdate(wid, 'roll', false);
            scheduleBotCheck();
            return;
        }

        if (movableIndices.length === 1) {
            gd.phase = 'move';
            inst.render(true);
            emitWidgetUpdate(wid, 'roll', false);
            setTimeout(() => {
                executeLudoHorseMove(activeCol, movableIndices[0], isBotCall);
            }, 780);
            return;
        }

        gd.phase = 'move';
        gd.status_text = `${LUDO_LABELS[activeCol]} tung được ${val}: Hãy bấm vào ngựa phát sáng để đi!`;
        inst.render(true);
        emitWidgetUpdate(wid, 'roll', false);
        scheduleBotCheck();
    }

    function scheduleBotCheck() {
        const gd = inst.data.game_data;
        if (!gd || gd.winner) return;
        const seatOwner = gd.seats[gd.turn];
        if (seatOwner !== '🤖 Bot') return;
        if (!isDesignatedBotRunner(gd)) return;
        if (inst.botTimer) clearTimeout(inst.botTimer);
        inst.botTimer = setTimeout(() => {
            if (gd.phase === 'roll') {
                triggerLudoDiceRoll(true);
            } else if (gd.phase === 'move') {
                const movables = [0, 1, 2, 3].filter(h => canMoveLudoHorse(gd, gd.turn, h, gd.dice));
                if (movables.length > 0) {
                    const pick = movables[movables.length - 1];
                    executeLudoHorseMove(gd.turn, pick, true);
                }
            }
        }, 850);
    }

    window.bindSafeButton(rollBtn, () => {
        triggerLudoDiceRoll(false);
    });

    inst.resetGame = () => {
        inst.data.game_data = makeInitialGameData('ludo', window.USERNAME || 'Thành viên');
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    };

    inst.render = (animateRoll) => {
        const gd = inst.data.game_data;
        if (!gd) return;
        const me = window.USERNAME || 'Thành viên';
        if (!gd.locked_players) gd.locked_players = {};

        LUDO_COLORS.forEach(c => {
            const occ = gd.seats[c];
            if (occ && occ !== '🤖 Bot') {
                gd.locked_players[occ] = c;
            }
        });

        const myLockedCol = gd.locked_players[me] || null;

        seatsBar.innerHTML = '';
        LUDO_COLORS.forEach(col => {
            const owner = gd.seats[col];
            const card = document.createElement('div');
            card.className = `ludo-seat-card seat-${col}` + (gd.turn === col && !gd.winner ? ' active-turn' : '');
            const head = document.createElement('div');
            head.className = 'ludo-seat-head';
            head.innerHTML = `<span>${LUDO_LABELS[col]}</span><span>${owner || 'Trống'}</span>`;

            const btns = document.createElement('div');
            btns.className = 'ludo-seat-btns';

            const joinBtn = document.createElement('button');
            joinBtn.type = 'button';
            joinBtn.className = 'ludo-seat-btn';

            if (owner === me) {
                joinBtn.innerText = 'Đã khóa chỗ';
                joinBtn.disabled = true;
            } else if (owner && owner !== '🤖 Bot') {
                joinBtn.innerText = 'Đã có người';
                joinBtn.disabled = true;
            } else if (myLockedCol && myLockedCol !== col) {
                joinBtn.innerText = 'Khóa đổi chỗ';
                joinBtn.disabled = true;
            } else {
                joinBtn.innerText = 'Ngồi vào đây';
                window.bindSafeButton(joinBtn, () => {
                    if (gd.locked_players[me] && gd.locked_players[me] !== col) {
                        if (window.showToast) window.showToast(`⚠️ Bạn đã ngồi ghế ${LUDO_LABELS[gd.locked_players[me]]} trong ván này, không được chuyển chỗ!`);
                        return;
                    }
                    gd.seats[col] = me;
                    gd.locked_players[me] = col;
                    inst.render(false);
                    emitWidgetUpdate(wid, null, false);
                });
            }

            const botBtn = document.createElement('button');
            botBtn.type = 'button';
            botBtn.className = 'ludo-seat-btn';
            botBtn.innerText = owner === '🤖 Bot' ? 'Tắt Bot' : '🤖 Bot';
            botBtn.disabled = (owner && owner !== '🤖 Bot');
            window.bindSafeButton(botBtn, () => {
                if (gd.seats[col] && gd.seats[col] !== '🤖 Bot') return;
                gd.seats[col] = (gd.seats[col] === '🤖 Bot') ? null : '🤖 Bot';
                if (!gd.seats[gd.turn]) gd.turn = getNextActiveLudoTurn(gd, gd.turn);
                inst.render(false);
                emitWidgetUpdate(wid, null, false);
                scheduleBotCheck();
            });

            btns.appendChild(joinBtn);
            btns.appendChild(botBtn);
            card.appendChild(head);
            card.appendChild(btns);
            seatsBar.appendChild(card);
        });

        boardEl.querySelectorAll('.ludo-horse').forEach(el => el.remove());

        LUDO_COLORS.forEach(col => {
            const arr = gd.horses[col] || [-1, -1, -1, -1];
            arr.forEach((pos, hIdx) => {
                let coord = null;
                if (pos === -1) {
                    coord = LUDO_STABLE_SLOTS[col][hIdx];
                } else if (pos >= 0 && pos <= 50) {
                    const gIdx = ludoGlobalTrackIndex(col, pos);
                    coord = LUDO_TRACK[gIdx];
                } else if (pos >= 51 && pos <= 56) {
                    coord = LUDO_HOME_PATHS[col][pos - 51];
                }
                if (!coord) return;
                const cell = cellsMap[`${coord[0]}_${coord[1]}`];
                if (!cell) return;
                const horseEl = document.createElement('div');
                horseEl.className = `ludo-horse color-${col}`;
                horseEl.innerText = '♞';
                const canClickMove = (!gd.winner && gd.turn === col && gd.phase === 'move' && gd.seats[col] === me && canMoveLudoHorse(gd, col, hIdx, gd.dice));
                if (canClickMove) {
                    horseEl.classList.add('movable');
                    window.bindSafeButton(horseEl, () => {
                        executeLudoHorseMove(col, hIdx, false);
                    });
                }
                cell.appendChild(horseEl);
            });
        });

        ludoCube.setFace(gd.dice || 6, !!animateRoll);

        infoText.innerText = gd.status_text || 'Hãy tung xúc xắc!';
        const isMyTurnToRoll = (!gd.winner && gd.phase === 'roll' && gd.seats[gd.turn] === me);
        rollBtn.disabled = !isMyTurnToRoll;
        rollBtn.innerText = isMyTurnToRoll ? '🎲 Tung Xúc Xắc' : `⏳ Lượt: ${gd.seats[gd.turn] || LUDO_LABELS[gd.turn]}`;
    };

    inst.render(false);
}

function buildChessInstanceUI(inst, bodyEl, headerControls) {
    const wid = inst.data.id;
    const flipBtn = document.createElement('button');
    flipBtn.type = 'button';
    flipBtn.className = 'widget-btn';
    flipBtn.innerText = '🔃 Đổi góc';
    headerControls.insertBefore(flipBtn, headerControls.firstChild);

    bodyEl.innerHTML = `
        <div class="xo-status">Trắng đi trước</div>
        <div class="chess-board-wrapper">
            <div class="chess-board"></div>
            <div class="chess-promo-modal" style="display:none;">
                <div class="promo-title">Chọn quân Phong Cấp:</div>
                <div class="chess-promo-choices"></div>
            </div>
        </div>
        <div class="chess-history-bar">Chưa có nước đi</div>
    `;
    const statusEl = bodyEl.querySelector('.xo-status');
    const boardEl = bodyEl.querySelector('.chess-board');
    const promoModal = bodyEl.querySelector('.chess-promo-modal');
    const promoChoices = bodyEl.querySelector('.chess-promo-choices');
    const historyEl = bodyEl.querySelector('.chess-history-bar');

    const engine = typeof Chess !== 'undefined' ? new Chess() : null;
    let flipped = false;
    let selectedSq = null;
    let legalMoves = [];

    window.bindSafeButton(flipBtn, () => {
        flipped = !flipped;
        inst.render(false);
    });

    function doChessMove(fromSq, toSq, promo) {
        if (!engine) return;
        const gd = inst.data.game_data;
        const curTurn = engine.turn();
        const mv = engine.move({ from: fromSq, to: toSq, promotion: promo || 'q' });
        if (!mv) return;
        selectedSq = null;
        legalMoves = [];
        if (!gd.players[curTurn]) {
            gd.players[curTurn] = window.USERNAME || 'Thành viên';
        }
        gd.fen = engine.fen();
        gd.turn = engine.turn();
        gd.last_move = { from: fromSq, to: toSq };
        gd.history = (gd.history || []).concat([mv.san]).slice(-60);

        if (engine.in_checkmate()) {
            gd.status = 'finished';
            gd.winner_text = `🏆 ${window.USERNAME} (${curTurn === 'w' ? 'Trắng' : 'Đen'}) Chiếu Hết!`;
        } else if (engine.in_draw() || engine.in_stalemate()) {
            gd.status = 'draw';
            gd.winner_text = '🤝 Ván cờ Hòa!';
        } else {
            gd.status = 'playing';
            gd.notice = engine.in_check() ? '⚠️ Chiếu tướng (Check)!' : '';
        }
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    }

    function showPromo(fromSq, toSq, color) {
        promoChoices.innerHTML = '';
        ['q', 'r', 'b', 'n'].forEach(pType => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'promo-btn';
            const img = document.createElement('img');
            img.src = CHESS_PIECE_URLS[color + pType];
            btn.appendChild(img);
            window.bindSafeButton(btn, () => {
                promoModal.style.display = 'none';
                doChessMove(fromSq, toSq, pType);
            });
            promoChoices.appendChild(btn);
        });
        promoModal.style.display = 'flex';
    }

    function onSqClick(sqName) {
        if (!engine || engine.game_over()) return;
        const targetMv = legalMoves.find(m => m.to === sqName);
        if (selectedSq && targetMv) {
            if (targetMv.flags.includes('p') || targetMv.promotion) {
                showPromo(selectedSq, sqName, engine.turn());
            } else {
                doChessMove(selectedSq, sqName, 'q');
            }
            return;
        }
        const p = engine.get(sqName);
        if (p && p.color === engine.turn()) {
            selectedSq = sqName;
            legalMoves = engine.moves({ square: sqName, verbose: true });
        } else {
            selectedSq = null;
            legalMoves = [];
        }
        drawGrid();
    }

    function drawGrid() {
        if (!engine) return;
        const gd = inst.data.game_data;
        boardEl.innerHTML = '';
        const bState = engine.board();
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const turn = engine.turn();
        const inCheck = engine.in_check();
        const targetMap = {};
        legalMoves.forEach(m => { targetMap[m.to] = m; });

        for (let dr = 0; dr < 8; dr++) {
            for (let dc = 0; dc < 8; dc++) {
                const r = flipped ? 7 - dr : dr;
                const c = flipped ? 7 - dc : dc;
                const sqName = files[c] + (8 - r);
                const sqEl = document.createElement('div');
                sqEl.className = 'chess-sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
                if (selectedSq === sqName) sqEl.classList.add('selected');
                if (gd.last_move && (gd.last_move.from === sqName || gd.last_move.to === sqName)) {
                    sqEl.classList.add('last-move');
                }
                const piece = bState[r][c];
                if (piece && piece.type === 'k' && piece.color === turn && inCheck) {
                    sqEl.classList.add('in-check');
                }
                if (dc === 0) {
                    const rk = document.createElement('span');
                    rk.className = 'chess-coord rank';
                    rk.innerText = 8 - r;
                    sqEl.appendChild(rk);
                }
                if (dr === 7) {
                    const fl = document.createElement('span');
                    fl.className = 'chess-coord file';
                    fl.innerText = files[c];
                    sqEl.appendChild(fl);
                }
                if (piece) {
                    const img = document.createElement('img');
                    img.className = 'chess-piece-img';
                    img.src = CHESS_PIECE_URLS[piece.color + piece.type];
                    sqEl.appendChild(img);
                }
                if (targetMap[sqName]) {
                    if (piece || targetMap[sqName].flags.includes('e')) {
                        const ring = document.createElement('div');
                        ring.className = 'chess-capture-ring';
                        sqEl.appendChild(ring);
                    } else {
                        const dot = document.createElement('div');
                        dot.className = 'chess-move-dot';
                        sqEl.appendChild(dot);
                    }
                }
                window.bindSafeButton(sqEl, () => onSqClick(sqName));
                boardEl.appendChild(sqEl);
            }
        }
    }

    inst.resetGame = () => {
        inst.data.game_data = makeInitialGameData('chess', window.USERNAME);
        selectedSq = null;
        legalMoves = [];
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    };

    inst.render = () => {
        const gd = inst.data.game_data;
        if (!gd || !engine) return;
        if (gd.fen && engine.fen() !== gd.fen) {
            engine.load(gd.fen);
            selectedSq = null;
            legalMoves = [];
        }
        drawGrid();
        const pW = (gd.players && gd.players.w) || 'Chờ...';
        const pB = (gd.players && gd.players.b) || 'Chờ...';
        let stHtml = `⚪ Trắng: <b>${pW}</b> vs ⚫ Đen: <b>${pB}</b>`;
        if (gd.status === 'finished') {
            stHtml += `<br><b style="color:#feca57">${gd.winner_text}</b>`;
        } else if (gd.status === 'draw') {
            stHtml += `<br><b style="color:#aaa">${gd.winner_text}</b>`;
        } else {
            stHtml += ` | Lượt: <b>${engine.turn() === 'w' ? '⚪ Trắng' : '⚫ Đen'}</b>`;
            if (gd.notice) stHtml += ` <b style="color:#ff4757">${gd.notice}</b>`;
        }
        statusEl.innerHTML = stHtml;
        historyEl.innerText = (gd.history && gd.history.length > 0) ? ('Biên bản: ' + gd.history.join('  ')) : 'Chưa có nước đi (Đủ luật Nhập thành, Bắt tốt qua đường, Phong cấp)';
    };

    inst.render(false);
}

function buildXoInstanceUI(inst, bodyEl) {
    const wid = inst.data.id;
    bodyEl.innerHTML = `
        <div class="xo-mode-bar">
            <span>Luật thắng:</span>
            <button type="button" class="xo-len-btn" data-len="4">⚡ Chạm 4 thắng</button>
            <button type="button" class="xo-len-btn active" data-len="5">🏆 Chạm 5 thắng</button>
        </div>
        <div class="xo-status">Sẵn sàng</div>
        <div class="xo-board-wrapper">
            <div class="xo-board"></div>
        </div>
    `;
    const statusEl = bodyEl.querySelector('.xo-status');
    const boardEl = bodyEl.querySelector('.xo-board');
    const lenBtns = bodyEl.querySelectorAll('.xo-len-btn');

    lenBtns.forEach(btn => {
        window.bindSafeButton(btn, () => {
            const gd = inst.data.game_data;
            gd.win_len = parseInt(btn.getAttribute('data-len'), 10) || 5;
            inst.render(false);
            emitWidgetUpdate(wid, null, false);
        });
    });

    for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
            const cell = document.createElement('div');
            cell.className = 'xo-cell';
            window.bindSafeButton(cell, () => {
                const gd = inst.data.game_data;
                if (gd.status !== 'playing' || gd.board[r][c] !== '') return;
                const turn = gd.turn;
                if (!gd.players[turn]) gd.players[turn] = window.USERNAME || 'Thành viên';
                gd.board[r][c] = turn;
                const winLine = checkXoWin(gd.board, r, c, turn, gd.win_len || 5);
                if (winLine) {
                    gd.status = 'finished';
                    gd.winner = turn;
                    gd.winner_name = window.USERNAME || 'Thành viên';
                    gd.winning_line = winLine;
                } else {
                    gd.turn = turn === 'X' ? 'O' : 'X';
                }
                inst.render(false);
                emitWidgetUpdate(wid, null, false);
            });
            boardEl.appendChild(cell);
        }
    }

    inst.resetGame = () => {
        const curLen = (inst.data.game_data && inst.data.game_data.win_len) || 5;
        inst.data.game_data = makeInitialGameData('xo', window.USERNAME);
        inst.data.game_data.win_len = curLen;
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    };

    inst.render = () => {
        const gd = inst.data.game_data;
        if (!gd || !gd.board) return;
        const wLen = gd.win_len || 5;
        lenBtns.forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-len'), 10) === wLen));

        const cells = boardEl.getElementsByClassName('xo-cell');
        const winSet = new Set();
        if (Array.isArray(gd.winning_line)) {
            gd.winning_line.forEach(pt => winSet.add(`${pt[0]}_${pt[1]}`));
        }
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const cell = cells[r * 20 + c];
                if (!cell) continue;
                const val = gd.board[r][c];
                cell.className = 'xo-cell' + (val === 'X' ? ' x' : val === 'O' ? ' o' : '') + (winSet.has(`${r}_${c}`) ? ' win' : '');
                cell.innerText = val;
            }
        }
        const pX = (gd.players && gd.players.X) || 'Chờ...';
        const pO = (gd.players && gd.players.O) || 'Chờ...';
        let html = `<span style="color:#00d2ff">X: ${pX}</span> vs <span style="color:#ff4757">O: ${pO}</span> (Chạm ${wLen})`;
        if (gd.status === 'finished') {
            html += ` | <b style="color:#feca57">🏆 ${gd.winner_name} (${gd.winner}) THẮNG!</b>`;
        } else {
            html += ` | Lượt: <b>${gd.turn}</b>`;
        }
        statusEl.innerHTML = html;
    };

    inst.render(false);
}

function buildMemoryInstanceUI(inst, bodyEl) {
    const wid = inst.data.id;
    bodyEl.innerHTML = `
        <div class="xo-status">Lật 2 thẻ giống nhau!</div>
        <div class="memory-grid-wrap">
            <div class="memory-grid"></div>
        </div>
    `;
    const statusEl = bodyEl.querySelector('.xo-status');
    const gridEl = bodyEl.querySelector('.memory-grid');

    inst.resetGame = () => {
        inst.data.game_data = makeInitialGameData('memory', window.USERNAME);
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    };

    inst.render = () => {
        const gd = inst.data.game_data;
        if (!gd || !gd.cards) return;
        gridEl.innerHTML = '';
        const matched = new Set(gd.matched || []);
        const flipped = new Set(gd.flipped || []);

        gd.cards.forEach((icon, idx) => {
            const card = document.createElement('div');
            const isM = matched.has(idx);
            const isF = flipped.has(idx);
            card.className = 'memory-card' + (isM ? ' matched' : isF ? ' revealed' : '');
            card.innerText = (isM || isF) ? icon : '❓';
            window.bindSafeButton(card, () => {
                if (isM || isF || gd.flipped.length >= 2) return;
                gd.flipped.push(idx);
                if (gd.flipped.length === 2) {
                    const i1 = gd.flipped[0];
                    const i2 = gd.flipped[1];
                    const user = window.USERNAME || 'Thành viên';
                    if (gd.cards[i1] === gd.cards[i2]) {
                        gd.matched.push(i1, i2);
                        gd.flipped = [];
                        gd.scores[user] = (gd.scores[user] || 0) + 1;
                        gd.notice = `🎯 ${user} ghép đúng ${gd.cards[i1]}!`;
                        inst.render(false);
                        emitWidgetUpdate(wid, null, false);
                    } else {
                        inst.render(false);
                        emitWidgetUpdate(wid, null, false);
                        setTimeout(() => {
                            gd.flipped = [];
                            inst.render(false);
                            emitWidgetUpdate(wid, null, false);
                        }, 800);
                    }
                } else {
                    inst.render(false);
                    emitWidgetUpdate(wid, null, false);
                }
            });
            gridEl.appendChild(card);
        });

        const scoreParts = Object.entries(gd.scores || {}).map(([u, s]) => `${u}: <b>${s}</b>`);
        statusEl.innerHTML = scoreParts.length > 0 ? scoreParts.join(' | ') : (gd.notice || 'Lật 2 thẻ giống nhau!');
    };

    inst.render(false);
}

function buildDiceInstanceUI(inst, bodyEl) {
    const wid = inst.data.id;
    bodyEl.innerHTML = `
        <div class="dice-count-bar">
            <span>Số lượng:</span>
            <button type="button" class="dice-cnt-btn" data-count="1">1 Viên</button>
            <button type="button" class="dice-cnt-btn active" data-count="2">2 Viên</button>
            <button type="button" class="dice-cnt-btn" data-count="3">3 Viên</button>
        </div>
        <div class="dice-stage"></div>
        <div class="dice-result-text">Nhấn nút để lắc xúc xắc 3D!</div>
        <button type="button" class="dice-roll-main-btn">🎲 LẮC XÚC XẮC 3D</button>
        <div class="dice-history-list">Chưa có lượt tung</div>
    `;
    bodyEl.classList.add('dice-body');
    const stage = bodyEl.querySelector('.dice-stage');
    const resText = bodyEl.querySelector('.dice-result-text');
    const rollBtn = bodyEl.querySelector('.dice-roll-main-btn');
    const histEl = bodyEl.querySelector('.dice-history-list');
    const cntBtns = bodyEl.querySelectorAll('.dice-cnt-btn');
    let cubeObjs = [];

    cntBtns.forEach(btn => {
        window.bindSafeButton(btn, () => {
            const gd = inst.data.game_data;
            gd.count = parseInt(btn.getAttribute('data-count'), 10) || 2;
            gd.values = Array(gd.count).fill(6);
            gd.total = gd.count * 6;
            cubeObjs = [];
            inst.render(false);
            emitWidgetUpdate(wid, null, false);
        });
    });

    window.bindSafeButton(rollBtn, () => {
        const gd = inst.data.game_data;
        const cnt = gd.count || 2;
        const vals = [];
        for (let i = 0; i < cnt; i++) vals.push(Math.floor(Math.random() * 6) + 1);
        gd.values = vals;
        gd.total = vals.reduce((a, b) => a + b, 0);
        gd.roller = window.USERNAME || 'Thành viên';
        gd.history = (gd.history || []).concat([`${gd.roller}: ${vals.join('+')} = ${gd.total}`]).slice(-8);
        inst.render(true);
        emitWidgetUpdate(wid, 'roll', false);
    });

    inst.resetGame = () => {
        inst.data.game_data = makeInitialGameData('dice', window.USERNAME);
        cubeObjs = [];
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    };

    inst.render = (animate) => {
        const gd = inst.data.game_data;
        if (!gd) return;
        const vals = gd.values || [6, 6];
        cntBtns.forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-count'), 10) === vals.length));

        if (cubeObjs.length !== vals.length) {
            stage.innerHTML = '';
            cubeObjs = vals.map(v => {
                const c = create3DDiceDOM(v, false);
                stage.appendChild(c.el);
                return c;
            });
        }

        cubeObjs.forEach((cObj, idx) => {
            cObj.setFace(vals[idx] || 6, !!animate);
        });

        resText.innerHTML = `🎉 <b>${gd.roller || 'Hệ thống'}</b>: <b>${vals.join(' + ')} = ${gd.total} nút</b>`;
        if (gd.history && gd.history.length > 0) {
            histEl.innerText = 'Lịch sử: ' + gd.history.slice().reverse().join(' | ');
        }
    };

    inst.render(false);
}

function buildTimerInstanceUI(inst, bodyEl) {
    const wid = inst.data.id;
    bodyEl.innerHTML = `
        <div class="timer-presets-row">
            <button type="button" class="timer-preset-btn" data-sec="60">1p</button>
            <button type="button" class="timer-preset-btn" data-sec="180">3p</button>
            <button type="button" class="timer-preset-btn active" data-sec="300">5p</button>
            <button type="button" class="timer-preset-btn" data-sec="600">10p</button>
            <button type="button" class="timer-preset-btn" data-sec="1500">25p</button>
        </div>
        <div class="timer-big-clock">05:00</div>
        <div class="timer-progress-wrap">
            <div class="timer-progress-bar" style="width:100%;"></div>
        </div>
        <div class="timer-status-sub">Sẵn sàng</div>
        <div class="timer-action-row">
            <button type="button" class="timer-act-btn start">▶️ Bắt đầu</button>
            <button type="button" class="timer-act-btn pause">⏸️ Tạm dừng</button>
            <button type="button" class="timer-act-btn reset">🔄 Đặt lại</button>
        </div>
    `;
    bodyEl.classList.add('timer-body');
    const clockEl = bodyEl.querySelector('.timer-big-clock');
    const progBar = bodyEl.querySelector('.timer-progress-bar');
    const subEl = bodyEl.querySelector('.timer-status-sub');
    const preBtns = bodyEl.querySelectorAll('.timer-preset-btn');
    const startBtn = bodyEl.querySelector('.timer-act-btn.start');
    const pauseBtn = bodyEl.querySelector('.timer-act-btn.pause');
    const resetBtn = bodyEl.querySelector('.timer-act-btn.reset');

    function fmt(sec) {
        const s = Math.max(0, Math.floor(sec));
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function computeCurrentRemaining(gd) {
        if (!gd.running) return Math.max(0, parseInt(gd.remaining, 10) || 0);
        const elapsed = Math.max(0, Math.floor(Date.now() / 1000 - parseFloat(gd.updated_at || Date.now() / 1000)));
        return Math.max(0, (parseInt(gd.remaining, 10) || 0) - elapsed);
    }

    preBtns.forEach(btn => {
        window.bindSafeButton(btn, () => {
            const gd = inst.data.game_data;
            const sec = parseInt(btn.getAttribute('data-sec'), 10) || 300;
            gd.duration = sec;
            gd.remaining = sec;
            gd.running = false;
            gd.updated_at = Date.now() / 1000;
            inst.render(false);
            emitWidgetUpdate(wid, null, false);
        });
    });

    window.bindSafeButton(startBtn, () => {
        const gd = inst.data.game_data;
        if (gd.running) return;
        if ((gd.remaining || 0) <= 0) gd.remaining = gd.duration || 300;
        gd.running = true;
        gd.updated_at = Date.now() / 1000;
        gd.starter = window.USERNAME || 'Thành viên';
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    });

    window.bindSafeButton(pauseBtn, () => {
        const gd = inst.data.game_data;
        if (!gd.running) return;
        gd.remaining = computeCurrentRemaining(gd);
        gd.running = false;
        gd.updated_at = Date.now() / 1000;
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    });

    window.bindSafeButton(resetBtn, () => {
        const gd = inst.data.game_data;
        gd.remaining = gd.duration || 300;
        gd.running = false;
        gd.updated_at = Date.now() / 1000;
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    });

    inst.resetGame = () => {
        inst.data.game_data = makeInitialGameData('timer', window.USERNAME);
        inst.render(false);
        emitWidgetUpdate(wid, null, false);
    };

    inst.render = () => {
        const gd = inst.data.game_data;
        if (!gd) return;
        if (inst.timerInterval) {
            clearInterval(inst.timerInterval);
            inst.timerInterval = null;
        }
        const dur = gd.duration || 300;
        preBtns.forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-sec'), 10) === dur));

        const updateTick = () => {
            const rem = computeCurrentRemaining(gd);
            clockEl.innerText = fmt(rem);
            clockEl.classList.toggle('urgent', rem > 0 && rem <= 15);
            const pct = dur > 0 ? Math.max(0, Math.min(100, (rem / dur) * 100)) : 0;
            progBar.style.width = pct + '%';
            if (gd.running && rem <= 0) {
                gd.running = false;
                gd.remaining = 0;
                if (inst.timerInterval) {
                    clearInterval(inst.timerInterval);
                    inst.timerInterval = null;
                }
                subEl.innerText = '⏰ ĐÃ HẾT GIỜ!';
                if (window.showToast) window.showToast(`⏰ ${inst.data.title} đã hết giờ!`);
            }
        };

        updateTick();
        if (gd.running) {
            subEl.innerText = `⏱️ Đang chạy (Bật bởi ${gd.starter || 'Thành viên'})`;
            inst.timerInterval = setInterval(updateTick, 1000);
        } else {
            subEl.innerText = computeCurrentRemaining(gd) <= 0 ? '⏰ Đã hết giờ!' : '⏸️ Đang tạm dừng / Sẵn sàng';
        }
    };

    inst.render(false);
}

function mountOrUpdateMultiWidget(wObj, animType) {
    if (!wObj || !wObj.id || !gamesLayer) return;
    const wid = wObj.id;
    let inst = multiInstances[wid];

    if (!inst) {
        const meta = getDefaultWidgetMeta(wObj.type, 1);
        const container = document.createElement('div');
        container.className = 'board-widget glass-effect';
        container.id = wid;
        container.style.left = (wObj.x || 2350) + 'px';
        container.style.top = (wObj.y || 2200) + 'px';
        container.style.width = (wObj.w || meta.w) + 'px';
        container.style.height = (wObj.h || meta.h) + 'px';

        const header = document.createElement('div');
        header.className = 'widget-header';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'widget-title';
        titleSpan.innerText = wObj.title || meta.title;

        const controls = document.createElement('div');
        controls.className = 'widget-controls';

        const cloneBtn = document.createElement('button');
        cloneBtn.type = 'button';
        cloneBtn.className = 'widget-btn';
        cloneBtn.title = 'Tạo thêm 1 bàn cùng loại bên cạnh';
        cloneBtn.innerText = '➕ Nhân bản';

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'widget-btn';
        resetBtn.title = 'Làm mới bàn chơi này';
        resetBtn.innerText = '🔄 Ván mới';

        const minBtn = document.createElement('button');
        minBtn.type = 'button';
        minBtn.className = 'widget-btn';
        minBtn.title = 'Thu gọn / Mở rộng';
        minBtn.innerText = '—';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'widget-btn close';
        closeBtn.title = 'Xóa bàn chơi này khỏi bảng';
        closeBtn.innerText = '✕';

        controls.appendChild(cloneBtn);
        controls.appendChild(resetBtn);
        controls.appendChild(minBtn);
        controls.appendChild(closeBtn);

        header.appendChild(titleSpan);
        header.appendChild(controls);

        const body = document.createElement('div');
        body.className = 'widget-body';

        container.appendChild(header);
        container.appendChild(body);
        gamesLayer.appendChild(container);

        inst = {
            el: container,
            titleEl: titleSpan,
            data: wObj,
            render: () => {},
            resetGame: () => {}
        };
        multiInstances[wid] = inst;

        if (wObj.type === 'noitu') buildNoiTuInstanceUI(inst, body);
        else if (wObj.type === 'ludo') buildLudoInstanceUI(inst, body);
        else if (wObj.type === 'chess') buildChessInstanceUI(inst, body, controls);
        else if (wObj.type === 'xo') buildXoInstanceUI(inst, body);
        else if (wObj.type === 'memory') buildMemoryInstanceUI(inst, body);
        else if (wObj.type === 'dice') buildDiceInstanceUI(inst, body);
        else if (wObj.type === 'timer') buildTimerInstanceUI(inst, body);

        window.bindSafeButton(cloneBtn, () => {
            window.createNewGameWidget(wObj.type);
        });

        window.bindSafeButton(resetBtn, () => {
            if (inst.resetGame) inst.resetGame();
        });

        window.bindSafeButton(minBtn, () => {
            container.classList.toggle('minimized');
            inst.data.minimized = container.classList.contains('minimized');
            emitWidgetUpdate(wid, null, false);
        });

        window.bindSafeButton(closeBtn, () => {
            if (inst.timerInterval) clearInterval(inst.timerInterval);
            if (inst.botTimer) clearTimeout(inst.botTimer);
            container.remove();
            delete multiInstances[wid];
            socket.emit('multi_widget_event', {
                room_id: ROOM_ID,
                action: 'delete',
                id: wid
            });
        });

        window.makeWidgetResizable(container, meta.minW, meta.minH, true, (nw, nh) => {
            inst.data.w = nw;
            inst.data.h = nh;
            emitWidgetUpdate(wid, null, false);
        });

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let initL = 0;
        let initT = 0;

        header.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            e.stopPropagation();
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initL = parseFloat(container.style.left) || 2350;
            initT = parseFloat(container.style.top) || 2200;
            container.style.zIndex = 38;
            if (header.setPointerCapture) {
                try { header.setPointerCapture(e.pointerId); } catch (err) {}
            }
        });

        header.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            e.stopPropagation();
            const scale = window.workspaceScale || 1;
            const nx = Math.round(initL + (e.clientX - startX) / scale);
            const ny = Math.round(initT + (e.clientY - startY) / scale);
            container.style.left = nx + 'px';
            container.style.top = ny + 'px';
            inst.data.x = nx;
            inst.data.y = ny;
            emitWidgetUpdate(wid, null, false);
        });

        const stopDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            container.style.zIndex = 16;
            if (e && header.releasePointerCapture) {
                try { header.releasePointerCapture(e.pointerId); } catch (err) {}
            }
            emitWidgetUpdate(wid, null, false);
        };

        header.addEventListener('pointerup', stopDrag);
        header.addEventListener('pointercancel', stopDrag);
        container.addEventListener('pointerdown', e => e.stopPropagation());
    }

    inst.data = wObj;
    if (typeof wObj.x === 'number') inst.el.style.left = wObj.x + 'px';
    if (typeof wObj.y === 'number') inst.el.style.top = wObj.y + 'px';
    if (typeof wObj.w === 'number') inst.el.style.width = wObj.w + 'px';
    if (typeof wObj.h === 'number') inst.el.style.height = wObj.h + 'px';
    if (wObj.title) inst.titleEl.innerText = wObj.title;
    inst.el.classList.toggle('minimized', !!wObj.minimized);
    inst.render(animType === 'roll');
}

window.loadMultiWidgets = function(list) {
    Object.values(multiInstances).forEach(inst => {
        if (inst.timerInterval) clearInterval(inst.timerInterval);
        if (inst.botTimer) clearTimeout(inst.botTimer);
        if (inst.el) inst.el.remove();
    });
    Object.keys(multiInstances).forEach(k => delete multiInstances[k]);
    if (Array.isArray(list)) {
        list.forEach(wObj => mountOrUpdateMultiWidget(wObj, null));
    }
};

socket.on('multi_widget_synced', (data) => {
    if (!data || !data.action) return;
    if (data.action === 'create' || data.action === 'update') {
        if (data.widget) {
            mountOrUpdateMultiWidget(data.widget, data.anim || null);
        }
    } else if (data.action === 'delete' && data.id) {
        const inst = multiInstances[data.id];
        if (inst) {
            if (inst.timerInterval) clearInterval(inst.timerInterval);
            if (inst.botTimer) clearTimeout(inst.botTimer);
            if (inst.el) inst.el.remove();
            delete multiInstances[data.id];
        }
    }
});
