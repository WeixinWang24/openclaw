export function createChatDeltaCoordinator({
  runLifecycleService,
}) {
  if (!runLifecycleService) {throw new Error('runLifecycleService is required');}

  return function handleChatDeltaEvent(event) {
    if (event?.state !== 'delta') {return;}
    runLifecycleService.handleDelta(event);
  };
}
