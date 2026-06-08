import { useState, useEffect, useCallback } from 'react';
import { Workspace, Line, Station, ID, StationType, Dependency, FeatureMap, Card, CardType, ActivityLogItem, WorkspaceSnapshot } from './types';

const INITIAL_LAYERS = [
  { id: 'l1', name: 'Sprint 0 / PoC' },
  { id: 'l2', name: 'Core Functionality' },
  { id: 'l3', name: 'Secondary Priority' },
  { id: 'l4', name: 'Deferred' }
];

const STORAGE_KEY = 'metro_architect_workspace';

export interface LineCreationParams {
  name: string;
  color: string;
  shortCode: string;
  icon?: string;
  startDate?: string;
  endDate?: string;
  firstStationTitle?: string;
  owner?: string;
  status?: string;
}

// Log utility
function addLog(
  prev: Workspace,
  action: ActivityLogItem['action'],
  entityType: ActivityLogItem['entityType'],
  entityId: ID,
  entityName: string,
  details: string
): ActivityLogItem[] {
  const newLog: ActivityLogItem = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    entityName,
    details
  };
  const logs = prev.activityLog || [];
  return [newLog, ...logs].slice(0, 500);
}

export function useWorkspaceStore() {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.lines) parsed.lines = [];
          if (!parsed.stations) parsed.stations = [];
          if (!parsed.dependencies) parsed.dependencies = [];
          if (!parsed.featureMaps) parsed.featureMaps = [];
          if (!parsed.activityLog) parsed.activityLog = [];
          if (!parsed.snapshots) parsed.snapshots = [];
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to parse saved workspace from localStorage:", e);
    }
    return {
      id: 'ws-1',
      name: 'Default Workspace',
      schemaVersion: 1,
      lines: [],
      stations: [],
      dependencies: [],
      featureMaps: [],
      activityLog: [],
      snapshots: []
    };
  });

  const [lastSaved, setLastSaved] = useState<Date>(() => new Date());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    setLastSaved(new Date());
  }, [workspace]);

  const addLine = useCallback((params: LineCreationParams) => {
    const lineId = `line-${Date.now()}`;
    const stationId = `stn-${Date.now()}`;
    
    const newLine: Line = {
      id: lineId,
      name: params.name,
      color: params.color,
      shortCode: params.shortCode,
      stationIds: params.firstStationTitle ? [stationId] : [],
      isVisible: true,
      metadata: {
        icon: params.icon || '',
        startDate: params.startDate || '',
        endDate: params.endDate || '',
        owner: params.owner || '',
        status: params.status || 'Planned'
      }
    };

    setWorkspace(prev => {
      const updatedStations = [...prev.stations];
      let details = `Created track "${params.name}"`;
      if (params.firstStationTitle) {
        const offset = prev.lines.length * 60;
        updatedStations.push({
          id: stationId,
          title: params.firstStationTitle,
          type: StationType.MILESTONE,
          x: 120 + offset,
          y: 120 + offset,
          lineIds: [lineId],
          startDate: params.startDate,
          endDate: params.endDate,
          status: 'Planned',
          owner: params.owner,
          metadata: {}
        });
        details += ` with launching milestone "${params.firstStationTitle}"`;
      }

      return {
        ...prev,
        lines: [...prev.lines, newLine],
        stations: updatedStations,
        activityLog: addLog(prev, 'create', 'line', lineId, params.name, details)
      };
    });
  }, []);

  const addStation = useCallback((lineId: ID, title: string, x: number, y: number) => {
    const stationId = `stn-${Date.now()}`;
    const newStation: Station = {
      id: stationId,
      title,
      type: StationType.PHASE_BOUNDARY,
      x,
      y,
      lineIds: [lineId],
      status: 'Planned',
      metadata: { createdAt: new Date().toISOString() }
    };

    setWorkspace(prev => {
      const updatedLines = prev.lines.map(l => 
        l.id === lineId ? { ...l, stationIds: [...l.stationIds, stationId] } : l
      );
      const line = prev.lines.find(l => l.id === lineId);
      const lineName = line ? line.name : 'Unknown';
      const details = `Added milestone "${title}" to track "${lineName}"`;

      return {
        ...prev,
        stations: [...prev.stations, newStation],
        lines: updatedLines,
        activityLog: addLog(prev, 'create', 'station', stationId, title, details)
      };
    });
  }, []);

  const toggleLineOnStation = useCallback((stationId: ID, lineId: ID) => {
    setWorkspace(prev => {
      const station = prev.stations.find(s => s.id === stationId);
      if (!station) return prev;

      const isMember = station.lineIds.includes(lineId);
      const updatedLineIds = isMember 
        ? station.lineIds.filter(id => id !== lineId)
        : [...station.lineIds, lineId];

      if (updatedLineIds.length === 0) return prev; // Must belong to at least one line

      const line = prev.lines.find(l => l.id === lineId);
      const lineName = line ? line.name : 'Unknown';
      const action = isMember ? 'Disassociated' : 'Associated';
      const details = `${action} milestone "${station.title}" ${isMember ? 'from' : 'with'} track "${lineName}"`;

      return {
        ...prev,
        stations: prev.stations.map(s => 
          s.id === stationId ? { ...s, lineIds: updatedLineIds } : s
        ),
        lines: prev.lines.map(l => {
          if (l.id === lineId) {
            return {
              ...l,
              stationIds: isMember 
                ? l.stationIds.filter(id => id !== stationId)
                : [...l.stationIds, stationId]
            };
          }
          return l;
        }),
        activityLog: addLog(prev, 'associate', 'station', stationId, station.title, details)
      };
    });
  }, []);

  const addDependency = useCallback((fromId: ID, toId: ID) => {
    if (fromId === toId) return;
    setWorkspace(prev => {
      const exists = prev.dependencies.find(d => d.fromStationId === fromId && d.toStationId === toId);
      if (exists) return prev;
      
      const newDep: Dependency = {
        id: `dep-${Date.now()}`,
        fromStationId: fromId,
        toStationId: toId,
        metadata: {}
      };

      const fromStation = prev.stations.find(s => s.id === fromId);
      const toStation = prev.stations.find(s => s.id === toId);
      const details = `Added dependency from "${fromStation?.title || 'Unknown'}" to "${toStation?.title || 'Unknown'}"`;

      return {
        ...prev,
        dependencies: [...prev.dependencies, newDep],
        activityLog: addLog(prev, 'dependency_add', 'dependency', newDep.id, 'Dependency', details)
      };
    });
  }, []);

  const removeDependency = useCallback((id: ID) => {
    setWorkspace(prev => {
      const dep = prev.dependencies.find(d => d.id === id);
      if (!dep) return prev;

      const fromStation = prev.stations.find(s => s.id === dep.fromStationId);
      const toStation = prev.stations.find(s => s.id === dep.toStationId);
      const details = `Removed dependency from "${fromStation?.title || 'Unknown'}" to "${toStation?.title || 'Unknown'}"`;

      return {
        ...prev,
        dependencies: prev.dependencies.filter(d => d.id !== id),
        activityLog: addLog(prev, 'dependency_remove', 'dependency', id, 'Dependency', details)
      };
    });
  }, []);

  const updateStationPos = useCallback((id: ID, x: number, y: number) => {
    setWorkspace(prev => ({
      ...prev,
      stations: prev.stations.map(s => s.id === id ? { ...s, x, y } : s)
    }));
  }, []);

  const updateStation = useCallback((id: ID, updates: Partial<Station>) => {
    setWorkspace(prev => {
      const station = prev.stations.find(s => s.id === id);
      if (!station) return prev;

      const detailsParts: string[] = [];
      if (updates.title && updates.title !== station.title) {
        detailsParts.push(`renamed to "${updates.title}"`);
      }
      if (updates.status && updates.status !== station.status) {
        detailsParts.push(`status set to "${updates.status}"`);
      }
      if (updates.owner !== undefined && updates.owner !== station.owner) {
        detailsParts.push(`owner set to "${updates.owner || 'None'}"`);
      }
      if (updates.type && updates.type !== station.type) {
        detailsParts.push(`type set to "${updates.type}"`);
      }

      const details = detailsParts.length > 0 
        ? `Updated milestone "${station.title}": ${detailsParts.join(', ')}`
        : `Updated milestone "${station.title}" properties`;

      return {
        ...prev,
        stations: prev.stations.map(s => s.id === id ? { ...s, ...updates } : s),
        activityLog: addLog(prev, 'update', 'station', id, updates.title || station.title, details)
      };
    });
  }, []);

  const deleteStation = useCallback((id: ID) => {
    setWorkspace(prev => {
      const station = prev.stations.find(s => s.id === id);
      if (!station) return prev;

      const details = `Deleted milestone "${station.title}" and clean-cascaded its connected dependencies`;

      return {
        ...prev,
        stations: prev.stations.filter(s => s.id !== id),
        lines: prev.lines.map(l => ({
          ...l,
          stationIds: l.stationIds.filter(sid => sid !== id)
        })),
        dependencies: prev.dependencies.filter(d => d.fromStationId !== id && d.toStationId !== id),
        featureMaps: prev.featureMaps.map(f => ({
          ...f,
          cards: f.cards.filter(c => c.sourceSegmentId !== id && c.sourceStationId !== id)
        })),
        activityLog: addLog(prev, 'delete', 'station', id, station.title, details)
      };
    });
  }, []);

  const deleteLine = useCallback((lineId: ID) => {
    setWorkspace(prev => {
      const line = prev.lines.find(l => l.id === lineId);
      if (!line) return prev;

      const details = `Deleted track "${line.name}" and cascaded all uniquely connected milestones, story cards, and backlogs`;

      const stationsToDelete: ID[] = [];
      const updatedStations = prev.stations.map(station => {
        if (station.lineIds.includes(lineId)) {
          const remainingLineIds = station.lineIds.filter(id => id !== lineId);
          if (remainingLineIds.length === 0) {
            stationsToDelete.push(station.id);
            return null;
          } else {
            return {
              ...station,
              lineIds: remainingLineIds
            };
          }
        }
        return station;
      }).filter((s): s is Station => s !== null);

      const updatedLines = prev.lines.filter(l => l.id !== lineId);

      const updatedDependencies = prev.dependencies.filter(d => 
        !stationsToDelete.includes(d.fromStationId) && !stationsToDelete.includes(d.toStationId)
      );

      const updatedFeatureMaps = prev.featureMaps
        .filter(fm => fm.lineId !== lineId)
        .map(fm => ({
          ...fm,
          cards: fm.cards.filter(c => 
            (!c.sourceSegmentId || !stationsToDelete.includes(c.sourceSegmentId)) &&
            (!c.sourceStationId || !stationsToDelete.includes(c.sourceStationId))
          )
        }));

      return {
        ...prev,
        lines: updatedLines,
        stations: updatedStations,
        dependencies: updatedDependencies,
        featureMaps: updatedFeatureMaps,
        activityLog: addLog(prev, 'delete', 'line', lineId, line.name, details)
      };
    });
  }, []);

  const ensureFeatureMap = useCallback((lineId: ID) => {
    setWorkspace(prev => {
      const line = prev.lines.find(l => l.id === lineId);
      if (!line) return prev;
      
      const existing = prev.featureMaps.find(f => f.lineId === lineId);
      if (existing) return prev;

      const newMap: FeatureMap = {
        id: `fm-${lineId}`,
        lineId,
        name: line.name,
        layers: [...INITIAL_LAYERS],
        cards: []
      };

      return {
        ...prev,
        featureMaps: [...prev.featureMaps, newMap]
      };
    });
  }, []);

  const addCard = useCallback((lineId: ID, layerId: ID, segmentId: ID, title: string, cardType?: CardType) => {
    setWorkspace(prev => {
      const fmap = prev.featureMaps.find(f => f.lineId === lineId);
      if (!fmap) return prev;

      const newCard: Card = {
        id: `card-${Date.now()}`,
        title,
        description: '',
        type: cardType || CardType.STORY,
        status: 'Todo',
        priority: 0,
        tags: [],
        sourceSegmentId: segmentId,
        metadata: { layerId, createdAt: new Date().toISOString() }
      };

      const line = prev.lines.find(l => l.id === lineId);
      const station = prev.stations.find(s => s.id === segmentId);
      const segmentText = station ? `milestone "${station.title}"` : 'General backlog';
      const details = `Added card "${title}" to the ${segmentText} backlog for "${line?.name || 'Unknown'}"`;

      return {
        ...prev,
        featureMaps: prev.featureMaps.map(f => 
          f.lineId === lineId ? { ...f, cards: [...f.cards, newCard] } : f
        ),
        activityLog: addLog(prev, 'create', 'card', newCard.id, title, details)
      };
    });
  }, []);

  const moveCard = useCallback((lineId: ID, cardId: ID, targetLayerId: ID, targetSegmentId: ID) => {
    setWorkspace(prev => {
      const fmap = prev.featureMaps.find(f => f.lineId === lineId);
      const card = fmap?.cards.find(c => c.id === cardId);
      if (!card) return prev;

      const station = prev.stations.find(s => s.id === targetSegmentId);
      const segmentText = station ? `milestone "${station.title}"` : 'General backlog';
      const details = `Moved story "${card.title}" to ${segmentText}`;

      return {
        ...prev,
        featureMaps: prev.featureMaps.map(f => {
          if (f.lineId !== lineId) return f;
          return {
            ...f,
            cards: f.cards.map(c => 
              c.id === cardId ? { ...c, sourceSegmentId: targetSegmentId, metadata: { ...c.metadata, layerId: targetLayerId } } : c
            )
          };
        }),
        activityLog: addLog(prev, 'move', 'card', cardId, card.title, details)
      };
    });
  }, []);

  const reorderCard = useCallback((lineId: ID, cardId: ID, targetLayerId: ID, targetSegmentId: ID, beforeCardId?: ID | null) => {
    setWorkspace(prev => {
      const fmap = prev.featureMaps.find(f => f.lineId === lineId);
      const cardToMove = fmap?.cards.find(c => c.id === cardId);
      if (!cardToMove) return prev;

      const station = prev.stations.find(s => s.id === targetSegmentId);
      const segmentText = station ? `milestone "${station.title}"` : 'General backlog';
      const details = `Reordered story "${cardToMove.title}" under ${segmentText}`;

      const updatedCard = {
        ...cardToMove,
        sourceSegmentId: targetSegmentId,
        metadata: { ...cardToMove.metadata, layerId: targetLayerId }
      };

      const remaining = fmap?.cards.filter(c => c.id !== cardId) || [];

      let newCardsList = [...remaining, updatedCard];

      if (beforeCardId) {
        const idx = remaining.findIndex(c => c.id === beforeCardId);
        if (idx !== -1) {
          const newCards = [...remaining];
          newCards.splice(idx, 0, updatedCard);
          newCardsList = newCards;
        }
      }

      return {
        ...prev,
        featureMaps: prev.featureMaps.map(f => {
          if (f.lineId !== lineId) return f;
          return {
            ...f,
            cards: newCardsList
          };
        }),
        activityLog: addLog(prev, 'move', 'card', cardId, cardToMove.title, details)
      };
    });
  }, []);

  const updateCard = useCallback((lineId: ID, cardId: ID, updates: Partial<Card>) => {
    setWorkspace(prev => {
      const fmap = prev.featureMaps.find(f => f.lineId === lineId);
      const card = fmap?.cards.find(c => c.id === cardId);
      if (!card) return prev;

      const detailsParts: string[] = [];
      if (updates.title && updates.title !== card.title) {
        detailsParts.push(`renamed to "${updates.title}"`);
      }
      if (updates.status && updates.status !== card.status) {
        detailsParts.push(`status set to "${updates.status}"`);
      }
      if (updates.priority !== undefined && updates.priority !== card.priority) {
        detailsParts.push(`priority set to "${updates.priority}"`);
      }
      if (updates.owner !== undefined && updates.owner !== card.owner) {
        detailsParts.push(`owner set to "${updates.owner || 'None'}"`);
      }

      const details = detailsParts.length > 0 
        ? `Updated story "${card.title}": ${detailsParts.join(', ')}`
        : `Updated story "${card.title}" properties`;

      return {
        ...prev,
        featureMaps: prev.featureMaps.map(f => {
          if (f.lineId !== lineId) return f;
          return {
            ...f,
            cards: f.cards.map(c => 
              c.id === cardId ? { ...c, ...updates } : c
            )
          };
        }),
        activityLog: addLog(prev, 'update', 'card', cardId, updates.title || card.title, details)
      };
    });
  }, []);

  const deleteCard = useCallback((lineId: ID, cardId: ID) => {
    setWorkspace(prev => {
      const fmap = prev.featureMaps.find(f => f.lineId === lineId);
      const card = fmap?.cards.find(c => c.id === cardId);
      if (!card) return prev;

      const details = `Deleted story card "${card.title}" from track backlogs`;

      return {
        ...prev,
        featureMaps: prev.featureMaps.map(f => {
          if (f.lineId !== lineId) return f;
          return {
            ...f,
            cards: f.cards.filter(c => c.id !== cardId)
          };
        }),
        activityLog: addLog(prev, 'delete', 'card', cardId, card.title, details)
      };
    });
  }, []);

  const moveStations = useCallback((ids: ID[], dx: number, dy: number) => {
    if (ids.length === 0 || (dx === 0 && dy === 0)) return;
    setWorkspace(prev => ({
      ...prev,
      stations: prev.stations.map(s => ids.includes(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s)
    }));
  }, []);

  const deleteStations = useCallback((ids: ID[]) => {
    if (ids.length === 0) return;
    setWorkspace(prev => {
      const stationsToDelete = prev.stations.filter(s => ids.includes(s.id));
      if (stationsToDelete.length === 0) return prev;

      const details = `Deleted ${stationsToDelete.length} milestone stations in bulk and cascaded connected elements`;

      return {
        ...prev,
        stations: prev.stations.filter(s => !ids.includes(s.id)),
        lines: prev.lines.map(l => ({
          ...l,
          stationIds: l.stationIds.filter(sid => !ids.includes(sid))
        })),
        dependencies: prev.dependencies.filter(d => !ids.includes(d.fromStationId) && !ids.includes(d.toStationId)),
        featureMaps: prev.featureMaps.map(f => ({
          ...f,
          cards: f.cards.filter(c => 
            (!c.sourceSegmentId || !ids.includes(c.sourceSegmentId)) &&
            (!c.sourceStationId || !ids.includes(c.sourceStationId))
          )
        })),
        activityLog: addLog(prev, 'delete', 'station', ids[0], `${stationsToDelete.length} stations`, details)
      };
    });
  }, []);

  const duplicateStations = useCallback((ids: ID[]) => {
    if (ids.length === 0) return;
    let newFirstStationId: ID = '';
    setWorkspace(prev => {
      const stationsToDup = prev.stations.filter(s => ids.includes(s.id));
      if (stationsToDup.length === 0) return prev;

      const idMap: Record<ID, ID> = {};
      const newStations = stationsToDup.map(s => {
        const newId = `stn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        idMap[s.id] = newId;
        if (!newFirstStationId) newFirstStationId = newId;
        return {
          ...s,
          id: newId,
          title: s.title.includes('(Copy)') ? s.title : `${s.title} (Copy)`,
          x: s.x + 80,
          y: s.y + 80,
        };
      });

      // Insert new station IDs after their originals in line tracks
      const updatedLines = prev.lines.map(line => {
        let containsAny = false;
        const newStationIds: ID[] = [];
        line.stationIds.forEach(sid => {
          newStationIds.push(sid);
          if (idMap[sid]) {
            newStationIds.push(idMap[sid]);
            containsAny = true;
          }
        });
        return containsAny ? { ...line, stationIds: newStationIds } : line;
      });

      // Duplicate internal dependencies
      const newDeps: Dependency[] = [];
      prev.dependencies.forEach(dep => {
        if (idMap[dep.fromStationId] && idMap[dep.toStationId]) {
          newDeps.push({
            id: `dep-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            fromStationId: idMap[dep.fromStationId],
            toStationId: idMap[dep.toStationId],
            metadata: { ...dep.metadata }
          });
        }
      });

      const details = `Duplicated ${stationsToDup.length} milestone stations and related sequences`;

      return {
        ...prev,
        stations: [...prev.stations, ...newStations],
        lines: updatedLines,
        dependencies: [...prev.dependencies, ...newDeps],
        activityLog: addLog(prev, 'create', 'station', newFirstStationId || newStations[0].id, `${newStations.length} stations`, details)
      };
    });
  }, []);

  const bulkUpdateStations = useCallback((ids: ID[], updates: Partial<Station>) => {
    if (ids.length === 0) return;
    setWorkspace(prev => {
      const details = `Bulk updated ${ids.length} stations properties`;
      return {
        ...prev,
        stations: prev.stations.map(s => ids.includes(s.id) ? { ...s, ...updates } : s),
        activityLog: addLog(prev, 'update', 'station', ids[0], `${ids.length} stations`, details)
      };
    });
  }, []);

  const bulkUpdateStationPositions = useCallback((positions: Record<ID, { x: number; y: number }>) => {
    setWorkspace(prev => {
      const details = `Auto-organized positions of ${Object.keys(positions).length} stations`;
      return {
        ...prev,
        stations: prev.stations.map(s => positions[s.id] ? { ...s, x: positions[s.id].x, y: positions[s.id].y } : s),
        activityLog: addLog(prev, 'update', 'station', Object.keys(positions)[0] || '', 'stations', details)
      };
    });
  }, []);

  const importWorkspace = (data: Workspace) => {
    // Ensure snapshots are initialized on direct workspace loads
    if (!data.snapshots) {
      data.snapshots = [];
    }
    setWorkspace(data);
  };

  /**
   * Captures the current configuration of elements (lines, stations, dependencies, featureMaps) 
   * into a named snapshot that gets preserved inside the history logs.
   */
  const createSnapshot = useCallback((name: string, description?: string, customTimestamp?: string) => {
    if (!name.trim()) return;
    setWorkspace(prev => {
      const snapId = `snap-${Date.now()}`;
      const newSnapshot: WorkspaceSnapshot = {
        id: snapId,
        name: name.trim(),
        description: description?.trim() || '',
        timestamp: customTimestamp || new Date().toISOString(),
        // Capture exact deep clones of reactive lists avoiding multi-reference mutations
        lines: JSON.parse(JSON.stringify(prev.lines)),
        stations: JSON.parse(JSON.stringify(prev.stations)),
        dependencies: JSON.parse(JSON.stringify(prev.dependencies)),
        featureMaps: JSON.parse(JSON.stringify(prev.featureMaps)),
      };
      const prevSnaps = prev.snapshots || [];
      const details = `Created workspace snapshot "${name.trim()}"`;
      return {
        ...prev,
        snapshots: [...prevSnaps, newSnapshot],
        activityLog: addLog(prev, 'create', 'line', snapId, name.trim(), details)
      };
    });
  }, []);

  /**
   * Removes a historical workspace snapshot by its ID.
   */
  const deleteSnapshot = useCallback((id: ID) => {
    setWorkspace(prev => {
      const prevSnaps = prev.snapshots || [];
      const target = prevSnaps.find(s => s.id === id);
      if (!target) return prev;
      const details = `Deleted historical snapshot "${target.name}"`;
      return {
        ...prev,
        snapshots: prevSnaps.filter(s => s.id !== id),
        activityLog: addLog(prev, 'delete', 'line', id, target.name, details)
      };
    });
  }, []);

  /**
   * Overwrites the active workspace map elements to completely restore project configurations
   * matching a selected snapshot.
   */
  const restoreSnapshot = useCallback((id: ID) => {
    setWorkspace(prev => {
      const prevSnaps = prev.snapshots || [];
      const target = prevSnaps.find(s => s.id === id);
      if (!target) return prev;
      
      const details = `Restored workspace configuration to match snapshot "${target.name}"`;
      
      return {
        ...prev,
        // Replace active lists with deep clones of the target snapshot configuration
        lines: JSON.parse(JSON.stringify(target.lines)),
        stations: JSON.parse(JSON.stringify(target.stations)),
        dependencies: JSON.parse(JSON.stringify(target.dependencies)),
        featureMaps: JSON.parse(JSON.stringify(target.featureMaps)),
        activityLog: addLog(prev, 'update', 'line', id, target.name, details)
      };
    });
  }, []);

  return { 
    workspace, 
    lastSaved,
    addLine, 
    addStation,
    toggleLineOnStation,
    addDependency,
    removeDependency,
    updateStationPos, 
    updateStation,
    deleteStation,
    deleteLine,
    ensureFeatureMap, 
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    reorderCard,
    moveStations,
    deleteStations,
    duplicateStations,
    bulkUpdateStations,
    bulkUpdateStationPositions,
    importWorkspace,
    createSnapshot,
    deleteSnapshot,
    restoreSnapshot
  };
}
