// Claude Task Page — polling-based frontend for agent task visibility.
// MVP: single current-task view with collaboration feed and follow-up.

(function () {
  'use strict';

  const POLL_INTERVAL = 3000;
  const PHASES = ['dispatch', 'coding', 'testing', 'handoff', 'review', 'done'];

  // DOM refs
  const $taskView = document.getElementById('taskView');
  const $emptyState = document.getElementById('emptyState');
  const $pollIndicator = document.getElementById('pollIndicator');
  const $taskTitle = document.getElementById('taskTitle');
  const $taskPrompt = document.getElementById('taskPrompt');
  const $badgeStatus = document.getElementById('badgeStatus');
  const $badgePhase = document.getElementById('badgePhase');
  const $badgeAcceptance = document.getElementById('badgeAcceptance');
  const $taskTiming = document.getElementById('taskTiming');
  const $phaseTimeline = document.getElementById('phaseTimeline');
  const $collabFeed = document.getElementById('collabFeed');
  const $valTests = document.getElementById('valTests');
  const $valCommit = document.getElementById('valCommit');
  const $valAcceptance = document.getElementById('valAcceptance');
  const $fileList = document.getElementById('fileList');
  const $logsScroll = document.getElementById('logsScroll');
  const $followupText = document.getElementById('followupText');
  const $followupBtn = document.getElementById('followupBtn');
  const $seedDemoBtn = document.getElementById('seedDemoBtn');
  const $handoffCard = document.getElementById('handoffCard');
  const $handoffSeen = document.getElementById('handoffSeen');
  const $handoffAcked = document.getElementById('handoffAcked');
  const $handoffStatusText = document.getElementById('handoffStatusText');
  const $reviewActions = document.getElementById('reviewActions');
  const $startReviewBtn = document.getElementById('startReviewBtn');
  const $acceptBtn = document.getElementById('acceptBtn');
  const $needsFixBtn = document.getElementById('needsFixBtn');

  let currentTaskId = null;

  // --- API helpers ---
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    return res.json();
  }

  // --- Rendering ---
  function showEmpty() {
    $taskView.style.display = 'none';
    $emptyState.style.display = '';
    currentTaskId = null;
  }

  function showTask() {
    $taskView.style.display = '';
    $emptyState.style.display = 'none';
  }

  // Human-readable status labels
  const STATUS_LABELS = {
    created: 'Created',
    running: 'Running',
    finished_by_claude: 'Claude Finished',
    review_started_by_vio: 'Vio Reviewing',
    accepted: 'Accepted',
    needs_fix: 'Needs Fix',
    paused: 'Paused',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };

  function renderTask(task) {
    $taskTitle.textContent = task.title;
    $taskPrompt.textContent = task.promptSummary || '';

    // Status badge with readable label
    const statusLabel = STATUS_LABELS[task.status] || task.status;
    $badgeStatus.textContent = statusLabel;
    $badgeStatus.className = 'pill status-' + task.status;

    // Phase badge
    $badgePhase.textContent = task.phase;
    $badgePhase.className = 'pill phase-' + task.phase;

    // Acceptance badge
    const acc = task.acceptanceStatus || 'pending';
    $badgeAcceptance.textContent = acc;
    $badgeAcceptance.className = 'pill accept-' + acc;

    // Timing + runtime info
    const parts = [];
    if (task.isRealTask) {
      parts.push('[live]');
    }
    if (task.runtime && task.runtime.bridgePid) {
      parts.push('pid:' + task.runtime.bridgePid);
    }
    if (task.startedAt) {
      parts.push('Started ' + formatTime(task.startedAt));
    }
    if (task.elapsedMs > 0) {
      parts.push('Elapsed ' + formatDuration(task.elapsedMs));
    }
    if (task.latestMeaningfulUpdate) {
      parts.push('Latest: ' + truncate(task.latestMeaningfulUpdate, 80));
    }
    $taskTiming.textContent = parts.join('  |  ');

    // Phase timeline
    const phaseIdx = PHASES.indexOf(task.phase);
    const steps = $phaseTimeline.querySelectorAll('.phase-step');
    steps.forEach((step, i) => {
      step.classList.remove('reached', 'active');
      if (i < phaseIdx) {step.classList.add('reached');}
      if (i === phaseIdx) {step.classList.add('active');}
    });

    // Handoff card
    renderHandoff(task);

    // Validation
    renderValidation(task);

    // Touched files
    renderFiles(task.touchedFiles || []);
  }

  function renderHandoff(task) {
    // Show handoff card when completion has been seen or task is in a post-completion state
    const showHandoff = task.completionEventSeen ||
      ['finished_by_claude', 'review_started_by_vio', 'accepted', 'needs_fix'].includes(task.status);

    $handoffCard.style.display = showHandoff ? '' : 'none';
    if (!showHandoff) { return; }

    $handoffSeen.textContent = task.completionEventSeen
      ? 'Yes (' + formatTime(task.completionSeenAt) + ')'
      : 'No';
    $handoffSeen.className = 'handoff-value ' + (task.completionEventSeen ? 'yes' : 'no');

    $handoffAcked.textContent = task.completionAcknowledged
      ? 'Yes (' + formatTime(task.completionAcknowledgedAt) + ')'
      : 'No';
    $handoffAcked.className = 'handoff-value ' + (task.completionAcknowledged ? 'yes' : 'no');

    $handoffStatusText.textContent = STATUS_LABELS[task.status] || task.status;
    $handoffStatusText.className = 'handoff-value status-text-' + task.status;

    // Review action buttons
    $reviewActions.style.display = '';
    const isFinished = task.status === 'finished_by_claude';
    const isReviewing = task.status === 'review_started_by_vio';
    const isTerminal = task.status === 'accepted' || task.status === 'needs_fix';

    $startReviewBtn.style.display = isFinished ? '' : 'none';
    $acceptBtn.style.display = isReviewing ? '' : 'none';
    $needsFixBtn.style.display = isReviewing ? '' : 'none';

    if (isTerminal) {
      $reviewActions.style.display = 'none';
    }
  }

  function renderValidation(task) {
    if (task.tests) {
      const passed = task.tests.passed || task.tests.status === 'pass';
      $valTests.textContent = task.tests.summary || task.tests.status || 'unknown';
      $valTests.className = 'val-value ' + (passed ? 'pass' : 'fail');
    } else {
      $valTests.textContent = '—';
      $valTests.className = 'val-value none';
    }

    if (task.commit) {
      $valCommit.textContent = typeof task.commit === 'string' ? task.commit : task.commit.sha || JSON.stringify(task.commit);
      $valCommit.className = 'val-value';
    } else {
      $valCommit.textContent = '—';
      $valCommit.className = 'val-value none';
    }

    const acc = task.acceptanceStatus || 'pending';
    $valAcceptance.textContent = acc;
    $valAcceptance.className = 'val-value ' + (acc === 'accepted' ? 'pass' : acc === 'needs-fix' ? 'fail' : 'none');
  }

  function renderFiles(files) {
    if (!files.length) {
      $fileList.innerHTML = '<li style="color:var(--text-dim);font-style:italic">none yet</li>';
      return;
    }
    $fileList.innerHTML = files.map(f => '<li>' + escapeHtml(f) + '</li>').join('');
  }

  function renderEvents(events) {
    if (!events.length) {
      $collabFeed.innerHTML = '<div class="feed-event"><div class="event-body"><span class="event-message" style="color:var(--text-dim)">No events yet</span></div></div>';
      return;
    }

    const avatarLabels = { vio: 'V', claude: 'C', human: 'H', system: 'S' };

    $collabFeed.innerHTML = events.map(evt => {
      const src = evt.source || 'system';
      const label = avatarLabels[src] || 'S';
      const typeClass = 'type-' + (evt.type || 'info');
      return `
        <div class="feed-event ${typeClass}">
          <div class="event-avatar src-${src}">${label}</div>
          <div class="event-body">
            <div class="event-head">
              <span class="event-type">${escapeHtml(evt.type || 'event')}</span>
              <span>${formatTime(evt.timestamp)}</span>
            </div>
            <div class="event-message">${escapeHtml(evt.message || '')}</div>
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    $collabFeed.scrollTop = $collabFeed.scrollHeight;
  }

  function renderLogs(logs) {
    if (!logs.length) {
      $logsScroll.innerHTML = '<div class="log-line" style="color:var(--text-dim)">No logs available</div>';
      return;
    }
    $logsScroll.innerHTML = logs.map(log => {
      const levelClass = 'level-' + (log.level || 'info');
      const ts = log.timestamp ? log.timestamp.split('T')[1]?.split('.')[0] || '' : '';
      return `<div class="log-line ${levelClass}"><span class="log-ts">${ts}</span>${escapeHtml(log.text || '')}</div>`;
    }).join('');
    $logsScroll.scrollTop = $logsScroll.scrollHeight;
  }

  // --- Polling ---
  async function poll() {
    $pollIndicator.textContent = 'polling...';
    try {
      const taskRes = await api('/api/agent-tasks/current');
      if (!taskRes.ok || !taskRes.task) {
        showEmpty();
        $pollIndicator.textContent = '';
        return;
      }

      const task = taskRes.task;
      currentTaskId = task.id;
      showTask();
      renderTask(task);

      // Fetch events and logs in parallel
      const [eventsRes, logsRes] = await Promise.all([
        api('/api/agent-tasks/' + encodeURIComponent(task.id) + '/events'),
        api('/api/agent-tasks/' + encodeURIComponent(task.id) + '/logs'),
      ]);

      if (eventsRes.ok) {
        renderEvents(eventsRes.events || []);
      }
      if (logsRes.ok) {
        renderLogs(logsRes.logs || []);
      }

      $pollIndicator.textContent = '';
    } catch (err) {
      $pollIndicator.textContent = 'poll error';
      console.error('[claude] poll error:', err);
    }
  }

  // --- Follow-up ---
  async function sendFollowUp() {
    if (!currentTaskId) {return;}
    const message = $followupText.value.trim();
    if (!message) {return;}

    $followupBtn.disabled = true;
    try {
      const res = await api('/api/agent-tasks/' + encodeURIComponent(currentTaskId) + '/follow-up', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        $followupText.value = '';
        await poll(); // Refresh immediately
      } else {
        alert('Follow-up failed: ' + (res.error || 'unknown error'));
      }
    } catch (err) {
      alert('Follow-up failed: ' + err.message);
    } finally {
      $followupBtn.disabled = false;
    }
  }

  // --- Seed demo ---
  async function seedDemo() {
    try {
      await api('/api/agent-tasks/seed-demo', { method: 'POST' });
      await poll();
    } catch (err) {
      console.error('[claude] seed-demo failed:', err);
    }
  }

  // --- Utilities ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(iso) {
    if (!iso) {return '';}
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  }

  function formatDuration(ms) {
    if (ms < 1000) {return ms + 'ms';}
    const s = Math.floor(ms / 1000);
    if (s < 60) {return s + 's';}
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) {return m + 'm ' + rem + 's';}
    const h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + '...' : str;
  }

  // --- Review actions ---
  async function startReview() {
    if (!currentTaskId) { return; }
    $startReviewBtn.disabled = true;
    try {
      await api('/api/agent-tasks/' + encodeURIComponent(currentTaskId) + '/start-review', { method: 'POST', body: '{}' });
      await poll();
    } catch (err) {
      console.error('[claude] start-review failed:', err);
    } finally {
      $startReviewBtn.disabled = false;
    }
  }

  async function acceptWork() {
    if (!currentTaskId) { return; }
    $acceptBtn.disabled = true;
    try {
      await api('/api/agent-tasks/' + encodeURIComponent(currentTaskId) + '/accept', { method: 'POST', body: '{}' });
      await poll();
    } catch (err) {
      console.error('[claude] accept failed:', err);
    } finally {
      $acceptBtn.disabled = false;
    }
  }

  async function markNeedsFix() {
    if (!currentTaskId) { return; }
    $needsFixBtn.disabled = true;
    try {
      await api('/api/agent-tasks/' + encodeURIComponent(currentTaskId) + '/needs-fix', { method: 'POST', body: '{}' });
      await poll();
    } catch (err) {
      console.error('[claude] needs-fix failed:', err);
    } finally {
      $needsFixBtn.disabled = false;
    }
  }

  // --- Init ---
  $followupBtn.addEventListener('click', sendFollowUp);
  $followupText.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void sendFollowUp();
    }
  });
  $seedDemoBtn.addEventListener('click', seedDemo);
  $startReviewBtn.addEventListener('click', startReview);
  $acceptBtn.addEventListener('click', acceptWork);
  $needsFixBtn.addEventListener('click', markNeedsFix);

  // Initial poll + interval
  void poll();
  setInterval(poll, POLL_INTERVAL);
})();
