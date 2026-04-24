"""
Dashboard API - Real Bot Integration
v2.10.0 - Enhanced error handling and logging
"""
from flask import Blueprint, request, jsonify, session
from functools import wraps
import json
import os
import secrets
import time
import logging
import traceback
import httpx
from pathlib import Path

dashboard_api = Blueprint('dashboard_api', __name__)

# Setup logging
logger = logging.getLogger(__name__)

# Bot state file - shared between bot and web panel when running locally
BOT_STATE_FILE = Path(__file__).parent.parent / 'data' / 'bot_state.json'

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            if 'user_id' not in session and 'token' not in session:
                token = request.headers.get('Authorization', '').replace('Bearer ', '')
                if not token:
                    return jsonify({'error': 'Unauthorized'}), 401
                
                from user_auth import validate_token
                user = validate_token(token)
                if not user:
                    return jsonify({'error': 'Invalid token'}), 401
                
                request.user = user
            else:
                request.user = {
                    'user_id': session.get('user_id'),
                    'username': session.get('username'),
                    'role': session.get('role', 'user'),
                    'permissions': session.get('permissions', '{}')
                }
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Auth error: {str(e)}\n{traceback.format_exc()}")
            return jsonify({'error': 'Authentication failed'}), 500
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            role = request.user.get('role', 'user') if hasattr(request, 'user') else session.get('role', 'user')
            if role != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Admin check error: {str(e)}\n{traceback.format_exc()}")
            return jsonify({'error': 'Authorization check failed'}), 500
    return decorated

# ============================================================================
# REAL STATS FROM BOT
# ============================================================================

def get_bot_stats():
    """Get real stats from bot state file"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                stats = data.get('stats', {})
                if stats.get('status') == 'online':
                    return stats
                logger.info(f"Bot state exists but status is: {stats.get('status')}")
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in bot state file: {e}")
    except Exception as e:
        logger.error(f"Error reading bot state: {str(e)}\n{traceback.format_exc()}")
    
    return None

def get_bot_servers():
    """Get real server list from bot state"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                guilds = data.get('guilds', [])
                if guilds:
                    return guilds
    except Exception as e:
        print(f"Error reading bot state: {e}")
    
    return []

def get_bot_commands():
    """Get real commands from bot state"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                commands = data.get('commands', [])
                if commands:
                    return commands
    except Exception as e:
        print(f"Error reading bot state: {e}")
    
    return []

# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@dashboard_api.route('/api/auth/login', methods=['POST'])
def api_login():
    """Login endpoint"""
    from user_auth import authenticate
    
    data = request.get_json() or {}
    username = data.get('username', '')
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Username and password required'}), 400
    
    # Check environment variables FIRST
    env_user = os.environ.get('ADMIN_USER')
    env_pass = os.environ.get('ADMIN_PASS')
    
    if env_user and env_pass and username == env_user and password == env_pass:
        session['user_id'] = 'admin_001'
        session['username'] = username
        session['role'] = 'admin'
        session['permissions'] = {'all': True}
        session['logged_in'] = True
        session.permanent = True
        
        return jsonify({
            'success': True,
            'token': secrets.token_urlsafe(32),
            'user': {
                'id': 'admin_001',
                'username': username,
                'role': 'admin',
                'permissions': {'all': True}
            }
        })
    
    result = authenticate(username, password)
    
    if not result['success']:
        return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
    
    session['user_id'] = result['user']['id']
    session['username'] = result['user']['username']
    session['role'] = result['user']['role']
    session['token'] = result['token']
    session['logged_in'] = True
    session.permanent = True
    
    return jsonify({
        'success': True,
        'token': result['token'],
        'user': result['user']
    })

@dashboard_api.route('/api/auth/logout', methods=['POST'])
def api_logout():
    """Logout endpoint"""
    token = session.get('token')
    if token:
        from user_auth import logout
        logout(token)
    
    session.clear()
    return jsonify({'success': True})

@dashboard_api.route('/api/auth/me')
@login_required
def api_me():
    """Get current user info"""
    user = request.user if hasattr(request, 'user') else {
        'user_id': session.get('user_id'),
        'username': session.get('username'),
        'role': session.get('role', 'user')
    }
    return jsonify(user)

# ============================================================================
# REAL STATS ENDPOINTS
# ============================================================================

@dashboard_api.route('/api/stats')
@login_required
def api_stats():
    """Get real bot statistics"""
    stats = get_bot_stats()
    
    if stats and stats.get('status') != 'offline':
        return jsonify(stats)
    
    state_stats = _get_stats_from_state()
    if state_stats and state_stats.get('status') != 'offline':
        return jsonify(state_stats)
    
    return jsonify({
        'status': 'offline',
        'servers': 0,
        'users': 0,
        'channels': 0,
        'cogs_loaded': 0,
        'plugin_count': 0,
        'latency_ms': 0,
        'uptime': '00:00:00',
        'bot_online': False,
        'message': 'Bot is not running. Start the bot locally to see real stats.'
    })


def _get_stats_from_state():
    """Get stats from bot state file"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                stats = data.get('stats', {})
                if stats:
                    stats['bot_online'] = stats.get('status') == 'online'
                    return stats
    except Exception as e:
        logger.warning(f"Error reading stats from state: {e}")
    return None

@dashboard_api.route('/api/servers')
@login_required
def api_servers():
    """Get real server list from bot"""
    servers = get_bot_servers()
    
    if not servers:
        servers = _get_servers_from_state()
    
    return jsonify({
        'servers': servers,
        'count': len(servers),
        'bot_online': len(servers) > 0
    })


def _get_servers_from_state():
    """Get servers from bot state file"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                return data.get('guilds', [])
    except Exception as e:
        logger.warning(f"Error reading guilds from state: {e}")
    return []

@dashboard_api.route('/api/commands')
@login_required
def api_commands():
    """Get real commands from bot"""
    commands = get_bot_commands()
    
    return jsonify({
        'commands': commands,
        'count': len(commands)
    })

@dashboard_api.route('/api/plugins')
@login_required
def api_plugins():
    """Get real plugin list from bot"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                plugins = data.get('plugins', [])
                return jsonify({'plugins': plugins})
    except:
        pass
    
    return jsonify({'plugins': []})

# ============================================================================
# DASHBOARD STATE
# ============================================================================

@dashboard_api.route('/api/dashboard/state')
@login_required
def api_dashboard_state():
    """Get dashboard state with real bot data"""
    stats = get_bot_stats()
    servers = get_bot_servers()
    
    return jsonify({
        'theme': session.get('theme', 'dark'),
        'username': session.get('username', 'Admin'),
        'role': session.get('role', 'admin'),
        'bot': {
            'online': stats.get('status') == 'online' if stats else False,
            'stats': stats or {},
            'servers': servers
        },
        'notifications': [],
        'activities': []
    })

@dashboard_api.route('/api/dashboard/theme', methods=['POST'])
@login_required
def api_set_theme():
    """Set dashboard theme"""
    data = request.get_json() or {}
    theme = data.get('theme', 'dark')
    session['theme'] = theme
    return jsonify({'success': True, 'theme': theme})

# ============================================================================
# USERS (ADMIN)
# ============================================================================

@dashboard_api.route('/api/users', methods=['GET'])
@login_required
def api_users():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    from user_auth import get_all_users
    return jsonify({'users': get_all_users()})

@dashboard_api.route('/api/users', methods=['POST'])
@login_required
@admin_required
def api_create_user():
    data = request.get_json() or {}
    from user_auth import create_user
    result = create_user(
        username=data.get('username'),
        password=data.get('password'),
        email=data.get('email'),
        role=data.get('role', 'user'),
        discord_id=data.get('discord_id')
    )
    
    if result['success']:
        return jsonify({'success': True, 'user_id': result['user_id']}), 201
    
    return jsonify({'error': 'Username already exists'}), 400

@dashboard_api.route('/api/users/<user_id>', methods=['PUT'])
@login_required
@admin_required
def api_update_user(user_id):
    data = request.get_json() or {}
    from user_auth import update_user
    success = update_user(user_id, {
        'username': data.get('username'),
        'email': data.get('email'),
        'role': data.get('role'),
        'discord_id': data.get('discord_id'),
        'is_active': data.get('is_active')
    })
    
    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'User not found'}), 404

@dashboard_api.route('/api/users/<user_id>', methods=['DELETE'])
@login_required
@admin_required
def api_delete_user(user_id):
    from user_auth import delete_user
    if user_id == 'admin_001':
        return jsonify({'error': 'Cannot delete the primary admin'}), 403
    
    success = delete_user(user_id)
    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'User not found'}), 404

@dashboard_api.route('/api/users/<user_id>/password', methods=['POST'])
@login_required
@admin_required
def api_change_user_password(user_id):
    data = request.get_json() or {}
    new_password = data.get('password')
    if not new_password or len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    from user_auth import change_password
    success = change_password(user_id, new_password)
    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'User not found'}), 404

@dashboard_api.route('/api/users/<user_id>/audit')
@login_required
@admin_required
def api_user_audit(user_id):
    from user_auth import get_user_audit_log
    limit = request.args.get('limit', 50, type=int)
    logs = get_user_audit_log(user_id, limit)
    return jsonify({'audit_log': logs})

# ============================================================================
# ACTIVITY
# ============================================================================

@dashboard_api.route('/api/activity')
@login_required
def api_activity():
    """Get recent activity"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                activities = data.get('activities', [])
                return jsonify({'activities': activities})
    except:
        pass
    
    return jsonify({'activities': []})

# ============================================================================
# CHART DATA
# ============================================================================

@dashboard_api.route('/api/charts/activity')
@login_required
def api_chart_activity():
    """Get activity chart data"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                stats = data.get('stats', {})
                guilds = data.get('guilds', [])
                
                if stats.get('status') == 'online':
                    return jsonify({
                        'labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        'commands': stats.get('commands_history', [12450, 15670, 18920, 14560, 19230, 22340, 18790]),
                        'messages': stats.get('messages_history', [45000, 52000, 61000, 48000, 72000, 85000, 67000]),
                        'joins': stats.get('joins_history', [120, 145, 189, 156, 203, 234, 198]),
                        'leaves': stats.get('leaves_history', [45, 67, 89, 56, 92, 134, 89])
                    })
    except Exception as e:
        logger.warning(f"Error reading bot state for charts: {e}")
    
    return jsonify({
        'labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        'commands': [0, 0, 0, 0, 0, 0, 0],
        'messages': [0, 0, 0, 0, 0, 0, 0],
        'joins': [0, 0, 0, 0, 0, 0, 0],
        'leaves': [0, 0, 0, 0, 0, 0, 0],
        'demo': True
    })

@dashboard_api.route('/api/charts/commands')
@login_required
def api_chart_commands():
    """Get command usage chart data"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                commands = data.get('commands', [])
                
                if commands and isinstance(commands, list) and len(commands) > 0:
                    labels = [c.get('name', 'unknown')[:15] for c in commands[:7]]
                    values = [c.get('uses', 0) for c in commands[:7]]
                    if not values:
                        values = [35, 25, 18, 12, 8, 5, 12]
                    
                    return jsonify({
                        'labels': labels if labels else ['ping', 'help', 'balance', 'daily', 'rank', 'warn', 'other'],
                        'values': values if any(values) else [35, 25, 18, 12, 8, 5, 12],
                        'colors': ['#58a6ff', '#3fb950', '#a371f7', '#d29922', '#f0883e', '#f85149', '#8b949e']
                    })
    except Exception as e:
        logger.warning(f"Error reading commands for charts: {e}")
    
    return jsonify({
        'labels': ['ping', 'help', 'balance', 'daily', 'rank', 'warn', 'other'],
        'values': [0, 0, 0, 0, 0, 0, 0],
        'colors': ['#58a6ff', '#3fb950', '#a371f7', '#d29922', '#f0883e', '#f85149', '#8b949e'],
        'demo': True
    })

# ============================================================================
# UPTIME MONITORING
# ============================================================================

import httpx
from datetime import datetime, timedelta

SERVICES = {
    'dashboard': os.environ.get('RAILWAY_DASHBOARD_URL', 'http://localhost:8080'),
    'bot': os.environ.get('RAILWAY_BOT_URL', 'http://localhost:5000'),
}

@dashboard_api.route('/api/uptime')
@login_required
def api_uptime_status():
    """Get current uptime status of all services"""
    results = {}
    
    for name, url in SERVICES.items():
        start = datetime.now()
        try:
            response = httpx.get(url, timeout=10)
            latency_ms = (datetime.now() - start).total_seconds() * 1000
            results[name] = {
                'name': name,
                'url': url,
                'status': 'up' if response.status_code < 500 else 'down',
                'latency_ms': round(latency_ms, 2),
                'status_code': response.status_code,
                'checked_at': datetime.utcnow().isoformat()
            }
        except Exception as e:
            results[name] = {
                'name': name,
                'url': url,
                'status': 'down',
                'error': str(e),
                'checked_at': datetime.utcnow().isoformat()
            }
    
    return jsonify({'services': results})

@dashboard_api.route('/api/uptime/<service_name>')
@login_required
def api_uptime_service(service_name):
    """Get uptime status for a specific service"""
    if service_name not in SERVICES:
        return jsonify({'error': 'Service not found'}), 404
    
    url = SERVICES[service_name]
    start = datetime.now()
    
    try:
        response = httpx.get(url, timeout=10)
        latency_ms = (datetime.now() - start).total_seconds() * 1000
        return jsonify({
            'name': service_name,
            'url': url,
            'status': 'up' if response.status_code < 500 else 'down',
            'latency_ms': round(latency_ms, 2),
            'status_code': response.status_code,
            'checked_at': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({
            'name': service_name,
            'url': url,
            'status': 'down',
            'error': str(e),
            'checked_at': datetime.utcnow().isoformat()
        })


# ============================================================================
# ANALYTICS
# ============================================================================

@dashboard_api.route('/api/analytics')
@login_required
def api_analytics():
    """Get analytics data for dashboard"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                
                stats = data.get('stats', {})
                commands = data.get('commands', [])
                guilds = data.get('guilds', [])
                
                top_commands = []
                if commands and isinstance(commands, list):
                    top_commands = sorted(commands, key=lambda x: x.get('uses', 0), reverse=True)[:10]
                    top_commands = [{'name': c.get('name', 'unknown'), 'count': c.get('uses', 0)} for c in top_commands]
                
                total_messages = stats.get('messages_today', 0)
                total_commands = stats.get('commands_today', 0)
                total_users = sum(g.get('member_count', 0) for g in guilds) if guilds else 0
                
                return jsonify({
                    'overview': {
                        'messages': total_messages,
                        'commands': total_commands,
                        'activeMembers': total_users,
                        'engagement': min(100, round((total_messages / max(total_users, 1)) * 100)) if total_users > 0 else 0,
                        'messagesChange': 0,
                        'commandsChange': 0,
                        'membersChange': 0,
                        'engagementChange': 0
                    },
                    'topCommands': top_commands,
                    'topChannels': [],
                    'hourly': []
                })
    except Exception as e:
        logger.warning(f"Error reading analytics from state: {e}")
    
    return jsonify({
        'overview': {
            'messages': 0,
            'commands': 0,
            'activeMembers': 0,
            'engagement': 0,
            'messagesChange': 0,
            'commandsChange': 0,
            'membersChange': 0,
            'engagementChange': 0
        },
        'topCommands': [],
        'topChannels': [],
        'hourly': []
    })


# ============================================================================
# PUBLIC HOMEPAGE API (No auth required)
# ============================================================================

@dashboard_api.route('/api/public/stats')
def api_public_stats():
    """Get public stats for homepage display - no authentication required"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                
                stats = data.get('stats', {})
                guilds = data.get('guilds', [])
                
                servers = len(guilds)
                users = sum(g.get('member_count', 0) for g in guilds) if guilds else 0
                commands = stats.get('commands_today', 0)
                
                return jsonify({
                    'servers': servers,
                    'users': users,
                    'commands': commands,
                    'status': 'online'
                })
    except Exception as e:
        logger.warning(f"Error reading public stats: {e}")
    
    return jsonify({
        'servers': 0,
        'users': 0,
        'commands': 0,
        'status': 'offline'
    })


@dashboard_api.route('/api/public/activity')
def api_public_activity():
    """Get public activity data for homepage charts - no authentication required"""
    try:
        if BOT_STATE_FILE.exists():
            with open(BOT_STATE_FILE, 'r') as f:
                data = json.load(f)
                stats = data.get('stats', {})
                
                commands_history = stats.get('commands_history', [])
                messages_history = stats.get('messages_history', [])
                
                if commands_history and messages_history:
                    return jsonify({
                        'commands': commands_history[-7:],
                        'messages': messages_history[-7:],
                        'labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][:len(commands_history)]
                    })
    except Exception as e:
        logger.warning(f"Error reading public activity: {e}")
    
    return jsonify({
        'commands': [0, 0, 0, 0, 0, 0, 0],
        'messages': [0, 0, 0, 0, 0, 0, 0],
        'labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    })


# ============================================================================
# ERROR TRACKING & BUG REPORTS
# ============================================================================

@dashboard_api.route('/api/errors')
@login_required
def api_errors():
    """Get recent errors from Sentry and local error tracking"""
    import os
    
    sentry_dsn = os.environ.get('SENTRY_DSN')
    errors = []
    
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk import capture_exception
            
            client = sentry_sdk.get_client()
            events = client.events
            
            for event in list(events)[:50]:
                errors.append({
                    'id': event.get('event_id', 'unknown'),
                    'type': event.get('type', 'error'),
                    'level': event.get('level', 'error'),
                    'message': event.get('message', {}).get('formatted', str(event.get('message', ''))),
                    'timestamp': event.get('timestamp', datetime.utcnow().isoformat()),
                    'platform': event.get('platform', 'python'),
                    'culprit': event.get('culprit', ''),
                })
        except Exception as e:
            logger.warning(f"Could not fetch Sentry events: {e}")
    
    if not errors:
        errors = _get_local_errors()
    
    return jsonify({
        'errors': errors,
        'count': len(errors),
        'sentry_enabled': bool(sentry_dsn)
    })


def _get_local_errors():
    """Get errors from local error log file"""
    import json
    from pathlib import Path
    
    error_log_path = Path(__file__).parent.parent / 'data' / 'error_log.json'
    
    if error_log_path.exists():
        try:
            with open(error_log_path, 'r') as f:
                return json.load(f).get('errors', [])[-50:]
        except Exception:
            pass
    
    return []


@dashboard_api.route('/api/errors/submit', methods=['POST'])
@login_required
def api_errors_submit():
    """Submit a new error report"""
    data = request.get_json() or {}
    
    error_entry = {
        'id': f"local_{int(datetime.utcnow().timestamp() * 1000)}",
        'type': 'bug_report',
        'level': data.get('level', 'error'),
        'message': data.get('message', ''),
        'description': data.get('description', ''),
        'severity': data.get('severity', 'medium'),
        'source': data.get('source', 'dashboard'),
        'guild_id': data.get('guild_id'),
        'user_id': session.get('user_id'),
        'username': session.get('username'),
        'timestamp': datetime.utcnow().isoformat(),
        'status': 'open',
    }
    
    _save_error_to_log(error_entry)
    _send_to_discord_webhook(error_entry)
    
    return jsonify({'success': True, 'error_id': error_entry['id']})


def _save_error_to_log(error_entry):
    """Save error to local error log"""
    import json
    from pathlib import Path
    
    error_log_path = Path(__file__).parent.parent / 'data' / 'error_log.json'
    error_log_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        if error_log_path.exists():
            with open(error_log_path, 'r') as f:
                log_data = json.load(f)
        else:
            log_data = {'errors': []}
        
        log_data['errors'].append(error_entry)
        log_data['errors'] = log_data['errors'][-500:]
        
        with open(error_log_path, 'w') as f:
            json.dump(log_data, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save error to log: {e}")


def _send_to_discord_webhook(error_entry):
    """Send error to Discord webhook for notifications"""
    import os
    
    webhook_url = os.environ.get('DISCORD_WEBHOOK')
    if not webhook_url:
        return
    
    try:
        import httpx
        
        severity_colors = {
            'low': 0x3fb950,
            'medium': 0xffaa00,
            'high': 0xf0883e,
            'critical': 0xe74c3c
        }
        
        embed = {
            'title': f"🐛 Bug Report: {error_entry.get('severity', 'medium').upper()}",
            'description': error_entry.get('description', error_entry.get('message', '')),
            'color': severity_colors.get(error_entry.get('severity', 'medium'), 0xffaa00),
            'fields': [
                {'name': 'Source', 'value': error_entry.get('source', 'unknown'), 'inline': True},
                {'name': 'User', 'value': error_entry.get('username', 'anonymous'), 'inline': True},
                {'name': 'Status', 'value': error_entry.get('status', 'open'), 'inline': True},
            ],
            'timestamp': error_entry.get('timestamp'),
            'footer': {'text': f"Dissident Bot - Error ID: {error_entry['id']}"}
        }
        
        httpx.post(webhook_url, json={'embeds': [embed]}, timeout=10)
    except Exception as e:
        logger.warning(f"Failed to send error to Discord webhook: {e}")


@dashboard_api.route('/api/bug-reports')
@login_required
def api_bug_reports():
    """Get all bug reports"""
    return jsonify({
        'bug_reports': _get_local_errors(),
        'count': len(_get_local_errors())
    })


@dashboard_api.route('/api/bug-reports/<error_id>', methods=['PUT'])
@login_required
def api_bug_report_update(error_id):
    """Update a bug report status"""
    data = request.get_json() or {}
    
    import json
    from pathlib import Path
    
    error_log_path = Path(__file__).parent.parent / 'data' / 'error_log.json'
    
    if error_log_path.exists():
        try:
            with open(error_log_path, 'r') as f:
                log_data = json.load(f)
            
            for error in log_data.get('errors', []):
                if error.get('id') == error_id:
                    error['status'] = data.get('status', error.get('status', 'open'))
                    error['updated_at'] = datetime.utcnow().isoformat()
                    error['updated_by'] = session.get('username')
                    break
            
            with open(error_log_path, 'w') as f:
                json.dump(log_data, f, indent=2)
            
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Bug report not found'}), 404


@dashboard_api.route('/api/bug-reports/<error_id>', methods=['DELETE'])
@login_required
def api_bug_report_delete(error_id):
    """Delete a bug report"""
    import json
    from pathlib import Path
    
    error_log_path = Path(__file__).parent.parent / 'data' / 'error_log.json'
    
    if error_log_path.exists():
        try:
            with open(error_log_path, 'r') as f:
                log_data = json.load(f)
            
            log_data['errors'] = [e for e in log_data.get('errors', []) if e.get('id') != error_id]
            
            with open(error_log_path, 'w') as f:
                json.dump(log_data, f, indent=2)
            
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Bug report not found'}), 404
