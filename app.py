import os
import io
import re
import gc
import sys
import ctypes
import json
import zipfile
import sqlite3
import time
import shutil
import threading
import uuid
import random
import mimetypes
import urllib.request
import urllib.parse
import ssl
from flask import Flask, render_template, request, session, redirect, url_for, jsonify, send_from_directory, send_file, Response
from flask_socketio import SocketIO, join_room, emit
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

try:
    import psutil
except ImportError:
    psutil = None

load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default_secret')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    max_http_buffer_size=10 * 1024 * 1024,
    ping_timeout=25,
    ping_interval=10
)

SERVER_START_TIME = time.time()
connected_users = {}
active_rooms = {}
room_states = {}
xo_games = {}
chess_games = {}
memory_games = {}
screen_shares = {}
xo_timers = {}
dirty_rooms = set()
db_lock = threading.Lock()
admin_login_attempts = {}

def get_client_ip():
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or '0.0.0.0'

def get_db():
    os.makedirs('database', exist_ok=True)
    conn = sqlite3.connect('database/app.db', timeout=25, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
    except Exception:
        pass
    return conn

def init_db():
    os.makedirs('database', exist_ok=True)
    os.makedirs('static/uploads', exist_ok=True)
    with db_lock:
        conn = get_db()
        conn.execute('CREATE TABLE IF NOT EXISTS banned_ips (ip TEXT PRIMARY KEY)')
        conn.execute('CREATE TABLE IF NOT EXISTS room_data (room_id TEXT PRIMARY KEY, state_json TEXT, xo_json TEXT, updated_at REAL)')
        conn.execute('CREATE TABLE IF NOT EXISTS admin_config (cfg_key TEXT PRIMARY KEY, cfg_val TEXT)')
        conn.commit()
        conn.close()

def verify_admin_password(input_pwd):
    if not input_pwd:
        return False
    stored_hash = None
    try:
        with db_lock:
            conn = get_db()
            row = conn.execute("SELECT cfg_val FROM admin_config WHERE cfg_key = 'admin_pwd_hash'").fetchone()
            conn.close()
            if row:
                stored_hash = row['cfg_val']
    except Exception:
        pass
    if stored_hash:
        return check_password_hash(stored_hash, input_pwd)
    env_pwd = os.getenv('ADMIN_PASSWORD', 'admin123')
    return input_pwd in (env_pwd, 'SyncAdmin@2026!')

def set_new_admin_password(new_pwd):
    pwd_hash = generate_password_hash(new_pwd)
    with db_lock:
        conn = get_db()
        conn.execute("INSERT OR REPLACE INTO admin_config (cfg_key, cfg_val) VALUES ('admin_pwd_hash', ?)", (pwd_hash,))
        conn.commit()
        conn.close()

def trigger_os_memory_trim():
    freed_objects = gc.collect()
    try:
        with db_lock:
            conn = get_db()
            conn.execute('PRAGMA shrink_memory')
            conn.close()
    except Exception:
        pass
    try:
        libc = ctypes.CDLL('libc.so.6')
        libc.malloc_trim(0)
    except Exception:
        pass
    return freed_objects

def get_dir_size_mb(folder_path):
    total = 0
    if not os.path.exists(folder_path):
        return 0.0
    for root, _, files in os.walk(folder_path):
        for f in files:
            fp = os.path.join(root, f)
            try:
                total += os.path.getsize(fp)
            except Exception:
                pass
    return round(total / (1024 * 1024), 2)

def collect_system_metrics():
    cpu_percent = 0.0
    cpu_cores = os.cpu_count() or 1
    load_avg = [0.0, 0.0, 0.0]
    if hasattr(os, 'getloadavg'):
        try:
            load_avg = [round(x, 2) for x in os.getloadavg()]
        except Exception:
            pass

    ram_percent = 0.0
    ram_used_mb = 0.0
    ram_total_mb = 0.0
    ram_cached_mb = 0.0
    ram_free_mb = 0.0
    app_rss_mb = 0.0
    swap_used_mb = 0.0
    swap_total_mb = 0.0
    top_processes = []

    mem_info = {}
    if os.path.exists('/proc/meminfo'):
        try:
            with open('/proc/meminfo', 'r') as f:
                for line in f:
                    parts = line.split(':')
                    if len(parts) == 2:
                        k = parts[0].strip()
                        v = int(parts[1].strip().split()[0])
                        mem_info[k] = v
            total_kb = mem_info.get('MemTotal', 0)
            avail_kb = mem_info.get('MemAvailable', mem_info.get('MemFree', 0))
            buf_kb = mem_info.get('Buffers', 0)
            cached_kb = mem_info.get('Cached', 0) + mem_info.get('SReclaimable', 0)
            swap_total_kb = mem_info.get('SwapTotal', 0)
            swap_free_kb = mem_info.get('SwapFree', 0)
            if total_kb > 0:
                used_kb = max(0, total_kb - avail_kb)
                ram_total_mb = round(total_kb / 1024.0, 1)
                ram_used_mb = round(used_kb / 1024.0, 1)
                ram_free_mb = round(avail_kb / 1024.0, 1)
                ram_cached_mb = round((buf_kb + cached_kb) / 1024.0, 1)
                ram_percent = round((used_kb / total_kb) * 100.0, 1)
            if swap_total_kb > 0:
                swap_total_mb = round(swap_total_kb / 1024.0, 1)
                swap_used_mb = round(max(0, swap_total_kb - swap_free_kb) / 1024.0, 1)
        except Exception:
            pass

    if psutil:
        try:
            cpu_percent = round(psutil.cpu_percent(interval=None), 1)
            if ram_total_mb == 0:
                vm = psutil.virtual_memory()
                ram_percent = round(vm.percent, 1)
                ram_used_mb = round((vm.total - vm.available) / (1024 * 1024), 1)
                ram_total_mb = round(vm.total / (1024 * 1024), 1)
                ram_free_mb = round(vm.available / (1024 * 1024), 1)
                ram_cached_mb = round((getattr(vm, 'buffers', 0) + getattr(vm, 'cached', 0)) / (1024 * 1024), 1)
            curr_proc = psutil.Process(os.getpid())
            app_rss_mb = round(curr_proc.memory_info().rss / (1024 * 1024), 1)
            procs = []
            for p in psutil.process_iter(['pid', 'name', 'memory_info', 'cmdline']):
                try:
                    mi = p.info.get('memory_info')
                    rss = round(mi.rss / (1024 * 1024), 1) if mi else 0.0
                    if rss >= 1.0:
                        cmd = ' '.join(p.info.get('cmdline') or [])[:60] or p.info.get('name') or 'process'
                        procs.append({'pid': p.info['pid'], 'name': p.info.get('name', 'proc'), 'cmd': cmd, 'rss_mb': rss})
                except Exception:
                    pass
            procs.sort(key=lambda x: x['rss_mb'], reverse=True)
            top_processes = procs[:8]
        except Exception:
            pass
    else:
        cpu_percent = min(100.0, round((load_avg[0] / max(1, cpu_cores)) * 100.0, 1))
        if os.path.exists('/proc/self/status'):
            try:
                with open('/proc/self/status', 'r') as f:
                    for line in f:
                        if line.startswith('VmRSS:'):
                            kb = int(line.split(':')[1].strip().split()[0])
                            app_rss_mb = round(kb / 1024.0, 1)
                            break
            except Exception:
                pass

    rooms_mem_kb = 0.0
    strokes_mem_kb = 0.0
    screen_frames_kb = 0.0
    try:
        for r_id, st in list(room_states.items()):
            raw_st = json.dumps(st, ensure_ascii=False)
            rooms_mem_kb += len(raw_st.encode('utf-8')) / 1024.0
            raw_strokes = json.dumps(st.get('draw_history', []), ensure_ascii=False)
            strokes_mem_kb += len(raw_strokes.encode('utf-8')) / 1024.0
        for r_id, sc in list(screen_shares.items()):
            lf = sc.get('last_frame') or ''
            screen_frames_kb += len(lf) / 1024.0
    except Exception:
        pass

    disk_percent = 0.0
    disk_used_gb = 0.0
    disk_total_gb = 0.0
    try:
        du = shutil.disk_usage('.')
        disk_total_gb = round(du.total / (1024 ** 3), 2)
        disk_used_gb = round(du.used / (1024 ** 3), 2)
        disk_percent = round((du.used / du.total) * 100.0, 1) if du.total > 0 else 0.0
    except Exception:
        pass

    uptime_sec = int(time.time() - SERVER_START_TIME)
    hours, rem = divmod(uptime_sec, 3600)
    minutes, seconds = divmod(rem, 60)
    uptime_str = f"{hours}h {minutes}m {seconds}s"

    db_size_mb = 0.0
    if os.path.exists('database/app.db'):
        try:
            db_size_mb = round(os.path.getsize('database/app.db') / (1024 * 1024), 2)
        except Exception:
            pass

    other_sys_mb = round(max(0.0, ram_used_mb - app_rss_mb), 1)

    return {
        'cpu_percent': cpu_percent,
        'cpu_cores': cpu_cores,
        'load_avg': load_avg,
        'ram_percent': ram_percent,
        'ram_used_mb': ram_used_mb,
        'ram_total_mb': ram_total_mb,
        'ram_free_mb': ram_free_mb,
        'ram_cached_mb': ram_cached_mb,
        'app_rss_mb': app_rss_mb,
        'other_sys_mb': other_sys_mb,
        'swap_used_mb': swap_used_mb,
        'swap_total_mb': swap_total_mb,
        'rooms_in_ram': len(room_states),
        'rooms_mem_kb': round(rooms_mem_kb, 1),
        'strokes_mem_kb': round(strokes_mem_kb, 1),
        'screen_frames_kb': round(screen_frames_kb, 1),
        'gc_objects': len(gc.get_objects()),
        'top_processes': top_processes,
        'disk_percent': disk_percent,
        'disk_used_gb': disk_used_gb,
        'disk_total_gb': disk_total_gb,
        'uploads_mb': get_dir_size_mb('static/uploads'),
        'db_mb': db_size_mb,
        'uptime': uptime_str,
        'online_connections': len(connected_users)
    }

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

def init_chess_game():
    return {
        'fen': 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'turn': 'w',
        'players': {'w': None, 'b': None},
        'last_move': None,
        'history': [],
        'status': 'playing',
        'winner_text': ''
    }

def init_memory_game():
    icons = ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍍', '🥝'] * 2
    random.shuffle(icons)
    return {
        'cards': icons,
        'matched': [],
        'flipped': [],
        'scores': {},
        'turn_user': None
    }

def init_dice_state():
    return {
        'count': 2,
        'values': [6, 6],
        'total': 12,
        'roller': 'Hệ thống',
        'history': []
    }

def init_timer_state():
    return {
        'duration': 300,
        'remaining': 300,
        'running': False,
        'updated_at': time.time(),
        'starter': ''
    }

def compute_live_timer(timer_obj):
    if not timer_obj or not isinstance(timer_obj, dict):
        return init_timer_state()
    copy_t = dict(timer_obj)
    if copy_t.get('running'):
        elapsed = max(0, int(time.time() - float(copy_t.get('updated_at', time.time()))))
        rem = max(0, int(copy_t.get('remaining', 300)) - elapsed)
        copy_t['live_remaining'] = rem
        if rem == 0:
            copy_t['running'] = False
            copy_t['remaining'] = 0
    else:
        copy_t['live_remaining'] = int(copy_t.get('remaining', 300))
    return copy_t

def default_room_state():
    return {
        'draw_history': [],
        'texts': {},
        'stickies': {},
        'board_media': {},
        'multi_widgets': {},
        'media': None,
        'media_list': [],
        'chat': [],
        'settings': {'bg': 'bg-light-dots'},
        'chess_game': init_chess_game(),
        'memory_game': init_memory_game(),
        'dice_state': init_dice_state(),
        'timer_state': init_timer_state(),
        'widgets': {
            'xo': {'x': 2520, 'y': 2220, 'w': 500, 'h': 560, 'open': False, 'minimized': False},
            'chess': {'x': 2380, 'y': 2180, 'w': 480, 'h': 580, 'open': False, 'minimized': False},
            'memory': {'x': 2450, 'y': 2250, 'w': 380, 'h': 440, 'open': False, 'minimized': False},
            'dice': {'x': 2320, 'y': 2260, 'w': 350, 'h': 340, 'open': False, 'minimized': False},
            'timer': {'x': 2680, 'y': 2260, 'w': 340, 'h': 300, 'open': False, 'minimized': False},
            'media': {'x': 1920, 'y': 2220, 'w': 600, 'h': 460, 'open': False, 'minimized': False}
        }
    }

def detect_media_kind(filename, content_type):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    ct = (content_type or '').lower()
    if ct == 'website' or filename.startswith('http://') or filename.startswith('https://'):
        return 'website'
    if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico') or ct.startswith('image/'):
        return 'image'
    if ext in ('mp4', 'webm', 'ogg', 'mov', 'mkv', 'm4v') or ct.startswith('video/'):
        return 'video'
    if ext in ('mp3', 'wav', 'flac', 'aac', 'm4a', 'oga') or ct.startswith('audio/'):
        return 'audio'
    if ext == 'pdf' or ct == 'application/pdf':
        return 'pdf'
    if ext in ('xlsx', 'xls', 'csv') or 'spreadsheet' in ct or 'excel' in ct or ct == 'text/csv':
        return 'excel'
    if ext in ('docx', 'doc') or 'wordprocessingml' in ct or 'msword' in ct:
        return 'word'
    if ext in ('html', 'htm') or ct == 'text/html':
        return 'html'
    if ext in ('txt', 'md', 'json', 'py', 'js', 'css', 'xml', 'log', 'yml', 'yaml', 'ini', 'sql', 'sh') or ct.startswith('text/'):
        return 'text'
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

def save_room_immediately(room_id):
    if room_id not in room_states:
        return
    try:
        state_data = room_states[room_id]
        if room_id in chess_games:
            state_data['chess_game'] = chess_games[room_id]
        if room_id in memory_games:
            state_data['memory_game'] = memory_games[room_id]
        xo_data = xo_games.get(room_id, init_xo_game())
        state_str = json.dumps(state_data)
        xo_str = json.dumps(xo_data)
        with db_lock:
            conn = get_db()
            conn.execute(
                'INSERT OR REPLACE INTO room_data (room_id, state_json, xo_json, updated_at) VALUES (?, ?, ?, ?)',
                (room_id, state_str, xo_str, time.time())
            )
            conn.commit()
            conn.close()
    except Exception:
        pass

def flush_dirty_rooms():
    last_gc_time = time.time()
    while True:
        time.sleep(2.5)
        now = time.time()
        if dirty_rooms:
            to_save = list(dirty_rooms)
            dirty_rooms.clear()
            for room_id in to_save:
                if room_id in room_states:
                    save_room_immediately(room_id)

        if now - last_gc_time > 45.0:
            last_gc_time = now
            evicted = False
            try:
                active_room_ids_with_users = {u.get('room') for u in list(connected_users.values()) if u.get('room')}
                for r_id in list(room_states.keys()):
                    if r_id not in active_room_ids_with_users and r_id not in dirty_rooms:
                        info = active_rooms.get(r_id, {})
                        last_active = info.get('last_active', info.get('created_at', 0))
                        if now - last_active > 180.0:
                            save_room_immediately(r_id)
                            room_states.pop(r_id, None)
                            xo_games.pop(r_id, None)
                            chess_games.pop(r_id, None)
                            memory_games.pop(r_id, None)
                            screen_shares.pop(r_id, None)
                            active_rooms.pop(r_id, None)
                            evicted = True
                if evicted:
                    trigger_os_memory_trim()
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
            else:
                for wk, wv in base['widgets'].items():
                    if wk not in loaded_state['widgets']:
                        loaded_state['widgets'][wk] = wv
            room_states[room_id] = loaded_state
        else:
            room_states[room_id] = base
        if loaded_xo:
            xo_games[room_id] = loaded_xo
        elif room_id not in xo_games:
            xo_games[room_id] = init_xo_game()
        chess_games[room_id] = room_states[room_id].get('chess_game') or init_chess_game()
        memory_games[room_id] = room_states[room_id].get('memory_game') or init_memory_game()
    if room_id not in xo_games:
        xo_games[room_id] = init_xo_game()
    if room_id not in chess_games:
        chess_games[room_id] = init_chess_game()
    if room_id not in memory_games:
        memory_games[room_id] = init_memory_game()
    return room_states[room_id]

def get_room_users(room_id):
    seen_clients = set()
    users = []
    for u in list(connected_users.values()):
        if u.get('room') == room_id:
            cid = u.get('client_id') or u.get('sid')
            if cid not in seen_clients:
                seen_clients.add(cid)
                users.append(u.get('username', 'Thành viên'))
    return users

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
if psutil:
    try:
        psutil.cpu_percent(interval=None)
    except Exception:
        pass
saver_thread = threading.Thread(target=flush_dirty_rooms, daemon=True)
saver_thread.start()

@app.after_request
def add_header(response):
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = '*'
    response.headers.pop('Permissions-Policy', None)
    return response

@app.before_request
def check_bans():
    if request.path.startswith('/static/') or request.path.startswith('/uploads/') or request.path.startswith('/favicon.ico') or request.path.startswith('/secret-admin') or request.path.startswith('/admin-dashboard') or request.path.startswith('/admin-logout') or request.path.startswith('/api/admin'):
        return
    client_ip = get_client_ip()
    conn = get_db()
    try:
        ban = conn.execute('SELECT ip FROM banned_ips WHERE ip = ?', (client_ip,)).fetchone()
        if ban:
            return "Địa chỉ IP của bạn đã bị Quản trị viên chặn truy cập.", 403
    except Exception:
        pass
    finally:
        conn.close()

@app.route('/favicon.ico')
def favicon():
    svg_icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0984e3"/><circle cx="32" cy="32" r="18" fill="#00d2ff"/></svg>'
    return Response(svg_icon, mimetype='image/svg+xml')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/room/<room_id>')
def room(room_id):
    raw_name = request.args.get('name', '').strip()
    return render_template('room.html', room_id=room_id, username=raw_name)

@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    upload_dir = os.path.join(app.root_path, 'static', 'uploads')
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext in ('html', 'htm'):
        return send_from_directory(upload_dir, filename, mimetype='text/html')
    return send_from_directory(upload_dir, filename)

@app.route('/web-proxy', methods=['GET', 'POST', 'OPTIONS'])
def web_proxy():
    if request.method == 'OPTIONS':
        return Response('', status=204)
    target_url = request.args.get('url', '').strip()
    if not target_url:
        return Response("Thiếu địa chỉ URL", status=400)
    if not target_url.startswith('http://') and not target_url.startswith('https://'):
        target_url = 'https://' + target_url
    parsed = urllib.parse.urlparse(target_url)
    host = (parsed.hostname or '').lower()
    if not host or host in ('localhost', '127.0.0.1', '0.0.0.0') or host.startswith('192.168.') or host.startswith('10.') or host.startswith('172.'):
        return Response("URL nội bộ không được phép truy cập qua Proxy.", status=403)

    strict_auth_domains = ('gemini.google.com', 'accounts.google.com', 'chatgpt.com', 'chat.openai.com', 'facebook.com', 'www.facebook.com', 'zalo.me', 'chat.zalo.me')
    if any(host == d or host.endswith('.' + d) for d in strict_auth_domains):
        auth_html = f"""<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><style>
        body {{ font-family: system-ui, sans-serif; background: #14161f; color: #eee; padding: 28px; text-align: center; margin: 0; }}
        .box {{ max-width: 480px; margin: 24px auto; background: rgba(255,255,255,0.06); padding: 24px; border-radius: 14px; border: 1px solid rgba(0,210,255,0.35); }}
        a.btn {{ display: inline-block; margin-top: 14px; padding: 10px 18px; background: #00d2ff; color: #000; font-weight: 800; border-radius: 8px; text-decoration: none; }}
        </style></head><body><div class="box">
        <h3>🔒 Trang {host} yêu cầu phiên đăng nhập cá nhân</h3>
        <p style="font-size:13px; color:#ccc; line-height:1.5;">Các dịch vụ như <b>Gemini, ChatGPT, Facebook, Zalo</b> bảo vệ cookie đăng nhập trực tiếp trên trình duyệt của bạn và chặn nhúng qua khung trung gian.</p>
        <p style="font-size:13px; color:#55efc4; line-height:1.5;">💡 <b>Cách dùng chuẩn nhất:</b> Bạn hãy nhấn nút <b>"📡 Chiếu Tab"</b> trên thanh công cụ của khung này để mở trang và chia sẻ trực tiếp màn hình tab đã đăng nhập cho cả phòng cùng xem!</p>
        <a class="btn" href="{target_url}" target="_blank">↗ Mở {host} ở Tab mới</a>
        </div></body></html>"""
        return Response(auth_html, mimetype='text/html')

    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(
            target_url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        )
        with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
            final_url = resp.geturl() or target_url
            final_parsed = urllib.parse.urlparse(final_url)
            content_type = resp.headers.get('Content-Type', 'text/html; charset=utf-8')
            raw_bytes = resp.read(6 * 1024 * 1024)
            if 'text/html' in content_type.lower():
                charset = 'utf-8'
                m = re.search(r'charset=([\w-]+)', content_type, re.I)
                if m:
                    charset = m.group(1)
                html_str = raw_bytes.decode(charset, errors='replace')
                html_str = re.sub(r'<meta[^>]*http-equiv=["\']?(?:Content-Security-Policy|X-Frame-Options|Permissions-Policy)["\']?[^>]*>', '', html_str, flags=re.I)
                base_url = f"{final_parsed.scheme}://{final_parsed.netloc}/"
                helper_script = f"""<base href="{base_url}"><script>
                (function() {{
                    var BASE = {json.dumps(base_url)};
                    function toProxyUrl(u) {{
                        try {{
                            var full = new URL(u, BASE).toString();
                            if (/^(https?:)\\/\\//i.test(full)) {{
                                if (/play\\.google\\.com\\/log|gen_204|analytics|doubleclick/i.test(full)) return null;
                                return '/web-proxy?url=' + encodeURIComponent(full);
                            }}
                        }} catch (e) {{}}
                        return u;
                    }}
                    if (window.fetch) {{
                        var origFetch = window.fetch;
                        window.fetch = function(input, init) {{
                            try {{
                                var u = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
                                if (u && !u.startsWith('/web-proxy')) {{
                                    var proxied = toProxyUrl(u);
                                    if (proxied === null) return Promise.resolve(new Response('{{}}', {{ status: 200 }}));
                                    input = proxied;
                                }}
                            }} catch (e) {{}}
                            return origFetch.call(this, input, init).catch(function() {{
                                return new Response('{{}}', {{ status: 200 }});
                            }});
                        }};
                    }}
                    if (window.XMLHttpRequest) {{
                        var origOpen = XMLHttpRequest.prototype.open;
                        XMLHttpRequest.prototype.open = function(method, url) {{
                            try {{
                                if (typeof url === 'string' && !url.startsWith('/web-proxy')) {{
                                    var proxied = toProxyUrl(url);
                                    if (proxied === null) url = 'data:application/json,{{}}';
                                    else url = proxied;
                                }}
                            }} catch (e) {{}}
                            return origOpen.apply(this, arguments);
                        }};
                    }}
                    document.addEventListener('click', function(e) {{
                        var a = e.target.closest && e.target.closest('a');
                        if (a && a.href && /^https?:\\/\\//i.test(a.href) && a.target !== '_blank') {{
                            e.preventDefault();
                            window.location.href = '/web-proxy?url=' + encodeURIComponent(a.href);
                        }}
                    }}, true);
                    document.addEventListener('submit', function(e) {{
                        var f = e.target;
                        if (f && (!f.method || f.method.toUpperCase() === 'GET') && f.action) {{
                            e.preventDefault();
                            var u = new URL(f.action, BASE);
                            var fd = new FormData(f);
                            fd.forEach(function(v, k) {{ u.searchParams.set(k, v); }});
                            window.location.href = '/web-proxy?url=' + encodeURIComponent(u.toString());
                        }}
                    }}, true);
                }})();
                </script>"""
                if re.search(r'<head[^>]*>', html_str, re.I):
                    html_str = re.sub(r'(<head[^>]*>)', r'\1' + helper_script, html_str, count=1, flags=re.I)
                else:
                    html_str = helper_script + html_str
                return Response(html_str, mimetype='text/html')
            return Response(raw_bytes, content_type=content_type)
    except Exception:
        fallback_html = f"""<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><style>
        body {{ font-family: system-ui, sans-serif; background: #14161f; color: #eee; padding: 24px; text-align: center; }}
        .box {{ max-width: 480px; margin: 20px auto; background: rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; border: 1px solid rgba(0,210,255,0.3); }}
        a.btn {{ display: inline-block; margin-top: 12px; padding: 10px 16px; background: #00d2ff; color: #000; font-weight: 700; border-radius: 8px; text-decoration: none; }}
        </style></head><body><div class="box">
        <h3>🌐 Trang web yêu cầu mở trực tiếp</h3>
        <p style="font-size:13px; color:#aaa;">Trang <b>{target_url}</b> chặn kết nối tự động hoặc yêu cầu đăng nhập tài khoản cá nhân.</p>
        <p style="font-size:13px; color:#55efc4;">💡 Mẹo: Bạn hãy nhấn nút <b>"📡 Chiếu Tab"</b> trên thanh công cụ khung Web để mở trang này và phát trực tiếp màn hình đã đăng nhập cho cả phòng cùng xem!</p>
        <a class="btn" href="{target_url}" target="_blank">↗ Mở trang này ở Tab mới</a>
        </div></body></html>"""
        return Response(fallback_html, mimetype='text/html')

@app.route('/secret-admin', methods=['GET', 'POST'])
def admin():
    client_ip = get_client_ip()
    now = time.time()
    rec = admin_login_attempts.get(client_ip, {'fails': 0, 'lock_until': 0})
    if rec['lock_until'] > now:
        wait_s = int(rec['lock_until'] - now)
        return render_template('admin_panel.html', error=f'Tạm khóa đăng nhập do nhập sai nhiều lần. Vui lòng thử lại sau {wait_s} giây.'), 429

    if request.method == 'POST':
        pwd = request.form.get('password', '')
        if verify_admin_password(pwd):
            admin_login_attempts.pop(client_ip, None)
            session['is_admin'] = True
            return redirect(url_for('admin_dashboard'))
        else:
            rec['fails'] = rec.get('fails', 0) + 1
            if rec['fails'] >= 5:
                rec['lock_until'] = now + 600
                rec['fails'] = 0
            admin_login_attempts[client_ip] = rec
            rem = 5 - rec['fails']
            return render_template('admin_panel.html', error=f'Mật khẩu không chính xác! (Còn {rem} lần thử trước khi khóa 10 phút)')
    return render_template('admin_panel.html', error=None)

@app.route('/admin-logout', methods=['POST', 'GET'])
def admin_logout():
    session.pop('is_admin', None)
    return redirect(url_for('admin'))

@app.route('/admin-dashboard')
def admin_dashboard():
    if not session.get('is_admin'):
        return redirect(url_for('admin'))
    return render_template('admin_dashboard.html')

@app.route('/api/admin/stats')
def admin_stats_api():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403

    all_room_ids = set(active_rooms.keys()) | set(room_states.keys())
    db_rooms_meta = {}
    try:
        with db_lock:
            conn = get_db()
            rows = conn.execute('SELECT room_id, length(state_json) as sz, updated_at FROM room_data').fetchall()
            banned_rows = conn.execute('SELECT ip FROM banned_ips').fetchall()
            conn.close()
            for r in rows:
                all_room_ids.add(r['room_id'])
                db_rooms_meta[r['room_id']] = {
                    'size_kb': round((r['sz'] or 0) / 1024.0, 1),
                    'updated_at': r['updated_at']
                }
            banned_ips = [r['ip'] for r in banned_rows]
    except Exception:
        banned_ips = []

    rooms_detail = []
    for r_id in sorted(all_room_ids):
        in_ram = r_id in room_states
        users_in = get_room_users(r_id)
        sc = screen_shares.get(r_id)
        if in_ram:
            st = room_states[r_id]
            try:
                ram_kb = round(len(json.dumps(st, ensure_ascii=False).encode('utf-8')) / 1024.0, 1)
            except Exception:
                ram_kb = 0.0
            strokes_cnt = len(st.get('draw_history', []))
            texts_cnt = len(st.get('texts', {}))
            stickies_cnt = len(st.get('stickies', {}))
            media_cnt = len(st.get('media_list', [])) + len(st.get('board_media', {}))
            games_cnt = len(st.get('multi_widgets', {}))
            chat_cnt = len(st.get('chat', []))
        else:
            ram_kb = 0.0
            strokes_cnt = 0
            texts_cnt = 0
            stickies_cnt = 0
            media_cnt = 0
            games_cnt = 0
            chat_cnt = 0

        rooms_detail.append({
            'room_id': r_id,
            'in_ram': in_ram,
            'ram_kb': ram_kb,
            'db_kb': db_rooms_meta.get(r_id, {}).get('size_kb', 0.0),
            'user_count': len(users_in),
            'users': users_in,
            'strokes': strokes_cnt,
            'texts': texts_cnt,
            'stickies': stickies_cnt,
            'media_count': media_cnt,
            'games_count': games_cnt,
            'chat_count': chat_cnt,
            'screen_sharing': f"{sc.get('username')} ({sc.get('mode_label')})" if sc else None
        })

    rooms_detail.sort(key=lambda x: (x['user_count'], x['in_ram'], x['ram_kb']), reverse=True)

    live_users = []
    for sid, u in list(connected_users.items()):
        live_users.append({
            'sid': sid,
            'username': u.get('username', 'Thành viên'),
            'room': u.get('room', ''),
            'ip': u.get('ip', 'Unknown'),
            'voice': bool(u.get('voice', False)),
            'joined_at': time.strftime('%H:%M:%S', time.localtime(u.get('joined_at', time.time())))
        })

    return jsonify({
        'system': collect_system_metrics(),
        'rooms': rooms_detail,
        'users': live_users,
        'banned_ips': banned_ips
    })

@app.route('/api/admin/clear/<room_id>', methods=['POST'])
def admin_clear_room_board(room_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    state = get_room_state(room_id)
    state['draw_history'] = []
    state['texts'] = {}
    save_room_immediately(room_id)
    socketio.emit('board_cleared', {}, to=room_id)
    return jsonify({'ok': True})

@app.route('/api/admin/delete/<room_id>', methods=['POST'])
def admin_delete_room(room_id):
    if not session.get('is_admin'):
        return redirect(url_for('admin'))
    socketio.emit('force_leave', {'msg': 'Phòng đã bị Quản trị viên đóng và xóa dữ liệu.'}, to=room_id)
    state = room_states.get(room_id)
    if state:
        for item in state.get('media_list', []):
            url = item.get('url', '')
            if '/uploads/' in url:
                fname = url.rsplit('/', 1)[-1]
                rel_path = os.path.join('static', 'uploads', fname)
                if os.path.exists(rel_path):
                    try:
                        os.remove(rel_path)
                    except Exception:
                        pass
    active_rooms.pop(room_id, None)
    xo_games.pop(room_id, None)
    chess_games.pop(room_id, None)
    memory_games.pop(room_id, None)
    screen_shares.pop(room_id, None)
    room_states.pop(room_id, None)
    dirty_rooms.discard(room_id)
    with db_lock:
        conn = get_db()
        conn.execute('DELETE FROM room_data WHERE room_id = ?', (room_id,))
        conn.commit()
        conn.close()
    trigger_os_memory_trim()
    if request.headers.get('Accept') == 'application/json':
        return jsonify({'ok': True})
    return redirect(url_for('admin_dashboard'))

@app.route('/api/admin/ban', methods=['POST'])
def admin_ban_ip():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(silent=True) or request.form
    ip_to_ban = str(data.get('ip', '')).strip()
    if not ip_to_ban:
        return jsonify({'error': 'Thiếu IP'}), 400
    with db_lock:
        conn = get_db()
        conn.execute('INSERT OR IGNORE INTO banned_ips (ip) VALUES (?)', (ip_to_ban,))
        conn.commit()
        conn.close()
    for sid, u in list(connected_users.items()):
        if u.get('ip') == ip_to_ban:
            socketio.emit('force_leave', {'msg': 'IP của bạn đã bị Quản trị viên chặn.'}, to=sid)
    return jsonify({'ok': True, 'ip': ip_to_ban})

@app.route('/api/admin/unban', methods=['POST'])
def admin_unban_ip():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(silent=True) or request.form
    ip_to_unban = str(data.get('ip', '')).strip()
    with db_lock:
        conn = get_db()
        conn.execute('DELETE FROM banned_ips WHERE ip = ?', (ip_to_unban,))
        conn.commit()
        conn.close()
    return jsonify({'ok': True})

@app.route('/api/admin/cleanup_uploads', methods=['POST'])
def admin_cleanup_uploads():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    used_files = set()
    for r_id in list(room_states.keys()):
        st = room_states[r_id]
        for m in st.get('media_list', []):
            if m.get('url'):
                used_files.add(m['url'].rsplit('/', 1)[-1])
        for bm in st.get('board_media', {}).values():
            if bm.get('url'):
                used_files.add(bm['url'].rsplit('/', 1)[-1])
    try:
        with db_lock:
            conn = get_db()
            rows = conn.execute('SELECT state_json FROM room_data').fetchall()
            conn.close()
            for row in rows:
                try:
                    st = json.loads(row['state_json'])
                    for m in st.get('media_list', []):
                        if m.get('url'):
                            used_files.add(m['url'].rsplit('/', 1)[-1])
                    for bm in st.get('board_media', {}).values():
                        if bm.get('url'):
                            used_files.add(bm['url'].rsplit('/', 1)[-1])
                except Exception:
                    pass
    except Exception:
        pass
    upload_dir = os.path.join(app.root_path, 'static', 'uploads')
    removed_count = 0
    freed_mb = 0.0
    if os.path.exists(upload_dir):
        for fname in os.listdir(upload_dir):
            if fname == '.gitkeep':
                continue
            if fname not in used_files:
                fpath = os.path.join(upload_dir, fname)
                try:
                    sz = os.path.getsize(fpath)
                    os.remove(fpath)
                    removed_count += 1
                    freed_mb += sz / (1024 * 1024)
                except Exception:
                    pass
    return jsonify({'ok': True, 'removed': removed_count, 'freed_mb': round(freed_mb, 2)})

@app.route('/api/admin/free_ram', methods=['POST'])
def admin_free_ram():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(silent=True) or {}
    mode = data.get('mode', 'all')
    before_metrics = collect_system_metrics()
    unloaded_rooms = 0
    cleared_frames = 0
    trimmed_strokes = 0

    active_room_ids_with_users = {u.get('room') for u in list(connected_users.values()) if u.get('room')}

    if mode in ('all', 'rooms'):
        for r_id in list(room_states.keys()):
            save_room_immediately(r_id)
            if r_id not in active_room_ids_with_users:
                room_states.pop(r_id, None)
                xo_games.pop(r_id, None)
                chess_games.pop(r_id, None)
                memory_games.pop(r_id, None)
                screen_shares.pop(r_id, None)
                active_rooms.pop(r_id, None)
                unloaded_rooms += 1

    if mode in ('all', 'frames'):
        for r_id, sc in list(screen_shares.items()):
            if sc.get('last_frame'):
                sc['last_frame'] = None
                cleared_frames += 1

    if mode in ('all', 'trim'):
        for r_id, st in list(room_states.items()):
            dh = st.get('draw_history', [])
            if len(dh) > 600:
                trimmed_strokes += len(dh) - 600
                st['draw_history'] = dh[-600:]
            ch = st.get('chat', [])
            if len(ch) > 50:
                st['chat'] = ch[-50:]
            save_room_immediately(r_id)

    try:
        if os.path.exists('/proc/sys/vm/drop_caches'):
            with open('/proc/sys/vm/drop_caches', 'w') as f:
                f.write('3\n')
    except Exception:
        pass

    freed_gc = trigger_os_memory_trim()
    after_metrics = collect_system_metrics()
    saved_rss = round(max(0.0, before_metrics['app_rss_mb'] - after_metrics['app_rss_mb']), 2)
    saved_sys = round(max(0.0, before_metrics['ram_used_mb'] - after_metrics['ram_used_mb']), 2)

    return jsonify({
        'ok': True,
        'unloaded_rooms': unloaded_rooms,
        'cleared_frames': cleared_frames,
        'trimmed_strokes': trimmed_strokes,
        'freed_gc_objects': freed_gc,
        'saved_rss_mb': saved_rss,
        'saved_sys_mb': saved_sys,
        'after': after_metrics
    })

@app.route('/api/admin/unload_room/<room_id>', methods=['POST'])
def admin_unload_single_room(room_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    if room_id in room_states:
        save_room_immediately(room_id)
        room_states.pop(room_id, None)
        xo_games.pop(room_id, None)
        chess_games.pop(room_id, None)
        memory_games.pop(room_id, None)
    trigger_os_memory_trim()
    return jsonify({'ok': True, 'room_id': room_id})

@app.route('/api/admin/clear_games/<room_id>', methods=['POST'])
def admin_clear_room_games(room_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    state = get_room_state(room_id)
    state['multi_widgets'] = {}
    save_room_immediately(room_id)
    users_list = get_room_users(room_id)
    live_bmedia = [compute_live_media(bm) for bm in state.get('board_media', {}).values()]
    socketio.emit('room_state', {
        'draw_history': state['draw_history'],
        'texts': list(state.get('texts', {}).values()),
        'stickies': list(state['stickies'].values()),
        'board_media': live_bmedia,
        'multi_widgets': [],
        'media': compute_live_media(state['media']),
        'media_list': state.get('media_list', [])[-30:],
        'screen_share': screen_shares.get(room_id),
        'chat': state['chat'][-50:],
        'settings': state['settings'],
        'widgets': state['widgets'],
        'users': users_list
    }, to=room_id)
    return jsonify({'ok': True})

@app.route('/api/admin/kick_user', methods=['POST'])
def admin_kick_user():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(silent=True) or {}
    sid = data.get('sid')
    reason = data.get('reason') or 'Quản trị viên đã mời bạn rời khỏi phòng.'
    if not sid or sid not in connected_users:
        return jsonify({'error': 'Người dùng không còn kết nối'}), 404
    socketio.emit('force_leave', {'msg': reason}, to=sid)
    return jsonify({'ok': True})

@app.route('/api/admin/change_password', methods=['POST'])
def admin_change_password():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(silent=True) or {}
    current_pwd = str(data.get('current_password', '')).strip()
    new_pwd = str(data.get('new_password', '')).strip()
    if not verify_admin_password(current_pwd):
        return jsonify({'error': 'Mật khẩu hiện tại không đúng!'}), 400
    if len(new_pwd) < 6:
        return jsonify({'error': 'Mật khẩu mới phải có ít nhất 6 ký tự!'}), 400
    set_new_admin_password(new_pwd)
    return jsonify({'ok': True})

@app.route('/api/admin/vacuum_db', methods=['POST'])
def admin_vacuum_db():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    for r_id in list(room_states.keys()):
        save_room_immediately(r_id)
    try:
        with db_lock:
            conn = get_db()
            conn.execute('VACUUM')
            conn.execute('PRAGMA shrink_memory')
            conn.close()
        trigger_os_memory_trim()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/backup/<room_id>')
def admin_backup_room(room_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    state = get_room_state(room_id)
    payload = {
        'backup_version': 28,
        'exported_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'room_id': room_id,
        'state': state,
        'xo_game': xo_games.get(room_id, init_xo_game()),
        'chess_game': chess_games.get(room_id, init_chess_game()),
        'memory_game': memory_games.get(room_id, init_memory_game())
    }
    buf = io.BytesIO(json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8'))
    buf.seek(0)
    filename = f"SyncSpace_Room_{room_id}_{int(time.time())}.json"
    return send_file(buf, mimetype='application/json', as_attachment=True, download_name=filename)

@app.route('/api/admin/backup_all_zip')
def admin_backup_all_zip():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    for r_id in list(room_states.keys()):
        save_room_immediately(r_id)
    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
        all_rooms_export = {}
        try:
            with db_lock:
                conn = get_db()
                rows = conn.execute('SELECT room_id, state_json, xo_json, updated_at FROM room_data').fetchall()
                conn.close()
                for row in rows:
                    rid = row['room_id']
                    try:
                        st_obj = json.loads(row['state_json'])
                    except Exception:
                        st_obj = default_room_state()
                    try:
                        xo_obj = json.loads(row['xo_json'])
                    except Exception:
                        xo_obj = init_xo_game()
                    room_dump = {
                        'backup_version': 28,
                        'room_id': rid,
                        'updated_at': row['updated_at'],
                        'state': st_obj,
                        'xo_game': xo_obj
                    }
                    all_rooms_export[rid] = room_dump
                    zf.writestr(f"rooms/{rid}.json", json.dumps(room_dump, ensure_ascii=False, indent=2))
        except Exception:
            pass
        zf.writestr("all_rooms_backup.json", json.dumps(all_rooms_export, ensure_ascii=False, indent=2))
        if os.path.exists('database/app.db'):
            try:
                zf.write('database/app.db', arcname='database/app.db')
            except Exception:
                pass
        upload_dir = os.path.join(app.root_path, 'static', 'uploads')
        if os.path.exists(upload_dir):
            for fname in os.listdir(upload_dir):
                if fname == '.gitkeep':
                    continue
                fpath = os.path.join(upload_dir, fname)
                if os.path.isfile(fpath):
                    try:
                        zf.write(fpath, arcname=f"uploads/{fname}")
                    except Exception:
                        pass
    mem_zip.seek(0)
    zip_name = f"SyncSpace_FullBackup_{time.strftime('%Y%m%d_%H%M%S')}.zip"
    return send_file(mem_zip, mimetype='application/zip', as_attachment=True, download_name=zip_name)

def restore_single_room_dict(room_id, data_obj):
    if not room_id or not isinstance(data_obj, dict):
        return False
    base = default_room_state()
    st = data_obj.get('state') if isinstance(data_obj.get('state'), dict) else data_obj
    for k, v in base.items():
        if k not in st:
            st[k] = v
    room_states[room_id] = st
    xo_games[room_id] = data_obj.get('xo_game') or st.get('xo_game') or init_xo_game()
    chess_games[room_id] = data_obj.get('chess_game') or st.get('chess_game') or init_chess_game()
    memory_games[room_id] = data_obj.get('memory_game') or st.get('memory_game') or init_memory_game()
    if room_id not in active_rooms:
        active_rooms[room_id] = {'created_at': time.time(), 'last_active': time.time()}
    save_room_immediately(room_id)
    users_list = get_room_users(room_id)
    live_bmedia = [compute_live_media(bm) for bm in st.get('board_media', {}).values()]
    socketio.emit('room_state', {
        'draw_history': st['draw_history'],
        'texts': list(st.get('texts', {}).values()),
        'stickies': list(st['stickies'].values()),
        'board_media': live_bmedia,
        'multi_widgets': list(st.get('multi_widgets', {}).values()),
        'media': compute_live_media(st['media']),
        'media_list': st.get('media_list', [])[-30:],
        'xo_game': xo_games[room_id],
        'chess_game': chess_games[room_id],
        'memory_game': memory_games[room_id],
        'dice_state': st.get('dice_state', init_dice_state()),
        'timer_state': compute_live_timer(st.get('timer_state')),
        'screen_share': screen_shares.get(room_id),
        'chat': st['chat'][-50:],
        'settings': st['settings'],
        'widgets': st['widgets'],
        'users': users_list
    }, to=room_id)
    return True

@app.route('/api/admin/restore', methods=['POST'])
def admin_restore_backup():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    target_room_override = request.form.get('room_id', '').strip()
    if 'file' not in request.files:
        return jsonify({'error': 'Chưa chọn tệp sao lưu (.json hoặc .zip)'}), 400
    f = request.files['file']
    if not f or not f.filename:
        return jsonify({'error': 'Tệp không hợp lệ'}), 400
    fname = f.filename.lower()
    restored_rooms = []
    try:
        if fname.endswith('.zip'):
            zbytes = io.BytesIO(f.read())
            upload_dir = os.path.join(app.root_path, 'static', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)
            with zipfile.ZipFile(zbytes, 'r') as zf:
                for member in zf.namelist():
                    if member.startswith('uploads/') and not member.endswith('/'):
                        base_name = os.path.basename(member)
                        if base_name:
                            with open(os.path.join(upload_dir, base_name), 'wb') as out_f:
                                out_f.write(zf.read(member))
                    elif member.startswith('rooms/') and member.endswith('.json'):
                        raw_json = json.loads(zf.read(member).decode('utf-8'))
                        rid = target_room_override or raw_json.get('room_id') or os.path.splitext(os.path.basename(member))[0]
                        if restore_single_room_dict(rid, raw_json):
                            restored_rooms.append(rid)
                if not restored_rooms and 'all_rooms_backup.json' in zf.namelist():
                    all_map = json.loads(zf.read('all_rooms_backup.json').decode('utf-8'))
                    if isinstance(all_map, dict):
                        for rid, rdata in all_map.items():
                            if restore_single_room_dict(rid, rdata):
                                restored_rooms.append(rid)
        else:
            raw_json = json.loads(f.read().decode('utf-8'))
            if isinstance(raw_json, dict) and 'state' in raw_json:
                rid = target_room_override or raw_json.get('room_id') or 'restored_room'
                if restore_single_room_dict(rid, raw_json):
                    restored_rooms.append(rid)
            elif isinstance(raw_json, dict) and 'draw_history' in raw_json:
                rid = target_room_override or 'restored_room'
                if restore_single_room_dict(rid, {'room_id': rid, 'state': raw_json}):
                    restored_rooms.append(rid)
            elif isinstance(raw_json, dict):
                for rid, rdata in raw_json.items():
                    if isinstance(rdata, dict) and restore_single_room_dict(rid, rdata):
                        restored_rooms.append(rid)
        return jsonify({'ok': True, 'restored_rooms': restored_rooms})
    except Exception as e:
        return jsonify({'error': f'Lỗi khôi phục tệp: {str(e)}'}), 400

@app.route('/api/admin/broadcast', methods=['POST'])
def admin_broadcast():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(silent=True) or request.form
    msg = str(data.get('msg', '')).strip()
    if not msg:
        return jsonify({'error': 'Thiếu nội dung thông báo'}), 400
    socketio.emit('system_broadcast', {'msg': msg, 'time': time.strftime('%H:%M')})
    return jsonify({'ok': True})

@app.route('/api/room/<room_id>/export')
def room_export_json(room_id):
    state = get_room_state(room_id)
    payload = {
        'backup_version': 28,
        'exported_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'room_id': room_id,
        'state': state,
        'xo_game': xo_games.get(room_id, init_xo_game()),
        'chess_game': chess_games.get(room_id, init_chess_game()),
        'memory_game': memory_games.get(room_id, init_memory_game())
    }
    buf = io.BytesIO(json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8'))
    buf.seek(0)
    filename = f"SyncSpace_{room_id}_{time.strftime('%Y%m%d_%H%M')}.json"
    return send_file(buf, mimetype='application/json', as_attachment=True, download_name=filename)

@app.route('/api/room/<room_id>/import', methods=['POST'])
def room_import_json(room_id):
    if 'file' not in request.files:
        return jsonify({'error': 'Chưa chọn tệp JSON'}), 400
    f = request.files['file']
    try:
        raw_json = json.loads(f.read().decode('utf-8'))
        if restore_single_room_dict(room_id, raw_json):
            return jsonify({'ok': True, 'room_id': room_id})
        return jsonify({'error': 'Định dạng JSON không hợp lệ'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Không tìm thấy tệp tải lên'}), 400
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'Chưa chọn tệp'}), 400
    upload_dir = os.path.join(app.root_path, 'static', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    orig_name = file.filename
    ext = orig_name.rsplit('.', 1)[-1].lower() if '.' in orig_name else 'bin'
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)
    guessed_mime, _ = mimetypes.guess_type(orig_name)
    content_type = file.content_type or guessed_mime or 'application/octet-stream'
    kind = detect_media_kind(orig_name, content_type)
    return jsonify({
        'url': f'/uploads/{filename}',
        'type': content_type,
        'kind': kind,
        'name': orig_name[:70]
    })

@socketio.on('ping_check')
def handle_ping_check(data):
    try:
        t_val = data.get('t', 0) if isinstance(data, dict) else 0
        emit('pong_check', {'t': t_val}, to=request.sid)
    except Exception:
        pass

@socketio.on('join_room')
def handle_join(data):
    try:
        if not isinstance(data, dict):
            return
        room_id = str(data.get('room_id', 'default')).strip()
        username = str(data.get('username', '')).strip() or 'Thành viên'
        client_id = str(data.get('client_id', '')).strip() or request.sid
        client_ip = get_client_ip()

        stale_sids = [
            sid for sid, u in list(connected_users.items())
            if u.get('room') == room_id and u.get('client_id') == client_id and sid != request.sid
        ]
        for old_sid in stale_sids:
            connected_users.pop(old_sid, None)
            emit('remove_cursor', {'sid': old_sid}, to=room_id)

        active_with_users = [r for r in active_rooms if len(get_room_users(r)) > 0]
        if room_id not in active_rooms and len(active_with_users) >= 15:
            emit('room_error', {'msg': 'Máy chủ đã đạt giới hạn phòng hoạt động cùng lúc. Vui lòng thử lại sau.'})
            return
        if room_id not in active_rooms:
            active_rooms[room_id] = {'created_at': time.time(), 'last_active': time.time()}
        else:
            active_rooms[room_id]['last_active'] = time.time()
        join_room(room_id)
        connected_users[request.sid] = {
            'sid': request.sid,
            'client_id': client_id,
            'room': room_id,
            'username': username,
            'ip': client_ip,
            'joined_at': time.time()
        }
        state = get_room_state(room_id)
        users_list = get_room_users(room_id)
        live_bmedia = [compute_live_media(bm) for bm in state.get('board_media', {}).values()]
        emit('room_state', {
            'draw_history': state['draw_history'],
            'texts': list(state.get('texts', {}).values()),
            'stickies': list(state['stickies'].values()),
            'board_media': live_bmedia,
            'multi_widgets': list(state.get('multi_widgets', {}).values()),
            'media': compute_live_media(state['media']),
            'media_list': state.get('media_list', [])[-30:],
            'xo_game': xo_games[room_id],
            'chess_game': chess_games[room_id],
            'memory_game': memory_games[room_id],
            'dice_state': state.get('dice_state', init_dice_state()),
            'timer_state': compute_live_timer(state.get('timer_state')),
            'screen_share': screen_shares.get(room_id),
            'chat': state['chat'][-50:],
            'settings': state['settings'],
            'widgets': state['widgets'],
            'users': users_list
        }, to=request.sid)
        emit('room_users', {'users': users_list, 'joined': username, 'sid': request.sid}, to=room_id)

        active_screen = screen_shares.get(room_id)
        if active_screen and active_screen.get('sid') != request.sid:
            emit('screen_viewer_joined', {'viewer_sid': request.sid, 'username': username}, to=active_screen['sid'])
            if active_screen.get('last_frame'):
                emit('screen_frame', {
                    'frame': active_screen['last_frame'],
                    'username': active_screen.get('username', 'Thành viên'),
                    'mode_label': active_screen.get('mode_label', 'Màn hình')
                }, to=request.sid)
    except Exception:
        pass

@socketio.on('update_username')
def handle_update_username(data):
    try:
        new_name = str(data.get('username', '')).strip()
        if not new_name or request.sid not in connected_users:
            return
        connected_users[request.sid]['username'] = new_name[:35]
        room_id = connected_users[request.sid]['room']
        users_list = get_room_users(room_id)
        emit('room_users', {'users': users_list, 'renamed': new_name[:35], 'sid': request.sid}, to=room_id)
    except Exception:
        pass

@socketio.on('disconnect')
def handle_disconnect():
    try:
        user_data = connected_users.pop(request.sid, None)
        if user_data:
            room_id = user_data['room']
            if room_id in screen_shares and screen_shares[room_id].get('sid') == request.sid:
                screen_shares.pop(room_id, None)
                emit('screen_share_stopped', {}, to=room_id)
            mark_room_dirty(room_id)
            users_list = get_room_users(room_id)
            emit('user_disconnected', {'sid': request.sid, 'username': user_data['username'], 'users': users_list}, to=room_id)
    except Exception:
        pass

@socketio.on('screen_share_start')
def handle_screen_share_start(data):
    try:
        room_id = data.get('room_id')
        if not room_id:
            return
        info = {
            'sid': request.sid,
            'username': data.get('username', 'Thành viên'),
            'mode': data.get('mode', 'screen'),
            'mode_label': data.get('mode_label', 'Toàn màn hình'),
            'x': data.get('x', 1960),
            'y': data.get('y', 2180),
            'w': data.get('w', 640),
            'h': data.get('h', 440),
            'last_frame': None
        }
        screen_shares[room_id] = info
        emit('screen_share_started', info, to=room_id, include_self=False)
        for sid, u in list(connected_users.items()):
            if u.get('room') == room_id and sid != request.sid:
                emit('screen_viewer_joined', {'viewer_sid': sid, 'username': u.get('username', '')}, to=request.sid)
    except Exception:
        pass

@socketio.on('screen_share_stop')
def handle_screen_share_stop(data):
    try:
        room_id = data.get('room_id')
        if not room_id:
            return
        if room_id in screen_shares and screen_shares[room_id].get('sid') == request.sid:
            screen_shares.pop(room_id, None)
        emit('screen_share_stopped', {}, to=room_id, include_self=False)
    except Exception:
        pass

@socketio.on('screen_widget_move')
def handle_screen_widget_move(data):
    try:
        room_id = data.get('room_id')
        if not room_id or room_id not in screen_shares:
            return
        for k in ('x', 'y', 'w', 'h'):
            if k in data:
                screen_shares[room_id][k] = data[k]
        emit('screen_widget_moved', data, to=room_id, include_self=False)
    except Exception:
        pass

@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    target_sid = data.get('target_sid')
    if target_sid:
        emit('webrtc_offer', {
            'from_sid': request.sid,
            'sdp': data.get('sdp'),
            'username': data.get('username', 'Thành viên'),
            'mode_label': data.get('mode_label', 'Màn hình')
        }, to=target_sid)

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    target_sid = data.get('target_sid')
    if target_sid:
        emit('webrtc_answer', {
            'from_sid': request.sid,
            'sdp': data.get('sdp')
        }, to=target_sid)

@socketio.on('webrtc_ice')
def handle_webrtc_ice(data):
    target_sid = data.get('target_sid')
    if target_sid:
        emit('webrtc_ice', {
            'from_sid': request.sid,
            'candidate': data.get('candidate')
        }, to=target_sid)

@socketio.on('screen_frame')
def handle_screen_frame(data):
    try:
        room_id = data.get('room_id')
        frame = data.get('frame')
        if not room_id or not frame:
            return
        if room_id in screen_shares:
            screen_shares[room_id]['last_frame'] = frame
        emit('screen_frame', {
            'frame': frame,
            'username': data.get('username', 'Thành viên'),
            'mode_label': data.get('mode_label', 'Màn hình')
        }, to=room_id, include_self=False)
    except Exception:
        pass

@socketio.on('mouse_move')
def handle_mouse_move(data):
    try:
        room_id = data.get('room_id')
        if not room_id:
            return
        data['sid'] = request.sid
        if request.sid in connected_users:
            data['username'] = connected_users[request.sid]['username']
        emit('mouse_update', data, to=room_id, include_self=False)
    except Exception:
        pass

@socketio.on('place_stamp')
def handle_place_stamp(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    emit('stamp_placed', data, to=room_id, include_self=False)

@socketio.on('laser_point')
def handle_laser_point(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    emit('laser_point', data, to=room_id, include_self=False)

@socketio.on('draw_live')
def handle_draw_live(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    data['sid'] = request.sid
    emit('draw_live', data, to=room_id, include_self=False)

@socketio.on('draw_segment')
def handle_draw_segment(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    emit('draw_segment', data, to=room_id, include_self=False)

@socketio.on('draw_stroke')
def handle_draw_stroke(data):
    try:
        room_id = data.get('room_id')
        stroke = data.get('stroke')
        if not room_id or not isinstance(stroke, dict):
            return
        if room_id in active_rooms:
            active_rooms[room_id]['last_active'] = time.time()
        pts = stroke.get('points')
        if isinstance(pts, list) and len(pts) > 2:
            compact_pts = [pts[0]]
            for pt in pts[1:-1]:
                prev = compact_pts[-1]
                dx = pt.get('x', 0) - prev.get('x', 0)
                dy = pt.get('y', 0) - prev.get('y', 0)
                if dx * dx + dy * dy >= 1.8:
                    compact_pts.append({'x': round(pt.get('x', 0), 1), 'y': round(pt.get('y', 0), 1)})
            compact_pts.append({'x': round(pts[-1].get('x', 0), 1), 'y': round(pts[-1].get('y', 0), 1)})
            if len(compact_pts) > 600:
                step = max(1, len(compact_pts) // 600)
                compact_pts = compact_pts[::step] + [compact_pts[-1]]
            stroke['points'] = compact_pts
        stroke.pop('_bbox', None)
        state = get_room_state(room_id)
        state['draw_history'].append(stroke)
        if len(state['draw_history']) > 1200:
            state['draw_history'] = state['draw_history'][-1200:]
        mark_room_dirty(room_id)
        stroke['sid'] = request.sid
        emit('draw_stroke', stroke, to=room_id, include_self=False)
    except Exception:
        pass

@socketio.on('delete_stroke')
def handle_delete_stroke(data):
    try:
        room_id = data.get('room_id')
        stroke_id = data.get('stroke_id')
        if not room_id or not stroke_id:
            return
        state = get_room_state(room_id)
        before_len = len(state['draw_history'])
        state['draw_history'] = [s for s in state['draw_history'] if s.get('id') != stroke_id]
        if len(state['draw_history']) != before_len:
            mark_room_dirty(room_id)
            emit('stroke_deleted', {'stroke_id': stroke_id, 'stroke_ids': [stroke_id]}, to=room_id, include_self=False)
    except Exception:
        pass

@socketio.on('delete_strokes_batch')
def handle_delete_strokes_batch(data):
    try:
        room_id = data.get('room_id')
        stroke_ids = data.get('stroke_ids')
        if not room_id or not isinstance(stroke_ids, list) or not stroke_ids:
            return
        id_set = set(stroke_ids)
        state = get_room_state(room_id)
        before_len = len(state['draw_history'])
        state['draw_history'] = [s for s in state['draw_history'] if s.get('id') not in id_set]
        if len(state['draw_history']) != before_len:
            mark_room_dirty(room_id)
            emit('stroke_deleted', {'stroke_ids': list(id_set)}, to=room_id, include_self=False)
    except Exception:
        pass

@socketio.on('undo_stroke')
def handle_undo_stroke(data):
    try:
        room_id = data.get('room_id')
        if not room_id:
            return
        client_id = data.get('client_id')
        username = data.get('username')
        state = get_room_state(room_id)
        history = state['draw_history']
        if not history:
            return
        target_idx = -1
        for i in range(len(history) - 1, -1, -1):
            st = history[i]
            if (client_id and st.get('owner_id') == client_id) or (username and st.get('owner') == username):
                target_idx = i
                break
        if target_idx == -1 and not client_id and not username:
            target_idx = len(history) - 1
        if target_idx != -1:
            removed = history.pop(target_idx)
            mark_room_dirty(room_id)
            if removed and removed.get('id'):
                emit('stroke_deleted', {'stroke_ids': [removed['id']]}, to=room_id)
            else:
                emit('board_sync', {'draw_history': history}, to=room_id)
    except Exception:
        pass

@socketio.on('clear_board')
def handle_clear(data):
    try:
        room_id = data.get('room_id')
        if not room_id:
            return
        client_id = data.get('client_id')
        username = data.get('username')
        state = get_room_state(room_id)

        def belongs_to_sender(item):
            if client_id and item.get('owner_id') == client_id:
                return True
            if username and item.get('owner') == username:
                return True
            return False

        state['draw_history'] = [s for s in state['draw_history'] if not belongs_to_sender(s)]
        if 'texts' in state and isinstance(state['texts'], dict):
            state['texts'] = {tid: tbox for tid, tbox in state['texts'].items() if not belongs_to_sender(tbox)}
        mark_room_dirty(room_id)
        emit('board_sync', {
            'draw_history': state['draw_history'],
            'texts': list(state.get('texts', {}).values())
        }, to=room_id)
    except Exception:
        pass

@socketio.on('new_text_box')
def handle_new_text_box(data):
    room_id = data.get('room_id')
    if not room_id or 'id' not in data:
        return
    state = get_room_state(room_id)
    if 'texts' not in state:
        state['texts'] = {}
    state['texts'][data['id']] = data
    mark_room_dirty(room_id)
    emit('text_box_added', data, to=room_id, include_self=False)

@socketio.on('update_text_box')
def handle_update_text_box(data):
    room_id = data.get('room_id')
    tid = data.get('id')
    if not room_id or not tid:
        return
    state = get_room_state(room_id)
    if 'texts' not in state:
        state['texts'] = {}
    if tid not in state['texts']:
        state['texts'][tid] = data
    else:
        for k in ('x', 'y', 'w', 'h', 'text', 'color', 'fontSize', 'owner', 'owner_id'):
            if k in data:
                state['texts'][tid][k] = data[k]
    mark_room_dirty(room_id)
    emit('text_box_updated', data, to=room_id, include_self=False)

@socketio.on('delete_text_box')
def handle_delete_text_box(data):
    room_id = data.get('room_id')
    tid = data.get('id')
    if not room_id or not tid:
        return
    state = get_room_state(room_id)
    if 'texts' in state and tid in state['texts']:
        del state['texts'][tid]
        mark_room_dirty(room_id)
    emit('text_box_deleted', {'id': tid}, to=room_id, include_self=False)

@socketio.on('widget_state')
def handle_widget_state(data):
    room_id = data.get('room_id')
    w_name = data.get('widget')
    if not room_id or w_name not in ('xo', 'chess', 'memory', 'dice', 'timer', 'media'):
        return
    state = get_room_state(room_id)
    w_info = state['widgets'].get(w_name, {})
    for k in ('x', 'y', 'w', 'h'):
        if k in data and isinstance(data[k], (int, float)):
            w_info[k] = data[k]
    if 'open' in data:
        w_info['open'] = bool(data['open'])
    if 'minimized' in data:
        w_info['minimized'] = bool(data['minimized'])
    state['widgets'][w_name] = w_info
    mark_room_dirty(room_id)
    emit('widget_updated', {'widget': w_name, 'state': w_info}, to=room_id, include_self=False)

@socketio.on('multi_widget_event')
def handle_multi_widget_event(data):
    try:
        room_id = data.get('room_id')
        action = data.get('action')
        if not room_id or not action:
            return
        state = get_room_state(room_id)
        if 'multi_widgets' not in state or not isinstance(state['multi_widgets'], dict):
            state['multi_widgets'] = {}
        mw_map = state['multi_widgets']
        sender_id = str(data.get('client_id') or '').strip()
        sender_name = str(data.get('username') or '').strip()

        def is_member_authorized(w_obj):
            if not isinstance(w_obj, dict):
                return True
            c_id = str(w_obj.get('creator_id') or '').strip()
            c_name = str(w_obj.get('creator') or '').strip()
            if (sender_id and c_id and sender_id == c_id) or (sender_name and c_name and sender_name == c_name):
                return True
            gd = w_obj.get('game_data') or {}
            if not isinstance(gd, dict):
                return True
            active_humans = 0
            if isinstance(gd.get('seats'), list):
                for s in gd['seats']:
                    if isinstance(s, dict) and s.get('occupantId') and not s.get('isBot'):
                        active_humans += 1
                        if (sender_id and s.get('occupantId') == sender_id) or (sender_name and s.get('occupantName') == sender_name):
                            return True
            elif isinstance(gd.get('seats'), dict):
                for s in gd['seats'].values():
                    if isinstance(s, dict) and s.get('type') == 'human' and (s.get('id') or s.get('name')):
                        active_humans += 1
                        if (sender_id and s.get('id') == sender_id) or (sender_name and s.get('name') == sender_name):
                            return True
            if isinstance(gd.get('players'), list):
                for p in gd['players']:
                    if isinstance(p, dict) and not p.get('isBot'):
                        active_humans += 1
                        if (sender_id and p.get('id') == sender_id) or (sender_name and p.get('name') == sender_name):
                            return True
            elif isinstance(gd.get('players'), dict):
                for p in gd['players'].values():
                    if isinstance(p, dict):
                        active_humans += 1
                        if (sender_id and p.get('id') == sender_id) or (sender_name and p.get('name') == sender_name):
                            return True
                    elif isinstance(p, str) and p:
                        active_humans += 1
                        if sender_name and p == sender_name:
                            return True
            if isinstance(gd.get('snakes'), dict):
                for sk in gd['snakes'].values():
                    if isinstance(sk, dict) and not sk.get('isBot'):
                        active_humans += 1
                        if (sender_id and sk.get('id') == sender_id) or (sender_name and sk.get('name') == sender_name):
                            return True
            return active_humans == 0 and not c_id and not c_name

        if action == 'create':
            w_obj = data.get('widget')
            if not isinstance(w_obj, dict) or 'id' not in w_obj:
                return
            if sender_id and not w_obj.get('creator_id'):
                w_obj['creator_id'] = sender_id
            if sender_name and not w_obj.get('creator'):
                w_obj['creator'] = sender_name
            mw_map[w_obj['id']] = w_obj
            mark_room_dirty(room_id)
            emit('multi_widget_synced', {'action': 'create', 'widget': w_obj}, to=room_id)
        elif action == 'update':
            wid = data.get('id')
            if not wid or wid not in mw_map:
                if isinstance(data.get('widget'), dict) and 'id' in data['widget']:
                    wid = data['widget']['id']
                    mw_map[wid] = data['widget']
                else:
                    return
            target = mw_map[wid]
            if data.get('is_reset') and not is_member_authorized(target):
                return
            for k in ('x', 'y', 'w', 'h', 'minimized', 'title', 'game_data'):
                if k in data:
                    target[k] = data[k]
            mark_room_dirty(room_id)
            include_self = bool(data.get('echo', False))
            emit('multi_widget_synced', {
                'action': 'update',
                'id': wid,
                'widget': target,
                'anim': data.get('anim')
            }, to=room_id, include_self=include_self)
        elif action == 'delete':
            wid = data.get('id')
            if wid and wid in mw_map:
                if (sender_id or sender_name) and not is_member_authorized(mw_map[wid]):
                    return
                del mw_map[wid]
                mark_room_dirty(room_id)
            emit('multi_widget_synced', {'action': 'delete', 'id': wid}, to=room_id)
    except Exception:
        pass

@socketio.on('dice_roll')
def handle_dice_roll(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    state = get_room_state(room_id)
    count = max(1, min(3, int(data.get('count', 2))))
    roller = data.get('username', 'Thành viên')
    values = [random.randint(1, 6) for _ in range(count)]
    total = sum(values)
    dice_st = state.get('dice_state') or init_dice_state()
    dice_st['count'] = count
    dice_st['values'] = values
    dice_st['total'] = total
    dice_st['roller'] = roller
    entry = f"{roller}: {' + '.join(str(v) for v in values)} = {total}"
    hist = dice_st.get('history', [])
    hist.append(entry)
    dice_st['history'] = hist[-10:]
    state['dice_state'] = dice_st
    state['widgets']['dice']['open'] = True
    mark_room_dirty(room_id)
    emit('dice_rolled', {'dice_state': dice_st, 'widget_state': state['widgets']['dice']}, to=room_id)

@socketio.on('timer_control')
def handle_timer_control(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    state = get_room_state(room_id)
    t_st = state.get('timer_state') or init_timer_state()
    action = data.get('action', 'start')
    sender = data.get('username', 'Thành viên')
    now = time.time()

    if action == 'set':
        sec = max(10, min(7200, int(data.get('seconds', 300))))
        t_st['duration'] = sec
        t_st['remaining'] = sec
        t_st['running'] = False
        t_st['updated_at'] = now
        t_st['starter'] = sender
    elif action == 'start':
        if 'seconds' in data:
            sec = max(10, min(7200, int(data.get('seconds', 300))))
            t_st['duration'] = sec
            t_st['remaining'] = sec
        elif t_st.get('remaining', 0) <= 0:
            t_st['remaining'] = t_st.get('duration', 300)
        t_st['running'] = True
        t_st['updated_at'] = now
        t_st['starter'] = sender
        state['widgets']['timer']['open'] = True
    elif action == 'pause':
        live_t = compute_live_timer(t_st)
        t_st['remaining'] = live_t.get('live_remaining', 0)
        t_st['running'] = False
        t_st['updated_at'] = now
    elif action == 'reset':
        t_st['remaining'] = t_st.get('duration', 300)
        t_st['running'] = False
        t_st['updated_at'] = now

    state['timer_state'] = t_st
    mark_room_dirty(room_id)
    emit('timer_updated', {
        'timer_state': compute_live_timer(t_st),
        'action': action,
        'sender': sender
    }, to=room_id)

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
        for k in ('x', 'y', 'w', 'h', 'fontSize', 'locked'):
            if k in data:
                state['stickies'][data['id']][k] = data[k]
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
    data['playing'] = True
    data['position'] = 0.0
    data['updated_at'] = time.time()
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
        for k in ('x', 'y', 'w', 'h'):
            if k in data:
                bm[data['id']][k] = data[k]
        mark_room_dirty(room_id)
    emit('board_media_moved', data, to=room_id, include_self=False)

@socketio.on('board_media_playback_sync')
def handle_board_media_playback_sync(data):
    room_id = data.get('room_id')
    card_id = data.get('id')
    if not room_id or not card_id:
        return
    state = get_room_state(room_id)
    bm = state.get('board_media', {}).get(card_id)
    if not bm:
        return
    action = data.get('action', 'play')
    pos = max(0.0, float(data.get('currentTime', 0.0)))
    bm['playing'] = (action == 'play')
    bm['position'] = pos
    bm['updated_at'] = time.time()
    mark_room_dirty(room_id)
    emit('board_media_playback_sync', {
        'id': card_id,
        'action': action,
        'currentTime': pos,
        'playing': bm['playing']
    }, to=room_id, include_self=False)

@socketio.on('request_board_media_sync')
def handle_request_board_media_sync(data):
    room_id = data.get('room_id')
    card_id = data.get('id')
    if not room_id or not card_id:
        return
    state = get_room_state(room_id)
    bm = state.get('board_media', {}).get(card_id)
    if bm:
        live_bm = compute_live_media(bm)
        emit('board_media_playback_sync', {
            'id': card_id,
            'action': 'play' if live_bm.get('playing') else 'pause',
            'currentTime': live_bm.get('current_pos', 0.0),
            'playing': live_bm.get('playing', False),
            'force': True
        }, to=request.sid)

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
    socketio.emit('xo_update', {'game': xo_games[room_id], 'notice': 'Bàn cờ Caro đã được làm mới!'}, to=room_id)

@socketio.on('chess_move')
def handle_chess_move(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    get_room_state(room_id)
    game = chess_games[room_id]
    username = data.get('username', 'Thành viên')
    moved_color = data.get('color', 'w')
    other_color = 'b' if moved_color == 'w' else 'w'
    if game['players'].get(moved_color) is None:
        if game['players'].get(other_color) != username or len(get_room_users(room_id)) <= 1:
            game['players'][moved_color] = username
    game['fen'] = data.get('fen', game['fen'])
    game['turn'] = data.get('turn', other_color)
    game['last_move'] = data.get('last_move')
    if data.get('san'):
        game['history'].append(data['san'])
        game['history'] = game['history'][-60:]
    game['status'] = data.get('status', 'playing')
    game['winner_text'] = data.get('winner_text', '')
    mark_room_dirty(room_id)
    emit('chess_update', {'game': game, 'notice': data.get('notice', '')}, to=room_id)

@socketio.on('chess_reset')
def handle_chess_reset(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    get_room_state(room_id)
    chess_games[room_id] = init_chess_game()
    mark_room_dirty(room_id)
    emit('chess_update', {'game': chess_games[room_id], 'notice': 'Ván Cờ Vua mới đã bắt đầu!'}, to=room_id)

@socketio.on('memory_flip')
def handle_memory_flip(data):
    room_id = data.get('room_id')
    idx = int(data.get('index', -1))
    username = data.get('username', 'Thành viên')
    if not room_id or idx < 0 or idx >= 16:
        return
    get_room_state(room_id)
    game = memory_games[room_id]
    if idx in game['matched'] or idx in game['flipped'] or len(game['flipped']) >= 2:
        return
    game['flipped'].append(idx)
    game['turn_user'] = username
    if len(game['flipped']) == 2:
        i1, i2 = game['flipped'][0], game['flipped'][1]
        if game['cards'][i1] == game['cards'][i2]:
            game['matched'].extend([i1, i2])
            game['flipped'] = []
            game['scores'][username] = game['scores'].get(username, 0) + 1
            mark_room_dirty(room_id)
            emit('memory_update', {'game': game, 'notice': f'🎯 {username} đã ghép đúng cặp {game["cards"][i1]}!'}, to=room_id)
        else:
            emit('memory_update', {'game': game, 'notice': f'{username} đang lật thẻ...'}, to=room_id)
            def hide_unmatched(rid, g_ref):
                time.sleep(0.9)
                g_ref['flipped'] = []
                socketio.emit('memory_update', {'game': g_ref}, to=rid)
            threading.Thread(target=hide_unmatched, args=(room_id, game), daemon=True).start()
    else:
        emit('memory_update', {'game': game}, to=room_id)

@socketio.on('memory_reset')
def handle_memory_reset(data):
    room_id = data.get('room_id')
    if not room_id:
        return
    get_room_state(room_id)
    memory_games[room_id] = init_memory_game()
    mark_room_dirty(room_id)
    emit('memory_update', {'game': memory_games[room_id], 'notice': 'Đã xáo bài mới!'}, to=room_id)

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
        'use_proxy': bool(data.get('use_proxy', False)),
        'name': data.get('name') or ('YouTube Video' if data.get('type') == 'youtube' else 'Trang Web / Tài liệu'),
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
    if isinstance(data.get('x'), (int, float)) and isinstance(data.get('y'), (int, float)):
        state['widgets']['media']['x'] = data['x']
        state['widgets']['media']['y'] = data['y']
    state['widgets']['media']['open'] = True
    state['widgets']['media']['minimized'] = False
    mark_room_dirty(room_id)
    emit('media_shared', {'media': item, 'media_list': state['media_list'][-30:], 'widget_state': state['widgets']['media']}, to=room_id)

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

@socketio.on('html_coop_event')
def handle_html_coop_event(data):
    try:
        room_id = data.get('room_id')
        if not room_id:
            return
        emit('html_coop_event', data, to=room_id, include_self=False)
    except Exception:
        pass

@socketio.on('voice_status')
def handle_voice_status(data):
    try:
        room_id = data.get('room_id')
        if not room_id:
            return
        active = bool(data.get('active', False))
        if request.sid in connected_users:
            connected_users[request.sid]['voice'] = active
        emit('voice_status_updated', {
            'sid': request.sid,
            'username': data.get('username', 'Thành viên'),
            'active': active,
            'speaking': bool(data.get('speaking', False))
        }, to=room_id, include_self=False)
        if active:
            for sid, u in list(connected_users.items()):
                if u.get('room') == room_id and sid != request.sid:
                    emit('voice_peer_ready', {'peer_sid': sid, 'username': u.get('username', '')}, to=request.sid)
    except Exception:
        pass

@socketio.on('voice_webrtc_signal')
def handle_voice_webrtc_signal(data):
    try:
        target_sid = data.get('target_sid')
        if not target_sid:
            return
        emit('voice_webrtc_signal', {
            'from_sid': request.sid,
            'username': data.get('username', 'Thành viên'),
            'type': data.get('type'),
            'sdp': data.get('sdp'),
            'candidate': data.get('candidate')
        }, to=target_sid)
    except Exception:
        pass

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
