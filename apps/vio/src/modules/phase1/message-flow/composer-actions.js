const CONTINUE_TEXT = '继续刚才最后明确提出的事情，不要重开话题。';

export function bindComposerFlowActions({ refs, flow, shell, onSlashBanner = null, debug = null }) {
  function emitDebug(event, payload = {}) {
    void debug?.emit?.({
      area: 'message-flow',
      event,
      activeSessionKey: flow?.getActiveSessionKey?.() || null,
      payload,
    });
  }

  function isSlashCommandText(text = '') {
    return /^\s*\/[A-Za-z0-9_-]+(?:\s|$)/.test(String(text || ''));
  }

  async function dispatchComposerText(rawText, { isContinue = false } = {}) {
    const sessionKey = flow?.getActiveSessionKey?.();
    const inputEl = refs?.composerInputEl;
    const sendBtnEl = refs?.composerSendBtnEl;
    const continueBtnEl = refs?.continueBtnEl;
    const statusEl = refs?.composerStatusEl;
    const text = String(rawText || '').trim();
    emitDebug('ui.send.submit', {
      sessionKey,
      textLength: text.length,
      hasText: !!text,
      isContinue,
    });
    if (!sessionKey || !text) {return;}

    const isSlashCommand = isSlashCommandText(text);
    const isControlAction = isSlashCommand || isContinue;
    const localId = isControlAction ? null : (shell?.send?.(sessionKey, text) || null);
    emitDebug('ui.send.local-id-created', {
      sessionKey,
      localId,
      textLength: text.length,
      isSlashCommand,
      isContinue,
      isControlAction,
    });
    if (!isContinue && inputEl) {inputEl.value = '';}
    if (sendBtnEl) {sendBtnEl.disabled = true;}
    if (continueBtnEl) {continueBtnEl.disabled = true;}
    if (statusEl) {statusEl.textContent = isSlashCommand ? 'Running command…' : (isContinue ? 'Continuing…' : 'Sending…');}
    if (isSlashCommand) {
      onSlashBanner?.(`Running ${text}…`, { ttlMs: 6200, tone: 'info' });
      emitDebug('ui.send.slash-banner-shown', {
        sessionKey,
        text,
      });
    } else if (isContinue) {
      onSlashBanner?.('推进中', { ttlMs: 4200, tone: 'info' });
      emitDebug('ui.send.continue-banner-shown', {
        sessionKey,
        text,
      });
    }

    try {
      emitDebug('ui.send.flow-dispatch', {
        sessionKey,
        localId,
        isSlashCommand,
        isContinue,
      });
      await flow?.sendMessage?.(sessionKey, text, { localId });
      emitDebug('ui.send.flow-dispatch-done', {
        sessionKey,
        localId,
        isSlashCommand,
        isContinue,
      });
      if (statusEl) {statusEl.textContent = isControlAction ? 'Command sent.' : 'Streaming…';}
      window.setTimeout(() => {
        if (statusEl) {statusEl.textContent = 'Enter newline · Shift+Enter send';}
      }, isControlAction ? 700 : 900);
    } catch (error) {
      emitDebug('ui.send.flow-dispatch-failed', {
        sessionKey,
        localId,
        isSlashCommand,
        isContinue,
        isControlAction,
        error: String(error?.message || error),
      });
      if (!isControlAction) {
        shell?.markPendingFailed?.(sessionKey, localId);
      } else if (isSlashCommand) {
        onSlashBanner?.(`Command failed: ${text}`, { ttlMs: 6800, tone: 'error' });
      } else if (isContinue) {
        onSlashBanner?.('继续失败', { ttlMs: 5200, tone: 'error' });
      }
      if (statusEl) {statusEl.textContent = `Send failed: ${String(error?.message || error)}`;}
    } finally {
      if (sendBtnEl) {sendBtnEl.disabled = false;}
      if (continueBtnEl) {continueBtnEl.disabled = !flow?.getActiveSessionKey?.();}
    }
  }

  refs?.refreshSessionBtnEl?.addEventListener('click', () => {
    const sessionKey = flow.getActiveSessionKey();
    if (!sessionKey) {return;}
    flow.refreshSession(sessionKey, 'manual-refresh').catch(() => {});
  });

  refs?.continueBtnEl?.addEventListener('click', () => {
    void dispatchComposerText(CONTINUE_TEXT, { isContinue: true });
  });

  if (refs?.continueBtnEl) {
    refs.continueBtnEl.disabled = !flow?.getActiveSessionKey?.();
  }

  refs?.composerFormEl?.addEventListener('submit', async event => {
    event.preventDefault();
    void dispatchComposerText(refs?.composerInputEl?.value || '');
  });
}
