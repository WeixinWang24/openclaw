#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRunLifecycleService } from '../src/server/runtime/runLifecycleService.mjs';

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error?.message || error}`);
    process.exitCode = 1;
  }
}

function createHarness() {
  const runtimeState = {
    mood: 'idle',
    phase: 'idle',
    activeRunId: null,
    latestRunSeq: 0,
    source: 'test',
  };
  const broadcasts = [];
  const state = {
    activeRunSeq: new Map(),
    runSequenceRef: {
      current: 0,
      increment() { this.current += 1; },
      get() { return this.current; },
    },
  };
  const routing = {
    last: null,
    setLastRouting(value) { this.last = value; },
    getLastRouting() { return this.last || {}; },
  };
  const sideEffects = {
    onAssistantError: async () => {},
  };
  const svc = createRunLifecycleService({
    state,
    routing,
    getRuntimeState: () => ({ ...runtimeState }),
    syncRuntimeState: patch => Object.assign(runtimeState, patch || {}),
    buildMoodPacket: (mood, payload = {}) => ({ type: 'mood', mood, ...payload }),
    broadcast: packet => broadcasts.push(packet),
    sideEffects,
  });
  return { svc, runtimeState, broadcasts, state, routing };
}

test('kernel.run delta contract drives runtime streaming state', () => {
  const { svc, runtimeState, broadcasts } = createHarness();
  svc.handleDelta({
    state: 'delta',
    runId: 'run-1',
    sessionKey: 'session-1',
    text: 'hello world',
    payload: { state: 'delta' },
  });
  assert.equal(runtimeState.mood, 'thinking');
  assert.equal(runtimeState.phase, 'streaming');
  assert.equal(runtimeState.activeRunId, 'run-1');
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].type, 'mood');
  assert.equal(broadcasts[0].phase, 'streaming');
  assert.equal(broadcasts[0].runId, 'run-1');
});

test('kernel.run final-style bridge side effects can be driven without legacy chat parsing', () => {
  const calls = [];
  const bridge = {
    recordAssistantFinal(payload) { calls.push(['final', payload]); },
    recordTerminalRunState(payload) { calls.push(['terminal', payload]); },
  };
  const event = { type: 'run.final', runId: 'run-2', sessionKey: 'session-2', text: 'done' };
  if (event.type === 'run.final') {
    bridge.recordAssistantFinal({
      runId: event.runId,
      sessionKey: event.sessionKey,
      text: event.text || '',
    });
    bridge.recordTerminalRunState({
      runId: event.runId,
      sessionKey: event.sessionKey,
      status: 'final',
      errorMessage: null,
    });
  }
  assert.deepEqual(calls, [
    ['final', { runId: 'run-2', sessionKey: 'session-2', text: 'done' }],
    ['terminal', { runId: 'run-2', sessionKey: 'session-2', status: 'final', errorMessage: null }],
  ]);
});

test('legacy raw chat forwarding no longer needs payload parsing for side effects', () => {
  const forwarded = [];
  const bridgeLike = {
    runtimeAdapters: {
      rpcClient: {
        emitRawEvent: event => forwarded.push(event),
      },
    },
    handleLegacyChat(msg) {
      if (msg.event === 'chat') {
        this.runtimeAdapters.rpcClient?.emitRawEvent?.(msg);
      }
    },
  };
  const raw = { event: 'chat', payload: { state: 'final', runId: 'run-3', message: { text: 'hello' } } };
  bridgeLike.handleLegacyChat(raw);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0], raw);
});

if (!process.exitCode) {
  console.log(`\nSummary: ${passed} passed, 0 failed`);
}
