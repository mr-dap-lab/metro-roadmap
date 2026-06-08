
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Workspace, Station, Line, ID, StationType } from '../types';
import { snapToMetro, getGridPoint, Point } from '../utils/geometry';
import { useToast } from './Toast';

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

export interface ThemePalette {
  id: string;
  name: string;
  description: string;
  lineColors: string[];
  stationColors: {
    MILESTONE: string;
    FEATURE: string;
    INTEGRATION: string;
    PHASE_BOUNDARY: string;
  };
}

export const METRO_THEMES: ThemePalette[] = [
  {
    id: 'classic-london',
    name: 'Classic London',
    description: 'Traditional Tube colours matching Red, Blue, Gold, and Emerald lines',
    lineColors: ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#8b5cf6', '#475569'],
    stationColors: {
      MILESTONE: '#eab308',
      FEATURE: '#10b981',
      INTEGRATION: '#8b5cf6',
      PHASE_BOUNDARY: '#64748b'
    }
  },
  {
    id: 'tokyo-neon',
    name: 'Tokyo Cyberpunk',
    description: 'Luminous high-contrast cyberpunk vibes with ultra neon accents',
    lineColors: ['#ec4899', '#06b6d4', '#10b981', '#a855f7', '#f97316', '#eab308'],
    stationColors: {
      MILESTONE: '#f59e0b',
      FEATURE: '#10b981',
      INTEGRATION: '#ec4899',
      PHASE_BOUNDARY: '#06b6d4'
    }
  },
  {
    id: 'paris-metro',
    name: 'Paris Vintage',
    description: 'Chic retro Art-Deco pastel tones and organic transit vibes',
    lineColors: ['#fb923c', '#4ade80', '#c084fc', '#22d3ee', '#facc15', '#f87171'],
    stationColors: {
      MILESTONE: '#facc15',
      FEATURE: '#4ade80',
      INTEGRATION: '#c084fc',
      PHASE_BOUNDARY: '#94a3b8'
    }
  },
  {
    id: 'nordic-cool',
    name: 'Nordic Forest',
    description: 'Deep woodland green, timber tan, and cool autumn elements',
    lineColors: ['#1b4332', '#9a031e', '#0f4c5c', '#fb8b24', '#e36414', '#5f0f40'],
    stationColors: {
      MILESTONE: '#fb8b24',
      FEATURE: '#1b4332',
      INTEGRATION: '#5f0f40',
      PHASE_BOUNDARY: '#0f4c5c'
    }
  },
  {
    id: 'tokyo-sunset',
    name: 'Kyoto Sunrise',
    description: 'Cherry blossom pinks, Imperial Gold, and deep sunlit crimson lines',
    lineColors: ['#f472b6', '#ca8a04', '#155e75', '#166534', '#991b1b', '#374151'],
    stationColors: {
      MILESTONE: '#ca8a04',
      FEATURE: '#166534',
      INTEGRATION: '#991b1b',
      PHASE_BOUNDARY: '#374151'
    }
  }
];

interface RoadmapEditorProps {
  workspace: Workspace;
  updateStationPos: (id: ID, x: number, y: number) => void;
  updateStation: (id: ID, updates: Partial<Station>) => void;
  deleteStation: (id: ID) => void;
  addStation: (lineId: ID, title: string, x: number, y: number) => void;
  toggleLineOnStation: (stationId: ID, lineId: ID) => void;
  addDependency: (fromId: ID, toId: ID) => void;
  removeDependency: (id: ID) => void;
  deleteLine: (lineId: ID) => void;
  highlightedStationId?: ID | null;
  moveStations: (ids: ID[], dx: number, dy: number) => void;
  deleteStations: (ids: ID[]) => void;
  duplicateStations: (ids: ID[]) => void;
  bulkUpdateStations: (ids: ID[], updates: Partial<Station>) => void;
  bulkUpdateStationPositions: (positions: Record<ID, { x: number; y: number }>) => void;
}

const STATION_ICONS = [
  { id: 'flag', symbol: '🚩' },
  { id: 'target', symbol: '🎯' },
  { id: 'pin', symbol: '📍' },
  { id: 'gem', symbol: '💎' },
  { id: 'rocket', symbol: '🚀' },
  { id: 'bolt', symbol: '⚡' },
  { id: 'stop', symbol: '🛑' },
  { id: 'check', symbol: '✅' },
  { id: 'star', symbol: '⭐' },
  { id: 'alert', symbol: '⚠️' }
];

export const STATION_TYPE_CONFIG: Record<string, {
  name: string;
  description: string;
  color: string;
  strokeColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
}> = {
  MILESTONE: {
    name: 'Milestone',
    description: 'Major business goals & key events',
    color: '#eab308',
    strokeColor: '#d97706',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    icon: '🚩'
  },
  FEATURE: {
    name: 'Feature Release',
    description: 'Major software epics & deliverables',
    color: '#10b981',
    strokeColor: '#059669',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    icon: '🚀'
  },
  INTEGRATION: {
    name: 'System Integration',
    description: 'Third-party APIs & architecture syncs',
    color: '#8b5cf6',
    strokeColor: '#7c3aed',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-250',
    textColor: 'text-indigo-800',
    icon: '🔌'
  },
  PHASE_BOUNDARY: {
    name: 'Phase Boundary',
    description: 'Gates, checkpoints, & transit anchors',
    color: '#64748b',
    strokeColor: '#475569',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-700',
    icon: '📍'
  }
};

export const DEFAULT_ICONS: Record<string, string> = {
  MILESTONE: '🚩',
  FEATURE: '🚀',
  INTEGRATION: '🔌',
  PHASE_BOUNDARY: '📍'
};

type Tool = 'pointer' | 'select' | 'station' | 'line' | 'link';

const RoadmapEditor: React.FC<RoadmapEditorProps> = ({ 
  workspace, 
  updateStationPos, 
  updateStation, 
  deleteStation, 
  addStation,
  toggleLineOnStation,
  addDependency,
  removeDependency,
  deleteLine,
  highlightedStationId,
  moveStations,
  deleteStations,
  duplicateStations,
  bulkUpdateStations,
  bulkUpdateStationPositions
}) => {
  const { showToast } = useToast();
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<Tool>('pointer');
  const [isMinimapCollapsed, setIsMinimapCollapsed] = useState(false);
  
  // Sidebar visibility state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarLineToDelete, setSidebarLineToDelete] = useState<ID | null>(null);

  // Dragging states
  const [draggingStationId, setDraggingStationId] = useState<ID | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<Point | null>(null);
  const [dragLeaderStartPos, setDragLeaderStartPos] = useState<Point | null>(null);
  
  // Toolbox dragging states - Positioned on right by default, below zoom controls
  const [toolboxPos, setToolboxPos] = useState<Point>(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth - 80 : 800,
    y: 230
  }));
  const [isDraggingToolbox, setIsDraggingToolbox] = useState(false);
  const [toolboxDragOffset, setToolboxDragOffset] = useState<Point>({ x: 0, y: 0 });

  const [selectedStationId, setSelectedStationId] = useState<ID | null>(null);
  const [selectedStationIds, setSelectedStationIds] = useState<ID[]>([]);
  const [marqueeStart, setMarqueeStart] = useState<Point | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<Point | null>(null);

  const [hoveredStationId, setHoveredStationId] = useState<ID | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<ID | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });

  // Roadmap filtering state declarations
  const [stationFilterStatus, setStationFilterStatus] = useState<string>('all');
  const [stationFilterOwner, setStationFilterOwner] = useState<string>('all');
  const [stationFilterType, setStationFilterType] = useState<string>('all');
  const [stationFilterSearch, setStationFilterSearch] = useState<string>('');
  const [stationFilterBehavior, setStationFilterBehavior] = useState<'dim' | 'hide'>('dim');

  const uniqueStationOwners = useMemo(() => {
    const owners = new Set<string>();
    workspace.stations.forEach(s => {
      if (s.owner && s.owner.trim()) {
        owners.add(s.owner.trim());
      }
    });
    return Array.from(owners).sort();
  }, [workspace.stations]);

  const isStationMatched = useCallback((station: Station) => {
    const matchesStatus = stationFilterStatus === 'all' || station.status === stationFilterStatus;
    const matchesOwner = stationFilterOwner === 'all' || 
      (stationFilterOwner === 'Unassigned' && (!station.owner || !station.owner.trim())) ||
      station.owner === stationFilterOwner;
    const matchesType = stationFilterType === 'all' || station.type === stationFilterType;
    const matchesSearch = !stationFilterSearch || 
      station.title.toLowerCase().includes(stationFilterSearch.toLowerCase()) ||
      (station.owner || '').toLowerCase().includes(stationFilterSearch.toLowerCase()) ||
      (station.status || '').toLowerCase().includes(stationFilterSearch.toLowerCase());
    
    return matchesStatus && matchesOwner && matchesType && matchesSearch;
  }, [stationFilterStatus, stationFilterOwner, stationFilterType, stationFilterSearch]);

  const isAnyStationFilterActive = useMemo(() => {
    return stationFilterStatus !== 'all' || 
           stationFilterOwner !== 'all' || 
           stationFilterType !== 'all' || 
           stationFilterSearch !== '';
  }, [stationFilterStatus, stationFilterOwner, stationFilterType, stationFilterSearch]);

  // Grid background and snapping preferences with local storage persistence
  const [showGrid, setShowGrid] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('roadmap_show_grid');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const [snapToGrid, setSnapToGrid] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('roadmap_snap_to_grid');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('roadmap_show_grid', String(showGrid));
  }, [showGrid]);

  useEffect(() => {
    localStorage.setItem('roadmap_snap_to_grid', String(snapToGrid));
  }, [snapToGrid]);
  
  const [selectedLineId, setSelectedLineId] = useState<ID | null>(workspace.lines[0]?.id || null);
  const [linkSourceId, setLinkSourceId] = useState<ID | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  const minimapRef = useRef<SVGSVGElement>(null);

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingMinimap, setIsDraggingMinimap] = useState(false);

  // ResizeObserver to track container/canvas width & height fluidly
  useEffect(() => {
    if (!canvasRef.current) return;
    const updateSize = () => {
      if (canvasRef.current) {
        setCanvasSize({
          width: canvasRef.current.clientWidth || 800,
          height: canvasRef.current.clientHeight || 600
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  const bounds = useMemo(() => {
    if (workspace.stations.length === 0) {
      return { minX: 0, maxX: 1200, minY: 0, maxY: 800, width: 1200, height: 800 };
    }
    const xs = workspace.stations.map(s => s.x);
    const ys = workspace.stations.map(s => s.y);
    const minX = Math.min(...xs) - 200;
    const maxX = Math.max(...xs) + 200;
    const minY = Math.min(...ys) - 200;
    const maxY = Math.max(...ys) + 200;

    const finalMinX = Math.min(minX, 0);
    const finalMaxX = Math.max(maxX, 1200);
    const finalMinY = Math.min(minY, 0);
    const finalMaxY = Math.max(maxY, 800);

    return {
      minX: finalMinX,
      maxX: finalMaxX,
      minY: finalMinY,
      maxY: finalMaxY,
      width: finalMaxX - finalMinX,
      height: finalMaxY - finalMinY
    };
  }, [workspace.stations]);

  const mapUserToMinimap = useCallback((x: number, y: number) => {
    const W_m = 216;
    const H_m = 120;
    const boundsWidth = bounds.width || 1200;
    const boundsHeight = bounds.height || 800;

    const minimapScale = Math.min(W_m / boundsWidth, H_m / boundsHeight);
    const offsetX = (W_m - boundsWidth * minimapScale) / 2;
    const offsetY = (H_m - boundsHeight * minimapScale) / 2;

    return {
      x: (x - bounds.minX) * minimapScale + offsetX,
      y: (y - bounds.minY) * minimapScale + offsetY
    };
  }, [bounds]);

  const handleMinimapInteraction = useCallback((e: React.MouseEvent<SVGSVGElement> | MouseEvent) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const xm = e.clientX - rect.left;
    const ym = e.clientY - rect.top;

    const W_m = 216;
    const H_m = 120;
    const boundsWidth = bounds.width || 1200;
    const boundsHeight = bounds.height || 800;

    const minimapScale = Math.min(W_m / boundsWidth, H_m / boundsHeight);
    const offsetX = (W_m - boundsWidth * minimapScale) / 2;
    const offsetY = (H_m - boundsHeight * minimapScale) / 2;

    const xu = (xm - offsetX) / minimapScale + bounds.minX;
    const yu = (ym - offsetY) / minimapScale + bounds.minY;

    setPan({
      x: canvasSize.width / 2 - xu * zoom,
      y: canvasSize.height / 2 - yu * zoom
    });
  }, [bounds, zoom, canvasSize]);

  const handleMinimapMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    setIsDraggingMinimap(true);
    handleMinimapInteraction(e);
  };

  const handleFitToScreen = useCallback(() => {
    if (workspace.stations.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const xs = workspace.stations.map(s => s.x);
    const ys = workspace.stations.map(s => s.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const w = maxX - minX;
    const h = maxY - minY;

    const padding = 150;
    const totalW = w + padding * 2;
    const totalH = h + padding * 2;

    const zX = canvasSize.width / totalW;
    const zY = canvasSize.height / totalH;
    let targetZoom = Math.max(0.2, Math.min(3, Math.min(zX, zY)));
    if (isNaN(targetZoom) || !isFinite(targetZoom)) {
      targetZoom = 1;
    }

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setZoom(targetZoom);
    setPan({
      x: canvasSize.width / 2 - midX * targetZoom,
      y: canvasSize.height / 2 - midY * targetZoom
    });

    showToast("Roadmap grid centered on content.", "info");
  }, [workspace.stations, canvasSize, showToast]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current && (e.target as SVGElement).id !== 'grid-bg') return;

    if (((activeTool === 'pointer' && e.shiftKey) || activeTool === 'select') && !draggingStationId) {
      const coords = getRelativeCoords(e);
      setMarqueeStart(coords);
      setMarqueeEnd(coords);
    } else if (activeTool === 'pointer' && !draggingStationId) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const selectedStation = workspace.stations.find(s => s.id === selectedStationId);
  const hoveredStation = workspace.stations.find(s => s.id === hoveredStationId);
  const hoveredLine = workspace.lines.find(l => l.id === hoveredLineId);

  const getStationProgress = useCallback((stationId: ID) => {
    let total = 0;
    let completed = 0;
    workspace.featureMaps.forEach(fm => {
      if (fm.cards) {
        fm.cards.forEach(card => {
          if (card.sourceSegmentId === stationId || card.sourceStationId === stationId) {
            total++;
            if (card.status === 'Completed') {
              completed++;
            }
          }
        });
      }
    });
    return { total, completed, percentage: total > 0 ? (completed / total) * 100 : 0 };
  }, [workspace.featureMaps]);

  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('metro_roadmap_active_theme');
      return saved || 'classic-london';
    }
    return 'classic-london';
  });

  const activeTheme = useMemo(() => {
    return METRO_THEMES.find(t => t.id === selectedThemeId) || METRO_THEMES[0];
  }, [selectedThemeId]);

  const handleThemeChange = (themeId: string) => {
    setSelectedThemeId(themeId);
    localStorage.setItem('metro_roadmap_active_theme', themeId);
    showToast(`Roadmap layout updated with "${METRO_THEMES.find(t => t.id === themeId)?.name || themeId}" theme!`, 'success');
  };

  const getLineColor = useCallback((lineId: ID) => {
    const index = workspace.lines.findIndex(l => l.id === lineId);
    if (index === -1) return '#cbd5e1';
    return activeTheme.lineColors[index % activeTheme.lineColors.length];
  }, [workspace.lines, activeTheme]);

  const renderNodeShape = (station: Station, isSelected: boolean, isLinkSource: boolean, isJunction: boolean, isDragging: boolean) => {
    const size = isSelected ? 16 : 12;
    const type = station.type || 'PHASE_BOUNDARY';
    
    let strokeColor = "#64748b";
    if (isLinkSource || isSelected) {
      strokeColor = "#4f46e5";
    } else {
      switch (type) {
        case 'MILESTONE':
          strokeColor = activeTheme.stationColors.MILESTONE;
          break;
        case 'FEATURE':
          strokeColor = activeTheme.stationColors.FEATURE;
          break;
        case 'INTEGRATION':
          strokeColor = activeTheme.stationColors.INTEGRATION;
          break;
        case 'PHASE_BOUNDARY':
        default:
          strokeColor = activeTheme.stationColors.PHASE_BOUNDARY;
          break;
      }
    }

    const strokeWidth = isLinkSource ? 8 : isSelected ? 6 : 4;
    const fill = isJunction ? "#f8fafc" : "white";

    switch (type) {
      case 'MILESTONE': {
        const pts = `0,${-size} ${size},0 0,${size} ${-size},0`;
        return (
          <polygon
            points={pts}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className={`transition-all duration-300 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
            filter="url(#shadow)"
          />
        );
      }
      case 'FEATURE':
        return (
          <rect
            x={-size}
            y={-size}
            width={size * 2}
            height={size * 2}
            rx={isSelected ? 6 : 4}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className={`transition-all duration-300 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
            filter="url(#shadow)"
          />
        );
      case 'INTEGRATION': {
        const w = size;
        const h = size * 0.86;
        const pts = `${-w/2},${-h} ${w/2},${-h} ${w},0 ${w/2},${h} ${-w/2},${h} ${-w},0`;
        return (
          <polygon
            points={pts}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className={`transition-all duration-300 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
            filter="url(#shadow)"
          />
        );
      }
      case 'PHASE_BOUNDARY':
      default:
        return (
          <circle
            cx="0"
            cy="0"
            r={size}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className={`transition-all duration-300 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
            filter="url(#shadow)"
          />
        );
    }
  };

  // Center canvas on highlighted station when selected from global search
  useEffect(() => {
    if (highlightedStationId) {
      const station = workspace.stations.find(s => s.id === highlightedStationId);
      if (station) {
        setSelectedStationId(highlightedStationId);
        // Ensure sidebar is expanded to show node inspect panel
        setIsSidebarCollapsed(false);
        
        setTimeout(() => {
          if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const width = rect.width || canvasRef.current.clientWidth || 800;
            const height = rect.height || canvasRef.current.clientHeight || 600;
            const cx = width / 2;
            const cy = height / 2;
            setPan({
              x: cx - station.x * zoom,
              y: cy - station.y * zoom
            });
          }
        }, 50);
      }
    }
  }, [highlightedStationId, workspace, zoom]);

  // Sync toolbox position with window size on initial mount and resize
  useEffect(() => {
    const handleResize = () => {
      setToolboxPos(prev => ({
        x: Math.min(prev.x, window.innerWidth - 80),
        y: prev.y
      }));
    };
    window.addEventListener('resize', handleResize);
    // Set initial position based on current window size
    setToolboxPos({ x: window.innerWidth - 80, y: 230 });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getRelativeCoords = (e: React.MouseEvent | MouseEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom
    };
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.2));
  const handleZoomReset = () => setZoom(1);

  const handleAutoLayout = () => {
    if (workspace.stations.length === 0) {
      showToast("No stations on the map to organize.", "info");
      return;
    }

    showToast("Calculating suggested layout...", "info");

    // Copy original positions to run simulation on
    const stations = workspace.stations.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      lineIds: [...s.lineIds]
    }));

    // Find all links (track connections & dependencies)
    const links: { source: string; target: string }[] = [];
    const linkSet = new Set<string>();

    const addLink = (u: string, v: string) => {
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push({ source: u, target: v });
      }
    };

    // 1. Core Metro Track Links (sequential stations in lines)
    for (const line of workspace.lines) {
      if (!line.stationIds || line.stationIds.length < 2) continue;
      for (let i = 0; i < line.stationIds.length - 1; i++) {
        addLink(line.stationIds[i], line.stationIds[i+1]);
      }
    }

    // 2. Dependencies
    for (const dep of workspace.dependencies) {
      addLink(dep.fromStationId, dep.toStationId);
    }

    // Centroid of current layout to keep the graph centered
    const centroidX = stations.reduce((sum, s) => sum + s.x, 0) / stations.length;
    const centroidY = stations.reduce((sum, s) => sum + s.y, 0) / stations.length;

    // Break exact matching positions with small random noise
    for (const s of stations) {
      if (isNaN(s.x) || isNaN(s.y) || (s.x === 0 && s.y === 0)) {
        s.x = centroidX + (Math.random() - 0.5) * 100;
        s.y = centroidY + (Math.random() - 0.5) * 100;
      }
      for (const other of stations) {
        if (s.id !== other.id && Math.abs(s.x - other.x) < 0.1 && Math.abs(s.y - other.y) < 0.1) {
          s.x += (Math.random() - 0.5) * 50;
          s.y += (Math.random() - 0.5) * 50;
        }
      }
    }

    // Simulation constants
    const ITERATIONS = 120;
    const kRep = 150000;      // Repulsion force strength
    const kAtt = 0.08;        // Attraction (spring) strength
    const restLength = 180;   // Desired link distance
    const kGravity = 0.015;    // Centering force
    let temperature = 60.0;   // Max displacement per step (cooling)

    // Run simulation
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const forces: Record<string, { x: number; y: number }> = {};
      for (const s of stations) {
        forces[s.id] = { x: 0, y: 0 };
      }

      // Repulsion between ALL node pairs
      for (let i = 0; i < stations.length; i++) {
        const s1 = stations[i];
        for (let j = i + 1; j < stations.length; j++) {
          const s2 = stations[j];
          const dx = s1.x - s2.x;
          const dy = s1.y - s2.y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq) || 1;
          
          // Coulomb-like repulsion
          const force = kRep / (distSq + 100); // add padding to soften extremely close forces
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          forces[s1.id].x += fx;
          forces[s1.id].y += fy;
          forces[s2.id].x -= fx;
          forces[s2.id].y -= fy;
        }
      }

      // Attraction along connected links
      for (const link of links) {
        const uPos = stations.find(s => s.id === link.source);
        const vPos = stations.find(s => s.id === link.target);
        if (!uPos || !vPos) continue;

        const dx = vPos.x - uPos.x;
        const dy = vPos.y - uPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Spring attraction: force is proportional to stretch
        const force = kAtt * (dist - restLength);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces[link.source].x += fx;
        forces[link.source].y += fy;
        forces[link.target].x -= fx;
        forces[link.target].y -= fy;
      }

      // Centering gravity force (pull toward centroid)
      for (const s of stations) {
        const dx = centroidX - s.x;
        const dy = centroidY - s.y;
        forces[s.id].x += kGravity * dx;
        forces[s.id].y += kGravity * dy;
      }

      // Apply forces capped by temperature
      for (const s of stations) {
        const f = forces[s.id];
        const fMag = Math.sqrt(f.x * f.x + f.y * f.y) || 1;
        const actualMove = Math.min(fMag, temperature);
        s.x += (f.x / fMag) * actualMove;
        s.y += (f.y / fMag) * actualMove;
      }

      // Cool down
      temperature *= 0.95;
    }

    // Snap to grid at the end (e.g. 40px grid) for elegant metro alignment
    const resultPositions: Record<string, { x: number; y: number }> = {};
    for (const s of stations) {
      resultPositions[s.id] = {
        x: Math.round(s.x / 40) * 40,
        y: Math.round(s.y / 40) * 40
      };
    }

    // Call bulk coordinates updates
    bulkUpdateStationPositions(resultPositions);
    showToast("Layout automatically organized!", "success");
    // Trigger fitting view after update
    setTimeout(() => {
      handleFitToScreen();
    }, 100);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current && (e.target as SVGElement).id !== 'grid-bg') return;
    
    if (activeTool === 'station') {
      if (!selectedLineId) {
        showToast("Please select or create a track line from the left panel first.", "warning");
        return;
      }
      const rawCoords = getRelativeCoords(e);
      const coords = snapToGrid ? getGridPoint(rawCoords.x, rawCoords.y, 40) : rawCoords;
      addStation(selectedLineId, 'New Station', coords.x, coords.y);
      showToast("New milestone station created.", "success");
    } else {
      setSelectedStationId(null);
      setSelectedStationIds([]);
      setLinkSourceId(null);
    }
  };

  const handleStationMouseDown = (id: ID, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (activeTool === 'link') {
      if (!linkSourceId) {
        setLinkSourceId(id);
        showToast("Select target node to establish dependency sequence link.", "info");
      } else {
        addDependency(linkSourceId, id);
        setLinkSourceId(null);
        showToast("Milestone dependency link created.", "success");
      }
      return;
    }

    if (activeTool !== 'pointer' && activeTool !== 'select') return;

    const isShift = e.shiftKey || activeTool === 'select';
    
    setSelectedStationIds(prev => {
      if (isShift) {
        if (prev.includes(id)) {
          const updated = prev.filter(sid => sid !== id);
          if (selectedStationId === id) {
            setSelectedStationId(updated[0] || null);
          }
          return updated;
        } else {
          setSelectedStationId(id);
          return [...prev, id];
        }
      } else {
        if (prev.includes(id)) {
          return prev; // keep current selection for drag
        }
        setSelectedStationId(id);
        return [id];
      }
    });

    if (!isShift && !selectedStationIds.includes(id)) {
      setSelectedStationId(id);
      setSelectedStationIds([id]);
    }

    setDraggingStationId(id);
    const leader = workspace.stations.find(s => s.id === id);
    if (leader) {
      setDragLeaderStartPos({ x: leader.x, y: leader.y });
    }
    setDragCurrentPos(getRelativeCoords(e));
  };

  const handleToolboxMouseDown = (e: React.MouseEvent) => {
    setIsDraggingToolbox(true);
    setToolboxDragOffset({
      x: e.clientX - toolboxPos.x,
      y: e.clientY - toolboxPos.y
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    
    if (isDraggingToolbox) {
      setToolboxPos({
        x: e.clientX - toolboxDragOffset.x,
        y: e.clientY - toolboxDragOffset.y
      });
      return;
    }

    if (isDraggingMinimap && minimapRef.current) {
      const rect = minimapRef.current.getBoundingClientRect();
      const xm = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const ym = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const W_m = rect.width || 216;
      const H_m = rect.height || 120;
      
      const boundsWidth = bounds.width || 1200;
      const boundsHeight = bounds.height || 800;
      
      const minimapScale = Math.min(W_m / boundsWidth, H_m / boundsHeight);
      const offsetX = (W_m - boundsWidth * minimapScale) / 2;
      const offsetY = (H_m - boundsHeight * minimapScale) / 2;
      
      const xu = (xm - offsetX) / minimapScale + bounds.minX;
      const yu = (ym - offsetY) / minimapScale + bounds.minY;
      
      setPan({
        x: canvasSize.width / 2 - xu * zoom,
        y: canvasSize.height / 2 - yu * zoom
      });
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const coords = getRelativeCoords(e);

    if (marqueeStart) {
      setMarqueeEnd(coords);
      return;
    }

    if (draggingStationId) {
      const line = workspace.lines.find(l => l.stationIds.includes(draggingStationId));
      let targetCoords = snapToGrid ? getGridPoint(coords.x, coords.y, 40) : coords;

      if (line) {
        const sIdx = line.stationIds.indexOf(draggingStationId);
        if (sIdx > 0) {
          const prevId = line.stationIds[sIdx - 1];
          const prev = workspace.stations.find(s => s.id === prevId);
          if (prev) targetCoords = snapToMetro(targetCoords, { x: prev.x, y: prev.y });
        }
      }
      setDragCurrentPos(targetCoords);
    }
  }, [draggingStationId, workspace.lines, workspace.stations, zoom, pan, isDraggingToolbox, toolboxDragOffset, isDraggingMinimap, bounds, canvasSize, isPanning, panStart, marqueeStart, snapToGrid]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingToolbox) {
      setIsDraggingToolbox(false);
      return;
    }

    if (isDraggingMinimap) {
      setIsDraggingMinimap(false);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (marqueeStart && marqueeEnd) {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

      const enclosedIds = workspace.stations
        .filter(s => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY)
        .map(s => s.id);

      if (enclosedIds.length > 0) {
        setSelectedStationIds(enclosedIds);
        setSelectedStationId(enclosedIds[0]);
        showToast(`Selected ${enclosedIds.length} stations.`, 'success');
      } else {
        setSelectedStationIds([]);
        setSelectedStationId(null);
      }
      setMarqueeStart(null);
      setMarqueeEnd(null);
      return;
    }

    if (draggingStationId && dragLeaderStartPos && dragCurrentPos) {
      const dx = dragCurrentPos.x - dragLeaderStartPos.x;
      const dy = dragCurrentPos.y - dragLeaderStartPos.y;

      if (selectedStationIds.includes(draggingStationId)) {
        moveStations(selectedStationIds, dx, dy);
      } else {
        updateStationPos(draggingStationId, dragCurrentPos.x, dragCurrentPos.y);
      }
    }
    setDraggingStationId(null);
    setDragLeaderStartPos(null);
    setDragCurrentPos(null);
  }, [draggingStationId, dragLeaderStartPos, dragCurrentPos, updateStationPos, isDraggingToolbox, isDraggingMinimap, isPanning, marqueeStart, marqueeEnd, workspace.stations, selectedStationIds, moveStations, showToast]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStationIds.length > 0) {
          const count = selectedStationIds.length;
          deleteStations(selectedStationIds);
          setSelectedStationIds([]);
          setSelectedStationId(null);
          showToast(`Successfully removed ${count} nodes in bulk.`, 'success');
        }
      } else if (e.key === 'Escape') {
        setSelectedStationIds([]);
        setSelectedStationId(null);
      } else if (e.key === 'g' || e.key === 'G') {
        setShowGrid(prev => {
          const next = !prev;
          showToast(next ? "Background grid visible." : "Background grid hidden.", "info");
          return next;
        });
      } else if (e.key === 's' || e.key === 'S') {
        setSnapToGrid(prev => {
          const next = !prev;
          showToast(next ? "Snap-to-grid enabled." : "Snap-to-grid disabled.", "info");
          return next;
        });
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (selectedStationIds.length > 0) {
          e.preventDefault();
          let dx = 0, dy = 0;
          const amt = snapToGrid ? 40 : 10; // match grid point interval or small pixel steps when snap is off
          if (e.key === 'ArrowLeft') dx = -amt;
          if (e.key === 'ArrowRight') dx = amt;
          if (e.key === 'ArrowUp') dy = -amt;
          if (e.key === 'ArrowDown') dy = amt;

          moveStations(selectedStationIds, dx, dy);
          if (snapToGrid) {
            showToast(`Nudged ${selectedStationIds.length} stations on grid.`, 'info');
          } else {
            showToast(`Nudged ${selectedStationIds.length} stations precisely.`, 'info');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStationIds, deleteStations, moveStations, showToast, snapToGrid]);

  const statusColors: Record<string, string> = {
    'Planned': 'text-blue-600 border-blue-100 bg-blue-50',
    'In Progress': 'text-amber-600 border-amber-100 bg-amber-50',
    'Completed': 'text-emerald-600 border-emerald-100 bg-emerald-50',
    'Blocked': 'text-rose-600 border-rose-100 bg-rose-50',
  };

  const statusBadgeColors: Record<string, string> = {
    'Planned': 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-amber-100 text-amber-700',
    'Completed': 'bg-emerald-100 text-emerald-700',
    'Blocked': 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="w-full h-full relative bg-slate-100 overflow-hidden flex transition-all duration-500">
      {/* Floating Station Tooltip */}
      {hoveredStation && !draggingStationId && (
        <div 
          className="fixed z-[100] pointer-events-none transition-all duration-200 bg-slate-900/95 text-slate-100 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-2 min-w-[260px] max-w-[340px]"
          style={{ left: `${mousePos.x + 20}px`, top: `${mousePos.y + 20}px` }}
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <span className="text-2xl filter drop-shadow bg-slate-800/80 p-1.5 rounded-xl">{hoveredStation.icon || '📍'}</span>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">Milestone Node</span>
              <h5 className="font-extrabold text-white text-sm leading-tight truncate">{hoveredStation.title}</h5>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 pt-1">
            {/* Status & Owner Row */}
            <div className="flex items-center justify-between gap-4 mt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black text-slate-400">Status</span>
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                  hoveredStation.status === 'Completed' || hoveredStation.status === 'Done' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  hoveredStation.status === 'In Progress' || hoveredStation.status === 'Doing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  hoveredStation.status === 'Blocked' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold' :
                  'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                }`}>
                  {hoveredStation.status || 'Planned'}
                </span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[10px] uppercase font-black text-slate-400">Team:</span>
                <span className="text-[10px] font-bold text-slate-200 truncate max-w-[120px]" title={hoveredStation.owner || 'Unassigned'}>
                  {hoveredStation.owner || 'Unassigned 🧑‍💻'}
                </span>
              </div>
            </div>

            {/* Created At Datum */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60">
              <span className="font-semibold uppercase tracking-wider text-[9px] block">Created At</span>
              <span className="font-mono text-slate-300 font-bold">
                {formatDateValue(getCreatedAtDate(hoveredStation.id, hoveredStation.metadata))}
              </span>
            </div>

            {/* Completion Progress details */}
            {(() => {
              const { total, completed, percentage } = getStationProgress(hoveredStation.id);
              if (total === 0) return null;
              return (
                <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">Backlog Progress</span>
                    <span className="font-mono font-extrabold text-emerald-400">{completed}/{total} Completed ({Math.round(percentage)}%)</span>
                  </div>
                  {/* Progress Line */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Dependencies count and connections list */}
            {(() => {
              const toStns = workspace.dependencies
                .filter(d => d.fromStationId === hoveredStation.id)
                .map(d => workspace.stations.find(s => s.id === d.toStationId)?.title)
                .filter(Boolean) as string[];
              const fromStns = workspace.dependencies
                .filter(d => d.toStationId === hoveredStation.id)
                .map(d => workspace.stations.find(s => s.id === d.fromStationId)?.title)
                .filter(Boolean) as string[];

              if (toStns.length === 0 && fromStns.length === 0) {
                return (
                  <div className="text-[10px] text-slate-500 italic pt-1.5 border-t border-slate-800/60">
                    No active milestone mapping connections.  
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800/60 text-[10px]">
                  <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">
                    Network Relations ({toStns.length + fromStns.length})
                  </span>
                  {fromStns.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Blocked By (Prerequisites)</span>
                      <p className="text-slate-300 leading-tight font-medium pl-1.5 border-l border-amber-500/40">
                        {fromStns.join(', ')}
                      </p>
                    </div>
                  )}
                  {toStns.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Blocks (Successor Milestones)</span>
                      <p className="text-slate-300 leading-tight font-medium pl-1.5 border-l border-indigo-500/40">
                        {toStns.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Quick Tutorial Tip Banner */}
            <div className="mt-1 p-2 bg-slate-800/70 border border-slate-850 rounded-xl text-[10px] text-indigo-300 leading-relaxed font-semibold">
              💡 {activeTool === 'pointer' ? 'Click milestone to select/edit title or details. Drag node to rearrange the roadmap track.' :
                  activeTool === 'connection' ? 'Click and drag to another milestone to create dependency arrow links.' :
                  activeTool === 'select' ? 'Milestone selected. Hold [Shift] to multi-select nodes.' :
                  'Tool active. Click on map elements to interact.'}
            </div>
          </div>
        </div>
      )}

      {/* Floating Track Line Tooltip */}
      {hoveredLine && !draggingStationId && !hoveredStation && (
        <div 
          className="fixed z-[100] pointer-events-none transition-all duration-200 bg-slate-900/95 text-slate-100 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-2 min-w-[260px] max-w-[325px]"
          style={{ left: `${mousePos.x + 20}px`, top: `${mousePos.y + 20}px` }}
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <span 
              className="w-4 h-4 rounded-full border-2 border-white shrink-0 shadow-sm"
              style={{ backgroundColor: getLineColor(hoveredLine.id) }}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">Product Line Track</span>
              <h5 className="font-extrabold text-white text-sm leading-tight truncate">{hoveredLine.name}</h5>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 pt-1 text-[11px]">
            {/* Meta statistics */}
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[9px]">Short Code</span>
              <span className="font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded font-black">
                {hoveredLine.shortCode}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60">
              <span className="font-semibold uppercase tracking-wider text-[9px]">Total Milestones</span>
              <span className="font-bold text-slate-200">
                {hoveredLine.stationIds.length} Stations passed
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60">
              <span className="font-semibold uppercase tracking-wider text-[9px]">Track Created At</span>
              <span className="font-mono text-slate-300 font-bold">
                {formatDateValue(getCreatedAtDate(hoveredLine.id, hoveredLine.metadata))}
              </span>
            </div>

            {/* Progress of cards on stations belonging to this line */}
            {(() => {
              let totalCards = 0;
              let completedCards = 0;
              const fmap = workspace.featureMaps.find(f => f.lineId === hoveredLine.id);
              if (fmap && fmap.cards) {
                totalCards = fmap.cards.length;
                completedCards = fmap.cards.filter(c => c.status === 'Completed' || c.status === 'Done').length;
              }
              const percentage = totalCards > 0 ? (completedCards / totalCards) * 100 : 0;
              return (
                <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">Track Workload</span>
                    <span className="font-mono font-extrabold text-indigo-300">{completedCards}/{totalCards} Cards Deliveries ({Math.round(percentage)}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300" 
                      style={{ width: `${percentage}%`, backgroundColor: getLineColor(hoveredLine.id) }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Line Tip banner */}
            <div className="mt-1 p-2 bg-slate-800/70 border border-slate-850 rounded-xl text-[10px] text-indigo-300 leading-relaxed font-semibold">
              💡 Tip: Click this product line in the Sidebar list to configure associated story maps, add features, or toggle visibility.
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Controls (Collapsible) */}
      <div 
        className={`${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-80 opacity-100'} bg-white border-r flex flex-col shadow-xl z-50 overflow-hidden transition-all duration-300 relative h-full`}
      >
        <div className="flex-1 flex flex-col min-w-[320px] h-full max-h-full min-h-0 overflow-hidden">
          {/* Internal Panel Header with Collapse Button */}
          <div className="px-6 py-4 flex items-center justify-between border-b bg-slate-50">
            <h4 className="font-black text-[11px] text-slate-800 uppercase tracking-widest">Editor Configuration</h4>
            <button 
              onClick={() => setIsSidebarCollapsed(true)}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors flex items-center justify-center"
              title="Collapse Panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7" /></svg>
            </button>
          </div>

          <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
            {/* Line Selector / List */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Product Tracks</h4>
              </div>
              <div className="flex flex-col gap-2">
                {workspace.lines.map(line => {
                  const isConfirming = sidebarLineToDelete === line.id;
                  if (isConfirming) {
                    return (
                      <div key={line.id} className="p-3 border border-rose-300 bg-rose-50/20 rounded-xl flex flex-col gap-2 animate-in fade-in duration-200">
                        <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider leading-tight">Delete track "{line.name}" and all elements inside cascadingly?</span>
                        <div className="flex gap-2 mt-0.5">
                          <button
                            onClick={() => {
                              deleteLine(line.id);
                              setSidebarLineToDelete(null);
                              const remaining = workspace.lines.filter(l => l.id !== line.id);
                              if (remaining.length > 0) {
                                setSelectedLineId(remaining[0].id);
                              } else {
                                setSelectedLineId(null);
                              }
                              showToast(`Successfully deleted track ${line.name} and related elements.`, 'success');
                            }}
                            className="px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-black uppercase cursor-pointer flex-1 text-center transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setSidebarLineToDelete(null)}
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase cursor-pointer flex-1 text-center transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={line.id}
                      className={`group/item rounded-xl flex items-center justify-between border-2 transition-all p-1.5 ${
                        selectedLineId === line.id ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-transparent bg-slate-50'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedLineId(line.id)}
                        className="flex-1 flex items-center gap-2.5 text-left p-1.5 rounded-lg focus:outline-none cursor-pointer overflow-hidden truncate"
                      >
                        <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: getLineColor(line.id) }} />
                        <span className="font-extrabold text-xs text-slate-700 tracking-tight truncate">{line.name}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSidebarLineToDelete(line.id);
                        }}
                        className="p-1 px-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Delete track cascadingly"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Roadmap Milestone Filters */}
            <section className="border-t border-slate-100 pt-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Roadmap Filters</h4>
                {isAnyStationFilterActive && (
                  <button
                    onClick={() => {
                      setStationFilterStatus('all');
                      setStationFilterOwner('all');
                      setStationFilterType('all');
                      setStationFilterSearch('');
                    }}
                    className="text-[9px] font-black text-rose-600 hover:text-rose-700 uppercase cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3.5">
                {/* Search input */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Search Milestones</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={stationFilterSearch}
                      onChange={(e) => setStationFilterSearch(e.target.value)}
                      placeholder="Title, owner, status..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-semibold"
                    />
                    {stationFilterSearch && (
                      <button
                        onClick={() => setStationFilterSearch('')}
                        className="absolute right-3 top-2.5 mt-0.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Status select */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                  <select
                    value={stationFilterStatus}
                    onChange={(e) => setStationFilterStatus(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 cursor-pointer transition-all"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>

                {/* Owner select */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Owner</label>
                  <select
                    value={stationFilterOwner}
                    onChange={(e) => setStationFilterOwner(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 cursor-pointer transition-all"
                  >
                    <option value="all">All Owners</option>
                    <option value="Unassigned">Unassigned</option>
                    {uniqueStationOwners.map(owner => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </div>

                {/* Type select */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Node Type</label>
                  <select
                    value={stationFilterType}
                    onChange={(e) => setStationFilterType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 cursor-pointer transition-all uppercase tracking-tight text-[11px]"
                  >
                    <option value="all">All Types</option>
                    <option value="MILESTONE">Milestone</option>
                    <option value="FEATURE">Feature Release</option>
                    <option value="INTEGRATION">System Integration</option>
                    <option value="PHASE_BOUNDARY">Phase Boundary</option>
                  </select>
                </div>

                {/* Filter behaviour toggle */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Filter Behavior</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setStationFilterBehavior('dim')}
                      className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                        stationFilterBehavior === 'dim'
                          ? 'bg-white shadow text-indigo-650 font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Dim Out
                    </button>
                    <button
                      type="button"
                      onClick={() => setStationFilterBehavior('hide')}
                      className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                        stationFilterBehavior === 'hide'
                          ? 'bg-white shadow text-indigo-650 font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Hide
                    </button>
                  </div>
                </div>

                {/* Active results indicators counter */}
                {isAnyStationFilterActive && (
                  <div className="mt-1 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-600 leading-normal flex items-center justify-between font-bold">
                    <span>Matching nodes:</span>
                    <span className="font-black bg-indigo-50 border border-indigo-100 text-indigo-650 px-2 py-0.5 rounded-lg">
                      {workspace.stations.filter(isStationMatched).length} / {workspace.stations.length}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Map Color Palette Selector */}
            <section className="border-t border-slate-100 pt-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Map Color Theme</h4>
              </div>
              <div className="flex flex-col gap-3">
                {METRO_THEMES.map(theme => {
                  const isActive = selectedThemeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleThemeChange(theme.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5 focus:outline-none cursor-pointer ${
                        isActive 
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20' 
                          : 'border-slate-150 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-extrabold text-xs text-slate-800 uppercase tracking-tight">{theme.name}</span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium leading-normal">{theme.description}</p>
                      
                      {/* Color dots preview */}
                      <div className="flex gap-1.5 mt-1">
                        {theme.lineColors.slice(0, 5).map((color, idx) => (
                          <div 
                            key={idx}
                            className="w-3.5 h-3.5 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        {theme.lineColors.length > 5 && (
                          <div className="text-[9px] font-black text-slate-400 self-center ml-0.5">
                            +{theme.lineColors.length - 5}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Station Inspector */}
            <section className="border-t border-slate-100 pt-8">
              <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-4">Node Attributes</h4>
              {selectedStationIds.length > 1 ? (
                <div className="flex flex-col gap-6">
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block">Group Selection</span>
                    <h5 className="font-extrabold text-sm text-indigo-900 tracking-tight leading-tight">
                      {selectedStationIds.length} Stations Selected
                    </h5>
                    <p className="text-[10px] text-indigo-650/85 font-semibold leading-relaxed">Changes apply to all selected nodes simultaneously.</p>
                  </div>

                  {/* Bulk Type Update */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Node Type</label>
                    <div className="relative">
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black appearance-none uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer"
                        defaultValue=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const val = e.target.value as StationType;
                          bulkUpdateStations(selectedStationIds, { type: val });
                          showToast(`Bulk updated ${selectedStationIds.length} stations to "${STATION_TYPE_CONFIG[val]?.name}"`, "success");
                        }}
                      >
                        <option value="" disabled>-- Select type --</option>
                        <option value="MILESTONE">Milestone</option>
                        <option value="FEATURE">Feature Release</option>
                        <option value="INTEGRATION">System Integration</option>
                        <option value="PHASE_BOUNDARY">Phase Boundary</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  {/* Bulk Status Update */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Node Status</label>
                    <div className="relative">
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black appearance-none uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer"
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          bulkUpdateStations(selectedStationIds, { status: val });
                          showToast(`Bulk updated ${selectedStationIds.length} stations status to "${val || 'Not Set'}"`, "success");
                        }}
                      >
                        <option value="" disabled>-- Select status --</option>
                        <option value="">Not Set</option>
                        <option value="Planned">Planned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  {/* Bulk Alignment */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Spatial Alignment</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const selStations = workspace.stations.filter(s => selectedStationIds.includes(s.id));
                          if (selStations.length === 0) return;
                          const avgY = Math.round(selStations.reduce((acc, s) => acc + s.y, 0) / selStations.length / 40) * 40;
                          bulkUpdateStations(selectedStationIds, { y: avgY });
                          showToast(`Aligned nodes horizontally at Y: ${avgY}`, "success");
                        }}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        title="Align all to average Y coordinate"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12h16M4 6h16M4 18h16" />
                        </svg>
                        Align Horiz
                      </button>
                      <button
                        onClick={() => {
                          const selStations = workspace.stations.filter(s => selectedStationIds.includes(s.id));
                          if (selStations.length === 0) return;
                          const avgX = Math.round(selStations.reduce((acc, s) => acc + s.x, 0) / selStations.length / 40) * 40;
                          bulkUpdateStations(selectedStationIds, { x: avgX });
                          showToast(`Aligned nodes vertically at X: ${avgX}`, "success");
                        }}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        title="Align all to average X coordinate"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12h16M4 6h16M4 18h16" />
                        </svg>
                        Align Vert
                      </button>
                    </div>
                  </div>

                  {/* Copy / Duplication and Bulk Deletion */}
                  <div className="mt-2 border-t border-slate-100 pt-5 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        duplicateStations(selectedStationIds);
                        showToast(`Duplicated ${selectedStationIds.length} stations on lines successfully.`, 'success');
                      }}
                      className="w-full p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      Duplicate Group
                    </button>

                    <button
                      onClick={() => {
                        const count = selectedStationIds.length;
                        deleteStations(selectedStationIds);
                        setSelectedStationIds([]);
                        setSelectedStationId(null);
                        showToast(`Removed all ${count} selected stations.`, 'success');
                      }}
                      className="w-full p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Group
                    </button>
                  </div>
                </div>
              ) : selectedStation ? (
                <div className="flex flex-col gap-5">
                  {/* Station Progress Panel */}
                  {(() => {
                    const { total, completed, percentage } = getStationProgress(selectedStation.id);
                    if (total === 0) {
                      return (
                        <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex flex-col gap-1.5 shadow-sm">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Nested Progress</span>
                          <span className="text-xs font-bold text-slate-600">No stories / features mapped</span>
                          <p className="text-[10px] text-slate-400 leading-normal font-medium">
                            Create cards under this milestone column on the <strong className="text-indigo-600 font-extrabold">Story Map (Feature Board)</strong> to track dynamic progress.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-emerald-50 border border-emerald-200/60 p-4 rounded-2xl flex flex-col gap-2.5 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">Feature Progress</span>
                            <span className="text-xs font-black text-emerald-950 leading-tight">
                              {completed} of {total} items completed
                            </span>
                          </div>
                          <span className="text-xs font-black text-emerald-700 font-mono tracking-tight bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200/40">
                            {Math.round(percentage)}%
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-sm"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Node Type</label>
                    <div className="relative">
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black appearance-none uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                        value={selectedStation.type || 'PHASE_BOUNDARY'}
                        onChange={(e) => {
                          const val = e.target.value as StationType;
                          updateStation(selectedStation.id, { type: val });
                          showToast(`Node type updated to "${STATION_TYPE_CONFIG[val]?.name || val}"`, "success");
                        }}
                      >
                        <option value="MILESTONE">Milestone</option>
                        <option value="FEATURE">Feature Release</option>
                        <option value="INTEGRATION">System Integration</option>
                        <option value="PHASE_BOUNDARY">Phase Boundary</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 ml-1 font-bold">
                      {STATION_TYPE_CONFIG[selectedStation.type || 'PHASE_BOUNDARY']?.description}
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Title</label>
                    <input 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                      value={selectedStation.title}
                      onChange={(e) => updateStation(selectedStation.id, { title: e.target.value })}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          showToast(`Milestone renamed to "${e.target.value.trim()}"`, "success");
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Symbol</label>
                    <div className="grid grid-cols-5 gap-2 bg-slate-50 p-2 border border-slate-200 rounded-2xl">
                      {STATION_ICONS.map(icon => (
                        <button
                          key={icon.id}
                          onClick={() => {
                            updateStation(selectedStation.id, { icon: icon.symbol });
                            showToast(`Milestone icon updated to ${icon.symbol}`, "success");
                          }}
                          className={`aspect-square flex items-center justify-center text-lg rounded-lg transition-all ${
                            selectedStation.icon === icon.symbol ? 'bg-indigo-600 shadow-md scale-110 text-white' : 'hover:bg-slate-200'
                          }`}
                        >
                          {icon.symbol}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Junction Management */}
                  <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Project Connectivity (Junctions)</label>
                      <div className="space-y-1.5">
                          {workspace.lines.map(line => {
                              const isConnected = selectedStation.lineIds.includes(line.id);
                              return (
                                  <button
                                      key={line.id}
                                      onClick={() => {
                                          toggleLineOnStation(selectedStation.id, line.id);
                                          showToast(
                                              isConnected 
                                              ? `Removed "${line.name}" track connectivity` 
                                              : `Connected station to "${line.name}" track`, 
                                              isConnected ? "info" : "success"
                                          );
                                      }}
                                      className={`w-full p-2.5 flex items-center gap-3 rounded-xl border text-[11px] font-black uppercase transition-all ${
                                          isConnected 
                                          ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                                          : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                                      }`}
                                  >
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getLineColor(line.id) }} />
                                      {line.name}
                                  </button>
                              );
                          })}
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Kickoff</label>
                      <input 
                        type="date"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={selectedStation.startDate || ''}
                        onChange={(e) => updateStation(selectedStation.id, { startDate: e.target.value })}
                        onBlur={() => showToast("Kickoff date saved", "success")}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Deadline</label>
                      <input 
                        type="date"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={selectedStation.endDate || ''}
                        onChange={(e) => updateStation(selectedStation.id, { endDate: e.target.value })}
                        onBlur={() => showToast("Deadline date saved", "success")}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Status</label>
                    <div className="relative">
                      <select 
                        className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black appearance-none uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 ${statusColors[selectedStation.status || ''] || 'text-slate-600'}`}
                        value={selectedStation.status || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateStation(selectedStation.id, { status: val });
                          showToast(`Milestone status set to "${val || 'Not Set'}"`, "success");
                        }}
                      >
                        <option value="">Not Set</option>
                        <option value="Planned">Planned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const title = selectedStation.title;
                      deleteStation(selectedStation.id);
                      setSelectedStationId(null);
                      showToast(`Station "${title}" successfully removed from the workspace.`, 'success');
                    }}
                    className="mt-4 p-3 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 border border-rose-100 shadow-sm"
                  >
                    Remove Node
                  </button>
                </div>
              ) : (
                <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50 text-slate-400">
                  <p className="text-[10px] font-black uppercase tracking-tighter leading-relaxed">Select a station node<br/>on the grid to inspect details</p>
                </div>
              )}
            </section>
          </div>

          <div className="p-6 bg-slate-900 text-white min-w-[320px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-glow" />
              <p className="text-[9px] font-black opacity-70 uppercase tracking-widest">Auto-Sync Engine</p>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400 font-bold">Spatial edits are propagated to the Feature Board in real-time.</p>
          </div>
        </div>
      </div>

      {/* Expand Trigger Button (Visible when sidebar is collapsed) */}
      {isSidebarCollapsed && (
        <button 
          onClick={() => setIsSidebarCollapsed(false)}
          className="absolute top-20 left-6 z-[80] bg-indigo-600 text-white p-3.5 rounded-2xl shadow-2xl hover:bg-indigo-700 transition-all transform hover:scale-105 flex items-center justify-center animate-in fade-in slide-in-from-left-4 duration-300"
          title="Expand Editor Panel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Floating Zoom Controls - Top Right */}
      <div className="absolute top-6 right-6 z-[70] flex flex-col gap-2 p-2 bg-white/80 backdrop-blur-md border border-white rounded-2xl shadow-2xl">
        <button 
          onClick={handleZoomIn}
          className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
        </button>
        <button 
          onClick={handleZoomReset}
          className="px-3 py-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all uppercase"
          title="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button 
          onClick={handleZoomOut}
          className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
        </button>
        <button 
          onClick={handleFitToScreen}
          className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all flex items-center justify-center"
          title="Fit entire roadmap on screen"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0" />
          </svg>
        </button>
        <div className="w-full h-px bg-slate-100 my-1" />
        <button 
          onClick={() => setShowGrid(prev => {
            const next = !prev;
            showToast(next ? "Background grid visible." : "Background grid hidden.", "info");
            return next;
          })}
          className={`p-3 rounded-xl transition-all flex items-center justify-center ${showGrid ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
          title="Toggle Background Grid (G)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
        </button>
        <button 
          onClick={() => setSnapToGrid(prev => {
            const next = !prev;
            showToast(next ? "Snap-to-grid enabled." : "Snap-to-grid disabled.", "info");
            return next;
          })}
          className={`p-3 rounded-xl transition-all flex items-center justify-center ${snapToGrid ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
          title="Toggle Grid Snapping (S)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 5v6a6 6 0 0012 0V5M9 5v4a3 3 0 006 0V5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 5H9M15 5h3" />
          </svg>
        </button>
        <button 
          onClick={handleAutoLayout}
          className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-100/80 rounded-xl transition-all flex items-center justify-center cursor-pointer"
          title="Suggest Layout (Auto-organize stations into a readable, non-overlapping layout)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a2 2 0 100 4 2 2 0 000-4zM5 17a2 2 0 100 4 2 2 0 000-4zM19 17a2 2 0 100 4 2 2 0 000-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5m0 0L7 17m5-5l5 5" />
          </svg>
        </button>
      </div>

      {/* Floating Toolbox - DRAGGABLE - Positioned below Zoom Controls */}
      <div 
        className="absolute z-[70] flex flex-col gap-1 p-2 bg-white/90 backdrop-blur-lg border border-white/50 rounded-3xl shadow-2xl transition-shadow duration-300"
        style={{ 
          left: `${toolboxPos.x}px`, 
          top: `${toolboxPos.y}px`,
          boxShadow: isDraggingToolbox ? '0 30px 60px -12px rgba(0,0,0,0.25)' : '0 20px 40px -12px rgba(0,0,0,0.1)'
        }}
      >
        {/* Drag Handle */}
        <div 
          onMouseDown={handleToolboxMouseDown}
          className="h-8 flex items-center justify-center cursor-move hover:bg-slate-50 rounded-2xl active:bg-slate-100 group transition-colors"
        >
          <div className="flex flex-col gap-0.5 items-center">
            <div className="w-4 h-0.5 bg-slate-200 rounded-full group-hover:bg-slate-300 transition-colors" />
            <div className="w-4 h-0.5 bg-slate-200 rounded-full group-hover:bg-slate-300 transition-colors" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button 
            onClick={() => { setActiveTool('pointer'); setLinkSourceId(null); }}
            className={`p-3 rounded-2xl transition-all ${activeTool === 'pointer' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Pointer (Move & Select Stations)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
          </button>
          <button 
            onClick={() => { setActiveTool('select'); setLinkSourceId(null); }}
            className={`p-3 rounded-2xl transition-all ${activeTool === 'select' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Group/Marquee Selection Box"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="3" strokeWidth="2.5" strokeDasharray="4 3" />
            </svg>
          </button>
          <button 
            onClick={() => { setActiveTool('station'); setLinkSourceId(null); }}
            className={`p-3 rounded-2xl transition-all ${activeTool === 'station' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Station (Click to place)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button 
            onClick={() => setActiveTool('link')}
            className={`p-3 rounded-2xl transition-all ${activeTool === 'link' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Dependency Tool (Connect Projects)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </button>
          <div className="w-full h-px bg-slate-100 my-1" />
          <button 
            onClick={() => setActiveTool('line')}
            className={`p-3 rounded-2xl transition-all ${activeTool === 'line' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Line Tool (Manage tracks)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="flex-1 relative cursor-crosshair overflow-hidden">
        <svg
          ref={canvasRef}
          width="100%"
          height="100%"
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          className="select-none touch-none"
        >
          <defs>
            <pattern 
              id="grid" 
              width="40" 
              height="40" 
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            >
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                <feOffset dx="0" dy="2" result="offsetblur" />
                <feComponentTransfer><feFuncA type="linear" slope="0.2" /></feComponentTransfer>
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
          <rect id="grid-bg" width="100%" height="100%" fill={showGrid ? "url(#grid)" : "transparent"} />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Draw Dependencies */}
            {workspace.dependencies.map(dep => {
                const from = workspace.stations.find(s => s.id === dep.fromStationId);
                const to = workspace.stations.find(s => s.id === dep.toStationId);
                if (!from || !to) return null;

                const fromDimmed = isAnyStationFilterActive && !isStationMatched(from);
                const toDimmed = isAnyStationFilterActive && !isStationMatched(to);
                const depDimmed = fromDimmed || toDimmed;

                if (stationFilterBehavior === 'hide' && depDimmed) {
                    return null;
                }

                return (
                    <g key={dep.id} className="group/dep" opacity={depDimmed ? "0.15" : "1.0"}>
                        <line 
                            x1={from.x} y1={from.y} 
                            x2={to.x} y2={to.y} 
                            stroke="#cbd5e1" 
                            strokeWidth="3" 
                            strokeDasharray="8,4" 
                            markerEnd="url(#arrowhead)"
                            className="transition-all"
                        />
                        {/* Hover trigger for removal */}
                        <circle 
                            cx={(from.x + to.x) / 2} 
                            cy={(from.y + to.y) / 2} 
                            r="10" 
                            fill="white" 
                            stroke="#cbd5e1" 
                            className="opacity-0 group-hover/dep:opacity-100 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); removeDependency(dep.id); }}
                        />
                        <text 
                            x={(from.x + to.x) / 2} 
                            y={(from.y + to.y) / 2 + 3} 
                            textAnchor="middle" 
                            className="opacity-0 group-hover/dep:opacity-100 text-[8px] font-black pointer-events-none fill-rose-500"
                        >✕</text>
                    </g>
                );
            })}

            {/* Draw Lines */}
            {workspace.lines.map(line => {
              const pts = line.stationIds
                .map(sid => workspace.stations.find(s => s.id === sid))
                .filter(Boolean) as Station[];
              
              if (pts.length < 2) return null;

              const d = pts.reduce((acc, p, i) => 
                i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, 
              '');

              const hasMatchingStation = pts.some(s => isStationMatched(s));
              const lineDimmed = isAnyStationFilterActive && !hasMatchingStation;

              return (
                <g key={line.id} opacity={lineDimmed ? "0.15" : "1.0"} className="transition-all duration-300">
                  <path
                    d={d}
                    fill="none"
                    stroke={getLineColor(line.id)}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-75"
                  />
                  {/* Wider stroke overlay to make hover trigger highly responsive */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="28"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredLineId(line.id)}
                    onMouseLeave={() => setHoveredLineId(null)}
                  />
                </g>
              );
            })}

            {/* Link Preview (when using Link Tool) */}
            {activeTool === 'link' && linkSourceId && dragCurrentPos && (() => {
                const source = workspace.stations.find(s => s.id === linkSourceId);
                if (!source) return null;
                return (
                    <line 
                        x1={source.x} y1={source.y} 
                        x2={dragCurrentPos.x} y2={dragCurrentPos.y} 
                        stroke="#4f46e5" 
                        strokeWidth="2" 
                        strokeDasharray="4,2" 
                    />
                );
            })()}

            {/* Drag Previews (Snap Lines) */}
            {draggingStationId && dragCurrentPos && (
                <g>
                    {(() => {
                        const line = workspace.lines.find(l => l.stationIds.includes(draggingStationId));
                        if (!line) return null;
                        const sIdx = line.stationIds.indexOf(draggingStationId);
                        const prevId = sIdx > 0 ? line.stationIds[sIdx - 1] : null;
                        const prev = prevId ? workspace.stations.find(s => s.id === prevId) : null;
                        
                        if (!prev) return null;
                        return (
                            <line 
                                x1={prev.x} y1={prev.y} 
                                x2={dragCurrentPos.x} y2={dragCurrentPos.y} 
                                stroke={getLineColor(line.id)} 
                                strokeWidth="8" 
                                strokeDasharray="5,5" 
                                opacity="0.4"
                            />
                        );
                    })()}
                </g>
            )}

            {/* Draw Stations */}
            {workspace.stations.map(station => {
              const isMatched = isStationMatched(station);
              const isDimmed = isAnyStationFilterActive && !isMatched;

              if (stationFilterBehavior === 'hide' && isDimmed) {
                return null;
              }

              const isDragging = draggingStationId === station.id;
              const isPartofSelectionDrag = draggingStationId && dragCurrentPos && dragLeaderStartPos && selectedStationIds.includes(draggingStationId) && selectedStationIds.includes(station.id);
              
              let displayX = station.x;
              let displayY = station.y;
              
              if (isDragging && dragCurrentPos) {
                displayX = dragCurrentPos.x;
                displayY = dragCurrentPos.y;
              } else if (isPartofSelectionDrag && dragCurrentPos && dragLeaderStartPos) {
                const dx = dragCurrentPos.x - dragLeaderStartPos.x;
                const dy = dragCurrentPos.y - dragLeaderStartPos.y;
                displayX = station.x + dx;
                displayY = station.y + dy;
              }

              const isJunction = station.lineIds.length > 1;
              const isSelected = selectedStationIds.includes(station.id);

              return (
                <g 
                  key={station.id} 
                  transform={`translate(${displayX}, ${displayY})`}
                  onMouseDown={(e) => handleStationMouseDown(station.id, e)}
                  onMouseEnter={() => setHoveredStationId(station.id)}
                  onMouseLeave={() => setHoveredStationId(null)}
                  className={`group ${activeTool === 'pointer' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} transition-all duration-300`}
                  opacity={isDimmed ? "0.15" : "1.0"}
                  style={{ pointerEvents: isDimmed ? "none" : "auto" }}
                >
                  {/* Highlight Ring for searched/focused station */}
                  {highlightedStationId === station.id && (
                    <circle 
                      r="28" 
                      fill="none" 
                      stroke="#4f46e5" 
                      strokeWidth="2" 
                      strokeDasharray="5,3" 
                      className="animate-spin"
                      style={{ transformOrigin: 'center', animationDuration: '8s' }}
                    />
                  )}
                  {highlightedStationId === station.id && (
                    <circle 
                      r="24" 
                      fill="none" 
                      stroke="#818cf8" 
                      strokeWidth="1.5" 
                      className="animate-ping opacity-60"
                      style={{ transformOrigin: 'center' }}
                    />
                  )}

                  {/* Interchange Highlight (Junction) */}
                  {isJunction && (
                      <circle 
                        r={isSelected ? "24" : "20"} 
                        fill="white" 
                        stroke="#cbd5e1" 
                        strokeWidth="1" 
                        className="animate-pulse"
                      />
                  )}

                  {/* Concentric Progress Halo Ring & Arc */}
                  {/* Calculates completion metrics for backing stories and projects a radial track */}
                  {(() => {
                    const { total, completed, percentage } = getStationProgress(station.id);
                    if (total === 0) return null; // Only show progress halo if there are stories mapped to this station

                    // Adjust ring boundaries slightly based on whether the station node is active/selected
                    const ringRadius = isSelected ? 24 : 18;
                    const strokeWidth = isSelected ? 3 : 2;
                    const circumference = 2 * Math.PI * ringRadius;
                    // Standard SVG dash-offset calculation to render partial progress sectors
                    const strokeDashoffset = circumference - (percentage / 100) * circumference;
                    
                    // Visual status palette mapping completion percentage to responsive theme colors
                    const ringColor = percentage === 100 
                      ? "#10b981" // Completed: Emerald Green
                      : percentage > 0 
                        ? "#4f46e5" // In Progress: Royal Indigo
                        : "#94a3b8"; // Planned: Neutral Slate Gray

                    return (
                      <g className="transition-all duration-300 pointer-events-none">
                        {/* Background track circle outlining the boundary */}
                        <circle
                          r={ringRadius}
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth={strokeWidth}
                          opacity="0.6"
                        />
                        {/* Progressive colored arc: SVG circles default to starting at 3 o'clock; 
                            rotate(-90) turns it 90 degrees counter-clockwise so the arc begins cleanly at 12 o'clock */}
                        <circle
                          r={ringRadius}
                          fill="none"
                          stroke={ringColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          transform="rotate(-90)"
                          className="transition-all duration-500 ease-out"
                        />
                      </g>
                    );
                  })()}

                  {/* Multi-Selection Hologram Ring */}
                  {isSelected && (
                    <circle 
                      r="22" 
                      fill="none" 
                      stroke="#4f46e5" 
                      strokeWidth="1.5" 
                      strokeDasharray="4,2" 
                      className="animate-spin"
                      style={{ transformOrigin: 'center', animationDuration: '24s' }}
                    />
                  )}

                  {renderNodeShape(
                    station, 
                    isSelected, 
                    linkSourceId === station.id, 
                    isJunction, 
                    isDragging || isPartofSelectionDrag
                  )}
                  
                  {(() => {
                    const nodeIcon = station.icon || DEFAULT_ICONS[station.type || 'PHASE_BOUNDARY'];
                    if (!nodeIcon) return null;
                    return (
                      <text
                        y="4"
                        textAnchor="middle"
                        className={`select-none pointer-events-none transition-all ${isDragging ? 'opacity-20' : 'opacity-100'} ${isSelected ? 'text-lg' : 'text-sm'}`}
                      >
                        {nodeIcon}
                      </text>
                    );
                  })()}

                  <text 
                    y={isJunction ? "48" : "40"} 
                    textAnchor="middle" 
                    className={`text-[11px] font-black select-none uppercase tracking-tight transition-all ${isDragging ? 'opacity-20' : 'opacity-100'} ${isSelected ? 'fill-indigo-600 scale-110' : 'fill-slate-800'}`}
                  >
                    {station.title}
                  </text>

                  {/* Under-Title Feature Completion Details */}
                  {(() => {
                    const { total, completed, percentage } = getStationProgress(station.id);
                    if (total === 0) return null;
                    return (
                      <text 
                        y={isJunction ? "58" : "50"} 
                        textAnchor="middle" 
                        className={`text-[9px] font-bold font-mono tracking-tight transition-all select-none duration-300 ${percentage === 100 ? 'fill-emerald-600 font-extrabold' : 'fill-slate-400'}`}
                      >
                        {completed}/{total} ({Math.round(percentage)}%)
                      </text>
                    );
                  })()}

                  {/* Junction Indicator Text */}
                  {isJunction && !isDragging && (
                      <text 
                        y="-24" 
                        textAnchor="middle" 
                        className="text-[8px] font-black fill-slate-400 uppercase tracking-widest pointer-events-none"
                      >
                        Interchange
                      </text>
                  )}

                  {/* Ghost Node during dragging */}
                  {isDragging && dragCurrentPos && (
                      <circle 
                        r="16" 
                        fill="white" 
                        stroke="#4f46e5" 
                        strokeWidth="6" 
                        opacity="0.8"
                        className="pointer-events-none"
                      />
                  )}
                </g>
              );
            })}

            {/* Draw Marquee Selection Box */}
            {marqueeStart && marqueeEnd && (() => {
              const x = Math.min(marqueeStart.x, marqueeEnd.x);
              const y = Math.min(marqueeStart.y, marqueeEnd.y);
              const w = Math.abs(marqueeStart.x - marqueeEnd.x);
              const h = Math.abs(marqueeStart.y - marqueeEnd.y);
              return (
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(79, 70, 229, 0.04)"
                  stroke="#4f46e5"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  rx="4"
                  className="pointer-events-none"
                />
              );
            })()}
          </g>
        </svg>

        {/* Interactive Minimap Overlay */}
        {isMinimapCollapsed ? (
          <button
            onClick={() => setIsMinimapCollapsed(false)}
            className="absolute bottom-6 right-6 z-[60] bg-white/95 backdrop-blur-md hover:bg-slate-50 text-slate-700 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer flex items-center gap-2 group pointer-events-auto"
            title="Expand Minimap View"
          >
            <svg className="w-5 h-5 text-indigo-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 6-3v11" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest pr-1">Show Minimap</span>
          </button>
        ) : (
          <div className="absolute bottom-6 right-6 z-[60] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/85 shadow-2xl p-3 w-[240px] flex flex-col gap-2 transition-all duration-300 pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="font-black text-[10px] text-slate-500 uppercase tracking-widest leading-none">Interactive Minimap</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleFitToScreen}
                  className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors uppercase cursor-pointer"
                  title="Recenter and scale map to fit screen"
                >
                  Fit Map
                </button>
                <button 
                  onClick={() => setIsMinimapCollapsed(true)}
                  className="p-0.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Hide Minimap"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Minimap Viewbox SVG */}
            <div className="w-[216px] h-[120px] rounded-xl bg-slate-50/50 border border-slate-100 overflow-hidden relative cursor-crosshair">
              <svg
                ref={minimapRef}
                width="100%"
                height="100%"
                onMouseDown={handleMinimapMouseDown}
                className="select-none touch-none bg-slate-50/20"
              >
                {/* Draw miniature tracks in the theme colors */}
                {workspace.lines.map(line => {
                  const pts = line.stationIds
                    .map(sid => workspace.stations.find(s => s.id === sid))
                    .filter(Boolean) as Station[];
                  
                  if (pts.length < 2) return null;

                  // Map each point to minimap coordinates
                  const mappedPoints = pts.map(p => {
                    const mp = mapUserToMinimap(p.x, p.y);
                    return `${mp.x},${mp.y}`;
                  }).join(' ');

                  return (
                    <polyline
                      key={`m-line-${line.id}`}
                      points={mappedPoints}
                      fill="none"
                      stroke={getLineColor(line.id)}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.85"
                    />
                  );
                })}

                {/* Draw miniature station node dots */}
                {workspace.stations.map(station => {
                  const mp = mapUserToMinimap(station.x, station.y);
                  let color = '#cbd5e1';
                  switch (station.type) {
                    case 'MILESTONE':
                      color = activeTheme.stationColors.MILESTONE;
                      break;
                    case 'FEATURE':
                      color = activeTheme.stationColors.FEATURE;
                      break;
                    case 'INTEGRATION':
                      color = activeTheme.stationColors.INTEGRATION;
                      break;
                    case 'PHASE_BOUNDARY':
                    default:
                      color = activeTheme.stationColors.PHASE_BOUNDARY;
                      break;
                  }

                  return (
                    <circle
                      key={`m-station-${station.id}`}
                      cx={mp.x}
                      cy={mp.y}
                      r="3.5"
                      fill="white"
                      stroke={color}
                      strokeWidth="1.5"
                      opacity="0.95"
                    />
                  );
                })}

                {/* Draw Visible Viewport Rect */}
                {(() => {
                  // Visible user space coordinates:
                  const visibleLeft = -pan.x / zoom;
                  const visibleTop = -pan.y / zoom;
                  const visibleRight = (canvasSize.width - pan.x) / zoom;
                  const visibleBottom = (canvasSize.height - pan.y) / zoom;

                  const viewTL = mapUserToMinimap(visibleLeft, visibleTop);
                  const viewBR = mapUserToMinimap(visibleRight, visibleBottom);

                  const rectX = viewTL.x;
                  const rectY = viewTL.y;
                  const rectW = viewBR.x - viewTL.x;
                  const rectH = viewBR.y - viewTL.y;

                  return (
                    <rect
                      x={rectX}
                      y={rectY}
                      width={rectW}
                      height={rectH}
                      fill="rgba(79, 70, 229, 0.08)"
                      stroke="#4f46e5"
                      strokeWidth="1.5"
                      rx="1"
                      className="pointer-events-none transition-all duration-75"
                    />
                  );
                })()}
              </svg>
            </div>

            {/* Viewport coordinates & help */}
            <div className="flex justify-between items-center text-[8px] font-black tracking-tight text-slate-400 uppercase">
              <span>Scale: {Math.round(zoom * 100)}%</span>
              <span className="text-slate-500 font-extrabold flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                </svg>
                Drag to pan
              </span>
            </div>
          </div>
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 flex flex-col gap-2 pointer-events-none">
            <div className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-100 shadow-md text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                Active Mode: {activeTool.toUpperCase()}
            </div>
            
            {/* Shapes Legend */}
            <div className="p-3 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-150 shadow-md text-[10px] text-slate-500 flex flex-col gap-2 pointer-events-auto">
                <div className="font-black text-slate-400 uppercase tracking-widest text-[8px] border-b border-slate-100 pb-1 mb-1">Node Legend</div>
                <div className="flex items-center gap-2 font-bold uppercase text-[9px] text-slate-600">
                    <span className="text-amber-500 font-extrabold w-3 text-center">🔶</span>
                    <span>Milestone</span>
                </div>
                <div className="flex items-center gap-2 font-bold uppercase text-[9px] text-slate-600">
                    <span className="text-emerald-500 font-extrabold w-3 text-center">⏹️</span>
                    <span>Feature</span>
                </div>
                <div className="flex items-center gap-2 font-bold uppercase text-[9px] text-slate-600">
                    <span className="text-violet-500 font-extrabold w-3 text-center text-xs">⬢</span>
                    <span>Integration</span>
                </div>
                <div className="flex items-center gap-2 font-bold uppercase text-[9px] text-slate-600">
                    <span className="text-slate-500 font-extrabold w-3 text-center">●</span>
                    <span>Boundary</span>
                </div>
            </div>

            {activeTool === 'link' && (
                <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    {linkSourceId ? 'SELECT TARGET NODE TO LINK' : 'SELECT ORIGIN NODE'}
                </div>
            )}
        </div>

        {/* Informative Help Badge positioned elegantly at Bottom Center */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[70] flex gap-2 pointer-events-none">
            <div className="px-5 py-2.5 bg-slate-900/95 backdrop-blur-md rounded-full shadow-2xl border border-slate-800 text-[10px] font-black text-white uppercase tracking-widest shadow-glow whitespace-nowrap">
                {activeTool === 'pointer' ? 'DRAG NODES TO LAY TRACK' : 
                 activeTool === 'station' ? 'CLICK TO PLACE NEW STATION' : 
                 activeTool === 'link' ? 'CREATE PROJECT DEPENDENCIES' :
                 'SELECT LINE TO CONFIGURE'}
            </div>
        </div>
      </div>
    </div>
  );
}

export default RoadmapEditor;
