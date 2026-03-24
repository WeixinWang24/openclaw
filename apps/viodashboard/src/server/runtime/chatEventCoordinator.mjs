import { appendProjectRoadmapEntry, ensureProjectRoadmap } from '../projectRoadmap.mjs';
import { buildRoadmapFromReply, stripStructuredRoadmapBlock } from '../utils.mjs';

export function createChatEventCoordinator({
  bridge,
  broadcast,
  buildMoodPacket,
  getRuntimeState,
  syncRuntimeState,
  state,
  roadmap,
  routing,
  sideEffects,
  tokenUsageService,
  wrapperPort,
}) {
  if (!bridge) {throw new Error('bridge is required');}
  if (typeof broadcast !== 'function') {throw new Error('broadcast is required');}
  if (typeof buildMoodPacket !== 'function') {throw new Error('buildMoodPacket is required');}
  if (typeof getRuntimeState !== 'function') {throw new Error('getRuntimeState is required');}
  if (typeof syncRuntimeState !== 'function') {throw new Error('syncRuntimeState is required');}
  if (!tokenUsageService || typeof tokenUsageService.refresh !== 'function') {throw new Error('tokenUsageService.refresh is required');}

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
      syncRuntimeState({
        mood: 'thinking',
        phase: 'streaming',
        activeRunId: event.runId || getRuntimeState().activeRunId,
        source: 'chat-delta',
      });
      broadcast(buildMoodPacket('thinking', {
        detail: 'assistant streaming',
        preview: (event.text || '').slice(0, 120),
        phase: 'streaming',
        runId: event.runId,
        source: 'chat-delta',
      }));
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
      const finishedSeq = event.runId ? state.activeRunSeq.get(event.runId) || 0 : 0;
      if (event.runId) {state.activeRunSeq.delete(event.runId);}
      syncRuntimeState({
        activeRunId: state.activeRunSeq.size ? getRuntimeState().activeRunId : null,
        source: 'chat-final',
      });
      try {
        const replyBody = stripStructuredRoadmapBlock(rawReplyText || '');
        const preview = replyBody.slice(0, 220);
        console.log('[wrapper] final reply preview:', preview);
        const extractedRoadmap = buildRoadmapFromReply(rawReplyText || '');
        const previousRoadmap = roadmap.loadRoadmapData();
        const roadmapDecision = roadmap.choosePersistedRoadmap(extractedRoadmap, previousRoadmap);
        const nextRoadmap = roadmapDecision.roadmap;
        if (roadmapDecision.replacedPrevious && previousRoadmap) {roadmap.pushRoadmapHistory(previousRoadmap);}
        roadmap.saveRoadmapData(nextRoadmap);
        console.log('[wrapper] roadmap source:', nextRoadmap.sourceType, 'items:', nextRoadmap.items?.length || 0, 'decision:', roadmapDecision.reason);
        broadcast({ type: 'roadmap', roadmap: nextRoadmap, decision: roadmapDecision.reason, extractedRoadmap });

        let projectRoadmapResult = null;
        try {
          ensureProjectRoadmap({ context: 'Auto-created by VioDashboard from assistant code-workflow roadmap handling.' });
          if (nextRoadmap?.items?.length) {
            projectRoadmapResult = appendProjectRoadmapEntry({
              roadmap: nextRoadmap,
              replyBody,
              changedFiles: [],
              notes: 'Auto-appended from assistant final reply roadmap extraction.',
              taskState: {
                phase: 'development/review turn',
              },
            });
            console.log('[wrapper] project roadmap updated:', JSON.stringify(projectRoadmapResult));
          }
        } catch (roadmapFileError) {
          console.log('[wrapper] project roadmap update failed', roadmapFileError?.message || String(roadmapFileError));
        }

        const newerRunStillActive = state.activeRunSeq.size > 0 && finishedSeq < state.runSequenceRef.get();
        if (newerRunStillActive) {
          routing.setLastRouting({
            mode: 'thinking',
            detail: `final for older run ignored while newer run is active (${state.activeRunSeq.size} active)`,
            preview,
            phase: 'streaming',
            runId: event.runId,
          });
          syncRuntimeState({ mood: 'thinking', phase: 'streaming', source: 'chat-final-suppressed' });
          broadcast(buildMoodPacket('thinking', {
            state: getRuntimeState().bodyState,
            detail: routing.getLastRouting().detail,
            preview,
            phase: 'streaming',
            runId: event.runId,
            source: 'chat-final-suppressed',
          }));
          return;
        }

        const result = await sideEffects.onAssistantFinal(replyBody || '');
        if (event.runId && event.runId !== state.lastAssistantFinalNotifiedRunIdRef.get()) {
          state.lastAssistantFinalNotifiedRunIdRef.set(event.runId);
          sideEffects.notifyAssistantFinal({
            title: 'Vio sent a final reply',
            message: preview || 'A reply finished and is ready for you.',
            dashboardPort: wrapperPort,
          });
        }
        routing.setLastRouting({
          mode: result?.mode ?? 'unknown',
          detail: `final length=${replyBody.length}`,
          preview,
          phase: 'final',
          runId: event.runId,
        });
        broadcast(buildMoodPacket(result?.mode ?? 'unknown', {
          state: result?.state ?? null,
          detail: routing.getLastRouting().detail,
          preview,
          phase: 'final',
          runId: event.runId,
          source: 'chat-final',
        }));
      } catch (error) {
        routing.setLastRouting({ mode: 'error', detail: error?.message || String(error), phase: 'final', runId: event.runId });
        console.log('[wrapper] sidecar final routing failed', error?.message || String(error));
        broadcast(buildMoodPacket('error', {
          detail: routing.getLastRouting().detail,
          phase: 'final',
          runId: event.runId,
          source: 'chat-final-error',
        }));
      }
    } else if (event.state === 'error') {
      if (event.runId) {state.activeRunSeq.delete(event.runId);}
      syncRuntimeState({ source: 'chat-error' });
      try {
        const result = await sideEffects.onAssistantError();
        routing.setLastRouting({ mode: 'error', detail: event.payload?.errorMessage || 'chat error', phase: 'error', runId: event.runId });
        broadcast(buildMoodPacket('error', {
          state: result?.state ?? getRuntimeState().bodyState,
          detail: routing.getLastRouting().detail,
          phase: 'error',
          runId: event.runId,
          source: 'chat-error',
        }));
      } catch (error) {
        console.log('[wrapper] sidecar error routing failed', error?.message || String(error));
      }
    } else if (event.state === 'aborted') {
      if (event.runId) {state.activeRunSeq.delete(event.runId);}
      routing.setLastRouting({ mode: state.activeRunSeq.size ? 'thinking' : 'idle', detail: 'chat aborted', phase: 'aborted', runId: event.runId });
      broadcast(buildMoodPacket(state.activeRunSeq.size ? 'thinking' : 'idle', {
        state: getRuntimeState().bodyState,
        detail: 'chat aborted',
        phase: state.activeRunSeq.size ? 'streaming' : 'aborted',
        runId: event.runId,
        source: 'chat-aborted',
      }));
    }
  };
}
