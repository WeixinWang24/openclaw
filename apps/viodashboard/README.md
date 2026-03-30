# VioDashboard

> Legacy/reference codebase. The standalone VioDashboard runtime on port 8791 has been decommissioned.
> Active browser-facing Vio development/runtime now lives in `apps/vio` on port 8792 via `com.vio.phase1`.

Beginner-first local dashboard for an OpenClaw source checkout.

This README is written for the exact situation below:

- you downloaded / cloned `openclaw_fork`
- you want to run **OpenClaw Gateway** from this repo
- you also want to run **VioDashboard** from this repo
- you want one document that tells you what to do, in order

Historical healthy state for the legacy standalone dashboard was:

- OpenClaw Gateway running locally at `ws://127.0.0.1:19011`
- OpenClaw Control UI reachable at `http://127.0.0.1:19011/`
- VioDashboard reachable at `http://127.0.0.1:8791/`
- VioDashboard `/setup.html` showing green or at least clearly telling you what is still missing

Current active target for browser-facing Vio work is:

- Vio Phase 1 reachable at `http://127.0.0.1:8792/`

---

## What lives where

From the repo root:

- OpenClaw source repo: `.`
- VioDashboard app: `apps/viodashboard`
- VioDashboard machine-local config: `apps/viodashboard/config/local.mjs`
- OpenClaw runtime config: `~/.openclaw/openclaw.json`

Important distinction:

- `~/.openclaw/openclaw.json` = **Gateway config/state entrypoint**
- `apps/viodashboard/config/local.mjs` = **Dashboard machine-local paths and CLI locations**

`config/local.mjs` is intentionally gitignored and machine-specific.
It should survive code updates unless you explicitly regenerate or edit it.

---

## Before you start

### Supported target

This guide is currently optimized for:

- macOS
- running OpenClaw from source
- running VioDashboard in **source mode**
- local-only gateway on the same machine

### You need

- Node.js `>= 22`
- `pnpm`
- a cloned repo, for example:

```bash
git clone <your-fork-url> openclaw_fork
cd openclaw_fork
```

Optional but recommended:

- Claude Code installed locally if you want VioDashboard's Claude features

---

## Fast path: first successful launch

If you just want the shortest path, do this from the **repo root**:

```bash
pnpm install
pnpm build

# Verify / create OpenClaw config and auth first if needed
openclaw status

# Generate VioDashboard machine-local config
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs
cd ../..

# Start or restart the Gateway
openclaw gateway restart

# Start or restart VioDashboard (source mode)
bash apps/viodashboard/launchd/reload.sh
```

Then open:

- OpenClaw Control UI: <http://127.0.0.1:19011/>
- VioDashboard: <http://127.0.0.1:8791/>
- VioDashboard setup page: <http://127.0.0.1:8791/setup.html>

If that works, skip to **Checks after startup**.

---

## Step-by-step guide

## 1) Build OpenClaw from source

From the repo root:

```bash
pnpm install
pnpm build
```

What this does:

- installs repo dependencies
- builds OpenClaw `dist/`
- gives the Gateway a runnable compiled output

If you later pull new code, do this again:

```bash
pnpm build
```

---

## 2) Make sure OpenClaw itself is configured

Before VioDashboard can connect cleanly, OpenClaw Gateway itself needs a valid config.

Check current status:

```bash
openclaw status
```

Key things to verify:

- Gateway is installed or can be started
- your config file exists at `~/.openclaw/openclaw.json`
- the Gateway port is what you expect
- auth is configured

If you're not set up yet, use the normal OpenClaw onboarding flow first.
For source users, the simplest route is usually:

```bash
openclaw onboard --install-daemon
```

If you already have a migrated working machine, your existing `~/.openclaw/openclaw.json` may already be enough.

---

## 3) Generate VioDashboard local machine config

This is the most important step for cross-device friendliness.

From the **repo root**, run:

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs
```

Preview only, without writing:

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs --print --yes
```

Force overwrite an existing local config:

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs --force
```

### What this writes

Only this file:

```text
apps/viodashboard/config/local.mjs
```

Typical fields include:

- `openclawRepoRoot`
- `workspaceRoot`
- `configPath`
- `defaultClaudeCwd`
- `claudeBin`
- `extraAllowedRoots`

### Why this matters

Without `config/local.mjs`, VioDashboard has to guess machine-local paths.
That is exactly the kind of thing that breaks on a new device.

This file is the intended place for:

- where this repo lives on **this machine**
- where your OpenClaw config lives on **this machine**
- where Claude CLI lives on **this machine**

---

## 4) Start or restart the OpenClaw Gateway

After build and config, restart the gateway:

```bash
openclaw gateway restart
```

Or, if needed, check status first:

```bash
openclaw gateway status
openclaw status
```

### Expected result

You should see a local gateway listening on something like:

```text
ws://127.0.0.1:19011
```

And the Control UI should be reachable at:

```text
http://127.0.0.1:19011/
```

> Note: your port may differ if your `~/.openclaw/openclaw.json` says otherwise.
> VioDashboard reads the actual port from that config file.

---

## 5) Start or restart VioDashboard

Recommended mode: **source mode**.

From the repo root:

```bash
bash apps/viodashboard/launchd/reload.sh
```

Check status:

```bash
bash apps/viodashboard/launchd/status.sh
```

Expected URL:

```text
http://127.0.0.1:8791/
```

If healthy, the status script should show:

- mode = `source`
- LaunchAgent loaded/running
- `/` returns `200`
- `/styles.css` returns `200`

---

## 6) Open the setup page

Open:

- <http://127.0.0.1:8791/setup.html>

This page is your local readiness check.
It is designed to answer:

- what is missing
- what is blocked
- what looks healthy
- what action to take next

The setup page is especially useful after:

- moving to a new machine
- pulling a large repo update
- changing local install paths
- reinstalling Claude or OpenClaw services

---

## Checks after startup

## Check A — OpenClaw is alive

```bash
openclaw status
```

You want to see:

- gateway reachable
- repo branch/commit shown correctly
- service running

## Check B — VioDashboard is alive

Open:

- <http://127.0.0.1:8791/>

## Check C — setup page works

Open:

- <http://127.0.0.1:8791/setup.html>

## Check D — setup API works

```bash
python3 - <<'PY'
import urllib.request
print(urllib.request.urlopen('http://127.0.0.1:8791/api/setup/state').status)
PY
```

Expected result:

```text
200
```

---

## What the setup wizard currently checks

Current first-pass checks include things like:

- whether `config/local.mjs` exists
- whether key local paths resolve
- whether Claude CLI can be found
- whether launchd/runtime wiring looks valid
- whether the dashboard service is up
- whether the Gateway bridge is connected

Important: this setup page is currently a **readiness / diagnostics wizard**, not a full auto-installer.
It helps you see what's wrong quickly, but it does not silently fix everything for you.

---

## Common problems

## Problem: `config/local.mjs` is missing

Symptom in setup page:

- `Local machine config` = missing

Fix:

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs
```

Then restart dashboard:

```bash
cd ../..
bash apps/viodashboard/launchd/reload.sh
```

---

## Problem: wizard says Claude CLI is missing

Symptom in setup page:

- `Dependency checks` = missing
- message mentions `claudeBin`

What to check:

```bash
which claude
```

If `claude` exists but launchd still cannot find it, regenerate local config so `claudeBin` is written as an absolute path:

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs --force
```

Then restart dashboard:

```bash
cd ../..
bash apps/viodashboard/launchd/reload.sh
```

---

## Problem: VioDashboard cannot connect to Gateway

Symptoms:

- setup page says Gateway bridge is blocked/disconnected
- logs show connection refused
- dashboard health is bad

Check:

```bash
openclaw gateway status
openclaw status
```

Common cause:

- VioDashboard is reading the wrong `configPath`
- Gateway is on a different port than VioDashboard expects

Fix:

- verify `~/.openclaw/openclaw.json` exists
- verify the port inside that config matches the running Gateway
- regenerate `config/local.mjs` if this machine moved paths
- restart both services

Recommended sequence:

```bash
openclaw gateway restart
bash apps/viodashboard/launchd/reload.sh
```

---

## Problem: `node scripts/bootstrap-local-config.mjs` says module not found

If you run this from the **repo root**:

```bash
node scripts/bootstrap-local-config.mjs
```

it will fail, because the script lives under `apps/viodashboard/`.

Use one of these instead:

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs
```

or from the repo root:

```bash
node apps/viodashboard/scripts/bootstrap-local-config.mjs
```

---

## Problem: dashboard crashes right after startup

Check logs:

```bash
tail -n 80 ~/Library/Logs/VioDashboard/wrapper.err.log
tail -n 80 ~/Library/Logs/VioDashboard/wrapper.out.log
```

Also check service status:

```bash
bash apps/viodashboard/launchd/status.sh
```

If the launch agent is not loaded or `/` returns connection refused, reload it:

```bash
bash apps/viodashboard/launchd/reload.sh
```

---

## Day-2 operations

## After pulling new code

From the repo root:

```bash
git pull
pnpm build
openclaw gateway restart
bash apps/viodashboard/launchd/reload.sh
```

### Will code updates overwrite local config?

No, not by default.

`apps/viodashboard/config/local.mjs` is machine-local and gitignored.
Updating the repo or rebuilding `dist/` does **not** automatically rewrite it.

However, if the dashboard's setup contract changes in future code, your old local config may become incomplete or outdated.
In that case the setup page should tell you what is missing.

---

## Moving to a new machine

The current design is reasonably cross-device friendly **as long as the initialization contract stays compatible**.

What usually transfers well:

- repo code
- OpenClaw source build process
- dashboard source code

What must be rechecked per machine:

- `apps/viodashboard/config/local.mjs`
- `~/.openclaw/openclaw.json`
- actual Gateway port
- `claudeBin`
- launchd service state
- filesystem paths

The intended migration pattern is:

1. clone or copy repo
2. build from source
3. regenerate `config/local.mjs`
4. verify OpenClaw config path
5. restart Gateway
6. restart VioDashboard
7. check `/setup.html`

---

## Recommended command reference

From the repo root:

### Build OpenClaw

```bash
pnpm install
pnpm build
```

### Check Gateway

```bash
openclaw status
openclaw gateway status
```

### Restart Gateway

```bash
openclaw gateway restart
```

### Generate VioDashboard local config

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs
```

### Preview VioDashboard local config

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs --print --yes
```

### Restart VioDashboard

```bash
bash apps/viodashboard/launchd/reload.sh
```

### Check VioDashboard status

```bash
bash apps/viodashboard/launchd/status.sh
```

### Check VioDashboard logs

```bash
tail -n 80 ~/Library/Logs/VioDashboard/wrapper.out.log
tail -n 80 ~/Library/Logs/VioDashboard/wrapper.err.log
```

---

## Minimal file map

If you are debugging setup, these are the only files most people need to know first:

- `apps/viodashboard/config/local.mjs` — machine-local dashboard config
- `apps/viodashboard/config/default.mjs` — repo defaults
- `apps/viodashboard/src/config.mjs` — merged runtime config loader
- `apps/viodashboard/src/server.mjs` — dashboard server entrypoint
- `apps/viodashboard/src/server/setupState.mjs` — setup diagnostics logic
- `apps/viodashboard/public/setup.html` — setup page UI

## URLs

- Dashboard: `http://127.0.0.1:8791/`
- Setup page: `http://127.0.0.1:8791/setup.html`
- OpenClaw Control UI: `http://127.0.0.1:19011/`
