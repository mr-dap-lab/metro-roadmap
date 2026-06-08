
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Workspace, ID } from '../types';
import { Camera, Sun, Moon, Users, ChevronDown, Compass, LayoutGrid } from 'lucide-react';
import { useTheme } from './ThemeContext';

export interface VirtualUser {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string;
  textColor: string;
  currentView: {
    type: 'roadmap' | 'board' | 'dashboard' | 'snapshots';
    targetId?: ID;
    targetName: string;
  };
  status: 'active' | 'idle';
  lastActive: string;
}

interface HeaderProps {
  view: string;
  onHome: () => void;
  onBack: () => void;
  onExport: () => void;
  onSnapshots: () => void;
  lastSaved?: Date;
  workspace?: Workspace;
  onSelectStation?: (stationId: ID) => void;
  onSelectCard?: (lineId: ID, cardId: ID) => void;
  onSelectLine?: (lineId: ID) => void;
  onSelectRoadmap?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  view, 
  onHome, 
  onExport, 
  onSnapshots,
  lastSaved, 
  workspace, 
  onSelectStation, 
  onSelectCard,
  onSelectLine,
  onSelectRoadmap
}) => {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Presence states
  const presenceContainerRef = useRef<HTMLDivElement>(null);
  const [isPresenceOpen, setIsPresenceOpen] = useState(false);
  const [virtualUsers, setVirtualUsers] = useState<VirtualUser[]>([]);

  // Close search dropdown and presence dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (presenceContainerRef.current && !presenceContainerRef.current.contains(event.target as Node)) {
        setIsPresenceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to generate a dynamic, valid view for a virtual user
  const getRandomView = useCallback((ws?: Workspace) => {
    if (!ws) {
      return { type: 'dashboard' as const, targetName: 'Workspace Dashboard' };
    }
    
    const choices: { type: 'roadmap' | 'board' | 'dashboard' | 'snapshots'; targetId?: ID; targetName: string }[] = [
      { type: 'dashboard', targetName: 'Workspace Dashboard' },
      { type: 'roadmap', targetName: 'Roadmap Canvas' }
    ];

    if (ws.lines && ws.lines.length > 0) {
      ws.lines.forEach(line => {
        choices.push({
          type: 'roadmap',
          targetId: line.id,
          targetName: `${line.shortCode} - ${line.name} Roadmap`
        });
        
        // Match feature map
        const fm = ws.featureMaps?.find(m => m.lineId === line.id);
        if (fm) {
          choices.push({
            type: 'board',
            targetId: line.id, // In App.tsx navigateToFeatureMap takes line.id
            targetName: `${line.name} Feature Board`
          });
        }
      });
    }

    if (choices.length === 0) {
      return { type: 'dashboard' as const, targetName: 'Workspace Dashboard' };
    }

    const randomIdx = Math.floor(Math.random() * choices.length);
    return choices[randomIdx];
  }, []);

  // Initialize virtual users when workspace loads
  useEffect(() => {
    if (!workspace) return;

    const initialUsers: VirtualUser[] = [
      {
        id: 'vu-sarah',
        name: 'Sarah Chen',
        initials: 'SC',
        role: 'Lead Product Manager',
        color: '#3b82f6', // blue
        textColor: 'text-blue-600 dark:text-blue-400',
        currentView: { type: 'dashboard', targetName: 'Workspace Dashboard' },
        status: 'active',
        lastActive: 'Active'
      },
      {
        id: 'vu-marcus',
        name: 'Marcus Vance',
        initials: 'MV',
        role: 'System Architect',
        color: '#10b981', // emerald
        textColor: 'text-emerald-600 dark:text-emerald-450',
        currentView: { type: 'roadmap', targetName: 'Roadmap Canvas' },
        status: 'active',
        lastActive: 'Active'
      },
      {
        id: 'vu-elena',
        name: 'Elena Rostova',
        initials: 'ER',
        role: 'QA Automation Lead',
        color: '#f59e0b', // amber
        textColor: 'text-amber-600 dark:text-amber-400',
        currentView: { type: 'board', targetName: 'Feature Backlog Board' },
        status: 'idle',
        lastActive: 'Idle - 3m ago'
      },
      {
        id: 'vu-liam',
        name: 'Liam Baker',
        initials: 'LB',
        role: 'Senior UI/UX Engineer',
        color: '#ec4899', // pink
        textColor: 'text-pink-600 dark:text-pink-400',
        currentView: { type: 'dashboard', targetName: 'Workspace Dashboard' },
        status: 'active',
        lastActive: 'Active'
      }
    ];

    const updated = initialUsers.map((user, idx) => {
      const viewSelection = getRandomView(workspace);
      return {
        ...user,
        currentView: viewSelection,
        status: idx === 2 ? 'idle' : 'active',
        lastActive: idx === 2 ? 'Idle - 3m ago' : 'Active'
      };
    });

    setVirtualUsers(updated);
  }, [workspace, getRandomView]);

  // Handle dynamic simulation
  useEffect(() => {
    if (!workspace || virtualUsers.length === 0) return;

    const interval = setInterval(() => {
      setVirtualUsers(prev => {
        const userIndex = Math.floor(Math.random() * prev.length);
        return prev.map((user, idx) => {
          if (idx !== userIndex) return user;

          const changeType = Math.random();
          if (changeType < 0.6) {
            const nextView = getRandomView(workspace);
            return {
              ...user,
              currentView: nextView,
              status: 'active',
              lastActive: 'Active'
            };
          } else {
            const nextStatus = user.status === 'active' ? 'idle' : 'active';
            return {
              ...user,
              status: nextStatus,
              lastActive: nextStatus === 'active' ? 'Active' : `Idle - ${Math.floor(Math.random() * 5) + 1}m ago`
            };
          }
        });
      });
    }, 15000); // 15 seconds iteration

    return () => clearInterval(interval);
  }, [workspace, virtualUsers.length, getRandomView]);

  // Compute search results
  const results = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2 || !workspace) {
      return { stations: [], cards: [] };
    }
    const q = searchQuery.toLowerCase().trim();

    // Match stations
    const matchingStations = workspace.stations.filter(s => 
      s.title.toLowerCase().includes(q) ||
      (s.owner && s.owner.toLowerCase().includes(q)) ||
      (s.status && s.status.toLowerCase().includes(q))
    ).map(s => {
      // Find what lines this station belongs to
      const associatedLines = workspace.lines.filter(l => s.lineIds.includes(l.id));
      return {
        ...s,
        lines: associatedLines
      };
    });

    // Match cards (features) across all feature maps
    const matchingCards = workspace.featureMaps.flatMap(fm => {
      const line = workspace.lines.find(l => l.id === fm.lineId);
      return fm.cards.map(c => ({
        ...c,
        lineId: fm.lineId,
        lineName: line?.name || 'Track Line',
        lineColor: line?.color || '#cbd5e1'
      }));
    }).filter(c => 
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      (c.owner && c.owner.toLowerCase().includes(q)) ||
      (c.tags && c.tags.some(tag => tag.toLowerCase().includes(q)))
    );

    return { stations: matchingStations, cards: matchingCards };
  }, [searchQuery, workspace]);

  const handleStationClick = (stationId: ID) => {
    if (onSelectStation) {
      onSelectStation(stationId);
    }
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleCardClick = (lineId: ID, cardId: ID) => {
    if (onSelectCard) {
      onSelectCard(lineId, cardId);
    }
    setSearchQuery('');
    setIsOpen(false);
  };

  const hasResults = results.stations.length > 0 || results.cards.length > 0;

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex items-center justify-between px-6 z-[100] shadow-sm relative transition-colors duration-150">
      <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={onHome}>
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
            <path d="M4 15V9h16v6H4zm0-8h16V3H4v4zm0 14h16v-4H4v4z" />
          </svg>
        </div>
        <h1 className="font-bold text-lg tracking-tight hidden sm:block text-slate-900 dark:text-slate-100">
          MetroMap <span className="text-slate-400 dark:text-slate-500 font-medium">Architect</span>
        </h1>
      </div>

      {/* Global Search Input Bar Container */}
      <div ref={containerRef} className="flex-1 max-w-lg mx-6 relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Search milestones, tracks or stories..."
            className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 focus:bg-white dark:focus:bg-slate-950 border border-slate-200 dark:border-slate-750 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950 rounded-2xl py-2 pl-10 pr-9 text-xs font-semibold transition-all focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
          />
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Global Search Results Dropdown Overlay */}
        {isOpen && searchQuery.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 mt-2 max-h-[460px] overflow-y-auto z-[200] py-3 flex flex-col gap-4">
            
            {/* Stations and Milestones Section */}
            {results.stations.length > 0 && (
              <div>
                <div className="px-4 py-1.5 flex items-center justify-between border-b border-slate-50 dark:border-slate-800 mb-1 bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.586L12 21l-5.657-5.657M12 14a3 3 0 110-6 3 3 0 010 6z" />
                    </svg>
                    Milestones & Stations
                  </span>
                  <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
                    {results.stations.length}
                  </span>
                </div>
                <div className="flex flex-col">
                  {results.stations.map(station => (
                    <div 
                      key={station.id}
                      onClick={() => handleStationClick(station.id)}
                      className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-start gap-3 cursor-pointer transition-colors group/item"
                    >
                       <div className="text-lg pt-0.5 shrink-0 group-hover/item:scale-110 transition-transform">
                        {station.icon || (
                          station.type === 'MILESTONE' ? '🚩' :
                          station.type === 'FEATURE' ? '🚀' :
                          station.type === 'INTEGRATION' ? '🔌' : '📍'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 tracking-tight truncate group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors">
                            {station.title}
                          </h4>
                          {station.status && (
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                              {station.status}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            {station.type === 'MILESTONE' ? 'Milestone' : 
                             station.type === 'FEATURE' ? 'Feature Release' :
                             station.type === 'INTEGRATION' ? 'System Integration' : 'Phase Boundary'}
                          </span>
                          
                          {station.lines.map(line => (
                            <span 
                              key={line.id}
                              className="text-[8px] font-black px-1.5 py-0.5 rounded-md text-white shadow-sm uppercase tracking-tight"
                              style={{ backgroundColor: line.color }}
                            >
                              {line.shortCode}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stories and Features Section */}
            {results.cards.length > 0 && (
              <div>
                <div className="px-4 py-1.5 flex items-center justify-between border-b border-slate-50 mb-1 bg-slate-50/50">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Story Backlog Items
                  </span>
                  <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {results.cards.length}
                  </span>
                </div>
                <div className="flex flex-col">
                  {results.cards.map(card => (
                    <div 
                      key={card.id}
                      onClick={() => handleCardClick(card.lineId, card.id)}
                      className="px-4 py-2.5 hover:bg-slate-50 flex items-start gap-3 cursor-pointer transition-colors group/item"
                    >
                      <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm" style={{ backgroundColor: card.lineColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-extrabold text-xs text-slate-800 tracking-tight truncate group-hover/item:text-indigo-600 transition-colors">
                            {card.title}
                          </h4>
                          <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                            {card.status || 'Todo'}
                          </span>
                        </div>
                        {card.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed line-clamp-1">
                            {card.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                          <span>Track: {card.lineName}</span>
                          <span>{card.owner || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!hasResults && (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                <div className="text-2xl">🔍</div>
                <h4 className="font-black text-xs text-slate-600 uppercase tracking-widest mt-1">No Matches Found</h4>
                <p className="text-[11px] text-slate-400">We couldn't find matches for "<span className="font-bold text-slate-600">{searchQuery}</span>"</p>
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="flex items-center gap-3 shrink-0">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-sm"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
        </button>

        {/* Team Presence Co-workers Stack */}
        <div ref={presenceContainerRef} className="relative flex items-center">
          <button
            onClick={() => setIsPresenceOpen(prev => !prev)}
            className="flex items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-705 rounded-xl transition-all cursor-pointer shadow-sm relative group"
            title="View active team co-workers in this workspace"
            id="team-presence-btn"
          >
            {/* Stacked avatars */}
            <div className="flex -space-x-1.5 overflow-hidden">
              {virtualUsers.map((user) => (
                <div
                  key={user.id}
                  className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[9px] font-black border-2 border-white dark:border-slate-900 transition-transform group-hover:scale-105 select-none text-white shadow-sm relative"
                  style={{ backgroundColor: user.color }}
                  title={`${user.name} (${user.role}) — ${user.status === 'active' ? 'Active' : 'Idle'}`}
                >
                  {user.initials}
                  {/* Status Indicator inside avatar */}
                  <span 
                    className={`absolute bottom-0 right-0 block h-1.5 w-1.5 rounded-full ring-1 ring-white dark:ring-slate-900 ${
                      user.status === 'active' ? 'bg-emerald-400' : 'bg-slate-400'
                    }`} 
                  />
                </div>
              ))}
            </div>
            
            {/* Label and dropdown arrow */}
            <div className="hidden md:flex items-center gap-1 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1 pr-0.5 select-none">
              <span>Team</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </div>
            
            {/* Pulse beacon if active co-workers present */}
            {virtualUsers.some(u => u.status === 'active') && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
            )}
          </button>

          {/* Elegant Dropdown Co-workers List Panel */}
          {isPresenceOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[250] py-4 px-4 flex flex-col gap-3 select-none">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full inline-block animate-pulse" />
                  Space Coordination
                </span>
                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
                  {virtualUsers.filter(u => u.status === 'active').length} ACTIVE NOW
                </span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto">
                {virtualUsers.map((user) => {
                  const isUserActive = user.status === 'active';
                  return (
                    <div 
                      key={user.id} 
                      className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                    >
                      {/* Avatar */}
                      <div 
                        className="h-8 w-8 rounded-full text-xs font-black flex items-center justify-center text-white shrink-0 relative shadow-sm"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.initials}
                        <span 
                          className={`absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                            isUserActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`} 
                        />
                      </div>

                      {/* Info & Location Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">
                            {user.name}
                          </h4>
                          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                            isUserActive 
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-450' 
                              : 'bg-slate-150 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                          }`}>
                            {user.status === 'active' ? 'Active' : 'Idle'}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-tight mt-0.5 animate-pulse">
                          {user.role}
                        </p>

                        {/* Viewing element with link pointer */}
                        <div className="mt-2 flex items-center justify-between gap-1.5 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                            {user.currentView.type === 'board' ? (
                              <LayoutGrid className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-extrabold">Viewing Location</span>
                              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 truncate">
                                {user.currentView.targetName}
                              </span>
                            </div>
                          </div>

                          {/* Navigation coordinate action if props exist */}
                          {(user.currentView.type === 'board' || user.currentView.type === 'roadmap' || user.currentView.type === 'dashboard') && (
                            <button
                              onClick={() => {
                                if (user.currentView.type === 'board' && user.currentView.targetId) {
                                  onSelectLine?.(user.currentView.targetId);
                                } else if (user.currentView.type === 'roadmap') {
                                  onSelectRoadmap?.();
                                } else if (user.currentView.type === 'dashboard') {
                                  onHome();
                                }
                                setIsPresenceOpen(false);
                              }}
                              className="px-2 py-1 text-[9px] font-extrabold tracking-tight uppercase text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-905 border border-indigo-100 dark:border-indigo-900 rounded-md transition-colors cursor-pointer shrink-0"
                              title="Sync your screen with co-worker's workspace focus"
                            >
                              Sync
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-[9px] text-slate-400 dark:text-slate-500 leading-relaxed text-center font-semibold">
                Simulating workspace peers to improve project track visibility.
              </div>
            </div>
          )}
        </div>

        {/* Elegant Auto-saved local state indicator */}
        <div className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-slate-500 dark:text-slate-400 font-semibold select-none shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-wider hidden xs:inline">Auto-saved</span>
          {lastSaved && (
            <span className="font-mono text-emerald-600 dark:text-emerald-450 bg-emerald-50/50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-lg border border-emerald-100/50 dark:border-emerald-900/50 text-[10px] font-bold">
              {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        <button 
          onClick={onSnapshots}
          className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 hover:shadow-sm ${
            view === 'snapshots' 
              ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700' 
              : 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-400'
          }`}
          title="Backup and compare workspace state versions"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Snapshots</span>
        </button>

        <button 
          onClick={onExport}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold border border-transparent dark:border-slate-700 rounded-xl transition-all flex items-center gap-2 hover:shadow-sm"
          title="Export current workspace roadmap as JSON file for backup"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M12 15V3m0 12l-4-4m4 4l4-4M4 17v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
          </svg>
          <span className="hidden sm:inline">Export JSON</span>
          <span className="sm:hidden">Export</span>
        </button>

        {view !== 'workspace' && (
          <button 
            onClick={onHome}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-105 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Exit Editor
          </button>
        )}
      </nav>
    </header>
  );
}

export default Header;
