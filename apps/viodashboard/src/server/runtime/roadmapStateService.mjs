import fs from 'node:fs';

export function createRoadmapStateService({ dataDir, roadmapDataPath, roadmapHistoryDataPath }) {
  if (!dataDir) {throw new Error('dataDir is required');}
  if (!roadmapDataPath) {throw new Error('roadmapDataPath is required');}
  if (!roadmapHistoryDataPath) {throw new Error('roadmapHistoryDataPath is required');}

  function loadRoadmapData() {
    try {
      if (!fs.existsSync(roadmapDataPath)) {return null;}
      return JSON.parse(fs.readFileSync(roadmapDataPath, 'utf8'));
    } catch {
      return null;
    }
  }

  function saveRoadmapData(payload) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(roadmapDataPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  function loadRoadmapHistory() {
    try {
      if (!fs.existsSync(roadmapHistoryDataPath)) {return [];}
      const raw = JSON.parse(fs.readFileSync(roadmapHistoryDataPath, 'utf8'));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveRoadmapHistory(items) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(roadmapHistoryDataPath, JSON.stringify(items, null, 2), 'utf8');
  }

  function pushRoadmapHistory(previousRoadmap) {
    if (!previousRoadmap || !previousRoadmap.id) {return;}
    const history = loadRoadmapHistory();
    if (history.some(item => item?.id === previousRoadmap.id)) {return;}
    history.unshift(previousRoadmap);
    saveRoadmapHistory(history.slice(0, 60));
  }

  function roadmapHasItems(roadmap) {
    return !!(roadmap && Array.isArray(roadmap.items) && roadmap.items.length);
  }

  function choosePersistedRoadmap(nextRoadmap, previousRoadmap) {
    if (nextRoadmap?.sourceType === 'assistant-structured') {
      return {
        roadmap: nextRoadmap,
        reason: roadmapHasItems(nextRoadmap) ? 'updated-structured' : 'accepted-empty-structured',
        replacedPrevious: !!(previousRoadmap && previousRoadmap.id !== nextRoadmap.id),
      };
    }
    if (roadmapHasItems(nextRoadmap)) {
      return {
        roadmap: nextRoadmap,
        reason: 'updated',
        replacedPrevious: !!(previousRoadmap && previousRoadmap.id !== nextRoadmap.id),
      };
    }
    if (roadmapHasItems(previousRoadmap)) {
      return {
        roadmap: previousRoadmap,
        reason: 'preserved-previous-non-empty',
        replacedPrevious: false,
      };
    }
    return {
      roadmap: nextRoadmap,
      reason: 'accepted-empty-no-previous',
      replacedPrevious: false,
    };
  }

  return {
    loadRoadmapData,
    saveRoadmapData,
    loadRoadmapHistory,
    saveRoadmapHistory,
    pushRoadmapHistory,
    choosePersistedRoadmap,
  };
}
