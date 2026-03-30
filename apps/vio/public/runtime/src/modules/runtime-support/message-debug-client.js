async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`debug post failed: ${res.status} ${text.slice(0, 160)}`);
  }
  return res.json().catch(() => ({}));
}

export function createMessageDebugClient({ enabled = true, profile = 'manual' } = {}) {
  async function emit(event = {}) {
    if (!enabled) {return { ok: false, skipped: true };}
    const record = {
      ts: typeof event?.ts === 'string' ? event.ts : new Date().toISOString(),
      profile,
      ...event,
    };
    try {
      return await postJson('/api/debug/message-event', { event: record });
    } catch (error) {
      console.warn('message debug emit failed', error);
      return { ok: false, error: error?.message || String(error) };
    }
  }

  return {
    emit,
  };
}
