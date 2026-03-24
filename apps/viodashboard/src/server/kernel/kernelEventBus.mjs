export const KERNEL_CHANNELS = {
  RAW_GATEWAY: 'raw.gateway',
  RUN: 'kernel.run',
  SESSION: 'kernel.session',
  TRANSCRIPT: 'kernel.transcript',
  DIAGNOSTICS: 'kernel.diagnostics',
};

export function createKernelEventBus() {
  const listeners = new Map();

  function subscribe(channel, handler) {
    if (!listeners.has(channel)) {listeners.set(channel, new Set());}
    listeners.get(channel).add(handler);
    return () => {
      const set = listeners.get(channel);
      if (!set) {return;}
      set.delete(handler);
      if (set.size === 0) {listeners.delete(channel);}
    };
  }

  function emit(channel, event) {
    const set = listeners.get(channel);
    if (!set || set.size === 0) {return;}
    for (const handler of set) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[kernelEventBus] listener failed on ${channel}:`, error?.message || error);
      }
    }
  }

  function clear() {
    listeners.clear();
  }

  return { subscribe, emit, clear };
}
