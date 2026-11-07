import os
import re
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES_DIR = os.path.join(PROJECT_ROOT, 'static', 'games')
CSS_MODULES_DIR = os.path.join(PROJECT_ROOT, 'static', 'css', 'modules')

GAME_MODULES = {
    'uno': {
        'title': 'Bài UNO Nhiều Người',
        'css_prefixes': ['.uno-'],
        'js_patterns': [r'uno', r'UNO']
    },
    'noitu': {
        'title': 'Nối Từ Tiếng Việt',
        'css_prefixes': ['.noitu-'],
        'js_patterns': [r'noitu', r'NoiTu', r'Nối Từ']
    },
    'ludo': {
        'title': 'Cờ Cá Ngựa 3D',
        'css_prefixes': ['.ludo-', '.cube-'],
        'js_patterns': [r'ludo', r'Ludo', r'Cá Ngựa', r'build3DCubeHtml']
    },
    'chess': {
        'title': 'Cờ Vua Quốc Tế',
        'css_prefixes': ['.chess-', '.promo-'],
        'js_patterns': [r'chess', r'Chess', r'PIECE_SVG']
    },
    'xo': {
        'title': 'Cờ Caro XO',
        'css_prefixes': ['.xo-'],
        'js_patterns': [r'xo_', r'xo-', r'checkLocalXoWin', r'Caro']
    },
    'memory': {
        'title': 'Lật Thẻ Trí Nhớ',
        'css_prefixes': ['.memory-'],
        'js_patterns': [r'memory', r'Memory', r'Trí Nhớ']
    },
    'dice': {
        'title': 'Xúc Xắc 3D',
        'css_prefixes': ['.dice-'],
        'js_patterns': [r'dice', r'Dice', r'Xúc Xắc']
    },
    'timer': {
        'title': 'Đồng Hồ Pomodoro',
        'css_prefixes': ['.timer-'],
        'js_patterns': [r'timer', r'Timer', r'Pomodoro', r'formatTimerMMSS']
    },
    'fishing': {
        'title': 'Bắn Cá Đại Dương 8 Người',
        'css_prefixes': ['.fish-', '.fishing-', '.mod-fishing-'],
        'js_patterns': [r'fishing', r'FISH_SPECIES']
    }
}

CSS_UI_GROUPS = {
    'backgrounds.css': ['#dynamic-bg', '.bg-', '.cosmos-', '@keyframes cosmos', '@keyframes galaxy', '@keyframes blackhole', '@keyframes gradientAurora'],
    'toolbar.css': ['.top-bar', '.bottom-dock', '.scroll-', '.info-pill', '.toolbar', '.group-trigger', '.tool-popover', '.popover-', '.sub-tool', '.sub-shape', '.stamp-', '.floating-stamp', '.style-', '#color-picker', '.qcolor', '.dock-btn', '.fab-btn', '.bottom-status', '.zoom-'],
    'widgets.css': ['.widget-', '.board-widget', '.floating-widget', '.board-text-box', '.tbox-', '.text-box-', '.sticky-', '.scolor', '.cursor', '.local-touch-badge', '.screen-'],
    'media_chat.css': ['.board-media-', '.media-', '.audio-', '.unlock-audio', '.doc-', '.excel-', '.word-', '.text-doc-', '.html-preview', '.chat-', '.name-modal', '#toast-', '.toast-']
}

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def extract_css_for_prefixes(css_text, prefixes):
    extracted = []
    lines = css_text.splitlines()
    capturing_block = False
    brace_depth = 0
    block_buffer = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if capturing_block:
            block_buffer.append(line)
            brace_depth += line.count('{') - line.count('}')
            if brace_depth <= 0:
                extracted.append('\n'.join(block_buffer))
                capturing_block = False
                block_buffer = []
            continue

        if any(p in stripped for p in prefixes):
            open_cnt = line.count('{')
            close_cnt = line.count('}')
            if open_cnt > close_cnt:
                capturing_block = True
                brace_depth = open_cnt - close_cnt
                block_buffer = [line]
            else:
                extracted.append(line)
    return '\n'.join(extracted)

def split_css_modules():
    style_path = os.path.join(PROJECT_ROOT, 'static', 'css', 'style.css')
    if not os.path.exists(style_path):
        return {}, {}
    with open(style_path, 'r', encoding='utf-8') as f:
        css_content = f.read()

    game_css_report = {}
    for game_key, meta in GAME_MODULES.items():
        g_dir = os.path.join(GAMES_DIR, game_key)
        ensure_dir(g_dir)
        css_out_path = os.path.join(g_dir, f'{game_key}.css')
        if game_key == 'fishing' and os.path.exists(css_out_path):
            with open(css_out_path, 'r', encoding='utf-8') as rf:
                game_css_report[game_key] = len(rf.read().splitlines())
            continue
        matched_css = extract_css_for_prefixes(css_content, meta['css_prefixes'])
        if matched_css:
            with open(css_out_path, 'w', encoding='utf-8') as out_f:
                out_f.write(matched_css + '\n')
            game_css_report[game_key] = len(matched_css.splitlines())

    ensure_dir(CSS_MODULES_DIR)
    ui_css_report = {}
    for file_name, prefixes in CSS_UI_GROUPS.items():
        matched = extract_css_for_prefixes(css_content, prefixes)
        out_file = os.path.join(CSS_MODULES_DIR, file_name)
        with open(out_file, 'w', encoding='utf-8') as out_f:
            out_f.write(matched + '\n')
        ui_css_report[file_name] = len(matched.splitlines())

    return game_css_report, ui_css_report

def parse_top_level_js_blocks(js_text):
    lines = js_text.splitlines()
    blocks = []
    current_block = []
    brace_depth = 0

    for line in lines:
        current_block.append(line)
        cleaned = re.sub(r'(["\'])(?:(?=(\\?))\2.)*?\1', '', line)
        brace_depth += cleaned.count('{') - cleaned.count('}')
        if brace_depth <= 0 and len(current_block) >= 1:
            joined = '\n'.join(current_block).strip()
            if joined:
                blocks.append(joined)
            current_block = []
            brace_depth = 0

    if current_block:
        joined = '\n'.join(current_block).strip()
        if joined:
            blocks.append(joined)
    return blocks

def split_js_game_modules():
    xo_js_path = os.path.join(PROJECT_ROOT, 'static', 'js', 'xo.js')
    if not os.path.exists(xo_js_path):
        return {}
    with open(xo_js_path, 'r', encoding='utf-8') as f:
        js_content = f.read()

    blocks = parse_top_level_js_blocks(js_content)
    js_report = {}

    for game_key, meta in GAME_MODULES.items():
        g_dir = os.path.join(GAMES_DIR, game_key)
        ensure_dir(g_dir)
        js_out_path = os.path.join(g_dir, f'{game_key}.js')

        if game_key == 'fishing' and os.path.exists(js_out_path):
            with open(js_out_path, 'r', encoding='utf-8') as rf:
                js_report[game_key] = len(rf.read().splitlines())
            continue

        matched_blocks = []
        for blk in blocks:
            if any(re.search(pat, blk) for pat in meta['js_patterns']):
                matched_blocks.append(blk)

        if matched_blocks:
            header = f"// Module Tro Choi: {meta['title']} ({game_key})\n"
            body = '\n\n'.join(matched_blocks) + '\n'
            with open(js_out_path, 'w', encoding='utf-8') as out_f:
                out_f.write(header + body)
            js_report[game_key] = len((header + body).splitlines())
        else:
            js_report[game_key] = 0

    return js_report

def generate_game_templates():
    for game_key, meta in GAME_MODULES.items():
        g_dir = os.path.join(GAMES_DIR, game_key)
        ensure_dir(g_dir)
        html_path = os.path.join(g_dir, f'{game_key}.html')
        if not os.path.exists(html_path):
            tpl = (
                f'<div class="modular-game-root {game_key}-module-root" data-game="{game_key}">\n'
                f'  <div class="modular-game-stage" id="{game_key}-stage-{{{{id}}}}"></div>\n'
                f'</div>\n'
            )
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(tpl)

def generate_manifest(css_report, js_report, ui_css_report):
    manifest = {
        'version': 31,
        'games': {},
        'css_modules': ui_css_report
    }
    for game_key, meta in GAME_MODULES.items():
        g_dir = os.path.join(GAMES_DIR, game_key)
        js_file = os.path.join(g_dir, f'{game_key}.js')
        css_file = os.path.join(g_dir, f'{game_key}.css')
        html_file = os.path.join(g_dir, f'{game_key}.html')
        manifest['games'][game_key] = {
            'title': meta['title'],
            'html': f'/static/games/{game_key}/{game_key}.html',
            'css': f'/static/games/{game_key}/{game_key}.css',
            'js': f'/static/games/{game_key}/{game_key}.js',
            'css_lines': css_report.get(game_key, 0),
            'js_lines': js_report.get(game_key, 0),
            'ready': os.path.exists(js_file) and os.path.exists(css_file) and os.path.exists(html_file)
        }
    manifest_path = os.path.join(GAMES_DIR, 'manifest.json')
    ensure_dir(GAMES_DIR)
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return manifest_path

def run_modularizer():
    ensure_dir(GAMES_DIR)
    ensure_dir(CSS_MODULES_DIR)
    css_report, ui_css_report = split_css_modules()
    js_report = split_js_game_modules()
    generate_game_templates()
    manifest_file = generate_manifest(css_report, js_report, ui_css_report)
    print('=== HOAN TAT TACH TOAN BO MODULE TRO CHOI & GIAO DIEN (V31) ===')
    print('1. Thu muc Games:', GAMES_DIR)
    print('   - So dong CSS moi tro:', json.dumps(css_report, ensure_ascii=False))
    print('   - So dong JS moi tro :', json.dumps(js_report, ensure_ascii=False))
    print('2. Thu muc CSS UI Modules:', CSS_MODULES_DIR)
    print('   - So dong CSS UI     :', json.dumps(ui_css_report, ensure_ascii=False))
    print('3. Tệp Manifest:', manifest_file)

if __name__ == '__main__':
    run_modularizer()
