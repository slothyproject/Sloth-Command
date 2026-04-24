/**
 * Socket.IO Client for Dissident Bot Dashboard
 * Real-time event handling with auto-reconnection
 */

class DissidentSocket {
    constructor(url = window.location.origin) {
        this.url = url;
        this.socket = null;
        this.connected = false;
        this.reconnecting = false;
        this.eventHandlers = {};
        this.subscriptions = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.pingInterval = null;
        this.listeners = {};
    }

    /**
     * Connect to Socket.IO server
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.connected) {
                resolve(this);
                return;
            }

            try {
                // Try Socket.IO connection
                this.socket = io(this.url, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: this.reconnectDelay,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    timeout: 10000
                });

                this.socket.on('connect', () => {
                    console.log('[Socket] Connected:', this.socket.id);
                    this.connected = true;
                    this.reconnecting = false;
                    this.reconnectAttempts = 0;
                    
                    // Subscribe to events
                    this.resubscribe();
                    
                    // Start ping interval
                    this.startPing();
                    
                    // Emit connected event
                    this.emit('connected', { socketId: this.socket.id });
                    
                    resolve(this);
                });

                this.socket.on('disconnect', (reason) => {
                    console.log('[Socket] Disconnected:', reason);
                    this.connected = false;
                    this.stopPing();
                    this.emit('disconnected', { reason });
                });

                this.socket.on('connect_error', (error) => {
                    console.error('[Socket] Connection error:', error);
                    this.reconnecting = true;
                    this.emit('error', { error: error.message });
                    
                    if (this.reconnectAttempts === 0) {
                        reject(error);
                    }
                    this.reconnectAttempts++;
                });

                this.socket.on('reconnect', (attemptNumber) => {
                    console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
                    this.connected = true;
                    this.reconnecting = false;
                    this.emit('reconnected', { attemptNumber });
                });

                this.socket.on('reconnect_failed', () => {
                    console.error('[Socket] Reconnection failed');
                    this.emit('reconnect_failed', {});
                });

                // Register event listeners
                this.registerServerEvents();

            } catch (error) {
                console.error('[Socket] Failed to initialize:', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.stopPing();
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.subscriptions.clear();
        }
    }

    /**
     * Subscribe to a channel/event
     */
    subscribe(channel) {
        if (!this.connected) {
            this.subscriptions.add(channel);
            return;
        }

        this.socket.emit('subscribe', { channel });
        this.subscriptions.add(channel);
        console.log('[Socket] Subscribed to:', channel);
    }

    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channel) {
        if (this.connected) {
            this.socket.emit('unsubscribe', { channel });
        }
        this.subscriptions.delete(channel);
        console.log('[Socket] Unsubscribed from:', channel);
    }

    /**
     * Resubscribe to all channels after reconnection
     */
    resubscribe() {
        for (const channel of this.subscriptions) {
            this.socket.emit('subscribe', { channel });
        }
    }

    /**
     * Register event listeners for server events
     */
    registerServerEvents() {
        // Bot events
        this.on('bot:stats', (data) => {
            this.emit('stats_update', data);
        });

        this.on('bot:activity', (data) => {
            this.emit('activity', data);
        });

        this.on('bot:guild_update', (data) => {
            this.emit('guild_update', data);
        });

        // Moderation events
        this.on('mod:case_created', (data) => {
            this.emit('case_created', data);
        });

        this.on('mod:case_updated', (data) => {
            this.emit('case_updated', data);
        });

        // Economy events
        this.on('economy:transaction', (data) => {
            this.emit('transaction', data);
        });

        this.on('economy:leaderboard_update', (data) => {
            this.emit('leaderboard_update', data);
        });

        // Ticket events
        this.on('ticket:created', (data) => {
            this.emit('ticket_created', data);
            this.updateBadge('tickets');
        });

        this.on('ticket:updated', (data) => {
            this.emit('ticket_updated', data);
        });

        this.on('ticket:closed', (data) => {
            this.emit('ticket_closed', data);
        });

        // Notification events
        this.on('notification', (data) => {
            this.emit('notification', data);
            this.showBrowserNotification(data.title, data.message, data.icon);
            this.updateBadge('notifications');
        });

        // System events
        this.on('system:restart', (data) => {
            this.emit('restart', data);
            this.showAlert('System Restart', 'The bot is restarting. Reconnecting...');
            setTimeout(() => window.location.reload(), 3000);
        });

        this.on('system:error', (data) => {
            this.emit('system_error', data);
            this.showAlert('System Error', data.message, 'error');
        });

        // Log events
        this.on('log:entry', (data) => {
            this.emit('log_entry', data);
        });
    }

    /**
     * Register a handler for a client event
     */
    on(event, handler) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(handler);

        // If socket is connected, also register with server
        if (this.socket) {
            this.socket.on(event, handler);
        }
    }

    /**
     * Remove a handler for a client event
     */
    off(event, handler) {
        if (this.listeners[event]) {
            if (handler) {
                this.listeners[event] = this.listeners[event].filter(h => h !== handler);
            } else {
                this.listeners[event] = [];
            }
        }

        if (this.socket) {
            if (handler) {
                this.socket.off(event, handler);
            } else {
                this.socket.off(event);
            }
        }
    }

    /**
     * Emit a client event (to server)
     */
    emit(event, data = {}) {
        if (this.socket && this.connected) {
            this.socket.emit(event, data);
        }
    }

    /**
     * Emit a local event (no server communication)
     */
    emitLocal(event, data) {
        if (this.listeners[event]) {
            for (const handler of this.listeners[event]) {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`[Socket] Error in handler for ${event}:`, error);
                }
            }
        }
    }

    /**
     * Start ping interval to keep connection alive
     */
    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.connected) {
                this.emit('ping', { timestamp: Date.now() });
            }
        }, 30000);
    }

    /**
     * Stop ping interval
     */
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Show browser notification
     */
    showBrowserNotification(title, body, icon) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            new Notification(title, { body, icon });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body, icon });
                }
            });
        }
    }

    /**
     * Update navigation badge
     */
    updateBadge(type) {
        const badgeId = `nav-${type}-badge`;
        const badge = document.getElementById(badgeId);
        if (badge) {
            const current = parseInt(badge.textContent) || 0;
            badge.textContent = current + 1;
            badge.style.display = 'flex';
        }
    }

    /**
     * Show alert in UI
     */
    showAlert(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = {
            error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        var el = document.createElement('div');
        el.className = 'toast ' + type;
        var titleEl = document.createElement('strong');
        titleEl.textContent = title;
        var msgEl = document.createElement('span');
        msgEl.textContent = message;
        var contentEl = document.createElement('div');
        contentEl.className = 'toast-content';
        contentEl.appendChild(titleEl);
        contentEl.appendChild(document.createElement('br'));
        contentEl.appendChild(msgEl);
        el.innerHTML = (icons[type] || icons.info);
        el.appendChild(contentEl);
        container.appendChild(toast);

        setTimeout(() => toast.remove(), 10000);
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Request current state from server
     */
    requestState() {
        this.emit('request_state', {});
    }

    /**
     * Join a guild room
     */
    joinGuild(guildId) {
        this.emit('guild:join', { guildId });
    }

    /**
     * Leave a guild room
     */
    leaveGuild(guildId) {
        this.emit('guild:leave', { guildId });
    }
}

// Global socket instance
window.DissidentSocket = DissidentSocket;
window.socket = null;

/**
 * Initialize socket connection
 */
function initSocket() {
    if (window.socket) return window.socket;
    
    window.socket = new DissidentSocket();
    window.socket.connect()
        .then(() => {
            console.log('Socket connected');
            window.socket.subscribe('dashboard');
            window.socket.requestState();
        })
        .catch(err => {
            console.warn('Socket connection failed, using polling fallback');
            initPolling();
        });
    
    return window.socket;
}

/**
 * Polling fallback when Socket.IO is not available
 */
function initPolling() {
    console.log('Initializing polling fallback');
    
    const pollInterval = 5000;
    let pollTimer = null;
    
    function poll() {
        fetch('/api/stats')
            .then(r => r.json())
            .then(data => {
                if (window.socket) {
                    window.socket.emitLocal('stats_update', data);
                }
            })
            .catch(() => {});
        
        fetch('/api/activity')
            .then(r => r.json())
            .then(data => {
                if (window.socket) {
                    window.socket.emitLocal('activity', data);
                }
            })
            .catch(() => {});
    }
    
    pollTimer = setInterval(poll, pollInterval);
    poll();
    
    return () => {
        if (pollTimer) clearInterval(pollTimer);
    };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize socket on dashboard pages
    if (!window.location.pathname.includes('/login')) {
        initSocket();
    }
});
