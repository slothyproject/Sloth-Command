window.Dissident = (function () {
    const themes = ['theme-dissident', 'theme-dissident-light', 'theme-amoled'];

    function getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'theme-dissident';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('dissident-theme', theme);
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
    }

    function cycleTheme() {
        const current = getTheme();
        const idx = themes.indexOf(current);
        const next = themes[(idx + 1) % themes.length];
        setTheme(next);
        return next;
    }

    function showToast(message, type) {
        type = type || 'info';
        var container = document.getElementById('toast-container');
        if (!container) return;
        var colors = {
            success: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
            error: 'border-red-500 bg-red-500/10 text-red-400',
            warning: 'border-orange-500 bg-orange-500/10 text-orange-400',
            info: 'border-primary bg-primary/10 text-primary'
        };
        var icons = {
            success: '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
            error: '<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
            warning: '<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
            info: '<path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
        };
        var el = document.createElement('div');
        el.className = 'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg text-sm font-medium transition-all duration-300 translate-x-full ' + (colors[type] || colors.info);
        el.innerHTML = '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' + (icons[type] || icons.info) + '</svg><span>' + message + '</span>';
        container.appendChild(el);
        requestAnimationFrame(function () {
            el.classList.remove('translate-x-full');
        });
        setTimeout(function () {
            el.classList.add('translate-x-full', 'opacity-0');
            setTimeout(function () { el.remove(); }, 300);
        }, 4000);
    }

    function apiCall(url, options) {
        options = options || {};
        return fetch(url, Object.assign({
            headers: { 'Accept': 'application/json' },
            credentials: 'same-origin'
        }, options)).then(function (res) {
            if (res.status === 401) {
                window.location.href = '/login';
                return Promise.reject(new Error('Unauthorized'));
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        });
    }

    function formatNumber(num) {
        if (num == null) return '0';
        return new Intl.NumberFormat().format(num);
    }

    function formatCompact(num) {
        if (num == null) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    function formatUptime(seconds) {
        if (!seconds) return '0s';
        var d = Math.floor(seconds / 86400);
        var h = Math.floor((seconds % 86400) / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return d + 'd ' + h + 'h';
        if (h > 0) return h + 'h ' + m + 'm';
        return m + 'm';
    }

    function formatRelativeTime(date) {
        if (!date) return '';
        var now = Date.now();
        var then = new Date(date).getTime();
        var diff = Math.max(0, now - then) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    function clearNotifications() {
        var badge = document.getElementById('notif-badge');
        if (badge) badge.classList.add('hidden');
        var list = document.getElementById('notif-list');
        if (list) list.innerHTML = '<div class="px-4 py-6 text-center text-sm text-muted-foreground">No new notifications</div>';
        showToast('All notifications cleared', 'success');
    }

    function addNotification(title, body, type) {
        type = type || 'info';
        var badge = document.getElementById('notif-badge');
        if (badge) {
            var count = parseInt(badge.textContent || '0') + 1;
            badge.textContent = count;
            badge.classList.remove('hidden');
        }
        var list = document.getElementById('notif-list');
        if (list) {
            var empty = list.querySelector('.text-center');
            if (empty) empty.remove();
            var item = document.createElement('div');
            item.className = 'px-4 py-3 hover:bg-dropdown-item-hover transition-colors cursor-pointer';
            var titleEl = document.createElement('p');
            titleEl.className = 'text-sm font-medium text-foreground';
            titleEl.textContent = title;
            var bodyEl = document.createElement('p');
            bodyEl.className = 'text-xs text-muted-foreground mt-0.5';
            bodyEl.textContent = body;
            item.appendChild(titleEl);
            item.appendChild(bodyEl);
            list.insertBefore(item, list.firstChild);
        }
    }

    function logout() {
        apiCall('/api/auth/logout', { method: 'POST' })
            .then(function () { window.location.href = '/login'; })
            .catch(function () { window.location.href = '/login'; });
    }

    function openSidebar() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebar-overlay');
        if (sidebar) {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0');
        }
        if (overlay) overlay.classList.remove('hidden');
    }

    function closeSidebar() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebar-overlay');
        if (window.innerWidth < 1024) {
            if (sidebar) {
                sidebar.classList.remove('translate-x-0');
                sidebar.classList.add('-translate-x-full');
            }
            if (overlay) overlay.classList.add('hidden');
        }
    }

    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;

    return {
        getTheme: getTheme,
        setTheme: setTheme,
        cycleTheme: cycleTheme,
        showToast: showToast,
        apiCall: apiCall,
        formatNumber: formatNumber,
        formatCompact: formatCompact,
        formatUptime: formatUptime,
        formatRelativeTime: formatRelativeTime,
        clearNotifications: clearNotifications,
        addNotification: addNotification,
        logout: logout,
        openSidebar: openSidebar,
        closeSidebar: closeSidebar
    };
})();