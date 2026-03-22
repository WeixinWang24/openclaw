import { resolveDeviceId, resolveWorkspaceKey, generateSessionId } from './ids.mjs';
import {
  ensureDeviceRecord,
  ensureWorkspaceRecord,
  readSessionRecord,
  writeSessionRecord,
} from './records.mjs';
import {
  upsertSessionState,
  shouldWriteCheckpoint,
  writeCheckpoint,
  buildActiveState,
  writeActiveState,
} from './runtime.mjs';
import { buildLatestSummary, writeLatestSummary } from './summary.mjs';

export async function saveViostateSnapshot({ viostateRoot, input }) {
  const { deviceId, fingerprint } = await resolveDeviceId(input.device, viostateRoot);
  const { workspaceKey } = await resolveWorkspaceKey(input.workspace, deviceId, viostateRoot);

  const device = await ensureDeviceRecord({
    viostateRoot,
    now: input.now,
    deviceId,
    device: input.device,
    fingerprint,
  });

  const workspace = await ensureWorkspaceRecord({
    viostateRoot,
    now: input.now,
    deviceId,
    workspaceKey,
    workspace: input.workspace,
  });

  const sessionId = input.sessionId || generateSessionId(input.now);
  const previousSession = await readSessionRecord({
    viostateRoot,
    deviceId,
    workspaceKey,
    sessionId,
  });

  const session = await upsertSessionState({
    viostateRoot,
    now: input.now,
    deviceId,
    workspaceKey,
    sessionId,
    input,
    previousSession,
  });

  const checkpointDecision = shouldWriteCheckpoint({
    input,
    previousSession,
    currentSession: session,
  });

  let checkpointPath;
  let checkpoint;

  if (checkpointDecision.shouldWrite) {
    const result = await writeCheckpoint({
      viostateRoot,
      now: input.now,
      deviceId,
      workspaceKey,
      session,
      input,
      reason: checkpointDecision.reason,
    });
    checkpoint = result.checkpoint;
    checkpointPath = result.checkpointPath;
    session.lastCheckpointPath = checkpointPath;

    await writeSessionRecord({
      viostateRoot,
      deviceId,
      workspaceKey,
      sessionId,
      session,
    });
  }

  const active = buildActiveState({
    now: input.now,
    deviceId,
    workspaceKey,
    workspace,
    session,
    latestCheckpointPath: checkpointPath || session.lastCheckpointPath,
    latestSummaryPath: 'summaries/latest.json',
    source: input.source,
  });

  await writeActiveState({
    viostateRoot,
    deviceId,
    workspaceKey,
    sessionId,
    active,
  });

  let summaryWritten = false;
  let summaryPath;

  try {
    const summary = buildLatestSummary({
      now: input.now,
      deviceId,
      workspaceKey,
      session,
      checkpoint,
      active,
      source: input.source,
    });

    const result = await writeLatestSummary({
      viostateRoot,
      deviceId,
      workspaceKey,
      sessionId,
      summary,
    });

    summaryPath = result.summaryPath;
    summaryWritten = true;
  } catch {
    summaryWritten = false;
  }

  return {
    deviceId,
    workspaceKey,
    sessionId,
    device,
    workspace,
    session,
    checkpointWritten: Boolean(checkpointPath),
    checkpointPath,
    activePath: 'active.json',
    summaryPath,
    summaryWritten,
  };
}
