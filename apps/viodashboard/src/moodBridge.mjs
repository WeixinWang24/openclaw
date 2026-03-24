// Sidecar mood bridge is intentionally disabled during runtime decoupling.

export async function onUserPrompt() {
  return null;
}

export async function onAssistantFinal(_text) {
  return null;
}

export async function onAssistantError() {
  return null;
}
