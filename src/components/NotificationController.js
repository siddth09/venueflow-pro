/**
 * VenueFlow Pro — Notification Controller
 * Single Responsibility: renders toast notifications and manages the notification bell.
 * All DOM content uses textContent — XSS-proof.
 */

export class NotificationController {
  /**
   * @param {import('../engine/state.js').StateEngine} store
   */
  constructor(store) {
    this.store = store;
    this._toastContainer = document.getElementById('toast-container');
    this._bellBadge = document.getElementById('notif-badge');
    this._notifList = document.getElementById('notif-list');
    this._unreadCount = 0;

    this._bindBell();

    // Subscribe to notification state changes
    this.store.subscribe('notifications', notifications => {
      this._handleNewNotifications(notifications);
    });
  }

  /** Shows a toast — safe, no innerHTML with external data. */
  showToast({ type = 'info', title, message, duration = 5000 }) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '🚨' }[type] || 'ℹ️';

    const body = document.createElement('div');
    body.className = 'toast-body';

    const titleEl = document.createElement('strong');
    titleEl.className = 'toast-title';
    titleEl.textContent = title; // textContent — safe

    const msgEl = document.createElement('p');
    msgEl.className = 'toast-message';
    msgEl.textContent = message; // textContent — safe

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this._dismissToast(toast));

    body.appendChild(titleEl);
    body.appendChild(msgEl);
    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(closeBtn);

    this._toastContainer.appendChild(toast);

    // Auto-dismiss
    setTimeout(() => this._dismissToast(toast), duration);
  }

  _dismissToast(toast) {
    toast.classList.add('toast--exiting');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  _bindBell() {
    const bellBtn = document.getElementById('notif-bell');
    if (!bellBtn) return;
    bellBtn.addEventListener('click', () => {
      this._unreadCount = 0;
      this._updateBadge();
      this._renderNotifPanel();
      const panel = document.getElementById('notif-panel');
      if (panel) panel.classList.toggle('hidden');
    });
  }

  _handleNewNotifications(notifications) {
    const state = this.store.getState();
    const prevCount = state.notifications.filter(n => n.read).length;
    const newNotifs = notifications.filter(n => !n.read);

    if (newNotifs.length > this._unreadCount) {
      const latest = newNotifs[newNotifs.length - 1];
      if (latest) this.showToast(latest);
      this._unreadCount = newNotifs.length;
      this._updateBadge();
    }
  }

  _updateBadge() {
    if (!this._bellBadge) return;
    if (this._unreadCount > 0) {
      this._bellBadge.textContent = this._unreadCount > 9 ? '9+' : String(this._unreadCount);
      this._bellBadge.classList.remove('hidden');
    } else {
      this._bellBadge.classList.add('hidden');
    }
  }

  _renderNotifPanel() {
    if (!this._notifList) return;
    const notifications = this.store.getState().notifications;
    this._notifList.innerHTML = '';

    if (!notifications.length) {
      const empty = document.createElement('p');
      empty.className = 'notif-empty';
      empty.textContent = 'No notifications yet';
      this._notifList.appendChild(empty);
      return;
    }

    [...notifications].reverse().forEach(n => {
      const item = document.createElement('div');
      item.className = `notif-item notif-item--${n.type || 'info'}`;

      const titleEl = document.createElement('strong');
      titleEl.textContent = n.title;

      const msgEl = document.createElement('p');
      msgEl.textContent = n.message;

      const timeEl = document.createElement('span');
      timeEl.className = 'notif-time';
      timeEl.textContent = new Date(n.ts).toLocaleTimeString();

      item.appendChild(titleEl);
      item.appendChild(msgEl);
      item.appendChild(timeEl);
      this._notifList.appendChild(item);
    });
  }
}
