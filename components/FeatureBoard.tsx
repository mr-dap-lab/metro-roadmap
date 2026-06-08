
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Workspace, ID, Line, Card, Layer, CardType } from '../types';
import { useToast } from './Toast';
import { ResourceAllocationView } from './ResourceAllocationView';

const getCreatedAtDate = (id: string, metadata?: any): Date => {
  if (metadata && metadata.createdAt) {
    return new Date(metadata.createdAt);
  }
  const timestampPart = id.replace(/^(stn-|card-|snap-|line-)/, '');
  if (/^\d+$/.test(timestampPart)) {
    return new Date(parseInt(timestampPart, 10));
  }
  return new Date('2026-06-01T08:00:00.000Z');
};

const formatDateValue = (date: Date): string => {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ' ' + date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getDueDateStatus = (dueDate?: string, status?: string) => {
  if (!dueDate || status === 'Completed' || status === 'Done') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { label: `Overdue by ${Math.abs(diffDays)}d`, urgency: 'overdue', days: diffDays };
  }
  if (diffDays <= 3) {
    return { label: diffDays === 0 ? 'Due Today' : diffDays === 1 ? 'Due Tomorrow' : `Due in ${diffDays}d`, urgency: 'nearing', days: diffDays };
  }
  return { label: `Due on ${target.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`, urgency: 'normal', days: diffDays };
};

interface FeatureBoardProps {
  workspace: Workspace;
  lineId: ID;
  addCard: (lineId: ID, layerId: ID, segmentId: ID, title: string, cardType?: CardType) => void;
  updateCard: (lineId: ID, cardId: ID, updates: Partial<Card>) => void;
  deleteCard: (lineId: ID, cardId: ID) => void;
  moveCard: (lineId: ID, cardId: ID, targetLayerId: ID, targetSegmentId: ID) => void;
  reorderCard: (lineId: ID, cardId: ID, targetLayerId: ID, targetSegmentId: ID, beforeCardId?: ID | null) => void;
  searchedCardId?: ID | null;
}

const FeatureBoard: React.FC<FeatureBoardProps> = ({ 
  workspace, 
  lineId, 
  addCard, 
  updateCard,
  deleteCard,
  moveCard,
  reorderCard,
  searchedCardId 
}) => {
  const { showToast } = useToast();
  const line = workspace.lines.find(l => l.id === lineId);
  const featureMap = workspace.featureMaps.find(f => f.lineId === lineId);

  if (!line || !featureMap) {
    return (
      <div className="flex-1 overflow-auto p-12 text-center text-slate-500">
        <h3 className="text-lg font-bold">Line Track or Feature Board not found</h3>
        <p className="text-xs text-slate-400 mt-2">The requested track may have been deleted or modified. Please return home.</p>
      </div>
    );
  }

  // Each station on the line defines a column, or segments between them if multiple stations
  const segments = useMemo(() => {
    const stns = line.stationIds
      .map(sid => workspace.stations.find(s => s.id === sid))
      .filter(Boolean);
    if (stns.length <= 1) {
      return stns; // Fallback so there's at least one column for the launch station
    }
    return stns.slice(0, -1); // Columns are track boundaries between stations
  }, [line.stationIds, workspace.stations]);

  const [newCardText, setNewCardText] = useState<{ [key: string]: string }>({});
  const [selectedTypes, setSelectedTypes] = useState<{ [key: string]: CardType }>({});

  const [dragOverCell, setDragOverCell] = useState<{ layerId: ID; segmentId: ID } | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<ID | null>(null);
  const [isDraggingId, setIsDraggingId] = useState<ID | null>(null);

  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState<CardType>(CardType.STORY);
  const [editStatus, setEditStatus] = useState('Todo');
  const [editOwner, setEditOwner] = useState('');
  const [editEstimate, setEditEstimate] = useState('');
  const [editPrereqs, setEditPrereqs] = useState<ID[]>([]);
  const [editComplexityScore, setEditComplexityScore] = useState<number | ''>('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editIsHighPriority, setEditIsHighPriority] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Active status toggle for the visual dependency connecting lines
  const [showDependencies, setShowDependencies] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('roadmap_show_feature_dependencies');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('roadmap_show_feature_dependencies', String(showDependencies));
  }, [showDependencies]);

  // Active status toggle for the visual density heatmap overlay
  const [showHeatmap, setShowHeatmap] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('roadmap_show_feature_heatmap');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('roadmap_show_feature_heatmap', String(showHeatmap));
  }, [showHeatmap]);

  const [viewMode, setViewMode] = useState<'board' | 'resource'>('board');

  // Backlog Board Filtering States
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState<string>('');

  const distinctOwners = useMemo(() => {
    const owners = new Set<string>();
    featureMap.cards.forEach(c => {
      if (c.owner && c.owner.trim()) {
        owners.add(c.owner.trim());
      }
    });
    return Array.from(owners).sort();
  }, [featureMap.cards]);

  const filteredCards = useMemo(() => {
    return featureMap.cards.filter(c => {
      const matchesSearch = !filterSearch || 
        c.title.toLowerCase().includes(filterSearch.toLowerCase()) || 
        (c.description || '').toLowerCase().includes(filterSearch.toLowerCase());
      
      const matchesType = filterType === 'all' || c.type === filterType;
      
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      
      const matchesOwner = filterOwner === 'all' || 
        (filterOwner === 'Unassigned' && (!c.owner || !c.owner.trim())) ||
        c.owner === filterOwner;
      
      return matchesSearch && matchesType && matchesStatus && matchesOwner;
    });
  }, [featureMap.cards, filterSearch, filterType, filterStatus, filterOwner]);

  const isAnyFilterActive = useMemo(() => {
    return filterType !== 'all' || filterStatus !== 'all' || filterOwner !== 'all' || filterSearch !== '';
  }, [filterType, filterStatus, filterOwner, filterSearch]);

  const alertCards = useMemo(() => {
    return featureMap.cards.filter(card => {
      if (card.status === 'Completed' || card.status === 'Done') return false;
      const dueStatus = getDueDateStatus(card.dueDate, card.status);
      return !!(card.isHighPriority || dueStatus?.urgency === 'overdue' || dueStatus?.urgency === 'nearing');
    });
  }, [featureMap.cards]);

  // Card pixel-coordinate dimensions tracking
  const [cardPositions, setCardPositions] = useState<Record<ID, { x: number; y: number; w: number; h: number }>>({});
  const [hoveredCardId, setHoveredCardId] = useState<ID | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  /**
   * Helper function to calculate precise relative positions of cards inside the board scroll canvas.
   */
  const updatePositions = useCallback(() => {
    const container = document.getElementById('feature-board-scroll-content');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const positions: Record<ID, { x: number; y: number; w: number; h: number }> = {};
    
    filteredCards.forEach(card => {
      const cardEl = document.getElementById(`card-${card.id}`);
      if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        positions[card.id] = {
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          w: rect.width,
          h: rect.height,
        };
      }
    });
    setCardPositions(positions);
  }, [filteredCards]);

  // Force position updates whenever dependency layout, cards, dragging, or edit cycles occur
  useEffect(() => {
    const timer = setTimeout(updatePositions, 100);
    return () => clearTimeout(timer);
  }, [filteredCards, dragOverCell, dragOverCardId, editingCard, showDependencies, updatePositions]);

  // Add scroll and resize listeners to maintain precise alignment
  useEffect(() => {
    window.addEventListener('resize', updatePositions);
    const container = document.querySelector('.flex-1.overflow-auto');
    if (container) {
      container.addEventListener('scroll', updatePositions);
    }
    return () => {
      window.removeEventListener('resize', updatePositions);
      if (container) {
        container.removeEventListener('scroll', updatePositions);
      }
    };
  }, [updatePositions]);

  /**
   * Computes the mathematical transitive closure of all connected cards in a dependency thread.
   * Tracks both upstream prerequisites (blockage) and downstream successors (targets) recursively.
   */
  const getConnectedCardIds = useCallback((cardId: ID): Set<ID> => {
    const connected = new Set<ID>([cardId]);
    const cards = featureMap.cards;
    
    const buildChain = (id: ID) => {
      const current = cards.find(c => c.id === id);
      if (!current) return;
      const prereqString = (current.metadata.prereqs as string) || '';
      const prereqIds = prereqString ? prereqString.split(',').filter(Boolean) : [];
      prereqIds.forEach(pId => {
        if (!connected.has(pId)) {
          connected.add(pId);
          buildChain(pId);
        }
      });
    };

    const buildDownstream = (id: ID) => {
      cards.forEach(c => {
        const pStr = (c.metadata.prereqs as string) || '';
        const pIds = pStr ? pStr.split(',').filter(Boolean) : [];
        if (pIds.includes(id) && !connected.has(c.id)) {
          connected.add(c.id);
          buildDownstream(c.id);
        }
      });
    };

    buildChain(cardId);
    buildDownstream(cardId);
    return connected;
  }, [featureMap.cards]);

  // Calculate dynamic line paths for SVG connector rendering in the Feature Board
  const dependencyLines = useMemo(() => {
    if (!showDependencies) return [];
    
    const lines: Array<{
      id: string;
      fromId: ID;
      toId: ID;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      highlighted: boolean;
      faded: boolean;
    }> = [];

    // Track active connection focus chains if a card is hovered
    const activeChain = hoveredCardId ? getConnectedCardIds(hoveredCardId) : null;

    filteredCards.forEach(card => {
      const prereqString = (card.metadata.prereqs as string) || '';
      const prereqIds = prereqString ? prereqString.split(',').filter(Boolean) : [];

      prereqIds.forEach(pId => {
        const fromPos = cardPositions[pId];
        const toPos = cardPositions[card.id];

        if (fromPos && toPos) {
          // Connections go Left-to-Right from right of prerequisite card to left of dependent card
          const startX = fromPos.x + fromPos.w;
          const startY = fromPos.y + fromPos.h / 2;
          
          const endX = toPos.x;
          const endY = toPos.y + toPos.h / 2;

          // Determine connection lighting
          const isFromHovered = hoveredCardId === pId;
          const isToHovered = hoveredCardId === card.id;
          
          let highlighted = false;
          let faded = false;

          if (hoveredCardId) {
            highlighted = isFromHovered || isToHovered;
            // Also highlight if it's in the active chain and connected to each other
            if (activeChain?.has(pId) && activeChain?.has(card.id)) {
              highlighted = true;
            }
            faded = !highlighted;
          }

          lines.push({
            id: `${pId}-${card.id}`,
            fromId: pId,
            toId: card.id,
            startX,
            startY,
            endX,
            endY,
            highlighted,
            faded
          });
        }
      });
    });

    return lines;
  }, [filteredCards, cardPositions, hoveredCardId, showDependencies, getConnectedCardIds]);

  const handleCardClick = (card: Card) => {
    setEditingCard(card);
    setEditTitle(card.title || '');
    setEditDesc(card.description || '');
    setEditType(card.type || CardType.STORY);
    setEditStatus(card.status || 'Todo');
    setEditOwner(card.owner || '');
    setEditEstimate(card.estimate || '');
    setEditComplexityScore(card.complexityScore !== undefined ? card.complexityScore : '');
    setEditDueDate(card.dueDate || '');
    setEditIsHighPriority(!!card.isHighPriority);
    
    // Parse mapped prerequisite IDs from custom metadata array string
    const prereqString = (card.metadata.prereqs as string) || '';
    setEditPrereqs(prereqString ? prereqString.split(',').filter(Boolean) : []);
    
    setShowDeleteConfirm(false);
  };

  const handleSaveEditCard = () => {
    if (!editingCard) return;
    updateCard(lineId, editingCard.id, {
      title: editTitle,
      description: editDesc,
      type: editType,
      status: editStatus,
      owner: editOwner,
      estimate: editEstimate,
      complexityScore: editComplexityScore === '' ? undefined : Number(editComplexityScore),
      dueDate: editDueDate || undefined,
      isHighPriority: editIsHighPriority,
      // Store updated prerequisites alongside card layout mappings
      metadata: {
        ...editingCard.metadata,
        prereqs: editPrereqs.filter(Boolean).join(',')
      }
    });
    setEditingCard(null);
    showToast(`Backlog item updated successfully.`, 'success');
  };

  const handleDeleteCard = () => {
    if (!editingCard) return;
    deleteCard(lineId, editingCard.id);
    setEditingCard(null);
    showToast('Backlog item deleted.', 'info');
  };

  const handleAddCard = (layerId: ID, segmentId: ID, cardType: CardType = CardType.STORY) => {
    const key = `${layerId}-${segmentId}`;
    const title = newCardText[key];
    if (!title) return;
    addCard(lineId, layerId, segmentId, title, cardType);
    setNewCardText(prev => ({ ...prev, [key]: '' }));
    showToast(`Backlog ${cardType.toLowerCase()} "${title}" added to story map.`, 'success');
  };

  const statusColors: Record<string, string> = {
    'Planned': 'bg-blue-400/30 text-white',
    'In Progress': 'bg-amber-400/30 text-white',
    'Completed': 'bg-emerald-400/30 text-white',
    'Blocked': 'bg-rose-400/30 text-white',
  };

  const hoveredCard = featureMap.cards.find(c => c.id === hoveredCardId);

  return (
    <div 
      className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-800 dark:text-slate-100"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Board Header Summary */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-4 h-12 rounded-full" style={{ backgroundColor: line.color }} />
          <div>
            <h2 className="font-extrabold text-2xl text-slate-900 dark:text-slate-50 tracking-tight">{line.name} <span className="text-slate-300 dark:text-slate-600 ml-2">Story Map</span></h2>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 py-0.5 bg-slate-50 dark:bg-slate-805 rounded">Segment-Driven Delivery</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
            {/* View Mode Tabs Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-750">
              <button 
                onClick={() => setViewMode('board')}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'board'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                }`}
              >
                📊 Story Board
              </button>
              <button 
                onClick={() => setViewMode('resource')}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'resource'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                }`}
                id="resource-allocation-view-btn"
              >
                👥 Workload Planner
              </button>
            </div>

            {/* Quick action buttons to toggle card prerequisite dependencies & heatmap overlays */}
            <div className="flex items-center gap-2.5 border-r pr-6 border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setShowDependencies(prev => !prev)}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  showDependencies 
                    ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>{showDependencies ? 'Prerequisites shown' : 'Prerequisites hidden'}</span>
              </button>

              <button 
                onClick={() => {
                  const next = !showHeatmap;
                  setShowHeatmap(next);
                  showToast(next ? "Bottleneck density heatmap enabled." : "Density heatmap disabled.", "info");
                }}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  showHeatmap 
                    ? 'bg-rose-600 text-white shadow-md hover:bg-rose-700 font-extrabold' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold'
                }`}
                title="Toggle visual heatmap overlay mapping active/overdue delivery card bottleneck density"
                id="toggle-heatmap-btn"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9.879z" />
                </svg>
                <span>{showHeatmap ? 'Heatmap active' : 'Heatmap overlay'}</span>
              </button>
            </div>

            <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-tighter">Live Status</span>
                <span className="text-xs font-black text-emerald-500 uppercase">Synchronized</span>
            </div>
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-slate-500 cursor-pointer">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </button>
        </div>
      </div>

      {viewMode === 'board' ? (
        <>
          {/* Dynamic Filters Bar */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm z-15">
        <div className="flex flex-wrap items-center gap-3.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search cards, features, stories..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition-all font-semibold"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-550">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            {filterSearch && (
              <button
                onClick={() => setFilterSearch('')}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Type</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-205 outline-none hover:bg-slate-101 dark:hover:bg-slate-750 cursor-pointer transition-colors"
            >
              <option value="all">All Types</option>
              {Object.values(CardType).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-205 outline-none hover:bg-slate-101 dark:hover:bg-slate-750 cursor-pointer transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          {/* Owner Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Owner</span>
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-205 outline-none hover:bg-slate-101 dark:hover:bg-slate-750 cursor-pointer transition-colors max-w-[130px] truncate"
            >
              <option value="all">All Owners</option>
              <option value="Unassigned">Unassigned</option>
              {distinctOwners.map(owner => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {isAnyFilterActive && (
            <button
              onClick={() => {
                setFilterSearch('');
                setFilterType('all');
                setFilterStatus('all');
                setFilterOwner('all');
              }}
              className="px-3 py-1.5 bg-red-55 dark:bg-rose-955/20 hover:bg-red-100 dark:hover:bg-rose-950/30 border border-red-200 dark:border-rose-900 text-red-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Info Metric Badge */}
        <div className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-xl tracking-tight flex items-center gap-1.5 border border-transparent dark:border-slate-800">
          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">{filteredCards.length}</span>
          <span className="text-slate-400 dark:text-slate-500 font-bold">of</span>
          <span className="font-mono text-slate-600 dark:text-slate-300 font-extrabold">{featureMap.cards.length}</span>
          <span className="text-slate-400 dark:text-slate-500">Backlog Items Shown</span>
        </div>
      </div>

      {alertCards.length > 0 && (
        <div className="bg-rose-50/70 dark:bg-rose-955/20 border-b border-rose-100 dark:border-rose-950/40 px-8 py-3 flex items-center gap-4 flex-wrap select-none animate-fade-in z-20">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 dark:bg-rose-500"></span>
            </span>
            <span>🔔 Action Required ({alertCards.length})</span>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto flex-1 py-0.5" style={{ scrollbarWidth: 'none' }}>
            {alertCards.map(card => {
              const dueStatus = getDueDateStatus(card.dueDate, card.status);
              const cardDueText = dueStatus && dueStatus.urgency !== 'normal' ? dueStatus.label : '';
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    handleCardClick(card);
                    setTimeout(() => {
                      document.getElementById(`card-${card.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 120);
                  }}
                  className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-rose-120 dark:border-rose-900/40 hover:border-rose-400 dark:hover:border-rose-600 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-all hover:scale-102 shadow-sm shrink-0 cursor-pointer text-left leading-none"
                >
                  <span className="font-extrabold max-w-[150px] truncate block text-slate-800 dark:text-slate-100">
                    {card.title}
                  </span>
                  <span className="text-[8px] bg-rose-500 dark:bg-rose-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shrink-0">
                    {card.isHighPriority ? 'High Prio' : cardDueText || 'Urgent'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-8">
        <div className="inline-flex flex-col gap-8 min-w-full pb-20 relative" id="feature-board-scroll-content">
          {/* SVG Overlay representing card prerequisites to connect blockers & successors */}
          {showDependencies && dependencyLines.length > 0 && (
            <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
              <defs>
                <marker
                  id="card-dependency-arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#818cf8" className="fill-indigo-400" />
                </marker>
                <marker
                  id="card-dependency-arrow-highlighted"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#4f46e5" className="fill-indigo-600" />
                </marker>
              </defs>
              {dependencyLines.map(line => {
                const dx = Math.abs(line.endX - line.startX);
                // Create a beautiful, sweepy cubic bezier curve between cards
                const controlOffset = Math.max(dx * 0.45, 60);
                const cp1X = line.startX + controlOffset;
                const cp1Y = line.startY;
                const cp2X = line.endX - controlOffset;
                const cp2Y = line.endY;

                // Subtract a bit of padding to avoid clipping or hiding arrowhead inside the card boundary
                const finalEndX = line.endX - 5;
                const pathData = `M ${line.startX} ${line.startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${finalEndX} ${line.endY}`;

                return (
                  <g key={line.id} className="transition-all duration-300">
                    {/* Thick glow track for highlighted paths under selection */}
                    {line.highlighted && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#e0e7ff"
                        strokeWidth="6"
                        className="opacity-70 animate-pulse duration-1000"
                      />
                    )}
                    {/* Core relationship stroke */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={line.highlighted ? "#4f46e5" : "#a5b4fc"}
                      strokeWidth={line.highlighted ? "3" : "2"}
                      strokeDasharray={line.faded ? "4 4" : undefined}
                      opacity={line.faded ? "0.15" : line.highlighted ? "1.0" : "0.65"}
                      markerEnd={line.highlighted ? "url(#card-dependency-arrow-highlighted)" : "url(#card-dependency-arrow)"}
                      className="transition-all duration-300"
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Column Headers (Roadmap Stations) */}
          <div className="flex gap-6 pl-52">
            {segments.map((stn, idx) => {
              if (!stn) return null;
              const colCards = featureMap.cards.filter(c => c.sourceSegmentId === stn.id);
              const activeCount = colCards.filter(c => c.status !== 'Completed').length;
              const isOverdueSegment = stn.endDate ? new Date(stn.endDate) < new Date() : false;
              const score = activeCount + (isOverdueSegment ? activeCount * 2 : 0);

              const totalComplexity = colCards.reduce((acc, c) => acc + (c.complexityScore || 0), 0);
              const completedComplexity = colCards.filter(c => c.status === 'Completed').reduce((acc, c) => acc + (c.complexityScore || 0), 0);
              const remainingComplexity = totalComplexity - completedComplexity;

              return (
                <div key={stn.id} className="w-80 shrink-0">
                  <div 
                    className="px-6 py-4 rounded-2xl shadow-md flex flex-col items-start gap-2 border-b-4 transition-all duration-300"
                    style={{ backgroundColor: line.color, borderBottomColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                  >
                    <div className="w-full flex justify-between items-center">
                      <span className="font-black text-sm uppercase tracking-tight">{stn.title}</span>
                      <span className="opacity-40 text-[10px] font-black">SEGMENT {idx + 1}</span>
                    </div>
                    
                    {/* Metadata display */}
                    <div className="flex flex-wrap gap-2 mt-1 w-full">
                      {(stn.startDate || stn.endDate) && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold bg-black/10 px-2 py-1 rounded-lg">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {stn.startDate || 'TBD'} — {stn.endDate || 'TBD'}
                        </div>
                      )}
                      {stn.owner && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold bg-black/10 px-2 py-1 rounded-lg">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          {stn.owner}
                        </div>
                      )}
                      {stn.status && (
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${statusColors[stn.status] || 'bg-black/10'}`}>
                          {stn.status}
                        </div>
                      )}
                    </div>
                    
                    {/* Column Effort Capacity Summary Widget */}
                    <div className="w-full mt-2 pt-2 border-t border-white/20 flex flex-col gap-1 text-[10px] select-none font-sans tracking-tight">
                      <div className="flex justify-between items-center font-black uppercase tracking-wider text-white">
                        <span>Column Effort</span>
                        <span className="bg-black/25 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          {remainingComplexity} / {totalComplexity} SP left
                        </span>
                      </div>
                      <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${totalComplexity > 0 ? (completedComplexity / totalComplexity) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-white/80 font-bold mt-1 leading-none">
                        <span>Done: {completedComplexity} SP</span>
                        <span>Total: {totalComplexity} SP</span>
                      </div>
                    </div>

                    {/* Visual Heatmap Overlay stats representation directly under header block */}
                    {showHeatmap && (
                      <div className="w-full mt-1 pt-2 border-t border-white/10 flex flex-col gap-1 text-[10px] select-none font-sans font-black tracking-tight" id={`heatmap-header-${stn.id}`}>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="bg-white/25 px-1.5 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider">
                            <span className={`w-1.5 h-1.5 rounded-full ${isOverdueSegment ? 'bg-rose-400 animate-ping' : score >= 6 ? 'bg-red-400' : score >= 3 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            Queue: {score}
                          </span>
                          <span className="uppercase tracking-widest text-[9px] text-white bg-black/15 px-1.5 py-0.5 rounded-md">
                            {isOverdueSegment ? '⚠️ Overdue' : score >= 6 ? '🚨 Blocked' : score >= 3 ? '⚡ Loaded' : '🌱 Cool'}
                          </span>
                        </div>
                        <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isOverdueSegment || score >= 6 ? 'bg-red-300 w-full' : score >= 3 ? 'bg-amber-300 w-2/3' : 'bg-emerald-300 w-1/3'}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rows (Layers) */}
          {featureMap.layers.map(layer => (
            <div key={layer.id} className="flex gap-6">
              {/* Row Header */}
              <div className="w-48 shrink-0 flex items-center justify-end pr-8">
                <h3 className="font-black text-right text-slate-400 uppercase text-[11px] tracking-widest leading-snug">
                  {layer.name}
                </h3>
              </div>               {/* Grid Cells */}
              <div className="flex gap-6">
                {segments.map(stn => {
                  if (!stn) return null;
                  const cellCards = filteredCards.filter(c => 
                    c.sourceSegmentId === stn.id && c.metadata.layerId === layer.id
                  );
                  const isDragOver = dragOverCell?.layerId === layer.id && dragOverCell?.segmentId === stn.id;

                  // Heatmap overlay logic mapping card backlog densities
                  const colCards = featureMap.cards.filter(c => c.sourceSegmentId === stn.id);
                  const activeCount = colCards.filter(c => c.status !== 'Completed').length;
                  const isOverdueSegment = stn.endDate ? new Date(stn.endDate) < new Date() : false;
                  const score = activeCount + (isOverdueSegment ? activeCount * 2 : 0);

                  let cellHeatmapClass = '';
                  if (score > 0) {
                    if (isOverdueSegment || score >= 6) {
                      cellHeatmapClass = 'bg-rose-50/50 dark:bg-rose-950/10 border-2 border-solid border-rose-205 dark:border-rose-900/40 hover:bg-rose-50/60 shadow-sm shadow-rose-100/10';
                    } else if (score >= 3) {
                      cellHeatmapClass = 'bg-amber-50/40 dark:bg-amber-950/8 border-2 border-solid border-amber-200/80 dark:border-amber-900/35 hover:bg-amber-50/50';
                    } else {
                      cellHeatmapClass = 'bg-emerald-50/30 dark:bg-emerald-950/5 border-2 border-dashed border-emerald-100 dark:border-emerald-900/20 hover:border-emerald-250 dark:hover:border-emerald-900/40';
                    }
                  } else {
                    cellHeatmapClass = 'bg-slate-50/30 dark:bg-slate-900/10 border-2 border-dashed border-slate-100/30 dark:border-slate-800/20 opacity-60';
                  }

                  return (
                    <div 
                        key={stn.id} 
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setDragOverCell({ layerId: layer.id, segmentId: stn.id });
                        }}
                        onDragLeave={() => {
                          setDragOverCell(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverCell(null);
                          const cardId = e.dataTransfer.getData('cardId');
                          if (cardId) {
                            reorderCard(lineId, cardId, layer.id, stn.id, null);
                            showToast('Card moved successfully.', 'success');
                          }
                        }}
                        className={`w-80 min-h-[180px] rounded-3xl p-5 flex flex-col gap-4 group transition-all duration-300 ${
                          isDragOver
                            ? 'bg-indigo-50 dark:bg-indigo-950/30 border-2 border-solid border-indigo-400 scale-[1.02] shadow-lg shadow-indigo-100 dark:shadow-none'
                            : showHeatmap
                              ? cellHeatmapClass
                              : 'bg-white/50 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 hover:border-indigo-100 dark:hover:border-indigo-900 hover:shadow-md'
                        }`}
                    >
                      {cellCards.map(card => {
                        const isSearchedHighlight = card.id === searchedCardId;
                        const isDragOverThisCard = dragOverCardId === card.id && isDraggingId !== card.id;

                        const dueStatus = getDueDateStatus(card.dueDate, card.status);
                        const isOverdue = dueStatus?.urgency === 'overdue';
                        const isNearing = dueStatus?.urgency === 'nearing';

                        let glowStyles = '';
                        if (card.isHighPriority && (isOverdue || isNearing)) {
                          glowStyles = 'ring-2 ring-rose-500/80 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse';
                        } else if (card.isHighPriority) {
                          glowStyles = 'ring-2 ring-rose-500/50 shadow-[0_0_10px_rgba(239,68,68,0.25)]';
                        } else if (isOverdue) {
                          glowStyles = 'ring-2 ring-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse';
                        } else if (isNearing) {
                          glowStyles = 'ring-2 ring-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse';
                        }

                        let cardColorStyles = 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xl dark:shadow-none border-l-4 border-l-indigo-500';
                        if (card.type === CardType.EPIC) {
                          cardColorStyles = 'bg-white dark:bg-slate-900 border-slate-100/80 dark:border-slate-800/80 hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-xl dark:shadow-none border-l-4 border-l-violet-500';
                        } else if (card.type === CardType.FEATURE) {
                          cardColorStyles = 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-xl dark:shadow-none border-l-4 border-l-emerald-500';
                        } else if (card.type === CardType.STORY) {
                          cardColorStyles = 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:border-sky-400 dark:hover:border-sky-505 hover:shadow-xl dark:shadow-none border-l-4 border-l-sky-400';
                        }

                        return (
                          <div 
                            key={card.id}
                            id={`card-${card.id}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('cardId', card.id);
                              setIsDraggingId(card.id);
                            }}
                            onDragEnd={() => {
                              setIsDraggingId(null);
                              setDragOverCardId(null);
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isDraggingId !== card.id) {
                                setDragOverCardId(card.id);
                              }
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              if (dragOverCardId === card.id) {
                                setDragOverCardId(null);
                              }
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverCardId(null);
                              const draggedCardId = e.dataTransfer.getData('cardId');
                              if (draggedCardId && draggedCardId !== card.id) {
                                reorderCard(lineId, draggedCardId, layer.id, stn!.id, card.id);
                                showToast('Card reordered successfully.', 'success');
                              }
                            }}
                            ref={el => {
                              if (isSearchedHighlight && el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                            onMouseEnter={() => setHoveredCardId(card.id)}
                            onMouseLeave={() => setHoveredCardId(null)}
                            onClick={() => handleCardClick(card)}
                            className={`p-5 rounded-2xl shadow-sm border transition-all cursor-grab active:cursor-grabbing hover:scale-[1.02] relative group/card duration-300 ${
                              isSearchedHighlight 
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-4 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-950 scale-[1.03] animate-pulse duration-1000' 
                                : isDragOverThisCard
                                ? 'border-t-4 border-t-indigo-600 dark:border-t-indigo-500 bg-indigo-50/30 dark:bg-indigo-955/15 border-dashed border-indigo-300 dark:border-indigo-800/80 scale-[1.02] shadow-md shadow-indigo-150'
                                : hoveredCardId && hoveredCardId === card.id
                                ? 'bg-white dark:bg-slate-900 border-indigo-500 dark:border-indigo-400 ring-4 ring-indigo-100 dark:ring-indigo-950 scale-[1.03] shadow-lg border-l-4 border-l-indigo-600 dark:border-l-indigo-500'
                                : hoveredCardId && getConnectedCardIds(hoveredCardId).has(card.id)
                                ? 'bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-50 dark:ring-indigo-950 shadow-md border-l-4 border-l-indigo-500'
                                : `${cardColorStyles} ${glowStyles}`
                            } ${
                              isDraggingId === card.id 
                                ? 'opacity-40 border-dashed' 
                                : hoveredCardId && !getConnectedCardIds(hoveredCardId).has(card.id)
                                ? 'opacity-25 scale-[0.98] blur-[0.4px]' 
                                : 'opacity-100'
                            }`}
                          >
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 leading-tight">{card.title}</h4>
                            {card.description && (
                              <p className="text-[11px] text-slate-400 dark:text-slate-400 line-clamp-2 mt-1 mb-2 leading-relaxed">{card.description}</p>
                            )}
                            <div className="flex items-center justify-between mt-4">
                               <div className="flex gap-1.5 flex-wrap">
                                  {card.isHighPriority && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400 rounded-md border border-rose-100 dark:border-rose-900/50 uppercase tracking-tighter flex items-center gap-1 shadow-sm">
                                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                                      Prio High
                                    </span>
                                  )}
                                  {dueStatus && (
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-tighter flex items-center gap-1 shadow-sm ${
                                      dueStatus.urgency === 'overdue'
                                        ? 'bg-red-50 dark:bg-red-955/35 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/50'
                                        : dueStatus.urgency === 'nearing'
                                        ? 'bg-amber-50 dark:bg-amber-955/35 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50'
                                        : 'bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/60'
                                    }`} title={card.dueDate}>
                                      📅 {dueStatus.label}
                                    </span>
                                  )}
                                  {card.type === CardType.EPIC && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-violet-50 text-violet-600 rounded-md border border-violet-100 uppercase tracking-tighter">Epic</span>
                                  )}
                                  {card.type === CardType.FEATURE && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 uppercase tracking-tighter">Feature</span>
                                  )}
                                  {card.type === CardType.STORY && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-sky-50 text-sky-600 rounded-md border border-sky-100 uppercase tracking-tighter">Story</span>
                                  )}
                                  {card.status !== 'Todo' && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-slate-900 text-white rounded-md uppercase tracking-tighter">{card.status}</span>
                                  )}
                                  {((card.metadata.prereqs as string) || '').split(',').filter(Boolean).length > 0 && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-md border border-orange-100 flex items-center gap-0.5 uppercase tracking-tighter" title="Has prerequisites">
                                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                      </svg>
                                      <span>Blocked</span>
                                    </span>
                                  )}
                                  {card.complexityScore !== undefined && card.complexityScore !== null && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-md border border-violet-100 dark:border-violet-900 uppercase tracking-tighter" title="Complexity Score">
                                      ⚡ {card.complexityScore} SP
                                    </span>
                                  )}
                               </div>
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                  {card.owner || 'Unassigned'}
                                </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add Card Input */}
                      <div className="mt-auto pt-3 border-t border-slate-100/60 font-sans">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
                            <input
                              type="text"
                              placeholder="New backlog item..."
                              className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none placeholder:text-slate-300"
                              value={newCardText[`${layer.id}-${stn!.id}`] || ''}
                              onChange={e => setNewCardText(prev => ({ ...prev, [`${layer.id}-${stn!.id}`]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const cellType = selectedTypes[`${layer.id}-${stn!.id}`] || CardType.STORY;
                                  handleAddCard(layer.id, stn!.id, cellType);
                                }
                              }}
                            />
                            <button 
                              onClick={() => {
                                const cellType = selectedTypes[`${layer.id}-${stn!.id}`] || CardType.STORY;
                                handleAddCard(layer.id, stn!.id, cellType);
                              }}
                              className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                              title="Add to story map"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                            </button>
                          </div>
                          
                          {/* Options to create Epics, Features, or User Stories nested under this Product Line */}
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Type:</span>
                            <div className="flex gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                              <button
                                onClick={() => setSelectedTypes(prev => ({ ...prev, [`${layer.id}-${stn!.id}`]: CardType.EPIC }))}
                                className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${
                                  (selectedTypes[`${layer.id}-${stn!.id}`] || CardType.STORY) === CardType.EPIC
                                    ? 'bg-violet-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                              >
                                Epic
                              </button>
                              <button
                                onClick={() => setSelectedTypes(prev => ({ ...prev, [`${layer.id}-${stn!.id}`]: CardType.FEATURE }))}
                                className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${
                                  (selectedTypes[`${layer.id}-${stn!.id}`] || CardType.STORY) === CardType.FEATURE
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                              >
                                Feature
                              </button>
                              <button
                                onClick={() => setSelectedTypes(prev => ({ ...prev, [`${layer.id}-${stn!.id}`]: CardType.STORY }))}
                                className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${
                                  (selectedTypes[`${layer.id}-${stn!.id}`] || CardType.STORY) === CardType.STORY
                                    ? 'bg-sky-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                              >
                                Story
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      ) : (
        <ResourceAllocationView
          workspace={workspace}
          lineId={lineId}
          featureMap={featureMap}
          segments={segments}
          updateCard={updateCard}
          onEditCard={setEditingCard}
          showToast={showToast}
          statusColors={statusColors}
        />
      )}
      
      {/* Footer Drift Alert */}
      <div className="px-8 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Governance: Local Workspace Encrypted & Persisted
          </p>
        </div>
        <p className="text-[10px] font-bold text-slate-500 italic">
          Station owner and status updates in roadmap are reflected in column headers above.
        </p>
      </div>

      {/* Detailed Card Editor Modal */}
      {editingCard && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-lg w-full flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-slate-850 dark:to-slate-900 font-sans">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wider">Backlog Card Details</h3>
              </div>
              <button 
                onClick={() => setEditingCard(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-all cursor-pointer"
              >
                <svg className="w-5 h-5 text-slate-400 dark:text-slate-550" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 font-sans">
              
              {/* Title Input */}
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-520 uppercase tracking-widest block mb-1.5 ml-1">Title</label>
                <input 
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-2xl text-slate-805 dark:text-slate-100 font-extrabold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner dark:shadow-none"
                  placeholder="Backlog item title..."
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              {/* Type Picker */}
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Card Type</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-850 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditType(CardType.EPIC)}
                    className={`py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      editType === CardType.EPIC 
                        ? 'bg-violet-600 text-white shadow-md' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-55 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Epic</span>
                    <span className="text-[8px] opacity-75 font-normal lowercase">High-level</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType(CardType.FEATURE)}
                    className={`py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      editType === CardType.FEATURE 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-55 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Feature</span>
                    <span className="text-[8px] opacity-75 font-normal lowercase">Technical epic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType(CardType.STORY)}
                    className={`py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      editType === CardType.STORY 
                        ? 'bg-sky-600 text-white shadow-md' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-55 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>User Story</span>
                    <span className="text-[8px] opacity-75 font-normal lowercase">Nested slice</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Status Selection */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Status</label>
                  <div className="relative">
                    <select 
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black appearance-none uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-sans cursor-pointer"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="Todo">Todo</option>
                      <option value="Planned">Planned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-slate-505">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                {/* Estimate */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest block mb-1.5 ml-1">Estimate (Points)</label>
                  <input 
                    type="text"
                    className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-205 font-extrabold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner dark:shadow-none"
                    placeholder="e.g. 3, 5, 8"
                    value={editEstimate}
                    onChange={(e) => setEditEstimate(e.target.value)}
                  />
                </div>

                {/* Complexity Score */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest block mb-1.5 ml-1">Complexity (SP/hrs)</label>
                  <input 
                    type="number"
                    min="0"
                    step="1"
                    className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-205 font-extrabold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner dark:shadow-none"
                    placeholder="e.g. 5"
                    value={editComplexityScore}
                    onChange={(e) => setEditComplexityScore(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Owner Input */}
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block mb-1.5 ml-1">Assignee / Owner</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </span>
                  <input 
                    type="text"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-2xl text-slate-700 dark:text-slate-200 font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner dark:shadow-none"
                    placeholder="Assignee name..."
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                  />
                </div>
              </div>

              {/* Due Date & Priority Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest block mb-1.5 ml-1">Target Due Date</label>
                  <input 
                    type="date"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-205 font-extrabold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner dark:shadow-none"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block mb-2 ml-1">High Focus Status</label>
                  <label className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 text-rose-600 border-slate-300 dark:border-slate-600 rounded focus:ring-rose-500 focus:ring-2 cursor-pointer"
                      checked={editIsHighPriority}
                      onChange={(e) => setEditIsHighPriority(e.target.checked)}
                    />
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
                      🚨 Flag High Priority
                    </span>
                  </label>
                </div>
              </div>

              {/* Description Input */}
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Detailed Description</label>
                <textarea 
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-200 font-medium text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner resize-none dark:shadow-none"
                  placeholder="Provide context, acceptance criteria or architectural notes..."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              {/* Prerequisites Section */}
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                  Prerequisites (Blocks this item)
                </label>
                <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 font-sans shadow-inner dark:shadow-none">
                  
                  {/* Current Selected Prerequisites list */}
                  <div className="flex flex-wrap gap-1.5">
                    {editPrereqs.length === 0 ? (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 italic block py-0.5">
                        This card has no prerequisite blockers.
                      </span>
                    ) : (
                      editPrereqs.map(pId => {
                        const targetCard = featureMap.cards.find(c => c.id === pId);
                        return (
                          <div 
                            key={pId} 
                            className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900 border-indigo-100 text-[10px] font-black uppercase tracking-tight"
                          >
                            <span className="truncate max-w-[120px]">
                              {targetCard ? targetCard.title : pId}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditPrereqs(prev => prev.filter(id => id !== pId))}
                              className="text-indigo-400 dark:text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors bg-white/40 dark:bg-slate-900/60 hover:bg-white/85 dark:hover:bg-slate-800 rounded p-0.5"
                            >
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add prerequisite utility */}
                  <div className="relative">
                    <select
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none uppercase tracking-widest cursor-pointer shadow-sm animate-none"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !editPrereqs.includes(val)) {
                          setEditPrereqs(prev => [...prev, val]);
                        }
                        // Reset selection after selecting
                        e.target.value = "";
                      }}
                    >
                      <option value="" className="dark:bg-slate-800">+ Link Prerequisite Card...</option>
                      {featureMap.cards
                        .filter(c => editingCard && c.id !== editingCard.id && !editPrereqs.includes(c.id))
                        .map(c => (
                          <option key={c.id} value={c.id} className="dark:bg-slate-800">
                            [{c.type}] {c.title}
                          </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between font-sans">
              
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-tight">Confirm?</span>
                  <button 
                    type="button"
                    onClick={handleDeleteCard}
                    className="px-3 py-1.5 bg-red-600 text-white font-bold text-[10px] uppercase rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    Delete Now
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-955/20 border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/35 hover:text-rose-700 dark:hover:text-rose-300 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Delete Card
                </button>
              )}

              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-606 dark:text-slate-300 font-black text-[10px] uppercase tracking-wider rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSaveEditCard}
                  className="px-5 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-950 dark:hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Floating Card Detail Tooltip */}
      {hoveredCard && (
        <div 
          className="fixed z-[100] pointer-events-none transition-all duration-200 bg-slate-900/95 text-slate-100 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-2 min-w-[260px] max-w-[340px]"
          style={{ left: `${mousePos.x + 20}px`, top: `${mousePos.y + 20}px` }}
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <span className="text-xl shrink-0 p-1.5 rounded-lg bg-slate-800 border border-slate-700">
              {hoveredCard.type === CardType.EPIC ? '🏆' :
               hoveredCard.type === CardType.CAPABILITY ? '⚡' :
               hoveredCard.type === CardType.FEATURE ? '🌟' :
               hoveredCard.type === CardType.TASK ? '⚙️' :
               '📄'}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">{hoveredCard.type} CARD</span>
              <h5 className="font-extrabold text-white text-sm leading-tight truncate">{hoveredCard.title}</h5>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1 text-[11px]">
            {/* Status & Owner Row */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[8px]">Status</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                  hoveredCard.status === 'Completed' || hoveredCard.status === 'Done' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  hoveredCard.status === 'In Progress' || hoveredCard.status === 'Doing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  hoveredCard.status === 'Blocked' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-extrabold animate-pulse' :
                  'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {hoveredCard.status}
                </span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[8px]">Owner</span>
                <span className="font-bold text-slate-200 truncate">{hoveredCard.owner || 'Unassigned 👩‍💻'}</span>
              </div>
            </div>

            {/* Estimation Weight */}
            {hoveredCard.estimate && (
              <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5">
                <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">Estimate Size</span>
                <span className="font-mono text-[10px] bg-slate-800 text-slate-200 px-2 py-0.5 rounded font-black uppercase">
                  {hoveredCard.estimate}
                </span>
              </div>
            )}

            {/* Created At Datum */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5">
              <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">Created At</span>
              <span className="font-mono text-slate-300 font-bold">
                {formatDateValue(getCreatedAtDate(hoveredCard.id, hoveredCard.metadata))}
              </span>
            </div>

            {/* Segment/Milestone Target Area */}
            {(() => {
              const segStn = workspace.stations.find(s => s.id === (hoveredCard.sourceStationId || hoveredCard.sourceSegmentId));
              if (!segStn) return null;
              return (
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5">
                  <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">Milestone Target</span>
                  <span className="text-slate-200 font-bold flex items-center gap-1 truncate max-w-[140px]">
                    📍 {segStn.title}
                  </span>
                </div>
              );
            })()}

            {/* Prerequisites count & list */}
            {(() => {
              const pStr = (hoveredCard.metadata.prereqs as string) || '';
              const pIds = pStr ? pStr.split(',').filter(Boolean) : [];
              const prereqCards = pIds.map(id => featureMap.cards.find(c => c.id === id)).filter(Boolean);

              const successors = featureMap.cards.filter(c => {
                const innerPrereqStr = (c.metadata.prereqs as string) || '';
                const innerIds = innerPrereqStr ? innerPrereqStr.split(',').filter(Boolean) : [];
                return innerIds.includes(hoveredCard.id);
              });

              if (prereqCards.length === 0 && successors.length === 0) {
                return (
                  <div className="text-[10px] text-slate-500 italic border-t border-slate-800/60 pt-1.5">
                    No active card connections or prerequisites assigned.
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-1.5 border-t border-slate-800/60 pt-1.5 text-[10px]">
                  <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">
                    Dependencies ({prereqCards.length + successors.length})
                  </span>
                  {prereqCards.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest block">Prerequisites (Blocks this card)</span>
                      <p className="text-slate-300 leading-tight pl-1.5 border-l border-amber-500/40">
                        {prereqCards.map(c => `"${c.title}"`).join(', ')}
                      </p>
                    </div>
                  )}
                  {successors.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block">Successors (Blocked by this card)</span>
                      <p className="text-slate-300 leading-tight pl-1.5 border-l border-indigo-500/40">
                        {successors.map(c => `"${c.title}"`).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* User Interaction Guide */}
            <div className="mt-1 p-2 bg-slate-800/70 border border-slate-850 rounded-xl text-[10px] text-indigo-300 leading-relaxed font-semibold">
              💡 Tip: Click card to edit description, assign owners, set estimations, or toggle dependency blockers. Drag-and-drop to adjust columns/phases.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeatureBoard;
