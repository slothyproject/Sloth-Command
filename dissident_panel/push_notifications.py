"""
Push Notifications Service - Browser Push Notifications
v2.8.0
"""
import json
from pathlib import Path
from typing import Dict, Optional

# ============================================================================
# PUSH NOTIFICATION CONFIG
# ============================================================================

# VAPID keys - generate real ones using: pip install pywebpush && python -c "from pywebpush import webpush; webpush.generate_vapid_keys()"
# Override with environment variables in production
import os
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')

if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
    print("[Push] WARNING: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables are required for push notifications.")
    print("[Push] Push notifications will not work until these are set.")

class PushNotificationService:
    """Handle browser push notifications"""
    
    def __init__(self):
        self._subscriptions: Dict[str, dict] = {}
        self._load_subscriptions()
        
    def _load_subscriptions(self):
        """Load subscriptions from file"""
        sub_file = Path(__file__).parent.parent / 'data' / 'push_subscriptions.json'
        if sub_file.exists():
            try:
                self._subscriptions = json.loads(sub_file.read_text())
            except:
                self._subscriptions = {}
    
    def _save_subscriptions(self):
        """Save subscriptions to file"""
        sub_file = Path(__file__).parent.parent / 'data' / 'push_subscriptions.json'
        sub_file.parent.mkdir(parents=True, exist_ok=True)
        sub_file.write_text(json.dumps(self._subscriptions, indent=2))
    
    def subscribe(self, user_id: str, subscription: dict) -> bool:
        """Store a push subscription"""
        self._subscriptions[user_id] = subscription
        self._save_subscriptions()
        return True
    
    def unsubscribe(self, user_id: str) -> bool:
        """Remove a push subscription"""
        if user_id in self._subscriptions:
            del self._subscriptions[user_id]
            self._save_subscriptions()
            return True
        return False
    
    def get_subscription(self, user_id: str) -> Optional[dict]:
        """Get a user's subscription"""
        return self._subscriptions.get(user_id)
    
    def send_notification(self, user_id: str, notification: dict) -> bool:
        """
        Send a push notification to a user
        In production, this would use pywebpush to send to the browser
        For demo, we just log it
        """
        subscription = self.get_subscription(user_id)
        if not subscription:
            return False
        
        # In production, you would use:
        # from pywebpush import webpush
        # webpush(
        #     subscription_info=subscription,
        #     data=json.dumps(notification),
        #     vapid_private_key=VAPID_PRIVATE_KEY,
        #     vapid_claims={"sub": "mailto:admin@example.com"}
        # )
        
        print(f"[Push] Sending notification to {user_id}: {notification.get('title')}")
        return True
    
    def broadcast(self, notification: dict) -> int:
        """Send notification to all subscribers"""
        count = 0
        for user_id in self._subscriptions:
            if self.send_notification(user_id, notification):
                count += 1
        return count
    
    def get_vapid_public_key(self) -> str:
        """Get the VAPID public key for the client"""
        return VAPID_PUBLIC_KEY

# Global instance
push_service = PushNotificationService()
