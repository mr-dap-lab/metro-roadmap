import React, { useState, useMemo } from 'react';
import { Workspace, ID, WorkspaceSnapshot, Line, Station, Dependency } from '../types';
import { useToast } from './Toast';
import { WeeklyProgressReport } from './WeeklyProgressReport';
import { 
  Camera, 
  Save, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Layers, 
  Clock, 
  ArrowRightLeft, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  FileCheck,
  MapPin,
  Flame,
  ArrowRight,
  Mail,
  Send,
  Settings,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface SnapshotManagerProps {
  workspace: Workspace;
  createSnapshot: (name: string, description?: string, customTimestamp?: string) => void;
  deleteSnapshot: (id: ID) => void;
  restoreSnapshot: (id: ID) => void;
  onBack: () => void;
}

export const SnapshotManager: React.FC<SnapshotManagerProps> = ({
  workspace,
  createSnapshot,
  deleteSnapshot,
  restoreSnapshot,
  onBack
}) => {
  const { showToast } = useToast();

  // Snapshot capture form states
  const [newSnapName, setNewSnapName] = useState('');
  const [newSnapDesc, setNewSnapDesc] = useState('');

  // Dropdown states for side-by-side comparison
  const [compareLeftId, setCompareLeftId] = useState<string>('live');
  const [compareRightId, setCompareRightId] = useState<string>('');

  // Confirmation state for destructive actions
  const [confirmRestoreId, setConfirmRestoreId] = useState<ID | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<ID | null>(null);

  // Initialize Right Dropdown when snapshots become available
  const savedSnapshots = useMemo(() => workspace.snapshots || [], [workspace.snapshots]);
  
  React.useEffect(() => {
    if (savedSnapshots.length > 0 && !compareRightId) {
      setCompareRightId(savedSnapshots[0].id);
    }
  }, [savedSnapshots, compareRightId]);

  /**
   * Helper to handle snapshot creation submission
   */
  const handleCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnapName.trim()) {
      showToast('Please provide a name for your snapshot', 'error');
      return;
    }
    createSnapshot(newSnapName, newSnapDesc);
    showToast(`Snapshot "${newSnapName.trim()}" successfully captured!`, 'success');
    setNewSnapName('');
    setNewSnapDesc('');
  };

  /**
   * Helper to execute snapshot restoration
   */
  const handleRestore = (id: ID) => {
    const target = savedSnapshots.find(s => s.id === id);
    if (!target) return;
    restoreSnapshot(id);
    showToast(`Successfully rolled back to snapshot "${target.name}"!`, 'success');
    setConfirmRestoreId(null);
  };

  /**
   * Helper to execute snapshot deletion
   */
  const handleDelete = (id: ID) => {
    const target = savedSnapshots.find(s => s.id === id);
    if (!target) return;
    deleteSnapshot(id);
    showToast(`Snapshot "${target.name}" successfully deleted.`, 'success');
    setConfirmDeleteId(null);
    if (compareRightId === id) {
      setCompareRightId(savedSnapshots.find(s => s.id !== id)?.id || '');
    }
    if (compareLeftId === id) {
      setCompareLeftId('live');
    }
  };

  /**
   * Resolves a snapshot selection ID into a full data configuration wrapper.
   * Can represent either a saved historical snapshot or the current "LIVE" active workspace.
   */
  const resolveConfig = (id: string) => {
    if (id === 'live') {
      return {
        name: 'Active Live Workspace',
        timestamp: new Date().toISOString(),
        description: 'Current real-time state of your interactive MetroMap configuration.',
        lines: workspace.lines,
        stations: workspace.stations,
        dependencies: workspace.dependencies,
        featureMaps: workspace.featureMaps
      };
    }
    const snap = savedSnapshots.find(s => s.id === id);
    if (snap) {
      return {
        name: snap.name,
        timestamp: snap.timestamp,
        description: snap.description || 'No description provided.',
        lines: snap.lines,
        stations: snap.stations,
        dependencies: snap.dependencies,
        featureMaps: snap.featureMaps
      };
    }
    return null;
  };

  const leftConfig = useMemo(() => resolveConfig(compareLeftId), [compareLeftId, workspace, savedSnapshots]);
  const rightConfig = useMemo(() => resolveConfig(compareRightId), [compareRightId, workspace, savedSnapshots]);

  /**
   * Formats ISO 8601 timestamps into beautiful highly scannable localized strings.
   */
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' at ' + date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  /**
   * Performs side-by-side analysis and gathers comparative diff logs.
   * Identifies tracks, milestones, or story elements added, deleted, or updated.
   */
  const diffAnalysis = useMemo(() => {
    if (!leftConfig || !rightConfig) return null;

    // --- 1. Line Tracks Diff ---
    const leftLineMap = new Map(leftConfig.lines.map(l => [l.name.toLowerCase().trim(), l]));
    const rightLineMap = new Map(rightConfig.lines.map(l => [l.name.toLowerCase().trim(), l]));

    const linesAdded: string[] = [];
    const linesRemoved: string[] = [];
    const linesModified: Array<{ name: string; changes: string[] }> = [];

    // Right checks (What is new in Right compared to Left?)
    rightConfig.lines.forEach(l => {
      const leftLine = leftLineMap.get(l.name.toLowerCase().trim());
      if (!leftLine) {
        linesAdded.push(l.name);
      } else {
        const changes: string[] = [];
        if (leftLine.shortCode !== l.shortCode) {
          changes.push(`Shortcode altered: "${leftLine.shortCode}" ➜ "${l.shortCode}"`);
        }
        if (leftLine.color !== l.color) {
          changes.push(`Visual color updated`);
        }
        if (leftLine.stationIds.length !== l.stationIds.length) {
          changes.push(`Milestone linkages: ${leftLine.stationIds.length} ➜ ${l.stationIds.length}`);
        }
        if (changes.length > 0) {
          linesModified.push({ name: l.name, changes });
        }
      }
    });

    // Left checks (What was deleted in Right compared to Left?)
    leftConfig.lines.forEach(l => {
      if (!rightLineMap.has(l.name.toLowerCase().trim())) {
        linesRemoved.push(l.name);
      }
    });

    // --- 2. Milestones / Stations Diff ---
    const leftStationMap = new Map(leftConfig.stations.map(s => [s.title.toLowerCase().trim(), s]));
    const rightStationMap = new Map(rightConfig.stations.map(s => [s.title.toLowerCase().trim(), s]));

    const stationsAdded: string[] = [];
    const stationsRemoved: string[] = [];
    const stationsModified: Array<{ title: string; changes: string[] }> = [];

    rightConfig.stations.forEach(s => {
      const leftStation = leftStationMap.get(s.title.toLowerCase().trim());
      if (!leftStation) {
        stationsAdded.push(s.title);
      } else {
        const changes: string[] = [];
        if (leftStation.status !== s.status) {
          changes.push(`Status altered: "${leftStation.status || 'None'}" ➜ "${s.status || 'None'}"`);
        }
        if (leftStation.owner !== s.owner) {
          changes.push(`Owner reassigned: "${leftStation.owner || 'Unassigned'}" ➜ "${s.owner || 'Unassigned'}"`);
        }
        if (leftStation.type !== s.type) {
          changes.push(`Marker type changed`);
        }
        if (changes.length > 0) {
          stationsModified.push({ title: s.title, changes });
        }
      }
    });

    leftConfig.stations.forEach(s => {
      if (!rightStationMap.has(s.title.toLowerCase().trim())) {
        stationsRemoved.push(s.title);
      }
    });

    // --- 3. Story Backlogs Card Counts ---
    const getCardStats = (config: typeof leftConfig) => {
      const cards = config.featureMaps.flatMap(fm => fm.cards || []);
      const todo = cards.filter(c => c.status === 'Todo').length;
      const progress = cards.filter(c => c.status === 'In Progress' || c.status === 'Doing').length;
      const done = cards.filter(c => c.status === 'Completed' || c.status === 'Done').length;
      const blocked = cards.filter(c => c.status === 'Blocked').length;
      return { total: cards.length, todo, progress, done, blocked };
    };

    const leftCardStats = getCardStats(leftConfig);
    const rightCardStats = getCardStats(rightConfig);

    return {
      linesAdded,
      linesRemoved,
      linesModified,
      stationsAdded,
      stationsRemoved,
      stationsModified,
      leftCardStats,
      rightCardStats,
      areIdentical: 
        linesAdded.length === 0 && 
        linesRemoved.length === 0 && 
        linesModified.length === 0 &&
        stationsAdded.length === 0 && 
        stationsRemoved.length === 0 && 
        stationsModified.length === 0 &&
        leftCardStats.total === rightCardStats.total &&
        leftCardStats.done === rightCardStats.done &&
        leftCardStats.progress === rightCardStats.progress &&
        leftCardStats.todo === rightCardStats.todo
    };
  }, [leftConfig, rightConfig]);

  const [activeTab, setActiveTab] = useState<'compare' | 'weekly'>('compare');
  const [autoEmailEnabled, setAutoEmailEnabled] = useState<boolean>(() => {
    return localStorage.getItem('metro_presence_auto_email_enabled') === 'true';
  });
  const [recipientEmails, setRecipientEmails] = useState<string>(() => {
    return localStorage.getItem('metro_presence_recipient_emails') || 'diego.avella@gmail.com, engineering-team@workspace.com';
  });
  const [scheduleDay, setScheduleDay] = useState<string>(() => {
    return localStorage.getItem('metro_presence_schedule_day') || 'Monday';
  });
  const [scheduleHour, setScheduleHour] = useState<string>(() => {
    return localStorage.getItem('metro_presence_schedule_hour') || '09:00';
  });
  const [isDispatching, setIsDispatching] = useState(false);
  const [lastDispatchedTime, setLastDispatchedTime] = useState<string | null>(null);

  // Sync to localStorage
  React.useEffect(() => {
    localStorage.setItem('metro_presence_auto_email_enabled', String(autoEmailEnabled));
  }, [autoEmailEnabled]);

  React.useEffect(() => {
    localStorage.setItem('metro_presence_recipient_emails', recipientEmails);
  }, [recipientEmails]);

  React.useEffect(() => {
    localStorage.setItem('metro_presence_schedule_day', scheduleDay);
  }, [scheduleDay]);

  React.useEffect(() => {
    localStorage.setItem('metro_presence_schedule_hour', scheduleHour);
  }, [scheduleHour]);

  // Compute the snapshot closest to 7 days ago
  const weeklyBaselineSnapshot = useMemo(() => {
    if (!savedSnapshots || savedSnapshots.length === 0) return null;
    const sorted = [...savedSnapshots].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const sevenDaysAgoTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let closest = sorted[0];
    let minDiff = Math.abs(new Date(closest.timestamp).getTime() - sevenDaysAgoTime);

    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(new Date(sorted[i].timestamp).getTime() - sevenDaysAgoTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = sorted[i];
      }
    }
    return closest;
  }, [savedSnapshots]);

  // Core generator to model previous week baseline snapshots
  const generateMockWeeklyBaseline = () => {
    if (!workspace) return;
    const baseLines = JSON.parse(JSON.stringify(workspace.lines)) as Line[];
    const baseStations = JSON.parse(JSON.stringify(workspace.stations)) as Station[];
    const baseDeps = JSON.parse(JSON.stringify(workspace.dependencies)) as Dependency[];
    const baseFeatureMaps = JSON.parse(JSON.stringify(workspace.featureMaps)) as FeatureMap[];

    if (baseLines.length > 0) {
      const targetLine = baseLines[baseLines.length - 1];
      if (targetLine.stationIds.length > 1) {
        targetLine.stationIds.pop();
      }
    }

    let modifiedCount = 0;
    baseStations.forEach(st => {
      if (st.status === 'Completed' && modifiedCount < 2) {
        st.status = 'Planning';
        modifiedCount++;
      }
    });

    baseFeatureMaps.forEach(fm => {
      if (fm.cards) {
        fm.cards.forEach(card => {
          if (card.status === 'Completed') {
            card.status = 'In Progress';
          }
        });
      }
    });

    const sevenDaysAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    createSnapshot(
      "Weekly Baseline Progress (Simulated)", 
      "Automatically simulated baseline representing milestone layouts & story card distributions from last week.",
      sevenDaysAgoISO
    );
    showToast("Simulated baseline snapshot from 1 week ago successfully generated!", "success");
  };

  const handleManualDispatch = () => {
    if (!recipientEmails.trim()) {
      showToast("Please provide at least one recipient email address.", "error");
      return;
    }
    setIsDispatching(true);
    setTimeout(() => {
      setIsDispatching(false);
      const nowStr = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString();
      setLastDispatchedTime(nowStr);
      showToast(`Automated digest email successfully dispatched to ${recipientEmails}!`, "success");
    }, 1500);
  };

  const digestDiff = useMemo(() => {
    if (!weeklyBaselineSnapshot) return null;

    const baseLines = weeklyBaselineSnapshot.lines || [];
    const baseStations = weeklyBaselineSnapshot.stations || [];
    const baseMaps = weeklyBaselineSnapshot.featureMaps || [];

    const liveLines = workspace.lines || [];
    const liveStations = workspace.stations || [];
    const liveMaps = workspace.featureMaps || [];

    const baselineLineMap = new Map(baseLines.map(l => [l.id, l]));
    const liveLineMap = new Map(liveLines.map(l => [l.id, l]));

    const addedLines: string[] = [];
    const removedLines: string[] = [];
    const alteredLines: string[] = [];

    liveLines.forEach(l => {
      const base = baselineLineMap.get(l.id);
      if (!base) {
        addedLines.push(l.name);
      } else if (base.name !== l.name || base.stationIds.length !== l.stationIds.length) {
        alteredLines.push(`${l.name} (${base.stationIds.length} ➜ ${l.stationIds.length} milestones)`);
      }
    });

    baseLines.forEach(l => {
      if (!liveLineMap.has(l.id)) {
        removedLines.push(l.name);
      }
    });

    const baselineStationMap = new Map(baseStations.map(s => [s.id, s]));
    const completedThisWeek: string[] = [];
    const addedMilestones: string[] = [];

    liveStations.forEach(s => {
      const base = baselineStationMap.get(s.id);
      if (!base) {
        addedMilestones.push(s.title);
        if (s.status === 'Completed') {
          completedThisWeek.push(s.title);
        }
      } else {
        if (base.status !== 'Completed' && s.status === 'Completed') {
          completedThisWeek.push(s.title);
        }
      }
    });

    const getComplexitySum = (maps: typeof liveMaps) => {
      return maps.flatMap(fm => fm.cards || []).reduce((acc, c) => acc + (c.complexityScore || 0), 0);
    };

    const getCompletedComplexitySum = (maps: typeof liveMaps) => {
      return maps.flatMap(fm => fm.cards || []).filter(c => c.status === 'Completed').reduce((acc, c) => acc + (c.complexityScore || 0), 0);
    };

    const baseTotalComplexity = getComplexitySum(baseMaps);
    const baseCompletedComplexity = getCompletedComplexitySum(baseMaps);

    const liveTotalComplexity = getComplexitySum(liveMaps);
    const liveCompletedComplexity = getCompletedComplexitySum(liveMaps);

    const complexityDifference = liveCompletedComplexity - baseCompletedComplexity;
    
    const baseCardsCount = baseMaps.flatMap(fm => fm.cards || []).length;
    const liveCardsCount = liveMaps.flatMap(fm => fm.cards || []).length;
    
    const completedCardsThisWeek = liveMaps.flatMap(fm => fm.cards || []).filter(c => {
      const baseCard = baseMaps.flatMap(fm => fm.cards || []).find(bc => bc.id === c.id);
      return c.status === 'Completed' && (!baseCard || baseCard.status !== 'Completed');
    }).length;

    return {
      addedLines,
      removedLines,
      alteredLines,
      completedThisWeek,
      addedMilestones,
      baseTotalComplexity,
      baseCompletedComplexity,
      liveTotalComplexity,
      liveCompletedComplexity,
      complexityDifference,
      baseCardsCount,
      liveCardsCount,
      completedCardsThisWeek
    };
  }, [weeklyBaselineSnapshot, workspace]);

  return (
    <div className="flex-1 bg-[#faf8f6]/30 dark:bg-slate-950/30 overflow-y-auto px-6 py-8 md:px-12 font-sans">
      
      {/* Navigation Headers */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors mb-2"
          >
            ← Back to Board
          </button>
          <h2 className="text-3xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
            <Camera className="w-8 h-8 text-indigo-600" />
            Workspace Snapshots & Reporting
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1">
            Capture named configuration backups, compare project developments, and configure weekly summary reports
          </p>
        </div>
      </div>

      {/* Tabs list navigation switches */}
      <div className="max-w-7xl mx-auto mb-8 flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'compare'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold'
          }`}
          id="tab-snap-compare"
        >
          <RotateCcw className="w-4 h-4" />
          History & Side-by-Side compare
        </button>
        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'weekly'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold'
          }`}
          id="tab-snap-weekly"
        >
          <Mail className="w-4 h-4" />
          Weekly Progress Email Dispatcher
        </button>
      </div>

      {activeTab === 'compare' ? (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COMPONENT: Snapshot List & Creation Form */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Form to Capture Snapshot */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Save className="w-4 h-4" /></span>
              Capture Current State
            </h3>
            
            <form onSubmit={handleCapture} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                  Snapshot Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Pre-Sprint 3 Planning, Initial MVP" 
                  value={newSnapName}
                  onChange={(e) => setNewSnapName(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-2xl py-2.5 px-4 text-xs font-semibold tracking-tight transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                  Description / Context Notes
                </label>
                <textarea 
                  rows={2}
                  placeholder="Summarize key alterations or goals captured in this baseline..."
                  value={newSnapDesc}
                  onChange={(e) => setNewSnapDesc(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-2xl py-2.5 px-4 text-xs font-semibold tracking-tight transition-all outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider py-3 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 mt-2"
              >
                <Camera className="w-4 h-4" />
                Baseline Workspace State
              </button>
            </form>
          </div>

          {/* Historical Saved Snapshots List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex-1 min-h-[300px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Clock className="w-4 h-4" /></span>
                History Backups
              </h3>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full uppercase">
                {savedSnapshots.length} Saved
              </span>
            </div>

            {savedSnapshots.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-400 text-xs font-medium italic">
                  No baseline snapshots saved yet.<br />
                  Capture one to keep named versions of your visual roadmap elements safe.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[450px] pr-1">
                {savedSnapshots.map((snap) => (
                  <div 
                    key={snap.id}
                    className="p-4 rounded-2xl border border-slate-100 hover:border-indigo-150 bg-slate-50/50 hover:bg-white transition-all flex flex-col gap-2 relative group"
                  >
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-800 leading-tight">
                        {snap.name}
                      </h4>
                      {snap.description && (
                        <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                          {snap.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[9px] font-mono font-bold text-slate-400 border-t border-slate-100/80 pt-2">
                      <span>Tracks: {snap.lines?.length || 0}</span>
                      <span>•</span>
                      <span>Stations: {snap.stations?.length || 0}</span>
                      <span>•</span>
                      <span>Cards: {snap.featureMaps?.reduce((sum, fm) => sum + (fm.cards?.length || 0), 0) || 0}</span>
                    </div>

                    <div className="text-[9px] font-semibold text-slate-300">
                      {formatDateTime(snap.timestamp)}
                    </div>

                    {/* Action buttons (Absolute triggers appearing on group hover) */}
                    <div className="flex items-center gap-1.5 self-end mt-2">
                      {confirmRestoreId === snap.id ? (
                        <div className="flex items-center gap-1 bg-amber-50 rounded-xl p-1 border border-amber-100">
                          <span className="text-[8px] font-black uppercase text-amber-700 px-1.5">Rollback?</span>
                          <button 
                            onClick={() => handleRestore(snap.id)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black uppercase px-2 py-1 rounded-lg"
                          >
                            Yes
                          </button>
                          <button 
                            onClick={() => setConfirmRestoreId(null)}
                            className="bg-slate-200 text-slate-700 text-[9px] font-medium uppercase px-2 py-1 rounded-lg"
                          >
                            No
                          </button>
                        </div>
                      ) : confirmDeleteId === snap.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 rounded-xl p-1 border border-rose-100">
                          <span className="text-[8px] font-black uppercase text-rose-700 px-1.5">Delete?</span>
                          <button 
                            onClick={() => handleDelete(snap.id)}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase px-2 py-1 rounded-lg"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-slate-200 text-slate-700 text-[9px] font-medium uppercase px-2 py-1 rounded-lg"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setConfirmRestoreId(snap.id)}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black uppercase tracking-tight text-[9px] flex items-center gap-1 transition-colors"
                            title="Restore active map to this snapshot state"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Rollback
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(snap.id)}
                            className="p-1 px-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                            title="Discard snapshot permanent"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COMPONENT (COL-SPAN-2): Comparison Side-by-Side Playground */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><ArrowRightLeft className="w-4 h-4" /></span>
              Compare baselines side-by-side
            </h3>

            {/* Selector Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black uppercase text-slate-400 block ml-1">Left Base</span>
                <select 
                  value={compareLeftId}
                  onChange={(e) => setCompareLeftId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3.5 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="live">🟢 Live Active Workspace</option>
                  {savedSnapshots.map(s => (
                    <option key={s.id} value={s.id}>💾 Snapshot: {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="text-slate-300 font-bold self-end py-2">vs</div>

              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black uppercase text-slate-400 block ml-1">Right Target</span>
                <select 
                  value={compareRightId}
                  onChange={(e) => setCompareRightId(e.target.value)}
                  disabled={savedSnapshots.length === 0}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3.5 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                >
                  {savedSnapshots.length === 0 ? (
                    <option value="">No snapshots saved</option>
                  ) : (
                    savedSnapshots.map(s => (
                      <option key={s.id} value={s.id}>💾 Snapshot: {s.name}</option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {(!leftConfig || !rightConfig) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <HelpCircle className="w-12 h-12 text-slate-200 mb-2" />
              <h4 className="font-bold text-slate-500 text-sm">Select Snapshots to Compare</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                You must have at least one saved baseline snapshot to test configurations. Build one in the left panel!
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-8">
              
              {/* Snapshot Info Panels Side by Side */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100/80 pb-6">
                
                {/* Column Left Baseline info */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded self-start uppercase tracking-widest mb-1.5">
                    {compareLeftId === 'live' ? 'ACTIVE STATE' : 'HISTORICAL SNAPSHOT'}
                  </span>
                  <h4 className="font-extrabold text-xs text-slate-800 truncate">{leftConfig.name}</h4>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-2">
                    {leftConfig.description}
                  </p>
                  <span className="text-[8px] font-mono text-slate-400 mt-2 font-bold uppercase block">
                    Saved: {formatDateTime(leftConfig.timestamp)}
                  </span>
                </div>

                {/* Column Right Baseline info */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded self-start uppercase tracking-widest mb-1.5">
                    HISTORICAL SNAPSHOT
                  </span>
                  <h4 className="font-extrabold text-xs text-slate-800 truncate">{rightConfig.name}</h4>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-2">
                    {rightConfig.description}
                  </p>
                  <span className="text-[8px] font-mono text-slate-400 mt-2 font-bold uppercase block">
                    Saved: {formatDateTime(rightConfig.timestamp)}
                  </span>
                </div>

              </div>

              {/* STATS COUNT GRID DIGEST */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                  Metrics Breakdown & Core Volumes
                </h4>
                
                <div className="grid grid-cols-4 gap-4">
                  {/* Track count compare */}
                  <div className="bg-slate-50/20 border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400">Track Lines</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="font-black text-slate-800 text-sm">{leftConfig.lines.length}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="font-black text-indigo-600 text-sm">{rightConfig.lines.length}</span>
                    </div>
                  </div>

                  {/* Stations compare */}
                  <div className="bg-slate-50/20 border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400">Milestones</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="font-black text-slate-800 text-sm">{leftConfig.stations.length}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="font-black text-indigo-600 text-sm">{rightConfig.stations.length}</span>
                    </div>
                  </div>

                  {/* Stories compare */}
                  <div className="bg-slate-50/20 border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400">Backlog Cards</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="font-black text-slate-800 text-sm">
                        {leftConfig.featureMaps.reduce((s, fm) => s + (fm.cards?.length || 0), 0)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="font-black text-indigo-600 text-sm">
                        {rightConfig.featureMaps.reduce((s, fm) => s + (fm.cards?.length || 0), 0)}
                      </span>
                    </div>
                  </div>

                  {/* Dependencies rules count compare */}
                  <div className="bg-slate-50/20 border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400">Dependencies</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="font-black text-slate-800 text-sm">{leftConfig.dependencies.length}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="font-black text-indigo-600 text-sm">{rightConfig.dependencies.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DETAILED COMPARATIVE LOG DIFFERENTIALS */}
              {diffAnalysis && (
                <div className="flex-1 flex flex-col gap-6">
                  
                  {diffAnalysis.areIdentical ? (
                    <div className="flex items-center justify-center gap-2 bg-slate-50 rounded-2xl p-4 border border-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      Both baselines represent identical map configuration elements.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6 overflow-y-auto max-h-[380px] p-0.5">
                      
                      {/* Lines comparison breakdown */}
                      {(diffAnalysis.linesAdded.length > 0 || diffAnalysis.linesRemoved.length > 0 || diffAnalysis.linesModified.length > 0) && (
                        <div>
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            Track Lines Comparative
                          </div>

                          <div className="bg-slate-50/55 rounded-2xl border border-slate-100 p-4 flex flex-col gap-2 text-xs">
                            {diffAnalysis.linesAdded.map(name => (
                              <div key={name} className="flex items-center gap-1.5 text-slate-800 font-extrabold">
                                <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">+ Added</span>
                                <span className="truncate">Track Line "{name}" is present on Right baseline but not Left</span>
                              </div>
                            ))}
                            {diffAnalysis.linesRemoved.map(name => (
                              <div key={name} className="flex items-center gap-1.5 text-slate-500 font-bold">
                                <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded shrink-0">- Removed</span>
                                <span className="truncate font-medium">Track Line "{name}" present on Left baseline but omitted on Right</span>
                              </div>
                            ))}
                            {diffAnalysis.linesModified.map(({ name, changes }) => (
                              <div key={name} className="flex flex-col gap-1 bg-slate-100/50 p-2.5 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-1.5 font-black text-slate-800">
                                  <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">❖ Altered</span>
                                  Track Line "{name}" Config edited
                                </div>
                                <div className="ml-16 font-mono text-[9px] text-slate-400 flex flex-col gap-0.5">
                                  {changes.map((c, idx) => <span key={idx}>• {c}</span>)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Station / Milestone comparison breakdown */}
                      {(diffAnalysis.stationsAdded.length > 0 || diffAnalysis.stationsRemoved.length > 0 || diffAnalysis.stationsModified.length > 0) && (
                        <div>
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Milestones & Stations Comparative
                          </div>

                          <div className="bg-slate-50/55 rounded-2xl border border-slate-100 p-4 flex flex-col gap-2 text-xs">
                            {diffAnalysis.stationsAdded.map(title => (
                              <div key={title} className="flex items-center gap-1.5 text-slate-800 font-extrabold">
                                <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">+ Added</span>
                                <span className="truncate">Milestone "{title}" was introduced</span>
                              </div>
                            ))}
                            {diffAnalysis.stationsRemoved.map(title => (
                              <div key={title} className="flex items-center gap-1.5 text-slate-500 font-bold">
                                <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded shrink-0">- Removed</span>
                                <span className="truncate font-medium">Milestone "{title}" was deleted</span>
                              </div>
                            ))}
                            {diffAnalysis.stationsModified.map(({ title, changes }) => (
                              <div key={title} className="flex flex-col gap-1 bg-slate-100/50 p-2.5 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-1.5 font-black text-slate-800">
                                  <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">❖ Edited</span>
                                  Milestone "{title}" details altered
                                </div>
                                <div className="ml-16 font-mono text-[9px] text-slate-400 flex flex-col gap-0.5">
                                  {changes.map((c, idx) => <span key={idx}>• {c}</span>)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Story Card status comparative counts */}
                      <div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Story Work Status Profiles compare
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Left breakdown */}
                          <div className="p-3 border border-slate-100 rounded-2xl bg-slate-50/35">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-2">{leftConfig.name} Log</span>
                            <div className="flex flex-col gap-1 text-[10px] font-bold">
                              <div className="flex items-center justify-between text-slate-600">
                                <span>Planned/Todo:</span> <span>{diffAnalysis.leftCardStats.todo}</span>
                              </div>
                              <div className="flex items-center justify-between text-indigo-600">
                                <span>Doing / In Progress:</span> <span>{diffAnalysis.leftCardStats.progress}</span>
                              </div>
                              <div className="flex items-center justify-between text-orange-600">
                                <span>Blocked items:</span> <span>{diffAnalysis.leftCardStats.blocked}</span>
                              </div>
                              <div className="flex items-center justify-between text-emerald-600 border-t border-slate-100 pt-1 mt-1">
                                <span>Delivered / Done:</span> <span>{diffAnalysis.leftCardStats.done}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right breakdown */}
                          <div className="p-3 border border-slate-100 rounded-2xl bg-slate-50/35">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-2">{rightConfig.name} Log</span>
                            <div className="flex flex-col gap-1 text-[10px] font-bold">
                              <div className="flex items-center justify-between text-slate-600">
                                <span>Planned/Todo:</span> <span>{diffAnalysis.rightCardStats.todo}</span>
                              </div>
                              <div className="flex items-center justify-between text-indigo-600">
                                <span>Doing / In Progress:</span> <span>{diffAnalysis.rightCardStats.progress}</span>
                              </div>
                              <div className="flex items-center justify-between text-orange-600">
                                <span>Blocked items:</span> <span>{diffAnalysis.rightCardStats.blocked}</span>
                              </div>
                              <div className="flex items-center justify-between text-emerald-600 border-t border-slate-100 pt-1 mt-1">
                                <span>Delivered / Done:</span> <span>{diffAnalysis.rightCardStats.done}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </div>
      ) : (
        <WeeklyProgressReport 
          workspace={workspace}
          createSnapshot={createSnapshot}
          showToast={showToast}
        />
      )}

    </div>
  );
};
