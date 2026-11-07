import os
import re
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES_DIR = os.path.join(PROJECT_ROOT, 'static', 'games')

GAME_MODULES = {
    'uno': {
        'title': 'Bài UNO Nhiều Người',
        'css_prefixes': ['.uno-'],
        'js_keywords': ['uno']
    },
    'noitu': {
        'title': 'Nối Từ Tiếng Việt',
        'css_prefixes': ['.noitu-'],
        'js_keywords': ['noitu']
    },
    'ludo': {
        'title': 'Cờ Cá Ngựa 3D',
        'css_prefixes': ['.ludo-', '.cube-'],
        'js_keywords': ['ludo']
    },
    'chess': {
        'title': 'Cờ Vua Quốc Tế',
        'css_prefixes': ['.chess-', '.promo-'],
        'js_keywords': ['chess']
    },
    'xo': {
        'title': 'Cờ Caro XO',
        'css_prefixes': ['.xo-'],
        'js_keywords': ['xo']
    },
    'memory': {
        'title': 'Lật Thẻ Trí Nhớ',
        'css_prefixes': ['.memory-'],
        'js_keywords': ['memory']
    },
    'dice': {
        'title': 'Xúc Xắc 3D',
        'css_prefixes': ['.dice-'],
        'js_keywords': ['dice']
    },
    'timer': {
        'title': 'Đồng Hồ Pomodoro',
        'css_prefixes': ['.timer-'],
        'js_keywords': ['timer']
    },
    'fishing': {
        'title': 'Bắn Cá Đại Dương 8 Người',
        'css_prefixes': ['.fish-'],
        'js_keywords': ['fishing']
    }
}

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def extract_css_for_prefixes(css_text, prefixes):
    extracted = []
    lines = css_text.splitlines()
    capturing_keyframes = False
    brace_depth = 0
    kf_buffer = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if capturing_keyframes:
            kf_buffer.append(line)
            brace_depth += line.count('{') - line.count('}')
            if brace_depth <= 0:
                extracted.append('\n'.join(kf_buffer))
                capturing_keyframes = False
                kf_buffer = []
            continue

        if any(p in stripped for p in prefixes):
            if stripped.startswith('@keyframes') and line.count('{') > line.count('}'):
                capturing_keyframes = True
                brace_depth = line.count('{') - line.count('}')
                kf_buffer = [line]
            else:
                extracted.append(line)
    return '\n'.join(extracted)

def split_css_modules():
    style_path = os.path.join(PROJECT_ROOT, 'static', 'css', 'style.css')
    if not os.path.exists(style_path):
        return {}
    with open(style_path, 'r', encoding='utf-8') as f:
        css_content = f.read()

    report = {}
    for game_key, meta in GAME_MODULES.items():
        g_dir = os.path.join(GAMES_DIR, game_key)
        ensure_dir(g_dir)
        css_out_path = os.path.join(g_dir, f'{game_key}.css')
        if game_key == 'fishing' and os.path.exists(css_out_path):
            continue
        matched_css = extract_css_for_prefixes(css_content, meta['css_prefixes'])
        if matched_css:
            with open(css_out_path, 'w', encoding='utf-8') as out_f:
                out_f.write(matched_css + '\n')
            report[game_key] = len(matched_css.splitlines())
    return report

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

def generate_manifest():
    manifest = {
        'version': 30,
        'modules': {}
    }
    for game_key, meta in GAME_MODULES.items():
        g_dir = os.path.join(GAMES_DIR, game_key)
        manifest['modules'][game_key] = {
            'title': meta['title'],
            'html': f'/static/games/{game_key}/{game_key}.html',
            'css': f'/static/games/{game_key}/{game_key}.css',
            'js': f'/static/games/{game_key}/{game_key}.js',
            'ready': os.path.exists(os.path.join(g_dir, f'{game_key}.js'))
        }
    manifest_path = os.path.join(GAMES_DIR, 'manifest.json')
    ensure_dir(GAMES_DIR)
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return manifest_path

def run_modularizer():
    ensure_dir(GAMES_DIR)
    css_report = split_css_modules()
    generate_game_templates()
    manifest_file = generate_manifest()
    print('=== HOAN TAT TACH MODULE TRO CHOI ===')
    print('Thu muc module:', GAMES_DIR)
    print('CSS da tach:', json.dumps(css_report, ensure_ascii=False))
    print('Manifest:', manifest_file)

if __name__ == '__main__':
    run_modularizer()
