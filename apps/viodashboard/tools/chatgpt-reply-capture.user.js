// ==UserScript==
// @name         VioDashboard ChatGPT Reply Capture
// @namespace    https://openclaw.local/viodashboard
// @version      0.1.3
// @description  Capture the latest ChatGPT Web reply into VioDashboard Replies inbox
// @match        https://chatgpt.com/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  'use strict';

  const CAPTURE_URL = 'http://127.0.0.1:8791/api/external-replies/capture/chatgpt';
  const BUTTON_ID = 'vio-chatgpt-capture-btn';

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function getConversationTitle() {
    const selectors = [
      'main h1',
      'header h1',
      'nav [data-testid="conversation-title"]',
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const text = cleanText(el?.textContent || '');
      if (text) {
        return text;
      }
    }
    return cleanText(document.title || '').replace(/\s*\|\s*ChatGPT\s*$/i, '');
  }

  function classifyMessageNode(node) {
    if (!node) {
      return null;
    }
    const directRole = cleanText(node.getAttribute?.('data-message-author-role') || '').toLowerCase();
    if (directRole === 'assistant' || directRole === 'user') {
      return directRole;
    }
    return null;
  }

  function extractMessageText(node) {
    if (!(node instanceof HTMLElement)) {
      return '';
    }
    const textRoots = [
      node.querySelector('[data-message-content]'),
      node.querySelector('[class*="markdown"]'),
      node.querySelector('[class*="prose"]'),
      node,
    ];
    for (const root of textRoots) {
      const text = cleanText(root?.innerText || root?.textContent || '');
      if (text) {
        return text;
      }
    }
    return '';
  }

  function findMessageCandidates() {
    const out = [];
    document.querySelectorAll('[data-message-author-role]').forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const role = classifyMessageNode(node);
      const text = extractMessageText(node);
      if (!role || !text) {
        return;
      }
      out.push({ node, role, text });
    });
    return out;
  }

  function extractLatestPromptReply() {
    const messages = findMessageCandidates();
    if (!messages.length) {
      throw new Error('No conversation messages found on page');
    }

    let latestAssistant = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') {
        latestAssistant = messages[i];
        break;
      }
    }
    if (!latestAssistant) {
      throw new Error('No assistant reply found on current page');
    }

    let latestUser = null;
    const assistantIndex = messages.indexOf(latestAssistant);
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') {
        latestUser = messages[i];
        break;
      }
    }

    return {
      conversationTitle: getConversationTitle(),
      promptText: latestUser?.text || '',
      replyText: latestAssistant.text,
      sourceUrl: window.location.href,
      capturedAt: new Date().toISOString(),
      captureMethod: 'userscript-manual',
      meta: {
        messageId: latestAssistant.node.getAttribute('data-testid') || latestAssistant.node.id || null,
      },
    };
  }

  function showToast(message, tone = 'ok') {
    let el = document.getElementById('vio-chatgpt-capture-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vio-chatgpt-capture-toast';
      Object.assign(el.style, {
        position: 'fixed',
        right: '20px',
        bottom: '72px',
        zIndex: '2147483647',
        maxWidth: '360px',
        padding: '10px 14px',
        borderRadius: '10px',
        fontSize: '13px',
        lineHeight: '1.4',
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        transition: 'opacity 160ms ease',
        opacity: '0',
      });
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.background = tone === 'error' ? '#6b1d1d' : '#1f4b2e';
    el.style.opacity = '1';
    clearTimeout(el._vioToastTimer);
    el._vioToastTimer = setTimeout(() => {
      el.style.opacity = '0';
    }, 2600);
  }

  function postCapture(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: CAPTURE_URL,
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(payload),
        timeout: 10000,
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText || '{}');
            if (res.status >= 200 && res.status < 300 && data?.ok) {
              resolve(data);
              return;
            }
            reject(new Error(data?.error || `capture failed (${res.status})`));
          } catch (err) {
            reject(err);
          }
        },
        onerror: function () {
          reject(new Error('GM request failed'));
        },
        ontimeout: function () {
          reject(new Error('GM request timed out'));
        },
      });
    });
  }

  async function handleCaptureClick(button) {
    button.disabled = true;
    button.textContent = 'Capturing…';
    try {
      const payload = extractLatestPromptReply();
      const data = await postCapture(payload);
      showToast(data?.deduped ? 'Reply already in inbox.' : 'Reply captured to VioDashboard.', 'ok');
    } catch (error) {
      console.error('[vio-capture]', error);
      showToast(`Capture failed: ${error?.message || error}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Capture reply';
    }
  }

  const old = document.getElementById(BUTTON_ID);
  if (old) {
    old.remove();
  }

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.textContent = 'Capture reply';
  Object.assign(button.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: '2147483647',
    padding: '12px 16px',
    borderRadius: '999px',
    border: '2px solid #fff',
    background: '#7c3aed',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'block',
    opacity: '1',
    visibility: 'visible',
    pointerEvents: 'auto',
  });

  button.addEventListener('click', () => {
    void handleCaptureClick(button);
  });

  document.body.appendChild(button);
})();
