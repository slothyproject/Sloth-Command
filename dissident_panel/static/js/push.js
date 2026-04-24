// Push Notification Service
// v2.8.0

class PushNotificationService {
    constructor() {
        this.swRegistration = null;
        this.isSubscribed = false;
    }

    async init() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.register('/static/sw.js');
            this.swRegistration = registration;
            console.log('Service Worker registered');
            
            // Check subscription status
            await this.checkSubscription();
            return true;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return false;
        }
    }

    async checkSubscription() {
        const subscription = await this.swRegistration.pushManager.getSubscription();
        this.isSubscribed = !!subscription;
        return this.isSubscribed;
    }

    async subscribe() {
        try {
            // Get VAPID public key from server
            const response = await fetch('/api/push/vapid-public-key');
            const { key } = await response.json();

            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(key)
            });

            // Send subscription to server
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription.toJSON())
            });

            this.isSubscribed = true;
            console.log('Push subscription successful');
            return true;
        } catch (error) {
            console.error('Push subscription failed:', error);
            return false;
        }
    }

    async unsubscribe() {
        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
            }
            
            await fetch('/api/push/unsubscribe', { method: 'POST' });
            this.isSubscribed = false;
            return true;
        } catch (error) {
            console.error('Unsubscribe failed:', error);
            return false;
        }
    }

    async testNotification() {
        try {
            const response = await fetch('/api/push/test', { method: 'POST' });
            const { success } = await response.json();
            return success;
        } catch (error) {
            console.error('Test notification failed:', error);
            return false;
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

// Export singleton
window.pushService = new PushNotificationService();
