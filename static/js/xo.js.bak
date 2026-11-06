const xoContainer = document.getElementById('xo-container');
const xoBoard = document.getElementById('xo-board');
const xoStatus = document.getElementById('xo-status');
const xoResetBtn = document.getElementById('xo-reset-btn');
const xoMinBtn = document.getElementById('xo-min-btn');
const xoCloseBtn = document.getElementById('xo-close-btn');
const xoHeader = document.getElementById('xo-header');

const chessContainer = document.getElementById('chess-container');
const chessBoardEl = document.getElementById('chess-board');
const chessStatusEl = document.getElementById('chess-status');
const chessHistoryEl = document.getElementById('chess-history');
const chessFlipBtn = document.getElementById('chess-flip-btn');
const chessResetBtn = document.getElementById('chess-reset-btn');
const chessMinBtn = document.getElementById('chess-min-btn');
const chessCloseBtn = document.getElementById('chess-close-btn');
const chessHeader = document.getElementById('chess-header');
const chessPromoModal = document.getElementById('chess-promo-modal');
const chessPromoChoices = document.getElementById('chess-promo-choices');

const memoryContainer = document.getElementById('memory-container');
const memoryGrid = document.getElementById('memory-grid');
const memoryStatus = document.getElementById('memory-status');
const memoryResetBtn = document.getElementById('memory-reset-btn');
const memoryMinBtn = document.getElementById('memory-min-btn');
const memoryCloseBtn = document.getElementById('memory-close-btn');
const memoryHeader = document.getElementById('memory-header');

const diceContainer = document.getElementById('dice-container');
const diceHeader = document.getElementById('dice-header');
const diceMinBtn = document.getElementById('dice-min-btn');
const diceCloseBtn = document.getElementById('dice-close-btn');
const diceStage = document.getElementById('dice-stage');
const diceResultText = document.getElementById('dice-result-text');
const diceHistoryList = document.getElementById('dice-history-list');
const btnRollDiceAction = document.getElementById('btn-roll-dice-action');
let selectedDiceCount = 2;
let diceAnimInterval = null;

const timerContainer = document.getElementById('timer-container');
const timerHeader = document.getElementById('timer-header');
const timerMinBtn = document.getElementById('timer-min-btn');
const timerCloseBtn = document.getElementById('timer-close-btn');
const timerBigClock = document.getElementById('timer-big-clock');
const timerProgressBar = document.getElementById('timer-progress-bar');
const timerStatusSub = document.getElementById('timer-status-sub');
const btnTimerStart = document.getElementById('btn-timer-start');
const btnTimerPause = document.getElementById('btn-timer-pause');
const btnTimerReset = document.getElementById('btn-timer-reset');
let boardTimerInterval = null;
let boardTimerDuration = 300;
let boardTimerRemaining = 300;

function setupBoardWidgetDragAndResize(wName, container, header, minW, minH) {
    if (!container || !header) return;
    const syncState = () => {
        socket.emit('widget_state', {
            room_id: ROOM_ID,
            widget: wName,
            x: parseFloat(container.style.left) || 2400,
            y: parseFloat(container.style.top) || 2200,
            w: parseFloat(container.style.width) || container.offsetWidth || minW,
            h: parseFloat(container.style.height) || container.offsetHeight || minH,
            open: container.style.display !== 'none',
            minimized: container.classList.contains('minimized')
        });
    };

    window.makeWidgetResizable(container, minW, minH, true, () => {
        syncState();
    });

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initL = 0;
    let initT = 0;

    header.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initL = parseFloat(container.style.left) || 2400;
        initT = parseFloat(container.style.top) || 2200;
        container.style.zIndex = 35;
        if (header.setPointerCapture) {
            try { header.setPointerCapture(e.pointerId); } catch (err) {}
        }
    });

    header.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.stopPropagation();
        const scale = window.workspaceScale || 1;
        container.style.left = Math.round(initL + (e.clientX - startX) / scale) + 'px';
        container.style.top = Math.round(initT + (e.clientY - startY) / scale) + 'px';
        syncState();
    });

    const stopDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        container.style.zIndex = 15;
        if (e && header.releasePointerCapture) {
            try { header.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        syncState();
    };

    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);
    container.addEventListener('pointerdown', e => e.stopPropagation());
    return syncState;
}

const syncXoState = setupBoardWidgetDragAndResize('xo', xoContainer, xoHeader, 360, 420);
const syncChessState = setupBoardWidgetDragAndResize('chess', chessContainer, chessHeader, 440, 520);
const syncMemoryState = setupBoardWidgetDragAndResize('memory', memoryContainer, memoryHeader, 340, 400);
const syncDiceState = setupBoardWidgetDragAndResize('dice', diceContainer, diceHeader, 310, 310);
const syncTimerState = setupBoardWidgetDragAndResize('timer', timerContainer, timerHeader, 310, 280);

function toggleGameWidget(wName, container, syncFn, defaultW, defaultH) {
    if (!container) return;
    if (container.style.display === 'none' || !container.style.display) {
        const center = window.getWorkspaceCoords(window.innerWidth / 2, window.innerHeight / 2);
        container.style.left = Math.round(center.x - defaultW / 2) + 'px';
        container.style.top = Math.round(center.y - defaultH / 2) + 'px';
        container.style.display = 'flex';
        container.classList.remove('minimized');
    } else {
        container.style.display = 'none';
    }
    if (syncFn) syncFn();
    if (window.closeAllPopovers) window.closeAllPopovers();
}

window.bindSafeButton(document.getElementById('btn-game-xo'), () => {
    toggleGameWidget('xo', xoContainer, syncXoState, 500, 560);
});

window.bindSafeButton(document.getElementById('btn-game-chess'), () => {
    toggleGameWidget('chess', chessContainer, syncChessState, 480, 580);
});

window.bindSafeButton(document.getElementById('btn-game-memory'), () => {
    toggleGameWidget('memory', memoryContainer, syncMemoryState, 380, 440);
});

window.bindSafeButton(document.getElementById('btn-game-dice'), () => {
    toggleGameWidget('dice', diceContainer, syncDiceState, 360, 350);
});

window.bindSafeButton(document.getElementById('btn-game-timer'), () => {
    toggleGameWidget('timer', timerContainer, syncTimerState, 350, 310);
});

window.bindSafeButton(xoMinBtn, () => {
    xoContainer.classList.toggle('minimized');
    if (syncXoState) syncXoState();
});
window.bindSafeButton(xoCloseBtn, () => {
    xoContainer.style.display = 'none';
    if (syncXoState) syncXoState();
});
window.bindSafeButton(xoResetBtn, () => {
    socket.emit('xo_manual_reset', { room_id: ROOM_ID });
});

function initXoGrid() {
    xoBoard.innerHTML = '';
    for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
            const cell = document.createElement('div');
            cell.className = 'xo-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            window.bindSafeButton(cell, () => {
                socket.emit('xo_click', { room_id: ROOM_ID, row: r, col: c, username: window.USERNAME });
            });
            xoBoard.appendChild(cell);
        }
    }
}
initXoGrid();

function renderXoGame(game, notice) {
    if (!game || !game.board) return;
    const cells = xoBoard.getElementsByClassName('xo-cell');
    const winningSet = new Set();
    if (game.winning_line && game.winning_line.length > 0) {
        game.winning_line.forEach(pt => winningSet.add(pt[0] + '_' + pt[1]));
    }
    for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
            const idx = r * 20 + c;
            const cell = cells[idx];
            if (!cell) continue;
            const val = game.board[r][c];
            cell.className = 'xo-cell';
            if (val === 'X') cell.classList.add('x');
            if (val === 'O') cell.classList.add('o');
            if (winningSet.has(r + '_' + c)) cell.classList.add('win');
            cell.innerText = val;
        }
    }
    const pX = (game.players && game.players.X) ? game.players.X : 'Chờ...';
    const pO = (game.players && game.players.O) ? game.players.O : 'Chờ...';
    let statusHTML = `<span style="color:#00d2ff">X: ${pX}</span> vs <span style="color:#ff4757">O: ${pO}</span>`;
    if (game.status === 'playing') {
        const turnColor = game.turn === 'X' ? '#00d2ff' : '#ff4757';
        statusHTML += ` | Lượt: <b style="color:${turnColor}">${game.turn}</b>`;
    } else if (game.status === 'finished') {
        statusHTML += ` | <b style="color:#feca57">🏆 ${game.winner_name} THẮNG!</b>`;
    } else if (game.status === 'draw') {
        statusHTML += ` | <b style="color:#aaa">HÒA!</b>`;
    }
    if (notice) {
        statusHTML += `<br><small style="color:#feca57; font-size:11px;">${notice}</small>`;
    }
    xoStatus.innerHTML = statusHTML;
}

window.loadXoState = function(game) {
    renderXoGame(game, null);
};

socket.on('xo_update', (data) => {
    if (data && data.game) renderXoGame(data.game, data.notice);
});

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

let chessEngine = typeof Chess !== 'undefined' ? new Chess() : null;
let chessFlipped = false;
let selectedSquare = null;
let legalMovesFromSelected = [];
let lastChessMove = null;
let chessPlayers = { w: null, b: null };

window.bindSafeButton(chessMinBtn, () => {
    chessContainer.classList.toggle('minimized');
    if (syncChessState) syncChessState();
});
window.bindSafeButton(chessCloseBtn, () => {
    chessContainer.style.display = 'none';
    if (syncChessState) syncChessState();
});
window.bindSafeButton(chessFlipBtn, () => {
    chessFlipped = !chessFlipped;
    renderChessBoard();
});
window.bindSafeButton(chessResetBtn, () => {
    socket.emit('chess_reset', { room_id: ROOM_ID });
});

function executeChessMove(fromSq, toSq, promotionPiece) {
    if (!chessEngine) return;
    const currentTurn = chessEngine.turn();
    const moveObj = chessEngine.move({
        from: fromSq,
        to: toSq,
        promotion: promotionPiece || 'q'
    });
    if (!moveObj) return;
    selectedSquare = null;
    legalMovesFromSelected = [];
    lastChessMove = { from: fromSq, to: toSq };

    let status = 'playing';
    let winnerText = '';
    let notice = '';
    if (chessEngine.in_checkmate()) {
        status = 'finished';
        winnerText = `${window.USERNAME} (${currentTurn === 'w' ? 'Trắng' : 'Đen'}) Chiếu Hết!`;
        notice = `🏆 Chiếu hết! ${window.USERNAME} chiến thắng!`;
    } else if (chessEngine.in_stalemate()) {
        status = 'draw';
        winnerText = 'Hòa cờ (Hết nước đi hợp lệ - Stalemate)';
    } else if (chessEngine.in_threefold_repetition()) {
        status = 'draw';
        winnerText = 'Hòa cờ (Lặp lại nước đi 3 lần)';
    } else if (chessEngine.insufficient_material()) {
        status = 'draw';
        winnerText = 'Hòa cờ (Không đủ quân chiếu hết)';
    } else if (chessEngine.in_draw()) {
        status = 'draw';
        winnerText = 'Hòa cờ (Luật 50 nước)';
    } else if (chessEngine.in_check()) {
        notice = '⚠️ Chiếu tướng (Check)!';
    }

    renderChessBoard();
    socket.emit('chess_move', {
        room_id: ROOM_ID,
        username: window.USERNAME,
        color: currentTurn,
        fen: chessEngine.fen(),
        turn: chessEngine.turn(),
        last_move: lastChessMove,
        san: moveObj.san,
        status: status,
        winner_text: winnerText,
        notice: notice
    });
}

function openPromotionModal(fromSq, toSq, color) {
    if (!chessPromoModal || !chessPromoChoices) {
        executeChessMove(fromSq, toSq, 'q');
        return;
    }
    chessPromoChoices.innerHTML = '';
    ['q', 'r', 'b', 'n'].forEach(pType => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'promo-btn';
        const img = document.createElement('img');
        img.src = CHESS_PIECE_URLS[color + pType];
        btn.appendChild(img);
        window.bindSafeButton(btn, () => {
            chessPromoModal.style.display = 'none';
            executeChessMove(fromSq, toSq, pType);
        });
        chessPromoChoices.appendChild(btn);
    });
    chessPromoModal.style.display = 'flex';
}

function onChessSquareClick(sqName) {
    if (!chessEngine || chessEngine.game_over()) return;
    const existingTarget = legalMovesFromSelected.find(m => m.to === sqName);
    if (selectedSquare && existingTarget) {
        const isPromotion = existingTarget.flags.includes('p') || existingTarget.promotion;
        if (isPromotion) {
            openPromotionModal(selectedSquare, sqName, chessEngine.turn());
        } else {
            executeChessMove(selectedSquare, sqName, 'q');
        }
        return;
    }
    const piece = chessEngine.get(sqName);
    if (piece && piece.color === chessEngine.turn()) {
        selectedSquare = sqName;
        legalMovesFromSelected = chessEngine.moves({ square: sqName, verbose: true });
    } else {
        selectedSquare = null;
        legalMovesFromSelected = [];
    }
    renderChessBoard();
}

function renderChessBoard() {
    if (!chessBoardEl || !chessEngine) return;
    chessBoardEl.innerHTML = '';
    const boardState = chessEngine.board();
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const turn = chessEngine.turn();
    const inCheck = chessEngine.in_check();
    const targetMap = {};
    legalMovesFromSelected.forEach(m => {
        targetMap[m.to] = m;
    });

    for (let displayR = 0; displayR < 8; displayR++) {
        for (let displayC = 0; displayC < 8; displayC++) {
            const r = chessFlipped ? 7 - displayR : displayR;
            const c = chessFlipped ? 7 - displayC : displayC;
            const sqName = files[c] + (8 - r);
            const isLight = (r + c) % 2 === 0;
            const sqEl = document.createElement('div');
            sqEl.className = 'chess-sq ' + (isLight ? 'light' : 'dark');

            if (selectedSquare === sqName) sqEl.classList.add('selected');
            if (lastChessMove && (lastChessMove.from === sqName || lastChessMove.to === sqName)) {
                sqEl.classList.add('last-move');
            }

            const piece = boardState[r][c];
            if (piece && piece.type === 'k' && piece.color === turn && inCheck) {
                sqEl.classList.add('in-check');
            }

            if (displayC === 0) {
                const rankSpan = document.createElement('span');
                rankSpan.className = 'chess-coord rank';
                rankSpan.innerText = 8 - r;
                sqEl.appendChild(rankSpan);
            }
            if (displayR === 7) {
                const fileSpan = document.createElement('span');
                fileSpan.className = 'chess-coord file';
                fileSpan.innerText = files[c];
                sqEl.appendChild(fileSpan);
            }

            if (piece) {
                const img = document.createElement('img');
                img.className = 'chess-piece-img';
                img.src = CHESS_PIECE_URLS[piece.color + piece.type];
                img.alt = piece.color + piece.type;
                sqEl.appendChild(img);
            }

            if (targetMap[sqName]) {
                const mv = targetMap[sqName];
                if (piece || mv.flags.includes('e')) {
                    const ring = document.createElement('div');
                    ring.className = 'chess-capture-ring';
                    sqEl.appendChild(ring);
                } else {
                    const dot = document.createElement('div');
                    dot.className = 'chess-move-dot';
                    sqEl.appendChild(dot);
                }
            }

            window.bindSafeButton(sqEl, () => onChessSquareClick(sqName));
            chessBoardEl.appendChild(sqEl);
        }
    }
}

function updateChessUI(gameData, notice) {
    if (!gameData || !chessEngine) return;
    if (gameData.fen) {
        chessEngine.load(gameData.fen);
    }
    selectedSquare = null;
    legalMovesFromSelected = [];
    lastChessMove = gameData.last_move || null;
    chessPlayers = gameData.players || { w: null, b: null };
    renderChessBoard();

    const pW = chessPlayers.w || 'Chờ...';
    const pB = chessPlayers.b || 'Chờ...';
    let statusHTML = `⚪ Trắng: <b>${pW}</b> vs ⚫ Đen: <b>${pB}</b>`;
    if (gameData.status === 'finished' || chessEngine.in_checkmate()) {
        statusHTML += `<br><b style="color:#feca57">🏆 ${gameData.winner_text || 'Chiếu hết!'}</b>`;
    } else if (gameData.status === 'draw' || chessEngine.in_draw()) {
        statusHTML += `<br><b style="color:#aaa">🤝 ${gameData.winner_text || 'Ván cờ Hòa!'}</b>`;
    } else {
        const tLabel = chessEngine.turn() === 'w' ? '⚪ Trắng' : '⚫ Đen';
        statusHTML += ` | Lượt: <b style="color:#00d2ff">${tLabel}</b>`;
        if (chessEngine.in_check()) {
            statusHTML += ` <b style="color:#ff4757">(ĐANG CHIẾU!)</b>`;
        }
    }
    if (notice) {
        statusHTML += `<br><small style="color:#55efc4">${notice}</small>`;
    }
    if (chessStatusEl) chessStatusEl.innerHTML = statusHTML;
    if (chessHistoryEl) {
        const hist = gameData.history || [];
        chessHistoryEl.innerText = hist.length > 0 ? 'Biên bản: ' + hist.join('  ') : 'Chưa có nước đi (Đủ luật Nhập thành, Bắt tốt qua đường, Phong cấp)';
        chessHistoryEl.scrollLeft = chessHistoryEl.scrollWidth;
    }
}

if (chessEngine) {
    renderChessBoard();
}

window.loadChessState = function(gameData) {
    updateChessUI(gameData, '');
};

socket.on('chess_update', (data) => {
    if (data && data.game) {
        updateChessUI(data.game, data.notice || '');
    }
});

window.bindSafeButton(memoryMinBtn, () => {
    memoryContainer.classList.toggle('minimized');
    if (syncMemoryState) syncMemoryState();
});
window.bindSafeButton(memoryCloseBtn, () => {
    memoryContainer.style.display = 'none';
    if (syncMemoryState) syncMemoryState();
});
window.bindSafeButton(memoryResetBtn, () => {
    socket.emit('memory_reset', { room_id: ROOM_ID });
});

function renderMemoryGame(game, notice) {
    if (!game || !memoryGrid) return;
    memoryGrid.innerHTML = '';
    const cards = game.cards || [];
    const matched = new Set(game.matched || []);
    const flipped = new Set(game.flipped || []);

    cards.forEach((icon, idx) => {
        const card = document.createElement('div');
        const isMatched = matched.has(idx);
        const isFlipped = flipped.has(idx);
        card.className = 'memory-card' + (isMatched ? ' matched' : isFlipped ? ' revealed' : '');
        card.innerText = (isMatched || isFlipped) ? icon : '❓';
        window.bindSafeButton(card, () => {
            if (!isMatched && !isFlipped) {
                socket.emit('memory_flip', { room_id: ROOM_ID, index: idx, username: window.USERNAME });
            }
        });
        memoryGrid.appendChild(card);
    });

    const scores = game.scores || {};
    const scoreParts = Object.entries(scores).map(([u, s]) => `${u}: <b>${s}</b>`);
    let statusHTML = scoreParts.length > 0 ? scoreParts.join(' | ') : 'Lật 2 thẻ giống nhau để ghi điểm!';
    if (matched.size === cards.length && cards.length > 0) {
        statusHTML += '<br><b style="color:#feca57">🎉 Đã mở hết toàn bộ thẻ!</b>';
    } else if (notice) {
        statusHTML += `<br><small style="color:#00d2ff">${notice}</small>`;
    }
    if (memoryStatus) memoryStatus.innerHTML = statusHTML;
}

window.loadMemoryState = function(game) {
    renderMemoryGame(game, '');
};

socket.on('memory_update', (data) => {
    if (data && data.game) {
        renderMemoryGame(data.game, data.notice || '');
    }
});

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

window.bindSafeButton(diceMinBtn, () => {
    diceContainer.classList.toggle('minimized');
    if (syncDiceState) syncDiceState();
});
window.bindSafeButton(diceCloseBtn, () => {
    diceContainer.style.display = 'none';
    if (syncDiceState) syncDiceState();
});

document.querySelectorAll('.dice-cnt-btn').forEach(btn => {
    window.bindSafeButton(btn, () => {
        document.querySelectorAll('.dice-cnt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDiceCount = parseInt(btn.getAttribute('data-count'), 10) || 2;
    });
});

if (btnRollDiceAction) {
    window.bindSafeButton(btnRollDiceAction, () => {
        socket.emit('dice_roll', {
            room_id: ROOM_ID,
            count: selectedDiceCount,
            username: window.USERNAME || 'Thành viên'
        });
    });
}

function renderDiceState(diceSt, animate) {
    if (!diceSt || !diceStage) return;
    const vals = Array.isArray(diceSt.values) && diceSt.values.length > 0 ? diceSt.values : [6, 6];
    selectedDiceCount = vals.length;
    document.querySelectorAll('.dice-cnt-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-count'), 10) === selectedDiceCount);
    });

    if (diceAnimInterval) {
        clearInterval(diceAnimInterval);
        diceAnimInterval = null;
    }

    diceStage.innerHTML = '';
    const cubes = vals.map(v => {
        const c = document.createElement('div');
        c.className = 'dice-cube' + (animate ? ' rolling' : '') + (v === 6 ? ' high-val' : '');
        c.innerText = DICE_FACES[(v - 1) % 6] || '⚅';
        diceStage.appendChild(c);
        return c;
    });

    if (animate) {
        if (diceResultText) diceResultText.innerText = `🎲 ${diceSt.roller || 'Thành viên'} đang lắc xúc xắc...`;
        diceAnimInterval = setInterval(() => {
            cubes.forEach(c => {
                const randFace = DICE_FACES[Math.floor(Math.random() * 6)];
                c.innerText = randFace;
            });
        }, 75);
        setTimeout(() => {
            if (diceAnimInterval) {
                clearInterval(diceAnimInterval);
                diceAnimInterval = null;
            }
            cubes.forEach((c, idx) => {
                const finalV = vals[idx] || 6;
                c.classList.remove('rolling');
                c.classList.toggle('high-val', finalV === 6);
                c.innerText = DICE_FACES[(finalV - 1) % 6] || '⚅';
            });
            if (diceResultText) {
                diceResultText.innerHTML = `🎉 <b>${diceSt.roller || 'Thành viên'}</b> tung được: <b>${vals.join(' + ')} = ${diceSt.total} nút</b>`;
            }
            if (diceHistoryList && Array.isArray(diceSt.history) && diceSt.history.length > 0) {
                diceHistoryList.innerText = 'Lịch sử: ' + diceSt.history.slice().reverse().join(' | ');
            }
        }, 720);
    } else {
        if (diceResultText) {
            diceResultText.innerHTML = `Kết quả gần nhất (${diceSt.roller || 'Hệ thống'}): <b>${vals.join(' + ')} = ${diceSt.total} nút</b>`;
        }
        if (diceHistoryList && Array.isArray(diceSt.history) && diceSt.history.length > 0) {
            diceHistoryList.innerText = 'Lịch sử: ' + diceSt.history.slice().reverse().join(' | ');
        }
    }
}

window.loadDiceState = function(diceSt) {
    renderDiceState(diceSt, false);
};

socket.on('dice_rolled', (data) => {
    if (!data || !data.dice_state) return;
    if (diceContainer && diceContainer.style.display === 'none') {
        diceContainer.style.display = 'flex';
        diceContainer.classList.remove('minimized');
    }
    renderDiceState(data.dice_state, true);
});

window.bindSafeButton(timerMinBtn, () => {
    timerContainer.classList.toggle('minimized');
    if (syncTimerState) syncTimerState();
});
window.bindSafeButton(timerCloseBtn, () => {
    timerContainer.style.display = 'none';
    if (syncTimerState) syncTimerState();
});

function formatTimerClock(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return String(m).padStart(2, '0') + ':' + String(rem).padStart(2, '0');
}

function updateTimerDisplayUI() {
    if (timerBigClock) {
        timerBigClock.innerText = formatTimerClock(boardTimerRemaining);
        timerBigClock.classList.toggle('urgent', boardTimerRemaining > 0 && boardTimerRemaining <= 15);
    }
    if (timerProgressBar) {
        const pct = boardTimerDuration > 0 ? Math.max(0, Math.min(100, (boardTimerRemaining / boardTimerDuration) * 100)) : 0;
        timerProgressBar.style.width = pct + '%';
    }
}

function applyTimerStateObject(tSt) {
    if (!tSt) return;
    if (boardTimerInterval) {
        clearInterval(boardTimerInterval);
        boardTimerInterval = null;
    }
    boardTimerDuration = parseInt(tSt.duration, 10) || 300;
    boardTimerRemaining = parseInt(tSt.live_remaining !== undefined ? tSt.live_remaining : tSt.remaining, 10) || 0;

    document.querySelectorAll('.timer-preset-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-sec'), 10) === boardTimerDuration);
    });

    updateTimerDisplayUI();

    if (tSt.running && boardTimerRemaining > 0) {
        if (timerStatusSub) timerStatusSub.innerText = `⏱️ Đang đếm ngược (Bật bởi ${tSt.starter || 'Thành viên'})`;
        boardTimerInterval = setInterval(() => {
            boardTimerRemaining = Math.max(0, boardTimerRemaining - 1);
            updateTimerDisplayUI();
            if (boardTimerRemaining <= 0) {
                clearInterval(boardTimerInterval);
                boardTimerInterval = null;
                if (timerStatusSub) timerStatusSub.innerText = '⏰ ĐÃ HẾT GIỜ!';
                if (window.showToast) window.showToast('⏰ Đồng hồ đếm ngược trên bảng đã hết giờ!');
            }
        }, 1000);
    } else {
        if (timerStatusSub) {
            timerStatusSub.innerText = boardTimerRemaining <= 0 ? '⏰ Đã hết giờ!' : '⏸️ Đang tạm dừng / Sẵn sàng';
        }
    }
}

document.querySelectorAll('.timer-preset-btn').forEach(btn => {
    window.bindSafeButton(btn, () => {
        const sec = parseInt(btn.getAttribute('data-sec'), 10) || 300;
        socket.emit('timer_control', {
            room_id: ROOM_ID,
            action: 'set',
            seconds: sec,
            username: window.USERNAME || 'Thành viên'
        });
    });
});

if (btnTimerStart) {
    window.bindSafeButton(btnTimerStart, () => {
        socket.emit('timer_control', {
            room_id: ROOM_ID,
            action: 'start',
            username: window.USERNAME || 'Thành viên'
        });
    });
}

if (btnTimerPause) {
    window.bindSafeButton(btnTimerPause, () => {
        socket.emit('timer_control', {
            room_id: ROOM_ID,
            action: 'pause',
            username: window.USERNAME || 'Thành viên'
        });
    });
}

if (btnTimerReset) {
    window.bindSafeButton(btnTimerReset, () => {
        socket.emit('timer_control', {
            room_id: ROOM_ID,
            action: 'reset',
            username: window.USERNAME || 'Thành viên'
        });
    });
}

window.loadTimerState = function(tSt) {
    applyTimerStateObject(tSt);
};

socket.on('timer_updated', (data) => {
    if (!data || !data.timer_state) return;
    if (data.action === 'start' && timerContainer && timerContainer.style.display === 'none') {
        timerContainer.style.display = 'flex';
        timerContainer.classList.remove('minimized');
    }
    applyTimerStateObject(data.timer_state);
});
