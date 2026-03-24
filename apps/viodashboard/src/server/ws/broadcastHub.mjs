import WebSocket from 'ws';

export function createBroadcastHub() {
  const clients = new Set();
  const tail = [];

  function record(packet) {
    try {
      tail.push({
        ts: new Date().toISOString(),
        type: packet?.type || null,
        sessionKey: packet?.sessionKey || packet?.event?.sessionKey || null,
        reason: packet?.reason || null,
        runId: packet?.runId || packet?.event?.runId || null,
        state: packet?.state || packet?.event?.state || null,
      });
      if (tail.length > 200) {tail.splice(0, tail.length - 200);}
    } catch {}
  }

  function broadcast(packet) {
    record(packet);
    const data = JSON.stringify(packet);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  function attach(ws) {
    clients.add(ws);
    return () => clients.delete(ws);
  }

  function getTail(limit = 100) {
    return tail.slice(-Math.max(1, limit));
  }

  function getClientCount() {
    return clients.size;
  }

  return {
    broadcast,
    attach,
    getTail,
    getClientCount,
  };
}
