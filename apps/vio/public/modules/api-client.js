async function readJsonOrThrow(url, init = undefined, fallbackError = 'request failed') {
  const res = await fetch(url, init);
  const contentType = String(res.headers.get('content-type') || '');
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`${fallbackError}: expected json, got ${contentType || 'unknown'} :: ${text.slice(0, 80)}`);
  }
  const data = await res.json();
  if (!res.ok) {throw new Error(data?.error || fallbackError);}
  return data;
}

export function createMockApiClient() {
  const mockHistory = new Map([
    ['vio:mock:main', [
      { id: 'm1', role: 'assistant', text: 'Vio Phase 1 mock session ready.' },
      { id: 'm2', role: 'assistant', text: 'This mock provider keeps Message Flow runnable before the real Vio API surface exists.' },
    ]],
    ['vio:mock:alt', [
      { id: 'm3', role: 'assistant', text: 'Alternate mock session.' },
    ]],
  ]);

  function appendAssistantMessage(sessionKey, text) {
    const history = mockHistory.get(sessionKey) || [];
    history.push({ id: `a-${Date.now()}`, role: 'assistant', text: String(text || '') });
    mockHistory.set(sessionKey, history);
    return history;
  }

  return {
    appendAssistantMessage,
    async fetchSessionList() {
      return {
        currentSessionKey: 'vio:mock:main',
        items: [
          { key: 'vio:mock:main', label: 'mock main', kind: 'session' },
          { key: 'vio:mock:alt', label: 'mock alt', kind: 'session' },
        ],
      };
    },
    async fetchSessionHistory(sessionKey) {
      return { messages: mockHistory.get(sessionKey) || [] };
    },
    async sendMessage(sessionKey, text) {
      const history = mockHistory.get(sessionKey) || [];
      history.push({ id: `u-${Date.now()}`, role: 'user', text: String(text || '') });
      history.push({ id: `a-${Date.now()}`, role: 'assistant', text: 'Mock send accepted. Real API not attached yet.' });
      mockHistory.set(sessionKey, history);
      return { ok: true, mock: true };
    },
  };
}

export function createApiClient() {
  const mockApi = createMockApiClient();
  let usingMock = false;

  async function withFallback(runReal, runMock) {
    if (usingMock) {return runMock();}
    try {
      return await runReal();
    } catch (error) {
      console.warn('Vio Phase 1 API fallback -> mock provider', error);
      usingMock = true;
      return runMock();
    }
  }

  function appendAssistantMessage(sessionKey, text) {
    return mockApi.appendAssistantMessage(sessionKey, text);
  }

  return {
    appendAssistantMessage,
    async fetchSessionList() {
      return withFallback(
        () => readJsonOrThrow('/api/sessions', { cache: 'no-store' }, 'sessions fetch failed'),
        () => mockApi.fetchSessionList(),
      );
    },
    async fetchSessionHistory(sessionKey, { force = false } = {}) {
      return withFallback(
        () => readJsonOrThrow(`/api/sessions/${encodeURIComponent(sessionKey)}/history?limit=40${force ? '&refresh=true' : ''}`, { cache: 'no-store' }, 'session history fetch failed').then(data => ({
          ...data,
          messages: Array.isArray(data?.messages)
            ? data.messages.map(message => ({
                ...message,
                role: message?.role || 'unknown',
                text: typeof message?.text === 'string' ? message.text : '',
              }))
            : [],
        })),
        () => mockApi.fetchSessionHistory(sessionKey),
      );
    },
    async sendMessage(sessionKey, text, options = {}) {
      return withFallback(
        () => readJsonOrThrow(`/api/sessions/${encodeURIComponent(sessionKey)}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, ...options }),
        }, 'send failed'),
        () => {
          if (options?.simulateFailure === true) {
            throw new Error('Mock send failure');
          }
          return mockApi.sendMessage(sessionKey, text, options);
        },
      );
    },
  };
}
