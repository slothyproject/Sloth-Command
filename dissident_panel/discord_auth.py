"""
Discord OAuth2 Authentication System
Allows users to login with their Discord account
"""
import secrets
import sqlite3
import json
import os
import httpx
from datetime import datetime
from pathlib import Path
from functools import wraps
from flask import Blueprint, request, redirect, session, jsonify, url_for

# Discord OAuth2 Configuration
# All secrets MUST come from environment variables (Railway)
DISCORD_CLIENT_ID = os.environ.get('DISCORD_CLIENT_ID', '')
DISCORD_CLIENT_SECRET = os.environ.get('DISCORD_CLIENT_SECRET', '')

# Build redirect URI - use Railway URL if on Railway
RAILWAY_STATIC_URL = os.environ.get('RAILWAY_STATIC_URL', '')

# The dissident panel is mounted at /bot, so the OAuth callback lives at /bot/auth/discord/callback.
# Override via DISCORD_REDIRECT_URI env var if needed.
if RAILWAY_STATIC_URL:
    # We're on Railway — panel is mounted at /bot
    DISCORD_REDIRECT_URI = os.environ.get(
        'DISCORD_REDIRECT_URI',
        f"https://{RAILWAY_STATIC_URL}/bot/auth/discord/callback",
    )
else:
    DISCORD_REDIRECT_URI = os.environ.get('DISCORD_REDIRECT_URI', 'http://127.0.0.1:5050/bot/auth/discord/callback')


print(f"[Discord OAuth] Redirect URI: {DISCORD_REDIRECT_URI}")

DISCORD_OAUTH_URL = "https://discord.com/api/oauth2"
DISCORD_API_URL = "https://discord.com/api/v10"

# Bot token for API access (optional)
BOT_TOKEN = os.environ.get('BOT_TOKEN', '')

# Scopes needed
DISCORD_SCOPES = ["identify", "guilds"]

# Database
DATA_DIR = Path(__file__).parent.parent / 'data'
DATA_DIR.mkdir(exist_ok=True)
DISCORD_AUTH_DB = DATA_DIR / 'discord_auth.db'

discord_auth = Blueprint('discord_auth', __name__, url_prefix='/auth/discord')

def get_db():
    conn = sqlite3.connect(DISCORD_AUTH_DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_discord_auth_db():
    """Initialize Discord auth database"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS discord_users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            discriminator TEXT DEFAULT '0',
            global_name TEXT,
            avatar TEXT,
            email TEXT,
            locale TEXT,
            flags INTEGER DEFAULT 0,
            mfa_enabled INTEGER DEFAULT 0,
            premium_type INTEGER DEFAULT 0,
            linked_user_id TEXT,
            linked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_login TEXT,
            login_count INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (linked_user_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS discord_sessions (
            id TEXT PRIMARY KEY,
            discord_id TEXT NOT NULL,
            access_token TEXT,
            refresh_token TEXT,
            token_type TEXT,
            expires_at TEXT,
            scopes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_activity TEXT,
            FOREIGN KEY (discord_id) REFERENCES discord_users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS linked_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id TEXT NOT NULL,
            local_user_id TEXT NOT NULL,
            linked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(discord_id),
            UNIQUE(local_user_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def generate_token():
    """Generate secure session token"""
    return secrets.token_urlsafe(32)

def log_audit(user_id, action, details=None, ip=None):
    """Log authentication events"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO audit_log (user_id, action, details, ip_address, timestamp)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, action, json.dumps(details) if details else None, ip, datetime.now().isoformat()))
    conn.commit()
    conn.close()

# ============================================
# DISCORD OAUTH2 ROUTES
# ============================================

@discord_auth.route('/debug')
def debug():
    """Debug endpoint to check session state"""
    return jsonify({
        'session_keys': list(session.keys()),
        'oauth_state': session.get('oauth_state', 'NOT SET'),
        'has_discord_id': 'discord_id' in session,
        'redirect_uri': DISCORD_REDIRECT_URI
    })

@discord_auth.route('/login')
def login():
    """Redirect to Discord OAuth2 authorization"""
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    
    # Build authorization URL
    params = {
        'client_id': DISCORD_CLIENT_ID,
        'redirect_uri': DISCORD_REDIRECT_URI,
        'response_type': 'code',
        'scope': ' '.join(DISCORD_SCOPES),
        'state': state
    }
    
    auth_url = f"{DISCORD_OAUTH_URL}/authorize?" + '&'.join(f"{k}={v}" for k, v in params.items())
    return redirect(auth_url)

@discord_auth.route('/callback')
def callback():
    """Handle Discord OAuth2 callback"""
    try:
        # Get authorization code and error
        code = request.args.get('code')
        error = request.args.get('error')
        state = request.args.get('state')
        
        if error:
            return jsonify({'error': f'OAuth error: {error}'}), 400
        
        if not code:
            return jsonify({'error': 'No authorization code received'}), 400
        
        # Clear session state
        if 'oauth_state' in session:
            session.pop('oauth_state')
        
        # Exchange code for tokens
        token_data = exchange_code_for_token(code)
        
        if not token_data:
            return jsonify({'error': 'Failed to exchange code for tokens'}), 500
        
        # Get user info from Discord
        user_info = get_discord_user(token_data['access_token'])
        
        if not user_info:
            return jsonify({'error': 'Failed to get user info'}), 500
        
        # Save user
        user = save_discord_user(user_info)
        if not user:
            return jsonify({'error': 'Failed to save user'}), 500
        
        session_token = create_discord_session(user['id'], token_data)
        if not session_token:
            return jsonify({'error': 'Failed to create session'}), 500
        
        log_audit(user['id'], 'discord_login', {'username': user['username']}, request.remote_addr)
        
        # Set session variables
        session['discord_id'] = user['id']
        session['discord_token'] = session_token
        session['username'] = user['username']
        session['avatar'] = user.get('avatar')
        session['authenticated'] = True
        session['login_type'] = 'discord'
        session['logged_in'] = True
        
        return redirect('/dashboard')
        
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@discord_auth.route('/logout')
def logout():
    """Logout from Discord session"""
    discord_id = session.get('discord_id')
    
    if discord_id:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM discord_sessions WHERE discord_id = ?', (discord_id,))
        conn.commit()
        conn.close()
    
    session.clear()
    return redirect('/login')

@discord_auth.route('/me')
def me():
    """Get current Discord user info"""
    if 'discord_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM discord_users WHERE id = ?', (session['discord_id'],))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'global_name': user['global_name'],
        'avatar': user['avatar'],
        'email': user['email'],
        'linked': user['linked_user_id'] is not None
    })

@discord_auth.route('/servers')
def get_servers():
    """Get user's Discord servers"""
    if 'discord_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT access_token FROM discord_sessions 
        WHERE discord_id = ? AND expires_at > ?
    ''', (session['discord_id'], datetime.now().isoformat()))
    session_row = cursor.fetchone()
    conn.close()
    
    if not session_row:
        return jsonify({'error': 'Session expired'}), 401
    
    headers = {'Authorization': f"Bearer {session_row['access_token']}"}
    try:
        response = httpx.get(f"{DISCORD_API_URL}/users/@me/guilds", headers=headers, timeout=10)
    except httpx.HTTPError:
        return jsonify({'error': 'Failed to connect to Discord'}), 502
    
    if response.status_code != 200:
        return jsonify({'error': 'Failed to fetch servers'}), response.status_code
    
    guilds = response.json()
    
    return jsonify({
        'servers': [
            {
                'id': g['id'],
                'name': g['name'],
                'icon': g.get('icon'),
                'owner': g.get('owner', False),
                'permissions': g.get('permissions')
            }
            for g in guilds
        ]
    })

# ============================================
# HELPER FUNCTIONS
# ============================================

def exchange_code_for_token(code):
    """Exchange authorization code for access token"""
    import urllib.parse
    
    data = {
        'client_id': DISCORD_CLIENT_ID,
        'client_secret': DISCORD_CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': DISCORD_REDIRECT_URI
    }
    
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    
    try:
        response = httpx.post(f"{DISCORD_OAUTH_URL}/token", data=data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except httpx.HTTPError:
        return None

def get_discord_user(access_token):
    """Get user info from Discord API"""
    headers = {'Authorization': f"Bearer {access_token}"}
    
    try:
        response = httpx.get(f"{DISCORD_API_URL}/users/@me", headers=headers, timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except httpx.HTTPError:
        return None

def save_discord_user(user_data):
    """Save or update Discord user in database"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO discord_users (id, username, discriminator, global_name, avatar, email, last_login, login_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            discriminator = excluded.discriminator,
            global_name = excluded.global_name,
            avatar = excluded.avatar,
            email = excluded.email,
            last_login = excluded.last_login,
            login_count = login_count + 1
    ''', (
        user_data['id'],
        user_data.get('username', ''),
        user_data.get('discriminator', '0'),
        user_data.get('global_name'),
        user_data.get('avatar'),
        user_data.get('email'),
        datetime.now().isoformat(),
        1
    ))
    
    cursor.execute('SELECT * FROM discord_users WHERE id = ?', (user_data['id'],))
    user = cursor.fetchone()
    
    conn.commit()
    conn.close()
    
    return dict(user) if user else None

def create_discord_session(discord_id, token_data):
    """Create Discord OAuth session"""
    conn = get_db()
    cursor = conn.cursor()
    
    session_token = generate_token()
    
    cursor.execute('''
        INSERT INTO discord_sessions (id, discord_id, access_token, refresh_token, token_type, expires_at, scopes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            last_activity = CURRENT_TIMESTAMP
    ''', (
        session_token[:32],
        discord_id,
        token_data.get('access_token'),
        token_data.get('refresh_token'),
        token_data.get('token_type'),
        datetime.now().isoformat(),
        token_data.get('scope', '')
    ))
    
    conn.commit()
    conn.close()
    
    return session_token[:32]

def is_discord_authenticated():
    """Check if user is authenticated via Discord"""
    return session.get('discord_id') and session.get('authenticated') and session.get('login_type') == 'discord'

# Initialize database on module load
init_discord_auth_db()
