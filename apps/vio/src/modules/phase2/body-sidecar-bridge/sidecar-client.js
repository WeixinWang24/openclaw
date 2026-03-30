export function createBodySidecarClient({ baseUrl, token, fetchImpl = fetch }) {
  async function post(path, payload) {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`body sidecar ${path} failed: ${res.status} ${text}`);
    }

    return await res.json().catch(() => ({}));
  }

  async function sendBodyState(payload) {
    return post('/status', { status: payload?.semanticState });
  }

  async function sendBodyReply({ text, sessionKey = null, runId = null, ts = Date.now() }) {
    return post('/reply', { text, sessionKey, runId, ts });
  }

  async function healthcheck() {
    try {
      await post('/event', { event: { type: 'healthcheck', ts: Date.now() } });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  }

  return {
    sendBodyState,
    sendBodyReply,
    healthcheck,
  };
}
