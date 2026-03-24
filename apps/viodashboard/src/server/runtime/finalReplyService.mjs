import { appendProjectRoadmapEntry, ensureProjectRoadmap } from '../projectRoadmap.mjs';
import { buildRoadmapFromReply, stripStructuredRoadmapBlock } from '../utils.mjs';

export function createFinalReplyService({
  state,
  roadmap,
  routing,
  sideEffects,
  broadcast,
  buildMoodPacket,
  getRuntimeState,
  syncRuntimeState,
  wrapperPort,
}) {
  if (!state) {throw new Error('state is required');}
  if (!roadmap) {throw new Error('roadmap is required');}
  if (!routing) {throw new Error('routing is required');}
  if (!sideEffects) {throw new Error('sideEffects is required');}
  if (typeof broadcast !== 'function') {throw new Error('broadcast is required');}
  if (typeof buildMoodPacket !== 'function') {throw new Error('buildMoodPacket is required');}
  if (typeof getRuntimeState !== 'function') {throw new Error('getRuntimeState is required');}
  if (typeof syncRuntimeState !== 'function') {throw new Error('syncRuntimeState is required');}

  async function handleFinalEvent(event, rawReplyText, { finishedSeq = 0 } = {}) {
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
      return { suppressed: true, preview, replyBody };
    }

    let result = null;
    let sidecarFinalError = null;
    try {
      result = await sideEffects.onAssistantFinal(replyBody || '');
    } catch (error) {
      sidecarFinalError = error;
      console.log('[wrapper] sidecar final bridge failed', error?.message || String(error));
    }

    if (event.runId && event.runId !== state.lastAssistantFinalNotifiedRunIdRef.get()) {
      state.lastAssistantFinalNotifiedRunIdRef.set(event.runId);
      sideEffects.notifyAssistantFinal({
        title: 'Vio sent a final reply',
        message: preview || 'A reply finished and is ready for you.',
        dashboardPort: wrapperPort,
      });
    }

    const fallbackMode = state.activeRunSeq.size > 0 ? 'thinking' : 'idle';
    const finalMode = result?.mode ?? fallbackMode;
    const finalState = result?.state ?? getRuntimeState().bodyState ?? null;
    const sidecarFinalErrorDetail = sidecarFinalError?.message || 'unknown sidecar final sync error';
    const finalDetail = sidecarFinalError
      ? `final length=${replyBody.length} · sidecar sync failed: ${sidecarFinalErrorDetail}`
      : `final length=${replyBody.length}`;

    syncRuntimeState({
      mood: finalMode,
      phase: 'final',
      activeRunId: state.activeRunSeq.size ? getRuntimeState().activeRunId : null,
      bodyState: finalState,
      source: sidecarFinalError ? 'chat-final-sidecar-error' : 'chat-final',
    });
    routing.setLastRouting({
      mode: finalMode,
      detail: finalDetail,
      preview,
      phase: 'final',
      runId: event.runId,
    });
    broadcast(buildMoodPacket(finalMode, {
      state: finalState,
      detail: routing.getLastRouting().detail,
      preview,
      phase: 'final',
      runId: event.runId,
      source: sidecarFinalError ? 'chat-final-sidecar-error' : 'chat-final',
    }));
    return { suppressed: false, preview, replyBody, result, sidecarFinalError };
  }

  return {
    handleFinalEvent,
  };
}
