export function createTokenUsageService({ bridge, tokenStats, broadcast, buildTokensPacket }) {
  if (!bridge) {throw new Error('bridge is required');}
  if (!tokenStats) {throw new Error('tokenStats is required');}
  if (typeof broadcast !== 'function') {throw new Error('broadcast is required');}
  if (typeof buildTokensPacket !== 'function') {throw new Error('buildTokensPacket is required');}

  async function refresh() {
    try {
      const latest = await bridge.fetchSessionUsage();
      if (!latest) {return null;}
      const prev = {
        input: tokenStats.totalInput,
        output: tokenStats.totalOutput,
        cacheRead: tokenStats.totalCacheRead,
        cacheWrite: tokenStats.totalCacheWrite,
        total: tokenStats.total,
      };
      tokenStats.totalInput = latest.input;
      tokenStats.totalOutput = latest.output;
      tokenStats.totalCacheRead = latest.cacheRead;
      tokenStats.totalCacheWrite = latest.cacheWrite;
      tokenStats.total = latest.total;
      tokenStats.modelName = latest.model;
      tokenStats.modelProvider = latest.provider;
      tokenStats.last = tokenStats.baselineReady ? {
        input: Math.max(0, latest.input - prev.input),
        output: Math.max(0, latest.output - prev.output),
        cacheRead: Math.max(0, latest.cacheRead - prev.cacheRead),
        cacheWrite: Math.max(0, latest.cacheWrite - prev.cacheWrite),
        total: Math.max(0, latest.total - prev.total),
      } : null;
      tokenStats.baselineReady = true;
      try {
        const [models, snapshot] = await Promise.all([
          bridge.fetchModelCatalog(),
          bridge.fetchSessionContextSnapshot(),
        ]);
        const match = models.find(model => {
          const name = typeof model?.id === 'string' ? model.id : (typeof model?.model === 'string' ? model.model : null);
          const provider = typeof model?.provider === 'string' ? model.provider : null;
          return name === latest.model && (!latest.provider || !provider || provider === latest.provider);
        });
        const limit = Number(match?.contextWindow ?? match?.context_window ?? match?.limit ?? 0) || null;
        tokenStats.modelLimit = limit;
        const estimatedPromptLoad = tokenStats.last ? ((tokenStats.last.input || 0) + (tokenStats.last.cacheRead || 0)) : null;
        tokenStats.modelUsagePercent = (limit && estimatedPromptLoad != null)
          ? Math.min(100, Math.round((estimatedPromptLoad / limit) * 1000) / 10)
          : null;
        tokenStats.contextSnapshot = snapshot ? {
          totalTokens: typeof snapshot.totalTokens === 'number' ? snapshot.totalTokens : null,
          limit: typeof snapshot.contextTokens === 'number' ? snapshot.contextTokens : null,
          fresh: snapshot.totalTokensFresh,
          model: snapshot.model,
          provider: snapshot.provider,
          sessionKey: snapshot.key,
          pct: typeof snapshot.totalTokens === 'number' && typeof snapshot.contextTokens === 'number' && snapshot.contextTokens > 0
            ? Math.min(100, Math.round((snapshot.totalTokens / snapshot.contextTokens) * 1000) / 10)
            : null,
        } : null;
      } catch (error) {
        console.log('[wrapper] models.list / sessions.list fetch failed', error?.message || String(error));
      }
      broadcast(buildTokensPacket());
      return tokenStats;
    } catch (error) {
      console.log('[wrapper] sessions.usage fetch failed', error?.message || String(error));
      return null;
    }
  }

  return {
    refresh,
  };
}
