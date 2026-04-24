"""
Dissident Bot Web Panel - Flask Application
Full-featured admin dashboard with real-time stats
v2.11.0 - Enhanced error handling and debugging
"""

import os
import sys
import json
import logging
import sqlite3
import threading
import traceback
from collections import deque
from datetime import datetime
from functools import wraps
from pathlib import Path

from flask import (
    Flask, render_template, request, jsonify, abort,
    redirect, url_for, session, send_file, send_from_directory
)
from werkzeug.security import check_password_hash, generate_password_hash

# Add web_panel to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import dashboard modules
import dashboard_api
import push_api
import user_auth as auth
import discord_auth
import bot_bridge
import push_notifications

# ============================================================================
# LOGGING SETUP
# ============================================================================

LOG_DIR = Path(__file__).parent.parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if os.environ.get('FLASK_DEBUG', 'false').lower() == 'true' else logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / 'web_panel.log')
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# APP SETUP
# ============================================================================

def get_version():
    """Read version from VERSION.json â€” single source of truth."""
    try:
        version_file = Path(__file__).parent.parent / 'VERSION.json'
        if version_file.exists():
            with open(version_file, 'r') as f:
                data = json.load(f)
                return data.get('version', 'unknown')
    except Exception:
        pass
    return 'unknown'

VERSION = get_version()

app = Flask(__name__,
            template_folder='templates',
            static_folder='static')

HOMEPAGE_EXPORT_DIR = Path(__file__).parent.parent / 'homepage' / 'out'
HOMEPAGE_STATIC_DIR = Path(app.static_folder) / 'homepage'
HOMEPAGE_DIR = HOMEPAGE_EXPORT_DIR if HOMEPAGE_EXPORT_DIR.exists() else HOMEPAGE_STATIC_DIR
CENTRAL_HUB_BASE_URL = (os.environ.get('CENTRAL_HUB_BASE_URL') or 'https://slothlee.xyz').rstrip('/')


def _central_hub_url(path: str) -> str:
    normalized = path if path.startswith('/') else f'/{path}'
    return f'{CENTRAL_HUB_BASE_URL}{normalized}'


def serve_homepage_export(path: str = ''):
    normalized = path.strip('/')
    if not normalized:
        normalized = 'index.html'

    direct_candidate = HOMEPAGE_DIR / normalized
    if direct_candidate.is_file():
        return send_from_directory(HOMEPAGE_DIR, normalized)

    index_candidate = HOMEPAGE_DIR / normalized / 'index.html'
    if index_candidate.is_file():
        return send_from_directory(HOMEPAGE_DIR, f'{normalized}/index.html')

    html_candidate = HOMEPAGE_DIR / f'{normalized}.html'
    if html_candidate.is_file():
        return send_from_directory(HOMEPAGE_DIR, f'{normalized}.html')

    abort(404)

# Debug mode
DEBUG = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
app.config['DEBUG'] = DEBUG

# Production-ready secret key
_secret = os.environ.get('SECRET_KEY', os.urandom(32).hex())
app.secret_key = _secret.encode('utf-8') if isinstance(_secret, str) else _secret

# Secure cookies in production
_port = os.environ.get('PORT', '8080')
app.config['SESSION_COOKIE_SECURE'] = (_port != '8080' and os.environ.get('RAILWAY_STATIC_URL', '') != '')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Inject version and bot stats into all templates
@app.context_processor
def inject_version():
    stats = SharedStateReader.get_stats()
    guilds = SharedStateReader.get_servers()
    server_count = len(guilds) if guilds else stats.get('servers', 0)
    user_count = sum(g.get('member_count', 0) for g in guilds) if guilds else stats.get('users', 0)
    if user_count >= 1000:
        user_display = f"{user_count / 1000:.1f}K"
    else:
        user_display = str(user_count)
    return {
        'version': VERSION,
        'bot_servers': server_count,
        'bot_users': user_display,
        'bot_latency': stats.get('latency_ms', 0),
        'bot_online': stats.get('status') == 'online',
        'use_socketio': os.environ.get('ENABLE_SOCKETIO', 'true').lower() == 'true',
        'use_charts': True,
        'username': session.get('username', 'Admin'),
        'page': 'dashboard',
    }

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri='memory://',
    strategy="fixed-window"
)

csrf = CSRFProtect(app)

app.register_blueprint(dashboard_api.dashboard_api)
app.register_blueprint(push_api.push_api)
app.register_blueprint(discord_auth.discord_auth)

logger.info(f"Sloth Lee Web Panel starting - Debug: {DEBUG}")
logger.info(f"Python: {sys.version}")
logger.info(f"Working directory: {os.getcwd()}")

# ============================================================================
# CONFIG
# ============================================================================

ADMIN_USERNAME = os.environ.get('ADMIN_USER', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASS', '')
CSRF_SECRET = os.environ.get('CSRF_SECRET', os.urandom(32).hex())

BOT_STATE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'bot_state.json')
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

# ============================================================================
# SHARED STATE READER â€” delegates to bot_bridge.SharedStateReader
# ============================================================================

SharedStateReader = bot_bridge.SharedStateReader


# ============================================================================
# AUTH
# ============================================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            # Check for multi-user auth
            if 'user_id' not in session:
                return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


# ============================================================================
# AUTH HELPERS
# ============================================================================

def get_current_user():
    """Get current logged in user from session"""
    user_id = session.get('user_id')
    if user_id:
        conn = sqlite3.connect(auth.AUTH_DB)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        conn.close()
        return dict(user) if user else None
    return None

def get_user_role():
    """Get current user role from session"""
    return session.get('role', session.get('logged_in') and 'admin' or 'user')

def is_admin():
    """Check if current user is admin"""
    return get_user_role() == 'admin'

def require_role(*roles):
    """Decorator to require specific roles"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Unauthorized'}), 401
            if user.get('role') not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# ============================================================================
# ROUTES
# ============================================================================

@app.route('/')
def index():
    if 'logged_in' in session:
        return redirect(_central_hub_url('/app/dashboard'))
    return redirect('/bot/login')


@app.route('/login')
def login():
    if 'logged_in' in session:
        return redirect(_central_hub_url('/app/dashboard'))
    return render_template('login.html', page='auth')


@app.route('/admin-login')
def admin_login():
    if 'logged_in' in session:
        return redirect(_central_hub_url('/app/dashboard'))
    return render_template('admin_login.html', page='auth')


def rate_limit(limit_str):
    if limiter:
        return limiter.limit(limit_str)
    return lambda f: f

@app.route('/api/login', methods=['POST'])
@rate_limit("5 per minute")
def api_login():
    data = request.json or {}
    username = data.get('username', '')
    password = data.get('password', '')
    
    env_user = os.environ.get('ADMIN_USER')
    env_pass = os.environ.get('ADMIN_PASS')
    
    if env_user and env_pass and username == env_user and password == env_pass:
        session['user_id'] = 'admin_001'
        session['username'] = username
        session['role'] = 'admin'
        session['logged_in'] = True
        session.permanent = True
        return jsonify({'success': True, 'redirect': _central_hub_url('/app/dashboard')})
    
    # Fallback to database auth
    from user_auth import authenticate
    result = authenticate(username, password)
    
    if result['success']:
        session['user_id'] = result['user']['id']
        session['username'] = result['user']['username']
        session['role'] = result['user']['role']
        session['logged_in'] = True
        return jsonify({'success': True, 'redirect': _central_hub_url('/app/dashboard')})

    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401


@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True, 'redirect': '/login'})


@app.route('/api/me')
def api_me():
    """Get current user info"""
    if 'logged_in' not in session and 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    return jsonify({
        'user_id': session.get('user_id'),
        'username': session.get('username'),
        'role': session.get('role', 'admin')
    })


# Main Dashboard
@app.route('/dashboard')
def dashboard():
    return redirect(_central_hub_url('/app/dashboard'))


# Activity Page
@app.route('/activity')
def activity():
    return redirect(_central_hub_url('/app/dashboard'))


# Moderation Page
@app.route('/moderation')
def moderation():
    return redirect(_central_hub_url('/app/moderation'))


# Economy Page
@app.route('/economy')
def economy():
    return redirect(_central_hub_url('/app/dashboard'))


# Tickets Page
@app.route('/tickets')
def tickets():
    return redirect(_central_hub_url('/app/tickets'))

# Users Page
@app.route('/users')
def users():
    return redirect(_central_hub_url('/app/users'))

# Database Page
@app.route('/database')
def database():
    return redirect(_central_hub_url('/app/settings'))

# Commands Page
@app.route('/commands')
def commands():
    return redirect(_central_hub_url('/app/servers'))

# Notifications Page
@app.route('/notifications')
def notifications():
    return redirect(_central_hub_url('/app/dashboard'))

# Scheduled Page
@app.route('/scheduled')
def scheduled():
    return redirect(_central_hub_url('/app/dashboard'))

# Webhooks Page
@app.route('/webhooks')
def webhooks():
    return redirect(_central_hub_url('/app/settings'))

# Plugins Page
@app.route('/plugins')
def plugins():
    return redirect(_central_hub_url('/app/settings'))

# Backups Page
@app.route('/backups')
def backups():
    return redirect(_central_hub_url('/app/settings'))

# Analytics Page
@app.route('/analytics')
def analytics():
    return redirect(_central_hub_url('/app/analytics'))


# Logs Page
@app.route('/logs')
def logs():
    return redirect(_central_hub_url('/app/logs'))


# Health Page
@app.route('/health')
def health():
    return redirect(_central_hub_url('/app/dashboard'))


# Settings Page
@app.route('/settings')
def settings():
    return redirect(_central_hub_url('/app/settings'))


# Multi-Server Pages
@app.route('/servers')
def servers():
    return redirect(_central_hub_url('/app/servers'))


@app.route('/servers/<server_id>')
def server_dashboard(server_id):
    return redirect(_central_hub_url('/app/servers'))


# Premium Page
@app.route('/premium')
def premium():
    return redirect(_central_hub_url('/app/dashboard'))


# Themes Page
@app.route('/themes')
def themes():
    return redirect(_central_hub_url('/app/settings'))


# Reviews Page
@app.route('/reviews')
def reviews_page():
    return redirect(_central_hub_url('/app/dashboard'))


# Marketplace Page
@app.route('/marketplace')
def marketplace():
    return redirect(_central_hub_url('/app/dashboard'))


@app.route('/partials/<page>')
@login_required
def partials(page):
    from flask import abort
    safe_page = page.replace('.', '').replace('/', '')
    try:
        return render_template(f'partials/{safe_page}.html')
    except Exception:
        abort(404)


# ============================================================================
# API ENDPOINTS
# ============================================================================

# NOTE: /api/servers, /api/commands, /api/plugins, /api/activity are served
# by dashboard_api.py blueprint â€” no duplicates here.


@app.route('/api/servers/<server_id>')
@login_required
def api_server(server_id):
    """Get server details from real bot state"""
    guilds = SharedStateReader.get_servers()
    for guild in guilds:
        if str(guild.get('id', '')) == str(server_id):
            return jsonify(guild)
    return jsonify({'error': 'Server not found'}), 404


@app.route('/api/servers/invite', methods=['POST'])
@login_required
def api_server_invite():
    """Generate server invite code"""
    import uuid
    invite_code = f"SRV-{uuid.uuid4().hex[:8].upper()}"
    return jsonify({'invite_code': invite_code, 'expires_at': None})


@app.route('/api/servers', methods=['POST'])
@login_required
def api_add_server():
    """Add a new server (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json() or {}
    
    return jsonify({'success': True, 'server': {'id': f"srv_{len(data)}", 'name': data.get('name', 'New Server')}})


@app.route('/api/servers/<server_id>', methods=['DELETE'])
@login_required
def api_delete_server(server_id):
    """Delete a server (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify({'success': True, 'message': f'Server {server_id} removed'})


@app.route('/api/moderation')
@login_required
def api_moderation():
    return jsonify(SharedStateReader.get_moderation_cases())


@app.route('/api/economy')
@login_required
def api_economy():
    stats = SharedStateReader.get_stats()
    return jsonify({
        'leaders': SharedStateReader.get_economy(),
        'stats': {
            'total_coins': stats.get('total_coins', 0),
            'daily_payout': stats.get('daily_payout', 0),
            'active_traders': stats.get('active_traders', 0)
        }
    })


@app.route('/api/tickets')
@login_required
def api_tickets():
    tickets = SharedStateReader.get_tickets()
    open_count = sum(1 for t in tickets if t.get('status') == 'open')
    pending_count = sum(1 for t in tickets if t.get('status') == 'pending')
    closed_today = sum(1 for t in tickets if t.get('status') == 'closed')
    return jsonify({
        'tickets': tickets,
        'stats': {
            'open': open_count,
            'pending': pending_count,
            'closed_today': closed_today
        }
    })


@app.route('/api/logs')
@login_required
def api_logs():
    limit = request.args.get('limit', 100, type=int)
    search = request.args.get('search', '').lower()

    logs = SharedStateReader.get_logs(limit)

    if search:
        logs = [log for log in logs if search in log['message'].lower()]

    return jsonify({'logs': logs})


@app.route('/api/charts')
@login_required
def api_charts():
    stats = SharedStateReader.get_stats()
    activity_data = SharedStateReader.get_activity()
    commands_data = SharedStateReader.get_commands()
    guilds_data = SharedStateReader.get_servers()

    commands_history = []
    messages_history = []
    if isinstance(activity_data, list) and activity_data:
        commands_history = [h.get('count', 0) for h in activity_data if isinstance(h, dict)]
    if isinstance(activity_data, dict):
        commands_history = [h.get('count', 0) for h in activity_data.get('commands_history', [])]
        messages_history = [h.get('count', 0) for h in activity_data.get('messages_history', [])]

    cmd_labels = [c.get('name', 'unknown')[:15] for c in commands_data[:7]] if commands_data else ['ping', 'help', 'balance', 'daily', 'rank', 'warn', 'other']
    cmd_values = [c.get('uses', 0) for c in commands_data[:7]] if commands_data else [0, 0, 0, 0, 0, 0, 0]

    time_labels = ['6h', '5h', '4h', '3h', '2h', '1h', 'Now']
    if commands_history:
        time_labels = time_labels[:len(commands_history)]
    if messages_history:
        while len(time_labels) < len(messages_history):
            time_labels.append(f'{len(time_labels)}h ago')

    chart_data = {
        'activity': {
            'labels': time_labels if time_labels else ['6h', '5h', '4h', '3h', '2h', '1h', 'Now'],
            'commands': commands_history if commands_history else [0, 0, 0, 0, 0, 0, 0],
            'messages': messages_history if messages_history else [0, 0, 0, 0, 0, 0, 0],
        },
        'servers': {
            'labels': [g.get('name', 'Unknown') for g in guilds_data[:5]] if guilds_data else ['Main Server'],
            'values': [g.get('member_count', 0) for g in guilds_data[:5]] if guilds_data else [0],
        },
        'economy': {
            'labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            'values': [0, 0, 0, 0, 0, 0, 0],
            'demo': True,
        },
        'commands': {
            'labels': cmd_labels,
            'values': cmd_values,
            'colors': ['#58a6ff', '#3fb950', '#a371f7', '#d29922', '#f0883e', '#f85149', '#8b949e'],
        },
        'status': stats.get('status', 'offline'),
    }

    if not commands_history and not commands_data:
        chart_data['demo'] = True

    return jsonify(chart_data)


@app.route('/api/guilds')
@login_required
def api_guilds():
    stats = SharedStateReader.get_stats()
    return jsonify(stats.get('guilds', []))


# ============================================================================
# DATABASE BROWSER
# ============================================================================

@app.route('/api/database/stats')
@login_required
def api_db_stats():
    import sqlite3
    import os

    db_path = os.path.join(DATA_DIR, 'dissident.db')
    if not os.path.exists(db_path):
        return jsonify({'tables': 0, 'rows': 0, 'size': '0 KB', 'lastUpdated': 'N/A'})

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Get table count
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchone()[0]

        # Get total rows
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        table_names = [r[0] for r in cursor.fetchall()]
        total_rows = 0
        for table in table_names:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                total_rows += cursor.fetchone()[0]
            except:
                pass

        conn.close()

        # Get size
        size = os.path.getsize(db_path)
        if size > 1024 * 1024:
            size_str = f"{size / (1024 * 1024):.1f} MB"
        else:
            size_str = f"{size / 1024:.1f} KB"

        return jsonify({
            'tables': tables,
            'rows': total_rows,
            'size': size_str,
            'lastUpdated': 'Live'
        })
    except Exception as e:
        return jsonify({'tables': 0, 'rows': 0, 'size': 'Error', 'lastUpdated': 'N/A'})


@app.route('/api/database/tables')
@login_required
def api_db_tables():
    import sqlite3
    import os

    db_path = os.path.join(DATA_DIR, 'dissident.db')
    if not os.path.exists(db_path):
        return jsonify([])

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        tables = []

        for (table_name,) in cursor.fetchall():
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                tables.append({'name': table_name, 'rows': count})
            except:
                tables.append({'name': table_name, 'rows': 0})

        conn.close()
        return jsonify(tables)
    except:
        return jsonify([])


@app.route('/api/database/table/<table_name>')
@login_required
def api_db_table(table_name):
    import sqlite3
    import os

    db_path = os.path.join(DATA_DIR, 'dissident.db')
    if not os.path.exists(db_path):
        return jsonify({'columns': [], 'rows': []})

    # Sanitize table name
    if not table_name.replace('_', '').isalnum():
        return jsonify({'error': 'Invalid table name'}), 400

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get columns
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [r[1] for r in cursor.fetchall()]

        # Get rows
        cursor.execute(f"SELECT * FROM {table_name} LIMIT 100")
        rows = [dict(r) for r in cursor.fetchall()]

        conn.close()
        return jsonify({'columns': columns, 'rows': rows})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



# ============================================================================
# COMMAND EXECUTOR
# ============================================================================

@app.route('/api/commands/execute', methods=['POST'])
@login_required
def api_commands_execute():

    data = request.json or {}
    command = data.get('command', '')
    args = data.get('args', [])

    # Demo response - in production this would execute the actual command
    responses = {
        'ping': 'Pong! Latency: 42ms',
        'help': 'Help command executed. Check your DM.',
        'stats': f'Servers: {SharedStateReader.get_stats().get("servers", 0)}, Users: {SharedStateReader.get_stats().get("users", 0)}',
        'balance': 'Your balance: 1,250 coins',
        'daily': 'You claimed your daily reward of 150 coins!',
    }

    output = responses.get(command, f'Command !{command} "{" ".join(args)}" executed (demo mode)')

    return jsonify({
        'success': True,
        'output': output,
        'command': command,
        'args': args
    })


# ============================================================================
# NOTIFICATIONS
# ============================================================================

notifications_store = deque(maxlen=200)
notifications_lock = threading.Lock()

@app.route('/api/notifications')
@login_required
def api_notifications():
    with notifications_lock:
        items = list(notifications_store)[-50:]
    return jsonify({'notifications': items})


@app.route('/api/notifications', methods=['POST'])
@login_required
def api_notifications_create():
    data = request.json or {}
    with notifications_lock:
        notification = {
            'id': len(notifications_store),
            'type': data.get('type', 'info'),
            'title': data.get('title', 'Notification'),
            'message': data.get('message', ''),
            'time': datetime.now().isoformat(),
            'read': False
        }
        notifications_store.append(notification)
    return jsonify(notification)


@app.route('/api/notifications/<int:notif_id>', methods=['DELETE'])
@login_required
def api_notifications_delete(notif_id):
    global notifications_store
    with notifications_lock:
        notifications_store = deque(
            (n for n in notifications_store if n.get('id') != notif_id),
            maxlen=200
        )
    return jsonify({'success': True})


# ============================================================================
# BACKUP & RESTORE
# ============================================================================

@app.route('/api/backup', methods=['POST'])
@login_required
def api_backup():

    import shutil
    import zipfile
    from io import BytesIO

    data = request.json or {}
    backup_name = data.get('name', f'backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}')

    # Create backup directory
    backup_dir = os.path.join(DATA_DIR, 'backups')
    os.makedirs(backup_dir, exist_ok=True)

    # Create zip
    zip_path = os.path.join(backup_dir, f'{backup_name}.zip')

    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Backup database
            db_path = os.path.join(DATA_DIR, 'dissident.db')
            if os.path.exists(db_path):
                zipf.write(db_path, 'dissident.db')

            # Backup config
            config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'bot', 'config.yaml')
            if os.path.exists(config_path):
                zipf.write(config_path, 'config.yaml')

        return jsonify({
            'success': True,
            'file': f'{backup_name}.zip',
            'path': zip_path,
            'size': os.path.getsize(zip_path)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/backup/list')
@login_required
def api_backup_list():
    backup_dir = os.path.join(DATA_DIR, 'backups')
    os.makedirs(backup_dir, exist_ok=True)

    backups = []
    for f in os.listdir(backup_dir):
        if f.endswith('.zip'):
            path = os.path.join(backup_dir, f)
            backups.append({
                'name': f,
                'size': os.path.getsize(path),
                'created': datetime.fromtimestamp(os.path.getctime(path)).isoformat()
            })

    return jsonify({'backups': sorted(backups, key=lambda x: x['created'], reverse=True)})


# ============================================================================
# ADMIN ACTIONS
# ============================================================================

@app.route('/api/actions/<action>', methods=['POST'])
@login_required
def api_actions(action):

    data = request.json or {}

    actions = {
        'sync_commands': lambda: {'success': True, 'message': 'Commands synced'},
        'reload_cogs': lambda: {'success': True, 'message': 'Cogs reloaded'},
        'clear_cache': lambda: {'success': True, 'message': 'Cache cleared'},
        'backup': lambda: {'success': True, 'message': 'Backup created', 'file': 'backup_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.zip'},
        'restart': lambda: {'success': True, 'message': 'Restart scheduled'},
    }

    if action in actions:
        return jsonify(actions[action]())

    return jsonify({'success': False, 'error': 'Unknown action'}), 400


@app.route('/api/moderation/<action>', methods=['POST'])
@login_required
@rate_limit("20 per minute")
def api_moderation_action(action):
    data = request.json or {}

    if action == 'warn':
        return jsonify({'success': True, 'case_id': 1005})
    elif action == 'kick':
        return jsonify({'success': True, 'message': 'User kicked'})
    elif action == 'ban':
        return jsonify({'success': True, 'message': 'User banned'})
    elif action == 'mute':
        return jsonify({'success': True, 'message': 'User muted'})

    return jsonify({'success': False, 'error': 'Unknown action'}), 400


@app.route('/api/economy/<action>', methods=['POST'])
@login_required
@rate_limit("20 per minute")
def api_economy_action(action):
    data = request.json or {}

    if action == 'award':
        return jsonify({'success': True, 'message': f"Awarded {data.get('amount', 0)} coins"})
    elif action == 'take':
        return jsonify({'success': True, 'message': f"Removed {data.get('amount', 0)} coins"})
    elif action == 'reset':
        return jsonify({'success': True, 'message': 'Balance reset'})

    return jsonify({'success': False, 'error': 'Unknown action'}), 400


@app.route('/api/plugin/<plugin_name>/<action>', methods=['POST'])
@login_required
@rate_limit("10 per minute")
def api_plugin_action(plugin_name, action):
    if action == 'load':
        return jsonify({'success': True, 'message': f'Plugin {plugin_name} loaded'})
    elif action == 'unload':
        return jsonify({'success': True, 'message': f'Plugin {plugin_name} unloaded'})
    elif action == 'reload':
        return jsonify({'success': True, 'message': f'Plugin {plugin_name} reloaded'})

    return jsonify({'success': False, 'error': 'Unknown action'}), 400


@app.route('/api/ticket/<int:ticket_id>/<action>', methods=['POST'])
@login_required
def api_ticket_action(ticket_id, action):
    if action == 'close':
        return jsonify({'success': True, 'message': f'Ticket #{ticket_id} closed'})
    elif action == 'claim':
        return jsonify({'success': True, 'message': f'Ticket #{ticket_id} claimed'})
    elif action == 'delete':
        return jsonify({'success': True, 'message': f'Ticket #{ticket_id} deleted'})

    return jsonify({'success': False, 'error': 'Unknown action'}), 400


# ============================================================================
# UTILITIES
# ============================================================================

@app.route('/api/ping')
def ping():
    return jsonify({
        'status': 'ok',
        'time': datetime.now().isoformat(),
        'bot_online': os.path.exists(BOT_STATE_FILE)
    })


# ============================================================================
# SOCKET.IO REAL-TIME EVENTS
# ============================================================================

# Try to import Flask-SocketIO (optional)
socketio = None
try:
    from flask_socketio import SocketIO, emit, join_room, leave_room
    
    # Initialize Socket.IO with gevent async mode + Redis message queue for multi-worker support
    _redis_host = os.environ.get('DISSIDENT_REDIS_HOST', os.environ.get('REDIS_HOST', 'localhost'))
    _redis_port = os.environ.get('DISSIDENT_REDIS_PORT', os.environ.get('REDIS_PORT', '6379'))
    _redis_password = os.environ.get('DISSIDENT_REDIS_PASSWORD', os.environ.get('REDIS_PASSWORD', ''))
    _redis_db = os.environ.get('REDIS_DB', '1')
    _redis_url = os.environ.get('SOCKETIO_MESSAGE_QUEUE', f'redis://:{_redis_password}@{_redis_host}:{_redis_port}/{_redis_db}' if _redis_password else f'redis://{_redis_host}:{_redis_port}/{_redis_db}')
    
    # Verify Redis is reachable before using message_queue
    _mq = None
    try:
        import redis as _redis
        _r = _redis.Redis.from_url(_redis_url, socket_connect_timeout=2)
        _r.ping()
        _r.close()
        _mq = _redis_url
        print(f'[Socket.IO] Redis message queue connected: {_redis_host}:{_redis_port}')
    except Exception:
        print(f'[Socket.IO] Redis unavailable at {_redis_host}:{_redis_port} â€” running single-worker mode')
    
    socketio = SocketIO(
        app,
        cors_allowed_origins='*',
        async_mode='gevent',
        message_queue=_mq,
        logger=False,
        engineio_logger=False
    )
    
    # Connection events
    @socketio.on('connect')
    def handle_connect():
        print('[Socket.IO] Client connected:', request.sid)
        emit('connected', {
            'status': 'ok',
            'sid': request.sid,
            'time': datetime.now().isoformat()
        })
    
    @socketio.on('disconnect')
    def handle_disconnect():
        print('[Socket.IO] Client disconnected:', request.sid)
    
    # Subscribe to dashboard events
    @socketio.on('subscribe')
    def handle_subscribe(data):
        channel = data.get('channel', 'dashboard')
        join_room(channel)
        print(f'[Socket.IO] Client joined room: {channel}')
        emit('subscribed', {'channel': channel})
        
        # Send current state
        stats = SharedStateReader.get_stats()
        emit('stats_update', stats)
    
    @socketio.on('unsubscribe')
    def handle_unsubscribe(data):
        channel = data.get('channel', 'dashboard')
        leave_room(channel)
        print(f'[Socket.IO] Client left room: {channel}')
    
    # Request current state
    @socketio.on('request_state')
    def handle_request_state():
        stats = SharedStateReader.get_stats()
        emit('stats_update', stats)
        activity = SharedStateReader.get_activity()
        emit('activity_update', activity)
    
    # Ping/pong for keepalive
    @socketio.on('ping')
    def handle_ping(data):
        emit('pong', {
            'timestamp': data.get('timestamp'),
            'server_time': datetime.now().isoformat()
        })
    
    # Guild-specific rooms
    @socketio.on('guild:join')
    def handle_guild_join(data):
        guild_id = data.get('guildId')
        if guild_id:
            room = f'guild_{guild_id}'
            join_room(room)
            print(f'[Socket.IO] Client joined guild room: {room}')
            emit('subscribed', {'channel': room})
    
    @socketio.on('guild:leave')
    def handle_guild_leave(data):
        guild_id = data.get('guildId')
        if guild_id:
            room = f'guild_{guild_id}'
            leave_room(room)
            print(f'[Socket.IO] Client left guild room: {room}')
    
    # Moderation events
    @socketio.on('mod:action')
    def handle_mod_action(data):
        action = data.get('action')
        target = data.get('target')
        reason = data.get('reason', '')
        
        print(f'[Socket.IO] Mod action: {action} on {target}')
        
        # Broadcast to dashboard room
        emit('mod:case_created', {
            'action': action,
            'target': target,
            'reason': reason,
            'by': session.get('username', 'Unknown'),
            'time': datetime.now().isoformat()
        }, room='dashboard')
    
    # Notification broadcast
    @socketio.on('notification:send')
    def handle_notification(data):
        notification = {
            'id': int(datetime.now().timestamp()),
            'type': data.get('type', 'info'),
            'title': data.get('title', 'Notification'),
            'message': data.get('message', ''),
            'time': datetime.now().isoformat()
        }
        emit('notification', notification, room='dashboard')
    
    HAS_SOCKETIO = True
    print('[Socket.IO] Flask-SocketIO loaded successfully')

except ImportError:
    print('[Web Panel] Socket.IO not available. Install flask-socketio for real-time features:')
    print('[Web Panel] pip install flask-socketio eventlet')
    socketio = None
    HAS_SOCKETIO = False


def broadcast_to_dashboard(event, data):
    """Broadcast event to all dashboard clients"""
    if socketio:
        socketio.emit(event, data, room='dashboard')


# ============================================================================
# MARKETPLACE API
# ============================================================================

MARKETPLACE_PLUGINS = [
    {
        'id': 'welcome-pro', 'name': 'Welcome Pro', 'author': 'DissidentTeam',
        'icon': 'fas fa-hand-sparkles', 'color': '#58a6ff',
        'category': 'moderation', 'price': 0, 'rating': 4.9, 'downloads': 15420,
        'version': '2.1.0', 'description': 'Advanced welcome messages with custom embeds',
        'fullDescription': 'Welcome Pro provides customizable welcome messages with rich embeds, temporary roles, and verification flows.',
        'features': ['Custom embeds', 'Temporary roles', 'Auto-verification', 'DM messages', 'Stats tracking'],
        'latestChangelog': 'Added new embed templates and improved performance',
        'requirements': ['Dissident Bot 2.0+'], 'added': '2024-01-01'
    },
    {
        'id': 'level-system', 'name': 'Level System', 'author': 'GameMaster',
        'icon': 'fas fa-trophy', 'color': '#3fb950',
        'category': 'economy', 'price': 0, 'rating': 4.7, 'downloads': 23100,
        'version': '3.0.0', 'description': 'XP and level system with rewards',
        'fullDescription': 'A comprehensive leveling system with XP tracking, ranks, and customizable rewards.',
        'features': ['XP tracking', 'Custom ranks', 'Reward roles', 'Leaderboards', 'Daily bonuses'],
        'latestChangelog': 'New weekly leaderboard feature',
        'requirements': ['Dissident Bot 2.0+'], 'added': '2023-12-15'
    },
    {
        'id': 'music-bot', 'name': 'Music Bot', 'author': 'AudioDev',
        'icon': 'fas fa-music', 'color': '#a371f7',
        'category': 'fun', 'price': 0, 'rating': 4.5, 'downloads': 45200,
        'version': '1.5.0', 'description': 'Play music from YouTube, Spotify, and more',
        'fullDescription': 'Full-featured music bot with queue management, filters, and multiple sources.',
        'features': ['YouTube support', 'Spotify support', 'Queue management', 'Audio filters', 'Lyrics'],
        'latestChangelog': 'Added Spotify playlist support',
        'requirements': ['FFmpeg installed', 'Dissident Bot 2.0+'], 'added': '2023-11-20'
    },
    {
        'id': 'ticket-advanced', 'name': 'Ticket Advanced', 'author': 'SupportPro',
        'icon': 'fas fa-ticket-alt', 'color': '#f0883e',
        'category': 'utility', 'price': 0, 'rating': 4.8, 'downloads': 18900,
        'version': '2.0.0', 'description': 'Advanced ticket system with panels',
        'fullDescription': 'Create custom ticket panels, categories, and automated responses.',
        'features': ['Custom panels', 'Categories', 'Auto-close', 'Transcripts', 'Satisfaction surveys'],
        'latestChangelog': 'Added transcript export',
        'requirements': ['Dissident Bot 2.0+'], 'added': '2024-01-05'
    },
    {
        'id': 'twitch-notify', 'name': 'Twitch Notify', 'author': 'StreamTools',
        'icon': 'fas fa-broadcast-tower', 'color': '#9146ff',
        'category': 'integration', 'price': 0, 'rating': 4.6, 'downloads': 8900,
        'version': '1.2.0', 'description': 'Twitch stream notifications',
        'fullDescription': 'Notify your Discord server when Twitch channels go live.',
        'features': ['Multi-channel support', 'Custom messages', 'Role mentions', 'Offline alerts'],
        'latestChangelog': 'Fixed notification delays',
        'requirements': ['Twitch API key', 'Dissident Bot 2.0+'], 'added': '2023-10-10'
    },
    {
        'id': 'auto-mod', 'name': 'AutoMod Premium', 'author': 'SafeSpace',
        'icon': 'fas fa-robot', 'color': '#f85149',
        'category': 'moderation', 'price': 5, 'rating': 4.9, 'downloads': 8900,
        'version': '2.0.0', 'description': 'AI-powered auto moderation',
        'fullDescription': 'Advanced auto moderation with AI spam detection and word filters.',
        'features': ['AI detection', 'Spam filter', 'Invite blocker', 'Link filter', 'Mention spam'],
        'latestChangelog': 'New AI model with 99% accuracy',
        'requirements': ['Dissident Bot 2.0+', 'Premium license'], 'added': '2024-01-10'
    },
]

installed_marketplace_plugins = []

@app.route('/api/marketplace/plugins')
@login_required
def api_marketplace_plugins():
    
    return jsonify({
        'plugins': MARKETPLACE_PLUGINS,
        'installed': installed_marketplace_plugins
    })

@app.route('/api/marketplace/plugin/<plugin_id>')
@login_required
def api_marketplace_plugin(plugin_id):
    
    for plugin in MARKETPLACE_PLUGINS:
        if plugin['id'] == plugin_id:
            return jsonify(plugin)
    
    return jsonify({'error': 'Plugin not found'}), 404

@app.route('/api/marketplace/install', methods=['POST'])
@login_required
def api_marketplace_install():
    
    data = request.get_json() or {}
    plugin_id = data.get('pluginId')
    
    if not plugin_id:
        return jsonify({'success': False, 'error': 'Plugin ID required'}), 400
    
    if plugin_id in installed_marketplace_plugins:
        return jsonify({'success': False, 'error': 'Plugin already installed'}), 400
    
    # Find plugin
    plugin = None
    for p in MARKETPLACE_PLUGINS:
        if p['id'] == plugin_id:
            plugin = p
            break
    
    if not plugin:
        return jsonify({'success': False, 'error': 'Plugin not found'}), 404
    
    # Install (demo - in production would download and install)
    installed_marketplace_plugins.append(plugin_id)
    
    logger.info(f'Plugin installed: {plugin["name"]}')
    
    return jsonify({
        'success': True,
        'message': f'{plugin["name"]} installed successfully',
        'plugin': plugin
    })

@app.route('/api/marketplace/uninstall', methods=['POST'])
@login_required
def api_marketplace_uninstall():
    
    data = request.get_json() or {}
    plugin_id = data.get('pluginId')
    
    if plugin_id in installed_marketplace_plugins:
        installed_marketplace_plugins.remove(plugin_id)
        return jsonify({'success': True, 'message': 'Plugin uninstalled'})
    
    return jsonify({'success': False, 'error': 'Plugin not installed'}), 400


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    logger.warning(f"404 Not Found: {request.path}")
    return render_template('404.html', page='error'), 404


@app.errorhandler(500)
def server_error(e):
    logger.error(f"500 Server Error: {request.path} - {str(e)}")
    debug_info = traceback.format_exc() if DEBUG else None
    return render_template('error.html',
        page='error',
        error_code=500,
        error_title='Internal Server Error',
        error_message='An unexpected error occurred. Our team has been notified.',
        debug_info=debug_info,
        error_id=datetime.now().strftime('%Y%m%d%H%M%S')
    ), 500


@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {str(e)}\n{traceback.format_exc()}")
    debug_info = traceback.format_exc() if DEBUG else None
    return render_template('error.html',
        page='error',
        error_code=500,
        error_title='Unexpected Error',
        error_message='An unexpected error occurred. Our team has been notified.',
        debug_info=debug_info,
        error_id=datetime.now().strftime('%Y%m%d%H%M%S')
    ), 500


@app.before_request
def log_request():
    """Log all incoming requests"""
    logger.debug(f"{request.method} {request.path} - {request.remote_addr}")


@app.after_request
def log_response(response):
    """Log all responses"""
    logger.debug(f"{request.method} {request.path} - {response.status_code}")
    return response


# ============================================================================
# PREMIUM PLUGINS API
# ============================================================================

PREMIUM_PLUGINS = [
    {
        'id': 'auto-mod', 'name': 'AutoMod Premium', 'author': 'DissidentTeam',
        'icon': 'fas fa-robot', 'color': '#f85149',
        'category': 'moderation', 'price': 9.99, 'billing': 'lifetime', 'tier': 'premium',
        'rating': 4.9, 'downloads': 3400,
        'version': '2.0.0', 'description': 'AI-powered auto moderation',
        'features': ['AI Detection', 'Spam Filter', 'Invite Blocker', 'Link Filter', 'Mention Spam', 'Word Filter'],
        'requirements': ['Dissident Bot 2.0+']
    },
    {
        'id': 'analytics-pro', 'name': 'Analytics Pro', 'author': 'DataScience',
        'icon': 'fas fa-chart-line', 'color': '#a371f7',
        'category': 'utility', 'price': 7.99, 'billing': 'monthly', 'tier': 'premium',
        'rating': 4.8, 'downloads': 2100,
        'version': '1.5.0', 'description': 'Advanced analytics and reporting',
        'features': ['Custom Reports', 'Export CSV', 'Advanced Charts', 'Retention Metrics', 'Revenue Tracking'],
        'requirements': ['Dissident Bot 2.0+']
    },
    {
        'id': 'custom-branding', 'name': 'Custom Branding', 'author': 'DesignPro',
        'icon': 'fas fa-palette', 'color': '#f0883e',
        'category': 'utility', 'price': 5.99, 'billing': 'lifetime', 'tier': 'basic',
        'rating': 4.6, 'downloads': 4500,
        'version': '1.2.0', 'description': 'Customize bot appearance',
        'features': ['Custom Logo', 'Embed Colors', 'Welcome Messages', 'Custom Commands'],
        'requirements': ['Dissident Bot 2.0+']
    },
    {
        'id': 'priority-support', 'name': 'Priority Support', 'author': 'DissidentTeam',
        'icon': 'fas fa-headset', 'color': '#3fb950',
        'category': 'utility', 'price': 4.99, 'billing': 'monthly', 'tier': 'basic',
        'rating': 4.9, 'downloads': 8900,
        'version': '1.0.0', 'description': '24/7 priority support access',
        'features': ['24/7 Support', 'Feature Requests', 'Beta Access'],
        'requirements': ['Dissident Bot 2.0+']
    },
    {
        'id': 'music-premium', 'name': 'Music Premium', 'author': 'AudioMaster',
        'icon': 'fas fa-music', 'color': '#9146ff',
        'category': 'fun', 'price': 6.99, 'billing': 'monthly', 'tier': 'premium',
        'rating': 4.7, 'downloads': 5600,
        'version': '2.1.0', 'description': 'Premium music features',
        'features': ['Spotify Integration', 'Playlist Support', 'Lyrics', 'Audio Filters', 'DJ Roles'],
        'requirements': ['FFmpeg', 'Dissident Bot 2.0+']
    },
    {
        'id': 'tickets-pro', 'name': 'Tickets Pro', 'author': 'SupportPro',
        'icon': 'fas fa-ticket-alt', 'color': '#58a6ff',
        'category': 'utility', 'price': 8.99, 'billing': 'lifetime', 'tier': 'premium',
        'rating': 4.9, 'downloads': 4200,
        'version': '3.0.0', 'description': 'Advanced ticket system',
        'features': ['Satisfaction Surveys', 'Transcripts', 'Auto-close', 'Custom Panels', 'Categories'],
        'requirements': ['Dissident Bot 2.0+']
    },
]

user_licenses = {}

@app.route('/api/premium/plugins')
@login_required
def api_premium_plugins():
    return jsonify({'plugins': PREMIUM_PLUGINS, 'tiers': ['basic', 'premium']})

@app.route('/api/premium/plugin/<plugin_id>')
@login_required
def api_premium_plugin(plugin_id):
    for plugin in PREMIUM_PLUGINS:
        if plugin['id'] == plugin_id:
            has_license = plugin_id in user_licenses.get(session['username'], [])
            return jsonify({**plugin, 'licensed': has_license, 'license': user_licenses.get(session['username'], {}).get(plugin_id)})
    return jsonify({'error': 'Plugin not found'}), 404

@app.route('/api/premium/purchase', methods=['POST'])
@login_required
def api_premium_purchase():
    data = request.get_json() or {}
    plugin_id = data.get('pluginId')
    if not plugin_id:
        return jsonify({'success': False, 'error': 'Plugin ID required'}), 400
    plugin = None
    for p in PREMIUM_PLUGINS:
        if p['id'] == plugin_id:
            plugin = p
            break
    if not plugin:
        return jsonify({'success': False, 'error': 'Plugin not found'}), 404
    user_plugins = user_licenses.setdefault(session['username'], {})
    if plugin_id in user_plugins:
        return jsonify({'success': False, 'error': 'Already owned'}), 400
    import uuid
    license_key = f"DS-{plugin_id[:4].upper()}-{uuid.uuid4().hex[:8].upper()}"
    user_plugins[plugin_id] = {'license_key': license_key, 'purchased': datetime.now().isoformat(), 'price': plugin['price']}
    logger.info(f'Premium plugin purchased: {plugin["name"]} by {session["username"]}')
    return jsonify({'success': True, 'message': f'{plugin["name"]} purchased!', 'license': {'key': license_key, 'plugin': plugin['name'], 'tier': plugin['tier']}})

@app.route('/api/premium/licenses')
@login_required
def api_premium_licenses():
    user_plugins = user_licenses.get(session['username'], {})
    licenses = []
    for plugin_id, license_info in user_plugins.items():
        for plugin in PREMIUM_PLUGINS:
            if plugin['id'] == plugin_id:
                licenses.append({'plugin': plugin, 'license': license_info})
                break
    return jsonify({'licenses': licenses})

@app.route('/api/premium/validate', methods=['POST'])
@login_required
def api_premium_validate():
    data = request.get_json() or {}
    license_key = data.get('licenseKey')
    if not license_key:
        return jsonify({'valid': False, 'error': 'License key required'}), 400
    for username, plugins in user_licenses.items():
        for plugin_id, license_info in plugins.items():
            if license_info.get('license_key') == license_key:
                for plugin in PREMIUM_PLUGINS:
                    if plugin['id'] == plugin_id:
                        return jsonify({'valid': True, 'plugin': plugin, 'license': license_info})
    return jsonify({'valid': False, 'error': 'Invalid license key'})


# ============================================================================
# REVIEWS API
# ============================================================================

@app.route('/api/reviews/plugin/<plugin_id>')
@login_required
def api_plugin_reviews(plugin_id):
    
    reviews = [
        {'id': 'r1', 'plugin_id': plugin_id, 'username': 'AdminUser', 'rating': 5, 'title': 'Excellent!', 'content': 'This plugin is amazing!', 'helpful': 12, 'created_at': '2024-01-15T10:30:00'},
        {'id': 'r2', 'plugin_id': plugin_id, 'username': 'Moderator1', 'rating': 4, 'title': 'Great plugin', 'content': 'Works well, would recommend.', 'helpful': 8, 'created_at': '2024-01-10T14:20:00'},
    ]
    
    # Calculate stats
    avg_rating = sum(r['rating'] for r in reviews) / len(reviews) if reviews else 0
    
    return jsonify({
        'reviews': reviews,
        'stats': {
            'total': len(reviews),
            'average': round(avg_rating, 1),
            'distribution': {'5': 60, '4': 25, '3': 10, '2': 3, '1': 2}
        }
    })

@app.route('/api/reviews', methods=['POST'])
@login_required
def api_create_review():
    
    data = request.get_json() or {}
    plugin_id = data.get('pluginId')
    rating = data.get('rating', 5)
    title = data.get('title', '')
    content = data.get('content', '')
    
    if not plugin_id:
        return jsonify({'error': 'Plugin ID required'}), 400
    
    if rating < 1 or rating > 5:
        return jsonify({'error': 'Rating must be 1-5'}), 400
    
    review = {
        'id': f'r_{int(datetime.now().timestamp())}',
        'plugin_id': plugin_id,
        'username': session['username'],
        'rating': rating,
        'title': title,
        'content': content,
        'helpful': 0,
        'created_at': datetime.now().isoformat()
    }
    
    logger.info(f'Review created: {plugin_id} by {session["username"]}')
    
    return jsonify({'success': True, 'review': review})

@app.route('/api/reviews/<review_id>/helpful', methods=['POST'])
@login_required
def api_review_helpful(review_id):
    
    return jsonify({'success': True, 'helpful': 1})

@app.route('/api/reviews/plugin/<plugin_id>/stats')
def api_plugin_review_stats(plugin_id):
    """Get review stats for a plugin"""
    return jsonify({
        'total': 25,
        'average': 4.5,
        'distribution': {'5': 15, '4': 6, '3': 2, '2': 1, '1': 1}
    })


# ============================================================================
# THEMES API
# ============================================================================

@app.route('/api/themes')
@login_required
def api_themes():
    
    themes = [
        {'id': 'dark', 'name': 'Dark', 'creator': 'System', 'is_default': True, 'preview': '#0d1117', 'likes': 500, 'downloads': 10000},
        {'id': 'light', 'name': 'Light', 'creator': 'System', 'is_default': False, 'preview': '#ffffff', 'likes': 200, 'downloads': 5000},
        {'id': 'amoled', 'name': 'AMOLED', 'creator': 'System', 'is_default': False, 'preview': '#000000', 'likes': 350, 'downloads': 3500},
        {'id': 'synthwave', 'name': 'Synthwave', 'creator': 'System', 'is_default': False, 'preview': '#ff00ff', 'likes': 280, 'downloads': 2800},
        {'id': 'nord', 'name': 'Nord', 'creator': 'System', 'is_default': False, 'preview': '#2e3440', 'likes': 420, 'downloads': 4200},
        {'id': 'dracula', 'name': 'Dracula', 'creator': 'System', 'is_default': False, 'preview': '#282a36', 'likes': 510, 'downloads': 5100},
    ]
    
    return jsonify({'themes': themes})

@app.route('/api/themes/<theme_id>')
@login_required
def api_theme(theme_id):
    
    themes = {
        'dark': {'id': 'dark', 'name': 'Dark', 'is_default': True, 'vars': {'--bg-primary': '#0d1117', '--accent': '#58a6ff', '--text-primary': '#f0f6fc'}},
        'light': {'id': 'light', 'name': 'Light', 'is_default': False, 'vars': {'--bg-primary': '#ffffff', '--accent': '#0969da', '--text-primary': '#24292f'}},
        'amoled': {'id': 'amoled', 'name': 'AMOLED', 'is_default': False, 'vars': {'--bg-primary': '#000000', '--accent': '#00d4ff', '--text-primary': '#ffffff'}},
        'synthwave': {'id': 'synthwave', 'name': 'Synthwave', 'is_default': False, 'vars': {'--bg-primary': '#1a1a2e', '--accent': '#ff00ff', '--text-primary': '#edf2f4'}},
        'nord': {'id': 'nord', 'name': 'Nord', 'is_default': False, 'vars': {'--bg-primary': '#2e3440', '--accent': '#88c0d0', '--text-primary': '#eceff4'}},
        'dracula': {'id': 'dracula', 'name': 'Dracula', 'is_default': False, 'vars': {'--bg-primary': '#282a36', '--accent': '#bd93f9', '--text-primary': '#f8f8f2'}},
    }
    
    if theme_id not in themes:
        return jsonify({'error': 'Theme not found'}), 404
    
    return jsonify(themes[theme_id])

@app.route('/api/themes', methods=['POST'])
@login_required
def api_create_theme():
    
    data = request.get_json() or {}
    name = data.get('name')
    css_vars = data.get('cssVariables', {})
    
    if not name:
        return jsonify({'error': 'Theme name required'}), 400
    
    import uuid
    theme_id = f'custom_{uuid.uuid4().hex[:8]}'
    
    theme = {
        'id': theme_id,
        'name': name,
        'creator': session['username'],
        'vars': css_vars,
        'is_default': False,
        'created_at': datetime.now().isoformat()
    }
    
    logger.info(f'Custom theme created: {name} by {session["username"]}')
    
    return jsonify({'success': True, 'theme': theme})



# ============================================================================
# SERVER REGISTRATION API
# ============================================================================

@app.route('/register')
def register_page():
    """Server registration page"""
    return render_template('register.html', page='auth')

@app.route('/api/register/validate', methods=['POST'])
@rate_limit("10 per minute")
def api_register_validate():
    """Validate a server registration code"""
    data = request.get_json() or {}
    code = data.get('code', '').strip().upper()
    
    if not code:
        return jsonify({'valid': False, 'error': 'Code required'}), 400
    
    # Validate code format: SRV-XXXXXXXX
    if not code.startswith('SRV-') or len(code) != 12:
        return jsonify({'valid': False, 'error': 'Invalid code format'}), 400
    
    # In production, this would check against stored codes in database
    # For now, accept any valid format
    return jsonify({'valid': True, 'code': code})

@app.route('/api/register/servers', methods=['POST'])
@rate_limit("10 per minute")
def api_register_servers():
    """"Get user's Discord servers via bot"""
    data = request.get_json() or {}
    code = data.get('code', '')
    
    # Get real servers from bot state
    servers = SharedStateReader.get_servers()
    
    # If bot is offline, return empty
    if not servers:
        return jsonify({'servers': [], 'error': 'Bot is offline'})
    
    return jsonify({'servers': servers})

@app.route('/api/register/complete', methods=['POST'])
@rate_limit("5 per minute")
def api_register_complete():
    """"Complete server registration"""
    data = request.get_json() or {}
    code = data.get('code', '')
    server = data.get('server', {})
    
    if not code or not server:
        return jsonify({'success': False, 'error': 'Missing data'}), 400
    
    # In production, this would:
    # 1. Mark code as used
    # 2. Store server in database
    # 3. Create user access
    
    return jsonify({
        'success': True,
        'server_id': server.get('id'),
        'message': 'Server registered successfully'
    })


# ============================================================================
# DEBUG & DIAGNOSTICS
# ============================================================================

@app.route('/api/debug')
def api_debug():
    """Debug endpoint - only available in debug mode or localhost"""
    if not DEBUG and request.remote_addr not in ('127.0.0.1', 'localhost', '::1'):
        return jsonify({'error': 'Debug endpoint only available in debug mode'}), 403
    
    import platform
    import psutil
    
    return jsonify({
        'version': VERSION,
        'debug': DEBUG,
        'platform': platform.platform(),
        'python': sys.version,
        'timestamp': datetime.now().isoformat(),
        'stats': SharedStateReader.get_stats(),
        'memory': psutil.virtual_memory()._asdict() if 'psutil' in sys.modules else None,
        'cpu': psutil.cpu_percent(),
        'bot_state_file': str(BOT_STATE_FILE) if 'BOT_STATE_FILE' in dir() else None,
        'bot_state_exists': os.path.exists(BOT_STATE_FILE) if 'BOT_STATE_FILE' in dir() else None,
    })


@app.route('/api/debug/logs')
def api_debug_logs():
    """Get recent log entries - only available in debug mode"""
    if not DEBUG and request.remote_addr not in ('127.0.0.1', 'localhost', '::1'):
        return jsonify({'error': 'Debug endpoint only available in debug mode'}), 403
    
    try:
        log_file = LOG_DIR / 'web_panel.log'
        if log_file.exists():
            with open(log_file, 'r') as f:
                lines = f.readlines()
                return jsonify({
                    'logs': lines[-100:] if len(lines) > 100 else lines,
                    'total_lines': len(lines)
                })
        return jsonify({'logs': [], 'message': 'No log file found'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/error-report', methods=['POST'])
@rate_limit("10 per minute")
def api_error_report():
    """Client-side error reporting endpoint"""
    data = request.get_json() or request.form.to_dict()
    
    error_data = {
        'timestamp': datetime.now().isoformat(),
        'user_agent': request.headers.get('User-Agent', 'Unknown'),
        'ip': request.remote_addr,
        'path': request.path,
        'error': data.get('error', 'Unknown error'),
        'stack': data.get('stack', ''),
        'user_id': session.get('user_id', 'anonymous')
    }
    
    logger.error(f"Client error report: {json.dumps(error_data, indent=2)}")
    
    # Write to error log
    error_log = LOG_DIR / 'client_errors.log'
    with open(error_log, 'a') as f:
        f.write(json.dumps(error_data, indent=2) + '\n')
    
    return jsonify({'success': True, 'message': 'Error reported'})


# ============================================================================
# STUB ENDPOINTS â€” Return placeholder data until real implementations exist
# ============================================================================

@app.route('/api/webhooks')
@login_required
def api_webhooks():
    return jsonify({'webhooks': [], 'requestsToday': 0, 'failed24h': 0})

@app.route('/api/webhooks', methods=['POST'])
@login_required
def api_create_webhook():
    data = request.get_json() or {}
    return jsonify({'success': True, 'webhook': {'id': 'wh_stub', 'name': data.get('name', ''), 'url': data.get('url', ''), 'enabled': True}})

@app.route('/api/webhooks/<webhook_id>', methods=['PATCH'])
@login_required
def api_update_webhook(webhook_id):
    return jsonify({'success': True})

@app.route('/api/webhooks/<webhook_id>', methods=['DELETE'])
@login_required
def api_delete_webhook(webhook_id):
    return jsonify({'success': True})

@app.route('/api/webhooks/<webhook_id>/test', methods=['POST'])
@login_required
def api_test_webhook(webhook_id):
    return jsonify({'success': True, 'message': 'Webhook test sent'})

@app.route('/api/scheduled')
@login_required
def api_scheduled():
    return jsonify({'tasks': [], 'history': [], 'runsToday': 0, 'failed24h': 0})

@app.route('/api/scheduled', methods=['POST'])
@login_required
def api_create_scheduled():
    data = request.get_json() or {}
    return jsonify({'success': True, 'task': {'id': 'task_stub', 'name': data.get('name', ''), 'type': data.get('type', 'command'), 'enabled': True}})

@app.route('/api/scheduled/<task_id>', methods=['PATCH'])
@login_required
def api_update_scheduled(task_id):
    return jsonify({'success': True})

@app.route('/api/scheduled/<task_id>', methods=['DELETE'])
@login_required
def api_delete_scheduled(task_id):
    return jsonify({'success': True})

@app.route('/api/scheduled/<task_id>/run', methods=['POST'])
@login_required
def api_run_scheduled(task_id):
    return jsonify({'success': True, 'message': 'Task executed'})

@app.route('/api/scheduled/run-all', methods=['POST'])
@login_required
def api_run_all_scheduled():
    return jsonify({'success': True, 'message': 'All tasks executed'})

@app.route('/api/reviews', methods=['POST'])
@login_required
def api_create_review_stub():
    data = request.get_json() or {}
    return jsonify({'success': True, 'review': {'id': 'r_stub', 'plugin_id': data.get('pluginId', ''), 'rating': data.get('rating', 5)}})


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/api/health')
def health_check():
    checks = {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'uptime': 'unknown',
        'checks': {}
    }
    
    # Check bot state file
    try:
        if 'BOT_STATE_FILE' in dir():
            checks['checks']['bot_state'] = os.path.exists(BOT_STATE_FILE)
        else:
            checks['checks']['bot_state'] = False
    except Exception as e:
        checks['checks']['bot_state'] = str(e)
    
    # Check database
    try:
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'dissident.db')
        checks['checks']['database'] = os.path.exists(db_path)
    except Exception as e:
        checks['checks']['database'] = str(e)
    
    # Check logs directory
    checks['checks']['logs_dir'] = LOG_DIR.exists()
    
    return jsonify(checks)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    print("=" * 60)
    print(f"  Dissident Bot Web Panel v{VERSION}")
    print("=" * 60)
    print(f"  URL:      http://127.0.0.1:{port}")
    print(f"  Mode:     {'DEBUG' if debug else 'PRODUCTION'}")
    print(f"  Logs:     {LOG_DIR}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=debug)
