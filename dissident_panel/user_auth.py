"""
Multi-User Authentication System
v2.7.0
"""
import os
import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

# Database
DATA_DIR = Path(__file__).parent.parent / 'data'
DATA_DIR.mkdir(exist_ok=True)
AUTH_DB = DATA_DIR / 'auth.db'

def get_db():
    conn = sqlite3.connect(AUTH_DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_auth_db():
    """Initialize authentication database"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            permissions TEXT DEFAULT '{}',
            discord_id TEXT,
            avatar TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_login TEXT,
            login_count INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT,
            last_activity TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS server_access (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            server_id TEXT NOT NULL,
            access_level TEXT DEFAULT 'view',
            granted_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, server_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            resource TEXT,
            details TEXT,
            ip_address TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Seed admin user (password must be set via ADMIN_USER/ADMIN_PASS env vars)
    admin_hash = hash_password(os.environ.get('ADMIN_PASS', 'changeme'))
    cursor.execute('''
        INSERT OR IGNORE INTO users (id, username, password_hash, role, permissions)
        VALUES (?, ?, ?, ?, ?)
    ''', ('admin_001', 'admin', admin_hash, 'admin', '{"all": true}'))
    
    # Seed demo server owner (remove in production)
    owner_hash = hash_password(os.environ.get('OWNER_PASS', 'changeme'))
    cursor.execute('''
        INSERT OR IGNORE INTO users (id, username, password_hash, role, permissions)
        VALUES (?, ?, ?, ?, ?)
    ''', ('owner_001', 'server_owner', owner_hash, 'server_owner', '{"servers": true}'))
    
    # Seed demo server access
    cursor.execute('''
        INSERT OR IGNORE INTO server_access (user_id, server_id, access_level, granted_by)
        VALUES (?, ?, ?, ?)
    ''', ('owner_001', 'srv_3', 'admin', 'admin_001'))
    
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${pwd_hash.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash"""
    try:
        salt, pwd_hex = stored_hash.split('$')
        pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return pwd_hash.hex() == pwd_hex
    except:
        return False

def create_user(username: str, password: str, email: str = None, role: str = 'user', discord_id: str = None) -> dict:
    """Create a new user"""
    import uuid
    init_auth_db()
    
    conn = get_db()
    cursor = conn.cursor()
    
    user_id = str(uuid.uuid4())[:12]
    password_hash = hash_password(password)
    
    try:
        cursor.execute('''
            INSERT INTO users (id, username, email, password_hash, role, discord_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, username, email, password_hash, role, discord_id))
        conn.commit()
        success = True
    except sqlite3.IntegrityError:
        success = False
        user_id = None
    
    conn.close()
    return {'success': success, 'user_id': user_id}

def authenticate(username: str, password: str) -> dict:
    """Authenticate user and return session info"""
    import uuid
    init_auth_db()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE username = ? AND is_active = 1', (username,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return {'success': False, 'error': 'Invalid credentials'}
    
    if not verify_password(password, user['password_hash']):
        conn.close()
        return {'success': False, 'error': 'Invalid credentials'}
    
    # Create session
    session_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    
    cursor.execute('''
        INSERT INTO sessions (id, user_id, token, expires_at, last_activity)
        VALUES (?, ?, ?, ?, ?)
    ''', (session_id, user['id'], token, expires_at, datetime.now().isoformat()))
    
    # Update last login
    cursor.execute('''
        UPDATE users SET last_login = ?, login_count = login_count + 1 WHERE id = ?
    ''', (datetime.now().isoformat(), user['id']))
    
    conn.commit()
    conn.close()
    
    return {
        'success': True,
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role'],
            'avatar': user['avatar'],
            'permissions': user['permissions']
        }
    }

def validate_token(token: str) -> dict:
    """Validate session token and return user info"""
    init_auth_db()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT s.*, u.username, u.role, u.email, u.permissions, u.avatar
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1
    ''', (token, datetime.now().isoformat()))
    
    session = cursor.fetchone()
    conn.close()
    
    if not session:
        return None
    
    return {
        'user_id': session['user_id'],
        'username': session['username'],
        'role': session['role'],
        'email': session['email'],
        'permissions': session['permissions'],
        'avatar': session['avatar']
    }

def logout(token: str):
    """Invalidate session"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM sessions WHERE token = ?', (token,))
    conn.commit()
    conn.close()

def get_user_servers(user_id: str, user_role: str) -> list:
    """Get servers accessible to user based on role"""
    init_auth_db()
    
    conn = get_db()
    cursor = conn.cursor()
    
    if user_role == 'admin':
        # Admin sees all servers
        cursor.execute('''
            SELECT s.*, u.username as owner_name, 'admin' as access_level
            FROM servers s
            LEFT JOIN users u ON s.owner_id = u.id
            ORDER BY s.created_at DESC
        ''', (user_id,))
    else:
        # Regular user sees only their servers
        cursor.execute('''
            SELECT s.*, u.username as owner_name, sa.access_level
            FROM servers s
            LEFT JOIN users u ON s.owner_id = u.id
            LEFT JOIN server_access sa ON s.id = sa.server_id AND sa.user_id = ?
            WHERE s.owner_id = ? OR sa.user_id = ?
            ORDER BY s.created_at DESC
        ''', (user_id, user_id, user_id))
    
    servers = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return servers

def grant_server_access(user_id: str, server_id: str, access_level: str = 'view', granted_by: str = None):
    """Grant user access to a server"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO server_access (user_id, server_id, access_level, granted_by)
        VALUES (?, ?, ?, ?)
    ''', (user_id, server_id, access_level, granted_by))
    conn.commit()
    conn.close()

def revoke_server_access(user_id: str, server_id: str):
    """Revoke user access to a server"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM server_access WHERE user_id = ? AND server_id = ?', (user_id, server_id))
    conn.commit()
    conn.close()

def log_action(user_id: str, action: str, resource: str = None, details: str = None, ip: str = None):
    """Log admin action"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO audit_log (user_id, action, resource, details, ip_address)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, action, resource, details, ip))
    conn.commit()
    conn.close()

def get_all_users() -> list:
    """Get all users (admin only)"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, email, role, discord_id, created_at, last_login, login_count, is_active
        FROM users ORDER BY created_at DESC
    ''')
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

def update_user(user_id: str, updates: dict) -> bool:
    """Update user details"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    
    set_clauses = []
    params = []
    for key in ('username', 'email', 'role', 'discord_id', 'is_active'):
        if key in updates:
            set_clauses.append(f'{key} = ?')
            params.append(updates[key])
    
    if not set_clauses:
        return False
    
    params.append(user_id)
    cursor.execute(f'UPDATE users SET {", ".join(set_clauses)} WHERE id = ?', params)
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success

def can_access_server(user_id: str, user_role: str, server_id: str) -> bool:
    """Check if user can access a server"""
    if user_role == 'admin':
        return True
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT 1 FROM servers WHERE id = ? AND owner_id = ?
        UNION
        SELECT 1 FROM server_access WHERE user_id = ? AND server_id = ?
    ''', (server_id, user_id, user_id, server_id))
    result = cursor.fetchone()
    conn.close()
    return result is not None

def delete_user(user_id: str) -> bool:
    """Delete a user and their sessions"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM sessions WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM server_access WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        return success
    except Exception:
        conn.close()
        return False

def get_user_audit_log(user_id: str, limit: int = 50) -> list:
    """Get audit log for a specific user"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM audit_log 
        WHERE user_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
    ''', (user_id, limit))
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

def change_password(user_id: str, new_password: str) -> bool:
    """Change user password"""
    init_auth_db()
    conn = get_db()
    cursor = conn.cursor()
    password_hash = hash_password(new_password)
    cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success

# Initialize on import
init_auth_db()
