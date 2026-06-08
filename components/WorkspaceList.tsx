
import React, { useState, useMemo } from 'react';
import { Workspace, ID } from '../types';
import { LineCreationParams } from '../store';
import { useToast } from './Toast';
import { Report } from './Report';

interface WorkspaceListProps {
  workspace: Workspace;
  onOpenRoadmap: () => void;
  onOpenFeatureMap: (lineId: ID) => void;
  addLine: (params: LineCreationParams) => void;
  deleteLine: (lineId: ID) => void;
  createSnapshot: (name: string, description?: string, customTimestamp?: string) => void;
}

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];
const ICONS = ['rocket', 'zap', 'star', 'shield', 'target', 'layers', 'cpu', 'globe'];

const formatLogTime = (isoString: string) => {
  try {
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} at ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch (e) {
    return isoString;
  }
};

const getActionBadge = (action: string) => {
  switch (action) {
    case 'create':
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', text: 'Created', icon: 'M12 4v16m8-8H4' };
    case 'update':
      return { bg: 'bg-amber-50 text-amber-700 border-amber-100', text: 'Updated', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' };
    case 'delete':
      return { bg: 'bg-rose-50 text-rose-700 border-rose-100', text: 'Deleted', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' };
    case 'move':
      return { bg: 'bg-purple-50 text-purple-700 border-purple-100', text: 'Moved', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' };
    case 'associate':
      return { bg: 'bg-indigo-50 text-indigo-700 border-indigo-100', text: 'Associated', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' };
    case 'dependency_add':
      return { bg: 'bg-teal-50 text-teal-700 border-teal-100', text: 'Dependency Added', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' };
    case 'dependency_remove':
      return { bg: 'bg-slate-50 text-slate-700 border-slate-100', text: 'Dependency Removed', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' };
    default:
      return { bg: 'bg-slate-50 text-slate-700 border-slate-100', text: 'Change', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };
  }
};

const getEntityLabel = (type: string) => {
  switch (type) {
    case 'line':
      return 'Track';
    case 'station':
      return 'Milestone';
    case 'card':
      return 'Backlog Card';
    case 'dependency':
      return 'Dependency';
    default:
      return type;
  }
};

const WorkspaceList: React.FC<WorkspaceListProps> = ({ 
  workspace, 
  onOpenRoadmap, 
  onOpenFeatureMap, 
  addLine, 
  deleteLine,
  createSnapshot
}) => {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);
  const [lineToDelete, setLineToDelete] = useState<ID | null>(null);
  const [activeTab, setActiveTab] = useState<'tracks' | 'activity' | 'reports'>('tracks');
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'line' | 'station' | 'card' | 'dependency'>('all');
  const [form, setForm] = useState<LineCreationParams>({
    name: '',
    color: COLORS[0],
    shortCode: '',
    icon: ICONS[0],
    startDate: '',
    endDate: '',
    firstStationTitle: 'Project Launch',
    owner: '',
    status: 'Planned'
  });

  const metrics = useMemo(() => {
    const totalLines = workspace.lines.length;
    const totalStations = workspace.stations.length;
    const junctionStations = workspace.stations.filter(s => s.lineIds.length > 1).length;
    const totalDependencies = workspace.dependencies.length;

    const allCards = workspace.featureMaps.flatMap(f => f.cards || []);
    const totalFeatures = allCards.length;

    const completedFeatures = allCards.filter(c => c.status === 'Completed' || c.status === 'Done').length;
    const inProgressFeatures = allCards.filter(c => c.status === 'In Progress' || c.status === 'Doing').length;
    const todoFeatures = allCards.filter(c => c.status === 'Todo' || c.status === 'Planned' || !c.status).length;
    const blockedFeatures = allCards.filter(c => c.status === 'Blocked').length;

    const completionPercentage = totalFeatures > 0
      ? Math.round((completedFeatures / totalFeatures) * 100)
      : 0;

    const linesByStatus = workspace.lines.reduce((acc, line) => {
      const status = (line.metadata?.status as string) || 'Planned';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const completedStations = workspace.stations.filter(st => st.status === 'Completed').length;

    return {
      totalLines,
      totalStations,
      junctionStations,
      totalDependencies,
      totalFeatures,
      completedFeatures,
      inProgressFeatures,
      todoFeatures,
      blockedFeatures,
      completionPercentage,
      linesByStatus,
      completedStations
    };
  }, [workspace]);

  const filteredLogs = useMemo(() => {
    const logs = workspace.activityLog || [];
    return logs.filter(log => {
      const matchesSearch = log.details.toLowerCase().includes(logSearch.toLowerCase()) || 
                            log.entityName.toLowerCase().includes(logSearch.toLowerCase());
      const matchesFilter = logFilter === 'all' || log.entityType === logFilter;
      return matchesSearch && matchesFilter;
    });
  }, [workspace.activityLog, logSearch, logFilter]);

  const handleAdd = () => {
    if (!form.name) return;
    const shortCode = form.shortCode || form.name.substring(0, 2).toUpperCase();
    addLine({ ...form, shortCode });
    setIsModalOpen(false);
    showToast(`Track "${form.name}" successfully created with its roadmap launching milestone!`, 'success');
    
    // Reset form
    setForm({
      name: '',
      color: COLORS[0],
      shortCode: '',
      icon: ICONS[0],
      startDate: '',
      endDate: '',
      firstStationTitle: 'Project Launch',
      owner: '',
      status: 'Planned'
    });
  };

  const statusBadgeColors: Record<string, string> = {
    'Planned': 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-amber-100 text-amber-700',
    'Completed': 'bg-emerald-100 text-emerald-700',
    'Blocked': 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto text-slate-800 dark:text-slate-100">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold mb-1 tracking-tight text-slate-900 dark:text-slate-50">Strategy Workspace</h2>
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">Coordinate your product initiatives through spatial mapping.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsDashboardVisible(!isDashboardVisible)}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 cursor-pointer border border-transparent dark:border-slate-700"
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${isDashboardVisible ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
            {isDashboardVisible ? 'Hide Dashboard' : 'Show Dashboard'}
          </button>
          <button 
            onClick={onOpenRoadmap}
            className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A2 2 0 013 15.382V5.618a2 2 0 011.553-1.944L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A2 2 0 0021 17.618V7.382a2 2 0 00-1.553-1.944L15 2m0 15V2m0 0L9 5" /></svg>
            Canvas Editor
          </button>
        </div>
      </div>

      {/* High-Level Stats Dashboard Component (Collapsible) */}
      <div 
        className={`transition-all duration-300 ease-in-out origin-top overflow-hidden ${
          isDashboardVisible ? 'max-h-[800px] opacity-100 mb-10' : 'max-h-0 opacity-0 mb-0'
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Total Metro Lines */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Metro Lines</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 20l-5.447-2.724A2 2 0 013 15.382V5.618a2 2 0 011.553-1.944L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A2 2 0 0021 17.618V7.382a2 2 0 00-1.553-1.944L15 2m0 15V2m0 0L9 5" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-50 leading-none">{metrics.totalLines}</div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 uppercase font-black tracking-wider">Active Tracks</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              <span>Planned: {metrics.linesByStatus['Planned'] || 0}</span>
              <span>Active: {metrics.linesByStatus['In Progress'] || 0}</span>
            </div>
          </div>

          {/* Card 2: Total Stations */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Milestones</span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M17.657 16.586L12 21l-5.657-5.657M12 14a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-50 leading-none">{metrics.totalStations}</div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 uppercase font-black tracking-wider">Stations Deployed</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              <span>Interchanges: {metrics.junctionStations}</span>
              <span>Milestones: {metrics.totalStations - metrics.junctionStations}</span>
            </div>
          </div>

          {/* Card 3: Total Backlog Features */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tactical Features</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-50 leading-none">{metrics.totalFeatures}</div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 uppercase font-black tracking-wider">Backlog Items</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              <span>Todo: {metrics.todoFeatures}</span>
              <span>Active: {metrics.inProgressFeatures}</span>
            </div>
          </div>

          {/* Card 4: Progress Integrity */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Network Health</span>
              <div className={`p-2 rounded-xl ${metrics.blockedFeatures > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' : 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400'}`}>
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-50 leading-none">{metrics.completionPercentage}%</div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 uppercase font-black tracking-wider">Feature Delivery</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              <span>Dependencies: {metrics.totalDependencies}</span>
              <span className={`${metrics.blockedFeatures > 0 ? 'text-rose-500 dark:text-rose-455 font-bold' : ''}`}>Blocked: {metrics.blockedFeatures}</span>
            </div>
          </div>
        </div>

        {/* Status Breakdown Charts Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-8 md:divide-x md:divide-slate-100 dark:md:divide-slate-800">
          <div className="w-full md:w-1/2">
            <h4 className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase tracking-widest mb-3">Backlog Distribution Status</h4>
            <div className="flex gap-1.5 w-full h-8 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-805 p-1">
              {metrics.totalFeatures > 0 ? (
                <>
                  {metrics.completedFeatures > 0 && (
                    <div 
                      className="bg-emerald-500 hover:bg-emerald-600 transition-all cursor-help flex items-center justify-center text-[10px] font-black text-white rounded-lg shadow-sm"
                      style={{ width: `${(metrics.completedFeatures / metrics.totalFeatures) * 100}%` }}
                      title={`Delivered: ${metrics.completedFeatures} / ${metrics.totalFeatures}`}
                    >
                      {Math.round((metrics.completedFeatures / metrics.totalFeatures) * 100)}%
                    </div>
                  )}
                  {metrics.inProgressFeatures > 0 && (
                    <div 
                      className="bg-amber-500 hover:bg-amber-600 transition-all cursor-help flex items-center justify-center text-[10px] font-black text-white rounded-lg shadow-sm"
                      style={{ width: `${(metrics.inProgressFeatures / metrics.totalFeatures) * 100}%` }}
                      title={`Active: ${metrics.inProgressFeatures} / ${metrics.totalFeatures}`}
                    >
                      {Math.round((metrics.inProgressFeatures / metrics.totalFeatures) * 100)}%
                    </div>
                  )}
                  {metrics.todoFeatures > 0 && (
                    <div 
                      className="bg-blue-500 hover:bg-blue-600 transition-all cursor-help flex items-center justify-center text-[10px] font-black text-white rounded-lg shadow-sm"
                      style={{ width: `${(metrics.todoFeatures / metrics.totalFeatures) * 100}%` }}
                      title={`Backlog: ${metrics.todoFeatures} / ${metrics.totalFeatures}`}
                    >
                      {Math.round((metrics.todoFeatures / metrics.totalFeatures) * 100)}%
                    </div>
                  )}
                  {metrics.blockedFeatures > 0 && (
                    <div 
                      className="bg-rose-500 hover:bg-rose-600 transition-all cursor-help flex items-center justify-center text-[10px] font-black text-white rounded-lg shadow-sm"
                      style={{ width: `${(metrics.blockedFeatures / metrics.totalFeatures) * 100}%` }}
                      title={`Blocked: ${metrics.blockedFeatures} / ${metrics.totalFeatures}`}
                    >
                      {Math.round((metrics.blockedFeatures / metrics.totalFeatures) * 100)}%
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">No Backlog items created yet</div>
              )}
            </div>
            <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mt-3.5 px-1 flex-wrap gap-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-md" />Done ({metrics.completedFeatures})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-md" />Doing ({metrics.inProgressFeatures})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded-md" />Todo ({metrics.todoFeatures})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-md" />Blocked ({metrics.blockedFeatures})</span>
            </div>
          </div>
          <div className="w-full md:w-1/2 md:pl-8 flex flex-col justify-center">
            <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-2.5">
              <span>Completed Station Milestones</span>
              <span className="text-indigo-600 dark:text-indigo-400">{metrics.completedStations} / {metrics.totalStations}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-[1px]">
              <div 
                className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-305 shadow-[0_0_8px_rgba(79,70,229,0.3)]" 
                style={{ width: `${metrics.totalStations > 0 ? (metrics.completedStations / metrics.totalStations) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-3 leading-relaxed uppercase tracking-wider">
              All tactical stories mapped underneath each milestone will directly drive overall delivery progress.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="mb-6 flex gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('tracks')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'tracks'
              ? 'bg-slate-900 dark:bg-slate-805 text-white shadow-md border border-transparent dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-900 debug:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          Product Tracks ({workspace.lines.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer relative ${
            activeTab === 'reports'
              ? 'bg-slate-900 dark:bg-slate-805 text-white shadow-md border border-transparent dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-900 debug:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
          </svg>
          Workspace Reports
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer relative ${
            activeTab === 'activity'
              ? 'bg-slate-900 dark:bg-slate-805 text-white shadow-md border border-transparent dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-900 debug:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Activity Log
          {workspace.activityLog && workspace.activityLog.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-black text-white shadow ring-2 ring-white dark:ring-slate-900">
              {workspace.activityLog.length > 99 ? '99+' : workspace.activityLog.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'tracks' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {/* Add New Line Card */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center group hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/15 transition-all min-h-[220px] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            <svg className="w-6 h-6 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <h3 className="font-bold text-slate-850 dark:text-slate-200 transition-colors">New Product Line</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 uppercase font-bold tracking-widest">Create metro track</p>
        </button>

        {/* Existing Lines */}
        {workspace.lines.map(line => {
          const isConfirmingDelete = lineToDelete === line.id;
          return (
            <div 
              key={line.id}
              className={`p-6 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border flex flex-col group transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 relative min-h-[240px] ${
                isConfirmingDelete ? 'border-rose-300 dark:border-rose-850 bg-rose-50/10 shadow-md ring-1 ring-rose-500/20 animate-pulse-subtle' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {isConfirmingDelete ? (
                <div className="flex flex-col h-full justify-between animate-in fade-in duration-200">
                  <div className="text-center py-2">
                    <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center mx-auto mb-3 text-rose-600">
                      <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <h3 className="font-extrabold text-slate-805 dark:text-slate-100 leading-tight">Delete Track "{line.name}"?</h3>
                    <p className="text-[9px] text-rose-700 dark:text-rose-400 font-black uppercase tracking-widest mt-1.5 leading-relaxed bg-rose-100/50 dark:bg-rose-950/50 rounded-full px-2 py-0.5 inline-block">Cascades All Elements</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed">
                      Removes this product line and all uniquely associated stations, dependencies, and backlog user story cards permanently.
                    </p>
                  </div>
                  <div className="flex gap-2.5 mt-auto pt-2">
                    <button
                      onClick={() => {
                        deleteLine(line.id);
                        setLineToDelete(null);
                        showToast(`Successfully deleted ${line.name} track and connected backlog elements.`, 'success');
                      }}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-xl transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      Delete Track
                    </button>
                    <button
                      onClick={() => setLineToDelete(null)}
                      className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350 font-bold text-[10px] rounded-xl transition-colors uppercase tracking-wider cursor-pointer border border-transparent dark:border-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-4 mb-6">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                      style={{ backgroundColor: line.color }}
                    >
                      <span className="font-black text-sm uppercase">{line.shortCode}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-slate-800 dark:text-slate-100 leading-tight truncate">{line.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">
                          {line.stationIds.length} MILESTONES
                        </p>
                        {line.metadata.status && (
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${statusBadgeColors[String(line.metadata.status)] || 'bg-slate-100 text-slate-500'}`}>
                            {line.metadata.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setLineToDelete(line.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50/50 transition-all cursor-pointer pointer-events-auto leading-none shrink-0"
                      title="Delete Product Line & All Connected Elements in Cascade"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    {line.metadata.startDate && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[10px] font-bold">{line.metadata.startDate} — {line.metadata.endDate || 'TBD'}</span>
                      </div>
                    )}
                    {line.metadata.owner && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="text-[10px] font-bold truncate">{line.metadata.owner}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-auto flex gap-2">
                     <button 
                      onClick={() => onOpenFeatureMap(line.id)}
                      className="flex-1 py-3 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 font-bold text-xs rounded-xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 uppercase tracking-tighter cursor-pointer"
                    >
                      Backlog
                    </button>
                    <button 
                      onClick={onOpenRoadmap}
                      className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 uppercase tracking-tighter cursor-pointer border border-transparent dark:border-slate-700"
                    >
                      Canvas
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      ) : activeTab === 'activity' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 mb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Header toolbar for Activity Log */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Recent Workspace Change Log</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Chronological feed of infrastructure and story events</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Log Search Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search log details..."
                  className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-202 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-550 outline-none w-full md:w-56"
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Log Category Filter Dropdown */}
              <select
                className="py-2 pl-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                value={logFilter}
                onChange={e => setLogFilter(e.target.value as any)}
              >
                <option value="all">All Entries</option>
                <option value="line">Tracks Only</option>
                <option value="station">Milestones Only</option>
                <option value="card">Cards Only</option>
                <option value="dependency">Dependencies Only</option>
              </select>
            </div>
          </div>

          {/* Activity Log Feed Items */}
          {filteredLogs.length > 0 ? (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {filteredLogs.map((log) => {
                const badge = getActionBadge(log.action);
                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-slate-50/15 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all flex items-start gap-4"
                  >
                    {/* Action Icon Badge */}
                    <div className={`p-2.5 rounded-xl border shrink-0 ${badge.bg}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={badge.icon} />
                      </svg>
                    </div>

                    {/* Log Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${badge.bg}`}>
                            {badge.text}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                            {getEntityLabel(log.entityType)}
                          </span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                          {formatLogTime(log.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 font-extrabold tracking-tight mt-1 leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 animate-pulse">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="font-extrabold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-xs">No Matching Log Entries</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Try relaxing your search terms or filter selection</p>
            </div>
          )}
        </div>
      ) : (
        <Report 
          workspace={workspace} 
          onOpenFeatureMap={onOpenFeatureMap} 
          createSnapshot={createSnapshot}
          showToast={showToast}
        />
      )}      {/* Modal Backdrop */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Infrastructure Setup</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Laying tracks for your next big thing</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 transition-colors cursor-pointer">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5 block">Initiative / Line Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Mobile Redesign" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-805 dark:text-slate-100 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5 block">Short Code</label>
                  <input 
                    type="text" 
                    maxLength={2}
                    placeholder="MR" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                    value={form.shortCode}
                    onChange={e => setForm({...form, shortCode: e.target.value.toUpperCase()})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5 block">Primary Lead (Owner)</label>
                  <input 
                    type="text" 
                    placeholder="Project Owner" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={form.owner}
                    onChange={e => setForm({...form, owner: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5 block">Track Status</label>
                  <select 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                    value={form.status}
                    onChange={e => setForm({...form, status: e.target.value})}
                  >
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5 block">Entry Station</label>
                  <input 
                    type="text" 
                    placeholder="Station Name" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={form.firstStationTitle}
                    onChange={e => setForm({...form, firstStationTitle: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5 block">Kickoff Date</label>
                  <input 
                    type="date" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-xs"
                    value={form.startDate}
                    onChange={e => setForm({...form, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5 block">Goal Deadline</label>
                  <input 
                    type="date" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-805 dark:text-slate-100 rounded-xl font-bold text-xs"
                    value={form.endDate}
                    onChange={e => setForm({...form, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-3 block">Track Color Identity</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm({...form, color: c})}
                      className={`w-9 h-9 rounded-full border-4 transition-all shadow-sm cursor-pointer ${form.color === c ? 'border-slate-900 dark:border-white scale-110 shadow-lg' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleAdd}
                  disabled={!form.name}
                  className="w-full py-4 bg-slate-900 dark:bg-indigo-650 text-white font-black text-sm rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 disabled:shadow-none uppercase tracking-[0.2em] cursor-pointer"
                >
                  Confirm Infrastructure Layout
                </button>
                <p className="text-[9px] text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-4">
                  New lane will be instantly available in the canvas editor
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceList;
