import React, { useState, useMemo } from 'react';
import { Workspace, ID, Line, Card, CardType, Station } from '../types';
import { VelocityReport } from './VelocityReport';

interface ReportProps {
  workspace: Workspace;
  onOpenFeatureMap?: (lineId: ID) => void;
  createSnapshot: (name: string, description?: string, customTimestamp?: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const Report: React.FC<ReportProps> = ({ 
  workspace, 
  onOpenFeatureMap,
  createSnapshot,
  showToast
}) => {
  const [reportTab, setReportTab] = useState<'funnel' | 'velocity'>('funnel');
  const [selectedLineId, setSelectedLineId] = useState<ID | 'all'>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | CardType>('all');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string | 'all'>('all');

  // 1. Gather all cards across all feature maps
  const allCardsAndLines = useMemo(() => {
    return workspace.featureMaps.flatMap(fm => {
      const line = workspace.lines.find(l => l.id === fm.lineId);
      return fm.cards.map(c => ({
        ...c,
        lineId: fm.lineId,
        lineName: line?.name || 'Unknown Track',
        lineColor: line?.color || '#3b82f6'
      }));
    });
  }, [workspace]);

  // 2. Extract unique owners/assignees in the workspace
  const allOwners = useMemo(() => {
    const list = new Set<string>();
    allCardsAndLines.forEach(c => {
      if (c.owner && c.owner.trim()) {
        list.add(c.owner.trim());
      }
    });
    workspace.stations.forEach(s => {
      if (s.owner && s.owner.trim()) {
        list.add(s.owner.trim());
      }
    });
    return Array.from(list).sort();
  }, [allCardsAndLines, workspace.stations]);

  // 3. Compute detailed metrics based on selections
  const reportData = useMemo(() => {
    // Filter stations/milestones
    const filteredStations = workspace.stations.filter(s => {
      if (selectedLineId === 'all') return true;
      return s.lineIds.includes(selectedLineId);
    });

    // Filter cards
    const filteredCards = allCardsAndLines.filter(c => {
      const matchesLine = selectedLineId === 'all' || c.lineId === selectedLineId;
      const matchesType = selectedTypeFilter === 'all' || c.type === selectedTypeFilter;
      const matchesOwner = selectedOwnerFilter === 'all' || c.owner === selectedOwnerFilter;
      return matchesLine && matchesType && matchesOwner;
    });

    // Break down counts by status
    const statuses = {
      todo: filteredCards.filter(c => c.status === 'Todo').length,
      planned: filteredCards.filter(c => c.status === 'Planned').length,
      inProgress: filteredCards.filter(c => c.status === 'In Progress').length,
      completed: filteredCards.filter(c => c.status === 'Completed').length,
      blocked: filteredCards.filter(c => c.status === 'Blocked').length,
    };

    const totalCards = filteredCards.length;

    // Standard Completion: ratio of Completed count to Total count
    const completionPercentage = totalCards > 0
      ? Math.round((statuses.completed / totalCards) * 100)
      : 0;

    // Weighted Completion: Completed (100%), In Progress (50%), Planned (20%), Todo (0%), Blocked (10%)
    const weightedSum = (statuses.completed * 1) + 
                        (statuses.inProgress * 0.5) + 
                        (statuses.planned * 0.2) + 
                        (statuses.blocked * 0.1) + 
                        (statuses.todo * 0);
    const weightedPercentage = totalCards > 0
      ? Math.round((weightedSum / totalCards) * 100)
      : 0;

    // Break down counts by card type (Story Level, Epic Level, etc)
    const typesCount = {
      epic: {
        total: filteredCards.filter(c => c.type === CardType.EPIC).length,
        done: filteredCards.filter(c => c.type === CardType.EPIC && c.status === 'Completed').length
      },
      feature: {
        total: filteredCards.filter(c => c.type === CardType.FEATURE).length,
        done: filteredCards.filter(c => c.type === CardType.FEATURE && c.status === 'Completed').length
      },
      story: {
        total: filteredCards.filter(c => c.type === CardType.STORY).length,
        done: filteredCards.filter(c => c.type === CardType.STORY && c.status === 'Completed').length
      }
    };

    return {
      filteredCards,
      filteredStations,
      totalCards,
      statuses,
      completionPercentage,
      weightedPercentage,
      typesCount,
    };
  }, [workspace, allCardsAndLines, selectedLineId, selectedTypeFilter, selectedOwnerFilter]);

  // 4. Calculate stats per individual Product Track (Line) to visualize in a list
  const trackProgressList = useMemo(() => {
    return workspace.lines.map(line => {
      const fmap = workspace.featureMaps.find(f => f.lineId === line.id);
      const cards = fmap ? fmap.cards : [];
      
      const total = cards.length;
      const completed = cards.filter(c => c.status === 'Completed').length;
      const inProgress = cards.filter(c => c.status === 'In Progress').length;
      const blocked = cards.filter(c => c.status === 'Blocked').length;
      const planned = cards.filter(c => c.status === 'Planned').length;
      const todo = cards.filter(c => c.status === 'Todo').length;

      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      // Breakdown by Level
      const epics = cards.filter(c => c.type === CardType.EPIC);
      const features = cards.filter(c => c.type === CardType.FEATURE);
      const stories = cards.filter(c => c.type === CardType.STORY);

      const epicPct = epics.length > 0 ? Math.round((epics.filter(c => c.status === 'Completed').length / epics.length) * 100) : 0;
      const featurePct = features.length > 0 ? Math.round((features.filter(c => c.status === 'Completed').length / features.length) * 100) : 0;
      const storyPct = stories.length > 0 ? Math.round((stories.filter(c => c.status === 'Completed').length / stories.length) * 100) : 0;

      // Milestones linked to this line
      const lineStations = workspace.stations.filter(s => s.lineIds.includes(line.id));
      const totalMilestones = lineStations.length;
      const doneMilestones = lineStations.filter(s => s.status === 'Completed').length;
      const milestonePct = totalMilestones > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : 0;

      return {
        line,
        total,
        completed,
        inProgress,
        blocked,
        planned,
        todo,
        pct,
        epicsCount: epics.length,
        epicPct,
        featuresCount: features.length,
        featurePct,
        storiesCount: stories.length,
        storyPct,
        totalMilestones,
        doneMilestones,
        milestonePct
      };
    });
  }, [workspace]);

  // 5. Workload allocation analysis by Assignee
  const assigneeMetrics = useMemo(() => {
    const list: Array<{
      name: string;
      total: number;
      completed: number;
      inProgress: number;
      blocked: number;
      pct: number;
    }> = [];

    allOwners.forEach(name => {
      const ownerCards = allCardsAndLines.filter(c => c.owner === name);
      const total = ownerCards.length;
      if (total === 0) return;

      const completed = ownerCards.filter(c => c.status === 'Completed').length;
      const inProgress = ownerCards.filter(c => c.status === 'In Progress').length;
      const blocked = ownerCards.filter(c => c.status === 'Blocked').length;
      const pct = Math.round((completed / total) * 100);

      list.push({
        name,
        total,
        completed,
        inProgress,
        blocked,
        pct
      });
    });

    return list.sort((a, b) => b.total - a.total);
  }, [allOwners, allCardsAndLines]);

  // 6. Quality Insights & Bottleneck flags
  const insights = useMemo(() => {
    const list: string[] = [];

    // Bottlenecks find: Blocked stories
    const blockedCount = allCardsAndLines.filter(c => c.status === 'Blocked').length;
    if (blockedCount > 0) {
      list.push(`Alert: There are ${blockedCount} team blockage(s) currently marked as "Blocked" across delivery boards.`);
    }

    // High Load Alert Check
    const overloaded = assigneeMetrics.find(m => (m.total - m.completed) > 6);
    if (overloaded) {
      list.push(`Risk mitigation: Assignee "${overloaded.name}" has ${overloaded.total - overloaded.completed} active (uncompleted) backlog items. Suggest balancing load.`);
    }

    // Empty milestones find
    const stationOccupancy = workspace.stations.map(st => {
      const count = allCardsAndLines.filter(c => c.sourceSegmentId === st.id).length;
      return { title: st.title, count };
    });
    const orphans = stationOccupancy.filter(o => o.count === 0);
    if (orphans.length > 0) {
      list.push(`Information: There are ${orphans.length} milestones/segments configured on the roadmap that have 0 backlog items assigned.`);
    }

    return list;
  }, [allCardsAndLines, assigneeMetrics, workspace.stations]);

  return (
    <div className="space-y-8 pb-16">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 max-w-sm">
        <button
          onClick={() => setReportTab('funnel')}
          className={`flex-1 py-1.5 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            reportTab === 'funnel'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          📊 Backlog Funnel
        </button>
        <button
          onClick={() => setReportTab('velocity')}
          className={`flex-1 py-1.5 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            reportTab === 'velocity'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          id="velocity-report-tab-btn"
        >
          📈 Velocity Report
        </button>
      </div>

      {reportTab === 'velocity' ? (
        <VelocityReport 
          workspace={workspace} 
          createSnapshot={createSnapshot} 
          showToast={showToast} 
        />
      ) : (
        <>
          {/* Search and Filters Strip */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Delivery Reports & Dashboards</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Statistical metrics compiled dynamically from active feature boards</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Target Track Select */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 ml-1">Scope Filter</span>
            <select
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="py-2.5 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 outline-none appearance-none"
            >
              <option value="all">All Product Tracks</option>
              {workspace.lines.map(line => (
                <option key={line.id} value={line.id}>{line.name}</option>
              ))}
            </select>
          </div>

          {/* Level Type Select */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 ml-1">Hierarchy Level</span>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
              className="py-2.5 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 outline-none appearance-none"
            >
              <option value="all">All Backlog Items</option>
              <option value={CardType.EPIC}>Epics Only</option>
              <option value={CardType.FEATURE}>Features Only</option>
              <option value={CardType.STORY}>User Stories Only</option>
            </select>
          </div>

          {/* Assignee Select */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 ml-1">Assignee Filter</span>
            <select
              value={selectedOwnerFilter}
              onChange={(e) => setSelectedOwnerFilter(e.target.value)}
              className="py-2.5 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 outline-none appearance-none"
            >
              <option value="all">All Owners</option>
              {allOwners.map(owner => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Hero Visual Percentage Ring & Standard Statistics layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Core Percentage Gauge Widget */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between group">
          <div>
            <span className="text-[9px] font-black px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md border text-center uppercase tracking-widest leading-loose">
              Overall Completion Rate
            </span>
            <p className="text-xs text-slate-400 font-bold uppercase mt-4">
              Real-time workspace milestone status
            </p>
          </div>

          {/* Custom SVG Radial ring */}
          <div className="my-6 flex items-center justify-center relative">
            <svg className="w-48 h-48 transform -rotate-90">
              {/* Back track */}
              <circle
                cx="96"
                cy="96"
                r="74"
                className="stroke-slate-100 fill-transparent"
                strokeWidth="14"
              />
              {/* Animated progress ring */}
              <circle
                cx="96"
                cy="96"
                r="74"
                className="stroke-indigo-600 fill-transparent transition-all duration-1000 ease-out"
                strokeWidth="14"
                strokeDasharray={2 * Math.PI * 74}
                strokeDashoffset={2 * Math.PI * 74 * (1 - reportData.completionPercentage / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-4xl font-black text-slate-800 tracking-tight">
                {reportData.completionPercentage}%
              </span>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Completed
              </p>
            </div>
          </div>

          {/* Footer of card */}
          <div className="border-t border-slate-100/60 pt-4 flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px]">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Weighted progress:
            </div>
            <span className="font-mono text-indigo-600 font-black">
              {reportData.weightedPercentage}%
            </span>
          </div>
        </div>

        {/* Dynamic Status Breakdown Statistics Grid */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between xl:col-span-2">
          <div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">Backlog Delivery Funnel</h3>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Metrics partitioned by card operational statuses</span>
          </div>

          {/* SVG representation bar chart / Grid progress layout */}
          <div className="space-y-4 my-6">
            
            {/* COMPLETED */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-extrabold text-slate-700 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Completed / Delivered
                </span>
                <span className="font-mono text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  <span className="text-slate-800 font-extrabold">{reportData.statuses.completed}</span> / {reportData.totalCards} item(s)
                </span>
              </div>
              <div className="h-3 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700" 
                  style={{ width: `${reportData.totalCards > 0 ? (reportData.statuses.completed / reportData.totalCards) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* IN PROGRESS */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-extrabold text-slate-700 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  In Progress
                </span>
                <span className="font-mono text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  <span className="text-slate-800 font-extrabold">{reportData.statuses.inProgress}</span> / {reportData.totalCards} item(s)
                </span>
              </div>
              <div className="h-3 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-700" 
                  style={{ width: `${reportData.totalCards > 0 ? (reportData.statuses.inProgress / reportData.totalCards) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* PLANNED */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-extrabold text-slate-700 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  Planned
                </span>
                <span className="font-mono text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  <span className="text-slate-800 font-extrabold">{reportData.statuses.planned}</span> / {reportData.totalCards} item(s)
                </span>
              </div>
              <div className="h-3 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all duration-700" 
                  style={{ width: `${reportData.totalCards > 0 ? (reportData.statuses.planned / reportData.totalCards) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* BLOCKED */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-extrabold text-slate-700 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Blocked / Risk Issues
                </span>
                <span className="font-mono text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  <span className="text-slate-800 font-extrabold text-red-600">{reportData.statuses.blocked}</span> / {reportData.totalCards} item(s)
                </span>
              </div>
              <div className="h-3 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full transition-all duration-700" 
                  style={{ width: `${reportData.totalCards > 0 ? (reportData.statuses.blocked / reportData.totalCards) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* TODO */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-extrabold text-slate-700 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  Unstarted (Todo)
                </span>
                <span className="font-mono text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  <span className="text-slate-800 font-extrabold">{reportData.statuses.todo}</span> / {reportData.totalCards} item(s)
                </span>
              </div>
              <div className="h-3 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-400 rounded-full transition-all duration-700" 
                  style={{ width: `${reportData.totalCards > 0 ? (reportData.statuses.todo / reportData.totalCards) * 100 : 0}%` }}
                />
              </div>
            </div>

          </div>

          <div className="border-t border-slate-100/60 pt-4 flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Filtered Backlog Items Count: {reportData.totalCards}</span>
            <span>Unfinished active: {reportData.totalCards - reportData.statuses.completed}</span>
          </div>

        </div>

      </div>

      {/* Track by Track breakdown section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4">Detailed track progress and cascades</h3>
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-6">Metrics partitioned by specific physical track boundaries and hierarchy levels</span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trackProgressList.map(({ line, total, completed, inProgress, blocked, planned, todo, pct, epicsCount, epicPct, featuresCount, featurePct, storiesCount, storyPct, totalMilestones, doneMilestones, milestonePct }) => (
            <div 
              key={line.id} 
              className="p-5 border border-slate-100 rounded-2xl bg-slate-50/20 hover:bg-slate-50/50 transition-all flex flex-col justify-between gap-4"
            >
              {/* Line Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-3.5 h-10 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
                  <div>
                    <h4 className="font-black text-sm text-slate-800 tracking-tight leading-none">{line.name}</h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CODE: {line.shortCode}</span>
                  </div>
                </div>

                {onOpenFeatureMap && (
                  <button 
                    onClick={() => onOpenFeatureMap(line.id)}
                    className="p-1.5 bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-indigo-500 rounded-xl transition-all font-bold text-[9px] uppercase hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                    title="Open active FeatureBoard for this line"
                  >
                    Open Map
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Major visual progress meter */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Track Accomplishment Rate</span>
                  <span className="font-mono font-black text-slate-800">{pct}% ({completed}/{total})</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/30">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: line.color }}
                  />
                </div>
              </div>

              {/* Hierarchy breakdowns (Epics, Features, Stories) */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100/60 pt-4">
                
                {/* Epics Progress */}
                <div className="bg-white/80 p-2.5 border border-slate-100 rounded-xl flex flex-col justify-between text-center min-h-[70px]">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Epics</span>
                  <span className="text-sm font-black text-violet-600 mt-1">{epicPct}%</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">({epicsCount} Items)</span>
                </div>

                {/* Technical Features Progress */}
                <div className="bg-white/80 p-2.5 border border-slate-100 rounded-xl flex flex-col justify-between text-center min-h-[70px]">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Features</span>
                  <span className="text-sm font-black text-emerald-600 mt-1">{featurePct}%</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">({featuresCount} Items)</span>
                </div>

                {/* Slices / Stories Progress */}
                <div className="bg-white/80 p-2.5 border border-slate-100 rounded-xl flex flex-col justify-between text-center min-h-[70px]">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Stories</span>
                  <span className="text-sm font-black text-sky-600 mt-1">{storyPct}%</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">({storiesCount} Items)</span>
                </div>

              </div>

              {/* Milestone accomplishments on track */}
              <div className="bg-slate-100/40 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center text-[10px] mb-1">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wide">Roadmap Milestones</span>
                  <span className="font-mono text-[10px] font-black text-slate-700">{doneMilestones}/{totalMilestones} Completed</span>
                </div>
                <div className="w-full bg-slate-200/50 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-slate-600 rounded-full transition-all duration-300"
                    style={{ width: `${milestonePct}%` }}
                  />
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* Two Columns for Allocation & Risk Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Workload allocations */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4">Resource Workload balance</h3>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-6">Delivery items assigned to active team members</span>

          {assigneeMetrics.length > 0 ? (
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {assigneeMetrics.map(item => (
                <div key={item.name} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="font-extrabold text-slate-800 truncate">{item.name}</span>
                    <span className="text-slate-400 font-mono">
                      Done: <span className="text-slate-800 font-black">{item.completed}</span> / {item.total} item(s)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 border border-slate-200/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300" 
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                    <span className="font-mono font-black text-[10px] text-indigo-600 w-8 text-right shrink-0">
                      {item.pct}%
                    </span>
                  </div>

                  {item.blocked > 0 && (
                    <span className="text-[9px] font-black text-red-600 uppercase tracking-widest mt-0.5">
                      ⚠️ Has {item.blocked} item(s) currently BLOCKED
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 font-black text-xs uppercase tracking-widest">
              No Workload Allocations Set
            </div>
          )}
        </div>

        {/* Workspace insights and warnings */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4">Risk Audit & Insights</h3>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-6">Automated governance scans over your workspace configuration</span>
          </div>

          <div className="space-y-3 my-4">
            {insights.length > 0 ? (
              insights.map((insight, idx) => {
                const getInsightColors = (text: string) => {
                  if (text.startsWith('Alert')) return 'bg-rose-50 border-rose-100 text-rose-700';
                  if (text.startsWith('Risk')) return 'bg-amber-50 border-amber-100 text-amber-700';
                  return 'bg-blue-50 border-blue-100 text-blue-700';
                };
                return (
                  <div 
                    key={idx} 
                    className={`p-3.5 border rounded-xl text-xs font-bold leading-relaxed ${getInsightColors(insight)}`}
                  >
                    {insight}
                  </div>
                );
              })
            ) : (
              <div className="p-8 border border-dashed border-emerald-100 bg-emerald-50/20 rounded-2xl text-center">
                <span className="text-2xl">🎉</span>
                <h4 className="font-black text-emerald-800 uppercase text-xs tracking-wider mt-2">All Scans Clean</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">No execution risks, workload skew or empty milestones detected.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100/60 pt-4 text-[9px] text-slate-400 font-black uppercase tracking-wider">
            Workspace Governance Rule Engine v1.0
          </div>
        </div>

      </div>
      </>
      )}

    </div>
  );
};
