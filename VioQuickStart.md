# VioDashboard + OpenClaw Quick Start

Beginner-first local setup guide for this `openclaw_fork` checkout.

This file is for the exact situation below:

- you downloaded / cloned `openclaw_fork`
- you want to run **OpenClaw Gateway** from this repo
- you also want to run **VioDashboard** from this repo
- you want one document that tells you what to do, in order

If everything is healthy, you should end with:

- OpenClaw Gateway running locally at `ws://127.0.0.1:19011`
- OpenClaw Control UI reachable at `http://127.0.0.1:19011/`
- VioDashboard reachable at `http://127.0.0.1:8791/`
- VioDashboard `/setup.html` showing green or at least clearly telling you what is still missing

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

If you're not set up yet, use the normal OpenClaw onboarding flow first:

```bash
openclaw onboard --install-daemon
```

If you already have a migrated working machine, your existing `~/.openclaw/openclaw.json` may already be enough.

---

## 3) Generate VioDashboard local machine config

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

Expected result:

- local gateway reachable
- Control UI opens at `http://127.0.0.1:19011/`

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
It helps answer:

- what is missing
- what is blocked
- what looks healthy
- what action to take next

Important: this setup page is currently a **readiness / diagnostics wizard**, not a full auto-installer.

---

## Checks after startup

### Check A — OpenClaw is alive

```bash
openclaw status
```

### Check B — VioDashboard is alive

Open:

- <http://127.0.0.1:8791/>

### Check C — setup page works

Open:

- <http://127.0.0.1:8791/setup.html>

### Check D — setup API works

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

## Common problems

### Problem: `config/local.mjs` is missing

Fix:

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs
cd ../..
bash apps/viodashboard/launchd/reload.sh
```

---

### Problem: wizard says Claude CLI is missing

Check:

```bash
which claude
```

If `claude` exists but launchd still cannot find it, regenerate local config so `claudeBin` is written as an absolute path:

```bash
cd apps/viodashboard
node scripts/bootstrap-local-config.mjs --force
cd ../..
bash apps/viodashboard/launchd/reload.sh
```

---

### Problem: VioDashboard cannot connect to Gateway

Check:

```bash
openclaw gateway status
openclaw status
```

Common causes:

- VioDashboard is reading the wrong `configPath`
- Gateway is on a different port than VioDashboard expects

Recommended recovery:

```bash
openclaw gateway restart
bash apps/viodashboard/launchd/reload.sh
```

---

### Problem: `node scripts/bootstrap-local-config.mjs` says module not found

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

### Problem: dashboard crashes right after startup

Check logs:

```bash
tail -n 80 ~/Library/Logs/VioDashboard/wrapper.err.log
tail -n 80 ~/Library/Logs/VioDashboard/wrapper.out.log
```

Also check service status:

```bash
bash apps/viodashboard/launchd/status.sh
```

If needed, reload it:

```bash
bash apps/viodashboard/launchd/reload.sh
```

---

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

The intended migration pattern is:

1. clone or copy repo
2. build from source
3. regenerate `config/local.mjs`
4. verify OpenClaw config path
5. restart Gateway
6. restart VioDashboard
7. check `/setup.html`

---

## Minimal file map

If you are debugging setup, these are the first files to know:

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
