import { stripStructuredRoadmapBlock } from '../utils.mjs';

export function createChatEventCoordinator({
  bridge,
  broadcast,
  state,
  tokenUsageService,
  finalReplyService,
  runLifecycleService,
}) {
  if (!bridge) {throw new Error('bridge is required');}
  if (typeof broadcast !== 'function') {throw new Error('broadcast is required');}
  if (!tokenUsageService || typeof tokenUsageService.refresh !== 'function') {throw new Error('tokenUsageService.refresh is required');}
  if (!finalReplyService || typeof finalReplyService.handleFinalEvent !== 'function') {throw new Error('finalReplyService.handleFinalEvent is required');}
  if (!runLifecycleService) {throw new Error('runLifecycleService is required');}

  return async function handleChatEvent(event) {
    if (event.state === 'final' || event.state === 'error' || event.state === 'aborted') {
      await tokenUsageService.refresh();
    }

    const rawReplyText = typeof event?.rawText === 'string'
      ? event.rawText
      : (typeof event?.text === 'string' ? event.text : '');
    const visibleReplyText = event.state === 'final' ? stripStructuredRoadmapBlock(rawReplyText) : rawReplyText;
    const isEmptyFinal = event.state === 'final' && !String(visibleReplyText || '').trim();
    const isDuplicateFinal = event.state === 'final' && !!event.runId && state.seenFinalRunIds.has(event.runId);
    const clientEvent = (event && typeof event === 'object') ? { ...event, text: visibleReplyText } : event;
    const shouldBroadcastLegacyChat = (() => {
      const eventSessionKey = event?.sessionKey || bridge.sessionKey || null;
      if (!eventSessionKey) {return false;}
      return eventSessionKey === bridge.sessionKey;
    })();

    if (shouldBroadcastLegacyChat && !(isEmptyFinal || isDuplicateFinal)) {
      broadcast({ type: 'chat', event: clientEvent, source: 'legacy.onChatEvent' });
    }
    if (event.state === 'delta') {
      runLifecycleService.handleDelta(event);
      return;
    }

    if (event.state === 'final') {
      if (isEmptyFinal) {
        console.log('[wrapper] ignored empty final event', event.runId || 'no-run-id');
        return;
      }
      if (isDuplicateFinal) {
        console.log('[wrapper] ignored duplicate final event', event.runId);
        return;
      }
      if (event.runId) {
        state.seenFinalRunIds.add(event.runId);
        if (state.seenFinalRunIds.size > 200) {state.seenFinalRunIds.clear();}
      }
      const { finishedSeq } = runLifecycleService.handleFinalStart(event);
      try {
        await finalReplyService.handleFinalEvent(event, rawReplyText, { finishedSeq });
      } catch (error) {
        runLifecycleService.handleFinalFailure(event, error);
      }
    } else if (event.state === 'error') {
      await runLifecycleService.handleError(event);
    } else if (event.state === 'aborted') {
      runLifecycleService.handleAborted(event);
    }
  };
}
