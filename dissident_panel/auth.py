"""
Consolidated authentication module for Dissident Web Panel.
Use this instead of individual login_required decorators in each module.
"""
from functools import wraps
from flask import redirect, url_for, session, jsonify


def login_required(f):
    """Redirect to login page if not authenticated (for HTML routes)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session and 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


def api_login_required(f):
    """Return 401 JSON if not authenticated (for API routes)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session and 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Return 403 JSON if not admin (for admin API routes)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session and 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        if session.get('role') != 'admin':
            return jsonify({'error': 'Insufficient permissions'}), 403
        return f(*args, **kwargs)
    return decorated_function