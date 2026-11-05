import os
import re
import json
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
from flask import Flask, render_template, request, session, redirect, url_for, jsonify, send_from_directory, Response
from flask_socketio import SocketIO, join_room, emit
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
        conn.commit()
        conn.close()

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
    disk_percent = 0.0
    disk_used_gb = 0.0
    disk_total_gb = 0.0

    if psutil:
        try:
            cpu_percent = round(psutil.cpu_percent(interval=None), 1)
            vm = psutil.virtual_memory()
            ram_percent = round(vm.percent, 1)
            ram_used_mb = round((vm.total - vm.available) / (1024 * 1024), 1)
            ram_total_mb = round(vm.total / (1024 * 1024), 1)
        except Exception:
            pass
    else:
        try:
            cpu_percent = min(100.0, round((load_avg[0] / max(1, cpu_cores)) * 100.0, 1))
            if os.path.exists('/proc/meminfo'):
                mem_info = {}
                with open('/proc/meminfo', 'r') as f:
                    for line in f:
                        parts = line.split(':')
                        if len(parts) == 2:
                            k = parts[0].strip()
                            v = int(parts[1].strip().split()[0])
                            mem_info[k] = v
                total_kb = mem_info.get('MemTotal', 0)
                avail_kb = mem_info.get('MemAvailable', mem_info.get('MemFree', 0))
                if total_kb > 0:
                    used_kb = total_kb - avail_kb
                    ram_total_mb = round(total_kb / 1024.0, 1)
                    ram_used_mb = round(used_kb / 1024.0, 1)
                    ram_percent = round((used_kb / total_kb) * 100.0, 1)
        except Exception:
            pass

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

    return {
        'cpu_percent': cpu_percent,
        'cpu_cores': cpu_cores,
        'load_avg': load_avg,
        'ram_percent': ram_percent,
        'ram_used_mb': ram_used_mb,
        'ram_total_mb': ram_total_mb,
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

def default_room_state():
    return {
        'draw_history': [],
        'texts': {},
        'stickies': {},
        'board_media': {},
        'media': None,
        'media_list': [],
        'chat': [],
        'settings': {'bg': 'bg-light-dots'},
        'chess_game': init_chess_game(),
        'memory_game': init_memory_game(),
        'widgets': {
            'xo': {'x': 2520, 'y': 2220, 'w': 500, 'h': 560, 'open': False, 'minimized': False},
            'chess': {'x': 2380, 'y': 2180, 'w': 480, 'h': 580, 'open': False, 'minimized': False},
            'memory': {'x': 2450, 'y': 2250, 'w': 380, 'h': 440, 'open': False, 'minimized': False},
            'media': {'x': 1920, 'y': 2220, 'w': 580, 'h': 440, 'open': False, 'minimized': False}
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

def flush_dirty_rooms():
    last_gc_time = time.time()
    while True:
        time.sleep(2.5)
        now = time.time()
        if dirty_rooms:
            to_save = list(dirty_rooms)
            dirty_rooms.clear()
            for room_id in to_save:
                if room_id not in room_states:
                    continue
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
                            (room_id, state_str, xo_str, now)
                        )
                        conn.commit()
                        conn.close()
                except Exception:
                    pass

        if now - last_gc_time > 60.0:
            last_gc_time = now
            try:
                active_room_ids_with_users = {u.get('room') for u in list(connected_users.values()) if u.get('room')}
                for r_id in list(room_states.keys()):
                    if r_id not in active_room_ids_with_users and r_id not in dirty_rooms:
                        info = active_rooms.get(r_id, {})
                        last_active = info.get('last_active', info.get('created_at', 0))
                        if now - last_active > 600.0:
                            save_room_immediately(r_id)
                            room_states.pop(r_id, None)
                            xo_games.pop(r_id, None)
                            chess_games.pop(r_id, None)
                            memory_games.pop(r_id, None)
                            screen_shares.pop(r_id, None)
                            active_rooms.pop(r_id, None)
            except Exception:
                pass

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
    return response

@app.before_request
def check_bans():
    if request.path.startswith('/static/') or request.path.startswith('/uploads/') or request.path.startswith('/secret-admin') or request.path.startswith('/admin-dashboard') or request.path.startswith('/api/admin'):
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

@app.route('/web-proxy')
def web_proxy():
    target_url = request.args.get('url', '').strip()
    if not target_url:
        return "Thiếu địa chỉ URL", 400
    if not target_url.startswith('http://') and not target_url.startswith('https://'):
        target_url = 'https://' + target_url
    parsed = urllib.parse.urlparse(target_url)
    host = (parsed.hostname or '').lower()
    if not host or host in ('localhost', '127.0.0.1', '0.0.0.0') or host.startswith('192.168.') or host.startswith('10.') or host.startswith('172.'):
        return "URL nội bộ không được phép truy cập qua Proxy.", 403
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(
            target_url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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
                html_str = re.sub(r'<meta[^>]*http-equiv=["\']?(?:Content-Security-Policy|X-Frame-Options)["\']?[^>]*>', '', html_str, flags=re.I)
                base_url = f"{final_parsed.scheme}://{final_parsed.netloc}/"
                helper_script = f"""<base href="{base_url}"><script>
                document.addEventListener('click', function(e) {{
                    var a = e.target.closest('a');
                    if (a && a.href && /^https?:\\/\\//i.test(a.href) && a.target !== '_blank') {{
                        e.preventDefault();
                        window.location.href = '/web-proxy?url=' + encodeURIComponent(a.href);
                    }}
                }}, true);
                document.addEventListener('submit', function(e) {{
                    var f = e.target;
                    if (f && (!f.method || f.method.toUpperCase() === 'GET') && f.action) {{
                        e.preventDefault();
                        var u = new URL(f.action, '{base_url}');
                        var fd = new FormData(f);
                        fd.forEach(function(v, k) {{ u.searchParams.set(k, v); }});
                        window.location.href = '/web-proxy?url=' + encodeURIComponent(u.toString());
                    }}
                }}, true);
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
        <h3>🌐 Trang web yêu cầu xác thực trình duyệt trực tiếp</h3>
        <p style="font-size:13px; color:#aaa;">Trang <b>{target_url}</b> chặn kết nối tự động hoặc yêu cầu đăng nhập tài khoản cá nhân.</p>
        <p style="font-size:13px; color:#55efc4;">💡 Mẹo: Bạn hãy nhấn nút <b>"📡 Chiếu Tab Đăng Nhập"</b> trên thanh công cụ khung Web để mở trang này và phát trực tiếp màn hình đã đăng nhập cho cả phòng cùng xem!</p>
        <a class="btn" href="{target_url}" target="_blank">↗ Mở trang này ở Tab mới</a>
        </div></body></html>"""
        return Response(fallback_html, mimetype='text/html')

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
    return render_template('admin_dashboard.html')

@app.route('/api/admin/stats')
def admin_stats_api():
    if not session.get('is_admin'):
        return jsonify({'error': 'Unauthorized'}), 403

    all_room_ids = set(active_rooms.keys()) | set(room_states.keys())
    try:
        with db_lock:
            conn = get_db()
            rows = conn.execute('SELECT room_id FROM room_data').fetchall()
            banned_rows = conn.execute('SELECT ip FROM banned_ips').fetchall()
            conn.close()
            for r in rows:
                all_room_ids.add(r['room_id'])
            banned_ips = [r['ip'] for r in banned_rows]
    except Exception:
        banned_ips = []

    rooms_detail = []
    for r_id in sorted(all_room_ids):
        st = get_room_state(r_id)
        users_in = get_room_users(r_id)
        sc = screen_shares.get(r_id)
        rooms_detail.append({
            'room_id': r_id,
            'user_count': len(users_in),
            'users': users_in,
            'strokes': len(st.get('draw_history', [])),
            'texts': len(st.get('texts', {})),
            'stickies': len(st.get('stickies', {})),
            'media_count': len(st.get('media_list', [])) + len(st.get('board_media', {})),
            'chat_count': len(st.get('chat', [])),
            'screen_sharing': f"{sc.get('username')} ({sc.get('mode_label')})" if sc else None
        })

    rooms_detail.sort(key=lambda x: (x['user_count'], x['strokes']), reverse=True)

    live_users = []
    for sid, u in list(connected_users.items()):
        live_users.append({
            'sid': sid,
            'username': u.get('username', 'Thành viên'),
            'room': u.get('room', ''),
            'ip': u.get('ip', 'Unknown'),
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
    upload_dir = os.path.join(app.root_path, 'static', 'uploads')
    removed_count = 0
    if os.path.exists(upload_dir):
        for fname in os.listdir(upload_dir):
            if fname == '.gitkeep':
                continue
            if fname not in used_files:
                try:
                    os.remove(os.path.join(upload_dir, fname))
                    removed_count += 1
                except Exception:
                    pass
    return jsonify({'ok': True, 'removed': removed_count})

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
            active_rooms[room_id] = {'created_at': time.time()}
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
            'media': compute_live_media(state['media']),
            'media_list': state.get('media_list', [])[-30:],
            'xo_game': xo_games[room_id],
            'chess_game': chess_games[room_id],
            'memory_game': memory_games[room_id],
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
    if not room_id or w_name not in ('xo', 'chess', 'memory', 'media'):
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

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
