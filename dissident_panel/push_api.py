"""
Web Push API Endpoints
v2.10.0 - Updated to use SharedStateReader directly
"""
from flask import Blueprint, request, jsonify, session
from functools import wraps

push_api = Blueprint('push_api', __name__)

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
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
                'role': session.get('role', 'user')
            }
        return f(*args, **kwargs)
    return decorated

# ============================================================================
# PUSH ENDPOINTS
# ============================================================================

@push_api.route('/api/push/vapid-public-key')
def get_vapid_key():
    """Get VAPID public key for push subscription"""
    from push_notifications import push_service
    return jsonify({'key': push_service.get_vapid_public_key()})

@push_api.route('/api/push/subscribe', methods=['POST'])
@login_required
def subscribe():
    """Subscribe to push notifications"""
    from push_notifications import push_service
    
    subscription = request.get_json()
    user_id = request.user.get('user_id')
    
    if not subscription or not user_id:
        return jsonify({'error': 'Invalid subscription'}), 400
    
    success = push_service.subscribe(user_id, subscription)
    
    if success:
        return jsonify({'success': True, 'message': 'Subscribed to push notifications'})
    return jsonify({'error': 'Failed to subscribe'}), 500

@push_api.route('/api/push/unsubscribe', methods=['POST'])
@login_required
def unsubscribe():
    """Unsubscribe from push notifications"""
    from push_notifications import push_service
    
    user_id = request.user.get('user_id')
    success = push_service.unsubscribe(user_id)
    
    return jsonify({'success': success})

@push_api.route('/api/push/test', methods=['POST'])
@login_required
def test_notification():
    """Send a test notification to current user"""
    from push_notifications import push_service
    
    user_id = request.user.get('user_id')
    notification = {
        'title': 'Test Notification',
        'body': 'Push notifications are working!',
        'icon': '/pwa/icon-192.png',
        'badge': '/pwa/icon-192.png',
        'tag': 'test',
        'data': {'url': '/dashboard'}
    }
    
    success = push_service.send_notification(user_id, notification)
    
    return jsonify({'success': success})

# ============================================================================
# BOT BRIDGE ENDPOINTS
# ============================================================================

@push_api.route('/api/bot/stats')
def bot_stats():
    """Get bot statistics"""
    from bot_bridge import SharedStateReader
    return jsonify(SharedStateReader.get_stats())

@push_api.route('/api/bot/servers')
def bot_servers():
    """Get bot servers"""
    from bot_bridge import SharedStateReader
    return jsonify({'servers': SharedStateReader.get_servers()})

@push_api.route('/api/bot/commands')
def bot_commands():
    """Get command statistics"""
    from bot_bridge import SharedStateReader
    return jsonify({'commands': SharedStateReader.get_commands()})

@push_api.route('/api/bot/activity')
def bot_activity():
    """Get activity data"""
    from bot_bridge import SharedStateReader
    activity = SharedStateReader.get_activity()
    if isinstance(activity, dict):
        return jsonify({'activity': activity.get('commands_history', [])})
    return jsonify({'activity': activity if isinstance(activity, list) else []})

@push_api.route('/api/bot/health')
def bot_health():
    """Get bot health metrics"""
    from bot_bridge import SharedStateReader
    return jsonify(SharedStateReader.get_health())
