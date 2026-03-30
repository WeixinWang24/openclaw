import { KERNEL_CHANNELS } from './kernelEventBus.mjs';

export function createGatewayRpcClient({ gatewayCall, bridgeRequest = null, eventBus, diagnostics, stateRef = { connected: false } }) {
  if (typeof gatewayCall !== 'function') {
    throw new Error('gatewayCall function is required');
  }

  async function connect() {
    diagnostics?.recordConnection('connected', 'phase-1 gateway client');
    return true;
  }

  async function disconnect() {
    diagnostics?.recordConnection('disconnected', 'phase-1 gateway client');
    return true;
  }

  async function call(method, params = {}, options = {}) {
    if (typeof bridgeRequest === 'function' &&  stateRef?.connected) {
      try {
        return await bridgeRequest(method, params, options);
      } catch (error) {
        const message = String(error?.message || error || '');
        if (!/missing scope|not connected|request failed/i.test(message)) {
          throw error;
        }
      }
    }
    return await gatewayCall(method, params, options);
  }

  function emitRawEvent(rawEvent) {
    diagnostics?.recordRawEventMeta({
      kind: rawEvent?.event || rawEvent?.type || 'unknown',
      sessionKey: rawEvent?.payload?.sessionKey || rawEvent?.sessionKey || null,
    });
    eventBus?.emit(KERNEL_CHANNELS.RAW_GATEWAY, rawEvent);
  }

  function getConnectionState() {
    return {
      connected:  stateRef?.connected,
      mode: typeof bridgeRequest === 'function' ? 'bridge-backed' : 'gateway-call',
    };
  }

  return {
    connect,
    disconnect,
    call,
    emitRawEvent,
    getConnectionState,
  };
}
