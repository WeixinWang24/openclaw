export function renderSessionListView(flow, refs, { sessions = [], activeSessionKey = null, sessionMeta = null, sessionLoadingState = null } = {}) {
  if (!refs?.sessionsListEl) {return;}
  refs.sessionsListEl.innerHTML = '';

  const primarySessions = [];
  const acpSessions = [];
  for (const session of sessions) {
    const rawKey = String(session?.key || '');
    if (rawKey.includes(':acp:')) {acpSessions.push(session);}
    else {primarySessions.push(session);}
  }

  for (const session of primarySessions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'session-item';
    button.dataset.selected = session.key === activeSessionKey ? 'true' : 'false';
    const meta = sessionMeta?.get?.(session.key) || null;
    const loading = !!sessionLoadingState?.has?.(session.key);
    const rawKey = String(session.key || '');
    const label = session.label || session.displayName || session.key || 'session';
    let badge = '';
    if (rawKey === 'agent:main:main' || rawKey.endsWith(':main')) {badge = 'main';}
    else if (rawKey.includes(':subagent:')) {badge = 'sub';}
    const state = loading ? 'loading' : meta?.pending ? 'pending' : meta?.dirty ? 'dirty' : '';
    button.innerHTML = `${badge ? `<span class="session-item-badge">${badge}</span>` : ''}<span class="session-item-title">${label}</span>${state ? `<span class="session-item-state">${state}</span>` : ''}`;
    button.title = rawKey || label;
    button.addEventListener('click', () => {
      flow.selectSession(session.key).catch(() => {});
    });
    refs.sessionsListEl.appendChild(button);
  }

  if (acpSessions.length > 0) {
    const wrap = document.createElement('div');
    wrap.className = 'session-acp-menu';

    const activeAcpSession = acpSessions.find(session => session.key === activeSessionKey) || null;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'session-item session-acp-trigger';
    trigger.dataset.selected = activeAcpSession ? 'true' : 'false';
    trigger.innerHTML = `<span class="session-item-badge">acp</span><span class="session-item-title">▾</span>`;
    wrap.appendChild(trigger);
    refs.sessionsListEl.appendChild(wrap);

    let menu = null;

    function closeMenu() {
      if (menu) {
        menu.remove();
        menu = null;
      }
      trigger.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      closeMenu();
      menu = document.createElement('div');
      menu.className = 'session-acp-dropdown';
      const rect = trigger.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 8}px`;
      menu.style.left = `${Math.max(12, rect.right - 240)}px`;

      for (const session of acpSessions) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'session-acp-option';
        item.dataset.selected = session.key === activeSessionKey ? 'true' : 'false';
        const rawLabel = session.label || session.displayName || session.key || 'acp session';
        item.textContent = rawLabel.length > 40 ? `${rawLabel.slice(0, 37)}…` : rawLabel;
        item.title = rawLabel;
        item.addEventListener('click', () => {
          closeMenu();
          flow.selectSession(session.key).catch(() => {});
        });
        menu.appendChild(item);
      }

      document.body.appendChild(menu);
      trigger.setAttribute('aria-expanded', 'true');
    }

    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (menu) {closeMenu();}
      else {openMenu();}
    });

    document.addEventListener('click', event => {
      if (!wrap.contains(event.target) && !menu?.contains(event.target)) {
        closeMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (menu) {
        closeMenu();
      }
    });
  }
}
