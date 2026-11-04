import os
import json
import sqlite3
import time
import threading
import uuid
import mimetypes
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from flask_socketio import SocketIO, join_room, emit
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default_secret')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

connected_users = {}
active_rooms = {}
room_states = {}
xo_games = {}
xo_timers = {}
dirty_rooms = set()
db_lock = threading.Lock()

def get_db():
    os.makedirs('database', exist_ok=True)
    conn = sqlite3.connect('database/app.db', timeout=20)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs('database', exist_ok=True)
    os.makedirs('static/uploads', exist_ok=True)
    with db_lock:
        conn = get_db()
        conn.execute('CREATE TABLE IF NOT EXISTS banned_ips (ip TEXT PRIMARY KEY)')
        conn.execute('CREATE TABLE IF NOT EXISTS room_data (room_id TEXT PRIMARY KEY, state_json TEXT, xo_json TEXT, updated_at REAL)')
        conn.commit()
        conn.close()

def init_xo_game():
    return {
        'board': [['' for _ in range(20)] for _ in range(20)],
        'turn': 'X',
        'players': {'X': None, 'O': None},
        'winner': None,
        'winner_name': None,
        'winning_line': [],
        'status': 'playing',
        'last_activity': time.time()
    }

def default_room_state():
    return {
        'draw_history': [],
        'stickies': {},
        'board_media': {},
        'media': None,
        'media_list': [],
        'chat': [],
        'settings': {'bg': 'bg-magical'},
        'widgets': {
            'xo': {'x': 2550, 'y': 2250, 'open': False, 'minimized': False},
            'media': {'x': 1950, 'y': 2250, 'open': False, 'minimized': False}
        }
    }

def detect_media_kind(filename, content_type):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    ct = (content_type or '').lower()
    if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg') or ct.startswith('image/'):
        return 'image'
    if ext in ('mp4', 'webm', 'ogg', 'mov', 'mkv') or ct.startswith('video/'):
        return 'video'
    if ext in ('mp3', 'wav', 'flac', 'aac', 'm4a', 'oga') or ct.startswith('audio/'):
        return 'audio'
    if ext == 'pdf' or ct == 'application/pdf':
        return 'pdf'
    return 'file'

def compute_live_media(media_obj):
    if not media_obj or not isinstance(media_obj, dict):
        return None
    copy_obj = dict(media_obj)
    if copy_obj.get('playing'):
        elapsed = max(0.0, time.time() - float(copy_obj.get('updated_at', time.time())))
        copy_obj['current_pos'] = float(copy_obj.get('position', 0.0)) + elapsed
    else:
        copy_obj['current_pos'] = float(copy_obj.get('position', 0.0))
    return copy_obj

def mark_room_dirty(room_id):
    if room_id:
        dirty_rooms.add(room_id)

def flush_dirty_rooms():
    while True:
        time.sleep(2.0)
        if not dirty_rooms:
            continue
        to_save = list(dirty_rooms)
        dirty_rooms.clear()
        for room_id in to_save:
            if room_id not in room_states:
                continue
            state_data = room_states[room_id]
            xo_data = xo_games.get(room_id, init_xo_game())
            try:
                with db_lock:
                    conn = get_db()
                    conn.execute(
                        'INSERT OR REPLACE INTO room_data (room_id, state_json, xo_json, updated_at) VALUES (?, ?, ?, ?)',
                        (room_id, json.dumps(state_data), json.dumps(xo_data), time.time())
                    )
                    conn.commit()
                    conn.close()
            except Exception:
                pass

def save_room_immediately(room_id):
    if room_id not in room_states:
        return
    state_data = room_states[room_id]
    xo_data = xo_games.get(room_id, init_xo_game())
    try:
        with db_lock:
            conn = get_db()
            conn.execute(
                'INSERT OR REPLACE INTO room_data (room_id, state_json, xo_json, updated_at) VALUES (?, ?, ?, ?)',
                (room_id, json.dumps(state_data), json.dumps(xo_data), time.time())
            )
            conn.commit()
            conn.close()
    except Exception:
        pass

def get_room_state(room_id):
    if room_id not in room_states:
        loaded_state = None
        loaded_xo = None
        try:
            with db_lock:
                conn = get_db()
                row = conn.execute('SELECT state_json, xo_json FROM room_data WHERE room_id = ?', (room_id,)).fetchone()
                conn.close()
                if row:
                    loaded_state = json.loads(row['state_json'])
                    loaded_xo = json.loads(row['xo_json'])
        except Exception:
            pass
        base = default_room_state()
        if loaded_state:
            for k, v in base.items():
                if k not in loaded_state:
                    loaded_state[k] = v
            if 'widgets' not in loaded_state or not isinstance(loaded_state['widgets'], dict):
                loaded_state['widgets'] = base['widgets']
            room_states[room_id] = loaded_state
        else:
            room_states[room_id] = base
        if loaded_xo:
            xo_games[room_id] = loaded_xo
        elif room_id not in xo_games:
            xo_games[room_id] = init_xo_game()
    if room_id not in xo_games:
        xo_games[room_id] = init_xo_game()
    return room_states[room_id]

def get_room_users(room_id):
    return [u['username'] for u in connected_users.values() if u['room'] == room_id]

def check_win(board, r, c, val):
    directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
    for dr, dc in directions:
        line = [[r, c]]
        nr, nc = r + dr, c + dc
        while 0 <= nr < 20 and 0 <= nc < 20 and board[nr][nc] == val:
            line.append([nr, nc])
            nr += dr
            nc += dc
        nr, nc = r - dr, c - dc
        while 0 <= nr < 20 and 0 <= nc < 20 and board[nr][nc] == val:
            line.append([nr, nc])
            nr -= dr
            nc -= dc
        if len(line) >= 5:
            return line
    return None

def handle_xo_inactivity(room_id):
    if room_id in xo_games:
        xo_games[room_id] = init_xo_game()
        mark_room_dirty(room_id)
        socketio.emit('xo_update', {'game': xo_games[room_id], 'notice': 'Bàn cờ đã được làm mới do không hoạt động!'}, to=room_id)

def schedule_xo_inactivity_timer(room_id):
    if room_id in xo_timers and xo_timers[room_id]:
        try:
            xo_timers[room_id].cancel()
        except Exception:
            pass
    t = threading.Timer(180, handle_xo_inactivity, args=[room_id])
    t.daemon = True
    xo_timers[room_id] = t
    t.start()

def handle_xo_auto_restart(room_id):
    if room_id in xo_games:
        xo_games[room_id] = init_xo_game()
        mark_room_dirty(room_id)
        socketio.emit('xo_update', {'game': xo_games[room_id], 'notice': 'Ván mới đã bắt đầu!'}, to=room_id)

def schedule_auto_restart(room_id):
    t = threading.Timer(5, handle_xo_auto_restart, args=[room_id])
    t.daemon = True
    t.start()

init_db()
saver_thread = threading.Thread(target=flush_dirty_rooms, daemon=True)
saver_thread.start()

@app.before_request
def check_bans():
    if request.path.startswith('/static/'):
        return
    conn = get_db()
    try:
        ban = conn.execute('SELECT ip FROM banned_ips WHERE ip = ?', (request.remote_addr,)).fetchone()
        if ban:
            return "Your IP is banned by Administrator.", 403
    except Exception:
        pass
    finally:
        conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/room/<room_id>')
def room(room_id):
    raw_name = request.args.get('name', '').strip()
    return render_template('room.html', room_id=room_id, username=raw_name)

@app.route('/secret-admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        pwd = request.form.get('password')
        if pwd == os.getenv('ADMIN_PASSWORD', 'admin123'):
            session['is_admin'] = True
            return redirect(url_for('admin_dashboard'))
    return render_template('admin_panel.html')

@app.route('/admin-dashboard')
def admin_dashboard():
    if not session.get('is_admin'):
        return redirect(url_for('admin'))
    room_summary = {}
    for r_id, info in list(active_rooms.items()):
        room_summary[r_id] = {
            'created_at': info.get('created_at', 0),
            'user_count': len(get_room_users(r_id))
        }
    return render_template('admin_dashboard.html', rooms=room_summary)

@app.route('/api/admin/delete/<room_id>', methods=['POST'])
def admin_delete_room(room_id):
    if not session.get('is_admin'):
        return redirect(url_for('admin'))
    socketio.emit('force_leave', {'msg': 'Phòng đã bị Quản trị viên đóng và xóa dữ liệu.'}, to=room_id)
    state = room_states.get(room_id)
    if state:
        for item in state.get('media_list', []):
            url = item.get('url', '')
            if url.startswith('/static/uploads/'):
                rel_path = url.lstrip('/')
                if os.path.exists(rel_path):
                    try:
                        os.remove(rel_path)
                    except Exception:
                        pass
    active_rooms.pop(room_id, None)
    xo_games.pop(room_id, None)
    room_states.pop(room_id, None)
    dirty_rooms.discard(room_id)
    with db_lock:
        conn = get_db()
        conn.execute('DELETE FROM room_data WHERE room_id = ?', (room_id,))
        conn.commit()
        conn.close()
    return redirect(url_for('admin_dashboard'))

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Không tìm thấy tệp tải lên'}), 400
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'Chưa chọn tệp'}), 400
    os.makedirs('static/uploads', exist_ok=True)
    orig_name = file.filename
    ext = orig_name.rsplit('.', 1)[-1].lower() if '.' in orig_name else 'bin'
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join('static/uploads', filename)
    file.save(filepath)
    guessed_mime, _ = mimetypes.guess_type(filepath)
    content_type = file.content_type or guessed_mime or 'application/octet-stream'
    kind = detect_media_kind(orig_name, content_type)
    return jsonify({
        'url': f'/static/uploads/{filename}',
        'type': content_type,
        'kind': kind,
        'name': orig_name[:60]
    })

@socketio.on('join_room')
def handle_join(data):
    room_id = str(data.get('room_id', 'default')).strip()
    username = str(data.get('username', '')).strip() or 'Thành viên'
    active_with_users = [r for r in active_rooms if len(get_room_users(r)) > 0]
    if room_id not in active_rooms and len(active_with_users) >= 15:
        emit('room_error', {'msg': 'Máy chủ đã đạt giới hạn phòng hoạt động cùng lúc. Vui lòng thử lại sau.'})
        return
    if room_id not in active_rooms:
        active_rooms[room_id] = {'created_at': time.time()}
    join_room(room_id)
    connected_users[request.sid] = {'room': room_id, 'username': username}
    state = get_room_state(room_id)
    users_list = get_room_users(room_id)
    emit('room_state', {
        'draw_history': state['draw_history'],
        'stickies': list(state['stickies'].values()),
        'board_media': list(state.get('board_media', {}).values()),
        'media': compute_live_media(state['media']),
        'media_list': state.get('media_list', [])[-30:],
        'xo_game': xo_games[room_id],
        'chat': state['chat'][-50:],
        'settings': state['settings'],
        'widgets': state['widgets'],
        'users': users_list
    }, to=request.sid)
    emit('room_users', {'users': users_list, 'joined': username, 'sid': request.sid}, to=room_id)

@socketio.on('update_username')
def handle_update_username(data):
    new_name = str(data.get('username', '')).strip()
    if not new_name or request.sid not in connected_users:
        return
    connected_users[request.sid]['username'] = new_name[:35]
    room_id = connected_users[request.sid]['room']
    users_list = get_room_users(room_id)
    emit('room_users', {'users': users_list, 'renamed': new_name[:35], 'sid': request.sid}, to=room_id)

@socketio.on('disconnect')
def handle_disconnect():
    user_data = connected_users.pop(request.sid, None)
    if user_data:
        room_id = user_data['room']
        save_room_immediately(room_id)
        users_list = get_room_users(room_id)
        emit('user_disconnected', {'sid': request.sid, 'username': user_data['username'], 'users': users_list}, to=room_id)

@socketio.on('mouse_move')
def handle_mouse_move(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    data['sid'] = request.sid
    if request.sid in connected_users:
        data['username'] = connected_users[request.sid]['username']
    emit('mouse_update', data, to=room_id, include_self=False)

@socketio.on('laser_point')
def handle_laser_point(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    emit('laser_point', data, to=room_id, include_self=False)

@socketio.on('draw_segment')
def handle_draw_segment(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    emit('draw_segment', data, to=room_id, include_self=False)

@socketio.on('draw_stroke')
def handle_draw_stroke(data):
    room_id = data.get('room_id')
    stroke = data.get('stroke')
    if not room_id or not stroke:
        return
    state = get_room_state(room_id)
    state['draw_history'].append(stroke)
    if len(state['draw_history']) > 1000:
        state['draw_history'] = state['draw_history'][-1000:]
    mark_room_dirty(room_id)
    emit('draw_stroke', stroke, to=room_id, include_self=False)

@socketio.on('undo_stroke')
def handle_undo_stroke(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    state = get_room_state(room_id)
    if state['draw_history']:
        state['draw_history'].pop()
        mark_room_dirty(room_id)
        emit('board_sync', {'draw_history': state['draw_history']}, to=room_id)

@socketio.on('clear_board')
def handle_clear(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    state = get_room_state(room_id)
    state['draw_history'] = []
    mark_room_dirty(room_id)
    emit('board_cleared', {}, to=room_id)

@socketio.on('widget_state')
def handle_widget_state(data):
    room_id = data.get('room_id')
    w_name = data.get('widget')
    if not room_id or w_name not in ('xo', 'media'):
        return
    state = get_room_state(room_id)
    w_info = state['widgets'].get(w_name, {})
    if 'x' in data:
        w_info['x'] = data['x']
    if 'y' in data:
        w_info['y'] = data['y']
    if 'open' in data:
        w_info['open'] = bool(data['open'])
    if 'minimized' in data:
        w_info['minimized'] = bool(data['minimized'])
    state['widgets'][w_name] = w_info
    mark_room_dirty(room_id)
    emit('widget_updated', {'widget': w_name, 'state': w_info}, to=room_id, include_self=False)

@socketio.on('new_sticky')
def handle_new_sticky(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    state['stickies'][data['id']] = data
    mark_room_dirty(room_id)
    emit('sticky_added', data, to=room_id, include_self=False)

@socketio.on('move_sticky')
def handle_move_sticky(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    if data['id'] in state['stickies']:
        state['stickies'][data['id']]['x'] = data['x']
        state['stickies'][data['id']]['y'] = data['y']
        mark_room_dirty(room_id)
    emit('sticky_moved', data, to=room_id, include_self=False)

@socketio.on('edit_sticky')
def handle_edit_sticky(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    if data['id'] in state['stickies']:
        state['stickies'][data['id']]['text'] = data['text']
        mark_room_dirty(room_id)
    emit('sticky_edited', data, to=room_id, include_self=False)

@socketio.on('delete_sticky')
def handle_delete_sticky(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    if data['id'] in state['stickies']:
        del state['stickies'][data['id']]
        mark_room_dirty(room_id)
    emit('sticky_deleted', data, to=room_id, include_self=False)

@socketio.on('color_sticky')
def handle_color_sticky(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    if data['id'] in state['stickies']:
        state['stickies'][data['id']]['color'] = data['color']
        mark_room_dirty(room_id)
    emit('sticky_colored', data, to=room_id, include_self=False)

@socketio.on('new_board_media')
def handle_new_board_media(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    if 'board_media' not in state:
        state['board_media'] = {}
    state['board_media'][data['id']] = data
    mark_room_dirty(room_id)
    emit('board_media_added', data, to=room_id, include_self=False)

@socketio.on('move_board_media')
def handle_move_board_media(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    bm = state.get('board_media', {})
    if data['id'] in bm:
        bm[data['id']]['x'] = data['x']
        bm[data['id']]['y'] = data['y']
        if 'w' in data:
            bm[data['id']]['w'] = data['w']
        mark_room_dirty(room_id)
    emit('board_media_moved', data, to=room_id, include_self=False)

@socketio.on('delete_board_media')
def handle_delete_board_media(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    bm = state.get('board_media', {})
    if data['id'] in bm:
        del bm[data['id']]
        mark_room_dirty(room_id)
    emit('board_media_deleted', data, to=room_id, include_self=False)

@socketio.on('xo_click')
def handle_xo_click(data):
    room_id = data.get('room_id')
    r = int(data.get('row', 0))
    c = int(data.get('col', 0))
    username = data.get('username', 'Thành viên')
    get_room_state(room_id)
    game = xo_games[room_id]
    if game['status'] != 'playing' or game['board'][r][c] != '':
        return
    current_turn = game['turn']
    other_turn = 'O' if current_turn == 'X' else 'X'
    if game['players'][current_turn] is None:
        if game['players'][other_turn] == username and len(get_room_users(room_id)) > 1:
            emit('xo_update', {'game': game, 'notice': 'Hãy chờ đối thủ đánh lượt này!'}, to=request.sid)
            return
        game['players'][current_turn] = username
    elif game['players'][current_turn] != username and len(get_room_users(room_id)) > 1:
        emit('xo_update', {'game': game, 'notice': f"Đang là lượt của {game['players'][current_turn]} ({current_turn})!"}, to=request.sid)
        return
    game['board'][r][c] = current_turn
    game['last_activity'] = time.time()
    win_line = check_win(game['board'], r, c, current_turn)
    if win_line:
        game['status'] = 'finished'
        game['winner'] = current_turn
        game['winner_name'] = username
        game['winning_line'] = win_line
        mark_room_dirty(room_id)
        socketio.emit('xo_update', {'game': game, 'notice': f'🎉 {username} ({current_turn}) đã thắng! Tự động tạo ván mới sau 5s.'}, to=room_id)
        schedule_auto_restart(room_id)
    else:
        is_draw = all(cell != '' for row in game['board'] for cell in row)
        if is_draw:
            game['status'] = 'draw'
            mark_room_dirty(room_id)
            socketio.emit('xo_update', {'game': game, 'notice': 'Trận đấu hòa! Tự động tạo ván mới sau 5s.'}, to=room_id)
            schedule_auto_restart(room_id)
        else:
            game['turn'] = other_turn
            mark_room_dirty(room_id)
            schedule_xo_inactivity_timer(room_id)
            socketio.emit('xo_update', {'game': game}, to=room_id)

@socketio.on('xo_manual_reset')
def handle_xo_manual_reset(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    xo_games[room_id] = init_xo_game()
    mark_room_dirty(room_id)
    socketio.emit('xo_update', {'game': xo_games[room_id], 'notice': 'Bàn cờ đã được làm mới!'}, to=room_id)

@socketio.on('media_share')
def handle_media_share(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    state = get_room_state(room_id)
    if 'media_list' not in state:
        state['media_list'] = []
    if data.get('type') == 'clear':
        state['media'] = None
        mark_room_dirty(room_id)
        emit('media_shared', {'type': 'clear', 'media_list': state['media_list'][-30:]}, to=room_id)
        return
    now = time.time()
    item = {
        'id': uuid.uuid4().hex[:8],
        'type': data.get('type'),
        'kind': data.get('kind') or detect_media_kind(data.get('name', ''), data.get('type', '')),
        'url': data.get('url'),
        'name': data.get('name') or ('YouTube Video' if data.get('type') == 'youtube' else 'Media File'),
        'sender': data.get('sender', 'Thành viên'),
        'time': time.strftime('%H:%M'),
        'playing': True,
        'position': 0.0,
        'updated_at': now,
        'current_pos': 0.0
    }
    state['media'] = item
    if not any(m.get('url') == item['url'] for m in state['media_list']):
        state['media_list'].append(item)
        if len(state['media_list']) > 30:
            state['media_list'] = state['media_list'][-30:]
    state['widgets']['media']['open'] = True
    state['widgets']['media']['minimized'] = False
    mark_room_dirty(room_id)
    emit('widget_updated', {'widget': 'media', 'state': state['widgets']['media']}, to=room_id)
    emit('media_shared', {'media': item, 'media_list': state['media_list'][-30:]}, to=room_id)

@socketio.on('media_playback_sync')
def handle_media_playback_sync(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    state = get_room_state(room_id)
    media = state.get('media')
    if not media:
        return
    action = data.get('action', 'play')
    pos = max(0.0, float(data.get('currentTime', 0.0)))
    media['playing'] = (action == 'play')
    media['position'] = pos
    media['updated_at'] = time.time()
    mark_room_dirty(room_id)
    emit('media_playback_sync', {
        'action': action,
        'currentTime': pos,
        'playing': media['playing'],
        'sender': data.get('sender', '')
    }, to=room_id, include_self=False)

@socketio.on('request_media_sync')
def handle_request_media_sync(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    state = get_room_state(room_id)
    live_media = compute_live_media(state.get('media'))
    if live_media:
        emit('media_playback_sync', {
            'action': 'play' if live_media.get('playing') else 'pause',
            'currentTime': live_media.get('current_pos', 0.0),
            'playing': live_media.get('playing', False),
            'force': True
        }, to=request.sid)

@socketio.on('chat_message')
def handle_chat_message(data):
    room_id = data.get('room_id')
    text = str(data.get('text', '')).strip()
    if not room_id or not text:
        return
    state = get_room_state(room_id)
    msg = {
        'id': uuid.uuid4().hex[:8],
        'username': data.get('username', 'Thành viên'),
        'text': text[:500],
        'time': time.strftime('%H:%M')
    }
    state['chat'].append(msg)
    if len(state['chat']) > 100:
        state['chat'] = state['chat'][-100:]
    mark_room_dirty(room_id)
    emit('chat_received', msg, to=room_id)

@socketio.on('change_bg')
def handle_change_bg(data):
    room_id = data.get('room_id')
    bg = data.get('bg')
    if not room_id or not bg:
        return
    state = get_room_state(room_id)
    state['settings']['bg'] = bg
    mark_room_dirty(room_id)
    emit('bg_updated', {'bg': bg}, to=room_id, include_self=False)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
