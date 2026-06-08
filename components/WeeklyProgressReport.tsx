import React, { useState, useMemo, useEffect } from 'react';
import { Workspace, ID, WorkspaceSnapshot, Line, Station, Dependency, FeatureMap } from '../types';
import { 
  Mail, 
  Send, 
  Settings, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Plus, 
  FileCheck 
} from 'lucide-react';

interface WeeklyProgressReportProps {
  workspace: Workspace;
  createSnapshot: (name: string, description?: string, customTimestamp?: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const WeeklyProgressReport: React.FC<WeeklyProgressReportProps> = ({
  workspace,
  createSnapshot,
  showToast
}) => {
  const [autoEmailEnabled, setAutoEmailEnabled] = useState<boolean>(() => {
    return localStorage.getItem('metro_presence_auto_email_enabled') === 'true';
  });
  const [recipientEmails, setRecipientEmails] = useState<string>(() => {
    return localStorage.getItem('metro_presence_recipient_emails') || 'diego.avella@gmail.com, engineering-team@metromap-workspace.com';
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
  useEffect(() => {
    localStorage.setItem('metro_presence_auto_email_enabled', String(autoEmailEnabled));
  }, [autoEmailEnabled]);

  useEffect(() => {
    localStorage.setItem('metro_presence_recipient_emails', recipientEmails);
  }, [recipientEmails]);

  useEffect(() => {
    localStorage.setItem('metro_presence_schedule_day', scheduleDay);
  }, [scheduleDay]);

  useEffect(() => {
    localStorage.setItem('metro_presence_schedule_hour', scheduleHour);
  }, [scheduleHour]);

  // Retrieve snapshots safely
  const savedSnapshots = workspace.snapshots || [];

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

    // 1. Omit last milestone on last line to simulate track line expansion
    if (baseLines.length > 0) {
      const targetLine = baseLines[baseLines.length - 1];
      if (targetLine.stationIds.length > 1) {
        targetLine.stationIds.pop();
      }
    }

    // 2. Rollback a few completed stations to Planning to simulate active milestone completion
    let modifiedCount = 0;
    baseStations.forEach(st => {
      if (st.status === 'Completed' && modifiedCount < 2) {
        st.status = 'Planning';
        modifiedCount++;
      }
    });

    // 3. Rollback completed feature cards to In Progress to simulate Sprint story delivery
    baseFeatureMaps.forEach(fm => {
      if (fm.cards) {
        fm.cards.forEach(card => {
          if (card.status === 'Completed' || card.status === 'Done') {
            card.status = 'In Progress';
          }
        });
      }
    });

    const sevenDaysAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    createSnapshot(
      "Weekly Baseline Progress (Simulated)", 
      "Automatically simulated baseline snapshot containing older milestone layouts & card progress distributions for 7 days ago.",
      sevenDaysAgoISO
    );
    showToast("Simulated baseline snapshot from 1 week ago successfully created!", "success");
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
    
    // Total story cards count
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
      completedCardsThisWeek
    };
  }, [weeklyBaselineSnapshot, workspace]);

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' at ' + date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* LHS Config Column */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        
        {/* Settings block */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-2" id="report-dispatcher-settings">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Settings className="w-4 h-4" />
            </span>
            Dispatcher Settings
          </h3>

          {/* Toggle schedule */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-sans">Automation Status</span>
            <button
              onClick={() => setAutoEmailEnabled(prev => !prev)}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-center transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                autoEmailEnabled 
                  ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/60' 
                  : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-400'
              }`}
              id="report-schedule-toggle"
            >
              <span className={`w-2 h-2 rounded-full inline-block ${autoEmailEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {autoEmailEnabled ? 'ON - Weekly Auto Active' : 'OFF - Manual Only'}
            </button>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-relaxed mt-2 font-semibold">
              If enabled, weekly status digest summaries comparisons are calculated and pushed automatically.
            </p>
          </div>

          {/* Recipients List input */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 font-sans">Target Recipients</label>
            <div className="relative">
              <input 
                type="text" 
                value={recipientEmails}
                onChange={(e) => setRecipientEmails(e.target.value)}
                placeholder="e.g. leads@company.com, engineers@company.com"
                className="w-full bg-slate-50 dark:bg-slate-850 hover:bg-slate-100/50 focus:bg-white border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-xl py-2.5 px-4 pl-9 text-xs font-semibold tracking-tight transition-all outline-none text-slate-755 dark:text-slate-200"
              />
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Delivery trigger details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 font-sans">Schedule Day</label>
              <select
                value={scheduleDay}
                onChange={(e) => setScheduleDay(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-705 p-2 rounded-xl text-xs font-extrabold text-slate-202 dark:text-slate-200 cursor-pointer"
              >
                <option>Monday</option>
                <option>Tuesday</option>
                <option>Wednesday</option>
                <option>Thursday</option>
                <option>Friday</option>
                <option>Saturday</option>
                <option>Sunday</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 font-sans">Scheduled Hour</label>
              <select
                value={scheduleHour}
                onChange={(e) => setScheduleHour(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-705 p-2 rounded-xl text-xs font-extrabold text-slate-202 dark:text-slate-200 cursor-pointer"
              >
                <option value="08:00">08:00 AM</option>
                <option value="09:00">09:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="17:00">05:00 PM</option>
              </select>
            </div>
          </div>

        </div>

        {/* 7-Day Baseline Connection Monitor */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2" id="report-baseline-monitor">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-4 h-4" />
            </span>
            History Baseline Connect
          </h3>

          {weeklyBaselineSnapshot ? (
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/60 rounded-2xl flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400">Baseline Connected</h4>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-relaxed">
                    Analyzing work changes relative to baseline <strong>"{weeklyBaselineSnapshot.name}"</strong> captured {formatDateTime(weeklyBaselineSnapshot.timestamp)}.
                  </p>
                </div>
              </div>
              
              <div className="text-[9px] font-mono text-slate-400 flex flex-col gap-0.5 border-t border-slate-100 dark:border-slate-800 pt-2 pl-1">
                <span>• Baseline Snapshot ID: {weeklyBaselineSnapshot.id}</span>
                <span>• Track Lines Count: {weeklyBaselineSnapshot.lines?.length || 0}</span>
                <span>• Total Milestones: {weeklyBaselineSnapshot.stations?.length || 0}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-amber-50/55 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/40 rounded-2xl flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-805 dark:text-slate-200">Baseline Omitted</h4>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-relaxed">
                    The reporting engine models comparative updates relative to a snapshot made ~7 days ago. No baseline from last week is present in snapshots history.
                  </p>
                </div>
              </div>

              <button
                onClick={generateMockWeeklyBaseline}
                className="w-full bg-slate-950 hover:bg-slate-900 text-white text-xs font-black uppercase tracking-wider py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                id="report-seed-button"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                Seed Past 7-Day Snapshot
              </button>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-relaxed text-center italic font-semibold">
                Constructs a custom historical backup with minor layout alterations so you can experience dynamic weekly progress updates immediately.
              </p>
            </div>
          )}
        </div>

        {/* Manual Direct dispatch trigger */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2" id="report-manual-run">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Send className="w-4 h-4" />
            </span>
            Simulated Mail Trigger
          </h3>
          
          <button
            disabled={isDispatching || !weeklyBaselineSnapshot}
            onClick={handleManualDispatch}
            className={`w-full text-white text-xs font-black uppercase tracking-wider py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
              !weeklyBaselineSnapshot 
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-405 cursor-not-allowed shadow-none' 
                : isDispatching 
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-100 dark:shadow-none'
            }`}
            id="report-send-now"
          >
            <Send className="w-3.5 h-3.5" />
            {isDispatching ? 'Transmitting digest...' : 'Dispatch Automated Email Now'}
          </button>

          {lastDispatchedTime && (
            <div className="mt-2 text-center text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center justify-center gap-1 animate-bounce">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline shrink-0" />
              Successfully Transmitted: {lastDispatchedTime}
            </div>
          )}
        </div>

      </div>

      {/* RHS Inbox Visualizer Column */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        
        {!weeklyBaselineSnapshot ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 border border-slate-100 dark:border-slate-804 shadow-sm flex flex-col items-center justify-center text-center">
            <Mail className="w-16 h-16 text-slate-200 dark:text-slate-755 mb-4 animate-pulse" />
            <h4 className="font-extrabold text-slate-750 dark:text-slate-300 uppercase tracking-wider text-sm font-sans">Automated Progress Live Preview</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed font-semibold">
              A historical baseline is needed to generate diff analytics. Please use the button on the left to seed backdated progress states.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* Visual mail client frame */}
            <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-950 overflow-hidden text-slate-100">
              
              {/* Client header controls */}
              <div className="bg-slate-950 px-5 py-3.5 border-b border-slate-900 flex items-center justify-between select-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400 block shrink-0" />
                  <span className="w-3 h-3 rounded-full bg-amber-400 block shrink-0" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400 block shrink-0" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest font-mono">Workspace Mail Client Sandbox</span>
                <span className="text-[9px] font-black text-indigo-400 bg-indigo-950/80 border border-indigo-900/60 px-2 py-0.5 rounded-full uppercase">
                  Ready to send
                </span>
              </div>

              {/* Message Addresses */}
              <div className="bg-slate-950/40 p-5 border-b border-slate-950 flex flex-col gap-2.5 font-sans">
                <div className="flex items-center text-xs text-slate-400 font-bold">
                  <span className="w-16">From:</span>
                  <span className="text-indigo-300 truncate">alerts@metroarchitecture-scheduler.io</span>
                </div>
                <div className="flex items-center text-xs text-slate-400 font-bold">
                  <span className="w-16">To:</span>
                  <span className="text-slate-200 truncate">{recipientEmails}</span>
                </div>
                <div className="flex items-center text-xs text-slate-400 font-bold">
                  <span className="w-16">Subject:</span>
                  <span className="text-slate-105 font-extrabold truncate flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    [Weekly Summary Report] Roadmap Velocity Tracker - {workspace.name}
                  </span>
                </div>
                {autoEmailEnabled && (
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-950/60 p-2 rounded-lg border border-slate-850 mt-1 flex items-center justify-between">
                    <span>⚡ Automated scheduling active</span>
                    <span className="text-indigo-400">Triggering Weekly on {scheduleDay}s at {scheduleHour}</span>
                  </div>
                )}
              </div>

              {/* Mail HTML preview paper sheet */}
              <div className="bg-white p-6 md:p-8 select-text text-slate-800 font-sans flex flex-col gap-6 max-h-[580px] overflow-y-auto">
                
                {/* Header Banner */}
                <div className="border-b-4 border-indigo-600 pb-5 text-center">
                  <span className="text-[9px] font-black tracking-widest text-indigo-600 uppercase">WEEKLY PROGRESS REPORT</span>
                  <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight mt-1 truncate">
                    {workspace.name}
                  </h1>
                  <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase mt-1">
                    Compiled dynamically against baseline backup of {formatDateTime(weeklyBaselineSnapshot.timestamp)}
                  </p>
                </div>

                {/* KPI metrics row */}
                <div className="grid grid-cols-3 gap-4">
                  
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-center">
                    <span className="text-[8px] font-black text-indigo-500 block uppercase tracking-wide">Velocity Unlocked</span>
                    <span className="text-2xl font-black text-indigo-700 block mt-1">
                      +{digestDiff?.complexityDifference || 0} SP
                    </span>
                    <span className="text-[8px] text-indigo-400 font-bold block mt-0.5">Effort Score Delivered</span>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                    <span className="text-[8px] font-black text-emerald-500 block uppercase tracking-wide">Deliverables Done</span>
                    <span className="text-2xl font-black text-emerald-700 block mt-1">
                      {digestDiff?.completedCardsThisWeek || 0} items
                    </span>
                    <span className="text-[8px] text-emerald-400 font-bold block mt-0.5">Backlog stories promoting</span>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-center font-sans">
                    <span className="text-[8px] font-black text-amber-500 block uppercase tracking-wide">Nodes Achieved</span>
                    <span className="text-2xl font-black text-amber-700 block mt-1 leading-none pt-0.5">
                      {digestDiff?.completedThisWeek.length || 0}
                    </span>
                    <span className="text-[8px] text-amber-400 font-bold block mt-1 font-sans">Milestones Completed</span>
                  </div>

                </div>

                {/* Progress load visualization widget */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Story Points Deliverance Capacity</span>
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase leading-none">
                      {digestDiff ? `${Math.round(digestDiff.liveTotalComplexity > 0 ? (digestDiff.liveCompletedComplexity / digestDiff.liveTotalComplexity) * 100 : 0)}% Completed` : '0%'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 leading-none">
                    <span>Baseline SP Completed: {digestDiff?.baseCompletedComplexity} / {digestDiff?.baseTotalComplexity} SP</span>
                    <span>Live SP Completed: {digestDiff?.liveCompletedComplexity} / {digestDiff?.liveTotalComplexity} SP</span>
                  </div>

                  <div className="w-full bg-slate-205 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${digestDiff ? (digestDiff.liveTotalComplexity > 0 ? (digestDiff.liveCompletedComplexity / digestDiff.liveTotalComplexity) * 100 : 0) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Lines progress display list */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                    Track Lines Mod Log
                  </h4>
                  {digestDiff && (digestDiff.addedLines.length > 0 || digestDiff.alteredLines.length > 0 || digestDiff.removedLines.length > 0) ? (
                    <div className="flex flex-col gap-2.5 font-sans">
                      {digestDiff.addedLines.map(line => (
                        <div key={line} className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <span className="bg-emerald-100 text-emerald-850 text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-sans shrink-0">+ Added</span>
                          <span>Line track introduced to baseline map: "<strong>{line}</strong>"</span>
                        </div>
                      ))}
                      {digestDiff.alteredLines.map(line => (
                        <div key={line} className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <span className="bg-indigo-100 text-indigo-850 text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-sans shrink-0">❖ Altered</span>
                          <span>Track line stations link modified: "<strong>{line}</strong>"</span>
                        </div>
                      ))}
                      {digestDiff.removedLines.map(line => (
                        <div key={line} className="text-xs font-bold text-slate-505 flex items-center gap-2">
                          <span className="bg-rose-100 text-rose-850 text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-sans shrink-0">- Removed</span>
                          <span>Track line model discarded: "<strong>{line}</strong>"</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-semibold italic">Track layout elements remained fully balanced through the week.</p>
                  )}
                </div>

                {/* Stations Completed log */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 font-sans">
                    Node Deliveries & Status Updates
                  </h4>
                  {digestDiff && (digestDiff.completedThisWeek.length > 0 || digestDiff.addedMilestones.length > 0) ? (
                    <div className="flex flex-col gap-2.5 font-sans font-medium text-xs">
                      {digestDiff.completedThisWeek.map(title => (
                        <div key={title} className="text-slate-800 flex items-center gap-2 font-bold">
                          <span className="bg-emerald-100 text-emerald-850 text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">✔ Completed</span>
                          <span>Milestone station moved to complete state: "<strong>{title}</strong>"</span>
                        </div>
                      ))}
                      {digestDiff.addedMilestones.filter(x => !digestDiff.completedThisWeek.includes(x)).map(title => (
                        <div key={title} className="text-slate-800 flex items-center gap-2 font-bold">
                          <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">+ introduced</span>
                          <span>Added new planning node: "<strong>{title}</strong>"</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-semibold italic">No node completions or plan changes logged this week yet.</p>
                  )}
                </div>

                {/* Footer disclaimer */}
                <div className="border-t border-slate-100 pt-4 text-center text-[9px] text-slate-400 font-bold leading-normal uppercase">
                  You are receiving this snapshot report automatically because your target email is registered as an auditor of the MetroMap configuration workspace.
                </div>

              </div>

            </div>

            {/* Markdown Report Copy Action bar */}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => {
                  if (!digestDiff) return;
                  const mdStr = `
# Roadmap Weekly Progress Report: ${workspace.name}
Baselined: ${weeklyBaselineSnapshot?.name}

## Target Auditor:
- **Receivers**: ${recipientEmails}
- **Scheduler**: Every ${scheduleDay} at ${scheduleHour}

## Effort Metrics:
- **Velocity Score Added**: +${digestDiff.complexityDifference} SP
- **Stories Delivered**: ${digestDiff.completedCardsThisWeek} items promoted
- **Milestones Complete**: ${digestDiff.completedThisWeek.length} nodes unlocked

## Track Layout Changes:
${digestDiff.addedLines.length > 0 ? digestDiff.addedLines.map(x => `- Introduced track line: ${x}`).join('\n') : '- No track additions.'}
${digestDiff.alteredLines.length > 0 ? digestDiff.alteredLines.map(x => `- Altered track mapping: ${x}`).join('\n') : '- No track alterations.'}

## Milestone Status Adjustments:
${digestDiff.completedThisWeek.length > 0 ? digestDiff.completedThisWeek.map(x => `- Promoted station to Completed: ${x}`).join('\n') : '- No completions.'}
                  `.trim();
                  navigator.clipboard.writeText(mdStr);
                  showToast("Markdown digest summary copied to Clipboard!", "success");
                }}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-250 text-[10px] text-slate-600 font-black uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                id="report-copy-markdown"
              >
                <FileCheck className="w-3.5 h-3.5 text-indigo-505" />
                Copy Markdown Summary Text
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
