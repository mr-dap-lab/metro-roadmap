import React, { useState, useMemo, useEffect } from 'react';
import { Workspace, ID, Line, Card, Layer, CardType, Station } from '../types';
import { 
  User, 
  Users, 
  Plus, 
  Trash2, 
  Settings, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Edit3, 
  Sliders, 
  UserPlus, 
  Inbox, 
  Tag, 
  Calendar 
} from 'lucide-react';

interface ResourceAllocationViewProps {
  workspace: Workspace;
  lineId: ID;
  featureMap: {
    id: ID;
    lineId: ID;
    name: string;
    layers: Layer[];
    cards: Card[];
  };
  segments: Station[];
  updateCard: (lineId: ID, cardId: ID, updates: Partial<Card>) => void;
  onEditCard: (card: Card) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  statusColors: Record<string, string>;
}

interface TeamMember {
  id: string;
  name: string;
  capacity: number; // Story points limit per sprint/phase
}

export const ResourceAllocationView: React.FC<ResourceAllocationViewProps> = ({
  workspace,
  lineId,
  featureMap,
  segments,
  updateCard,
  onEditCard,
  showToast,
  statusColors
}) => {
  // Roster of team members
  const [roster, setRoster] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem('metro_presence_roster');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    // Default list of professional engineers/designers
    return [
      { id: '1', name: 'Sarah Chen', capacity: 8 },
      { id: '2', name: 'Elena Rostova', capacity: 10 },
      { id: '3', name: 'Marcus Vance', capacity: 6 },
      { id: '4', name: 'Kenji Sato', capacity: 8 },
      { id: '5', name: 'Amara Okafor', capacity: 12 }
    ];
  });

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberCapacity, setNewMemberCapacity] = useState<number>(8);
  const [capacityEditId, setCapacityEditId] = useState<string | null>(null);
  const [tempCapacity, setTempCapacity] = useState<number>(8);

  // Synchronize roster with localStorage
  useEffect(() => {
    localStorage.setItem('metro_presence_roster', JSON.stringify(roster));
  }, [roster]);

  // Extract distinct owners from actual cards to sync to roster
  const distinctOwnersInCards = useMemo(() => {
    const owners = new Set<string>();
    featureMap.cards.forEach(c => {
      if (c.owner && c.owner.trim() && c.owner !== 'Unassigned') {
        owners.add(c.owner.trim());
      }
    });
    return Array.from(owners);
  }, [featureMap.cards]);

  // Automatically register card owners in roster to preserve integrity
  useEffect(() => {
    let updated = false;
    const currentRoster = [...roster];
    distinctOwnersInCards.forEach(owner => {
      const exists = currentRoster.some(
        member => member.name.toLowerCase() === owner.toLowerCase()
      );
      if (!exists) {
        currentRoster.push({
          id: `owner-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: owner,
          capacity: 8
        });
        updated = true;
      }
    });
    if (updated) {
      setRoster(currentRoster);
    }
  }, [distinctOwnersInCards]);

  // Helper: check if a card assignee belongs to "Unassigned"
  const isUnassigned = (card: Card) => {
    return !card.owner || card.owner.trim() === '' || card.owner === 'Unassigned';
  };

  // Workload calculations per team member (overall across the entire feature map)
  const rosterWorkloads = useMemo(() => {
    const workloads: Record<string, { totalPoints: number; cardCount: number; cards: Card[] }> = {};
    
    // Initialize for roster
    roster.forEach(m => {
      workloads[m.name.toLowerCase()] = { totalPoints: 0, cardCount: 0, cards: [] };
    });
    
    // Unassigned ledger
    workloads['unassigned'] = { totalPoints: 0, cardCount: 0, cards: [] };

    featureMap.cards.forEach(card => {
      const ownerLower = card.owner ? card.owner.trim().toLowerCase() : '';
      const sizeVal = card.complexityScore || 1; // Default to 1 SP if load unspecified

      if (isUnassigned(card)) {
        workloads['unassigned'].totalPoints += sizeVal;
        workloads['unassigned'].cardCount += 1;
        workloads['unassigned'].cards.push(card);
      } else if (workloads[ownerLower]) {
        workloads[ownerLower].totalPoints += sizeVal;
        workloads[ownerLower].cardCount += 1;
        workloads[ownerLower].cards.push(card);
      } else {
        // Just in case we have active owners that exist but aren't in roster (lowercase diff)
        const nameToUse = roster.find(m => m.name.toLowerCase() === ownerLower)?.name.toLowerCase() || ownerLower;
        if (!workloads[nameToUse]) {
          workloads[nameToUse] = { totalPoints: 0, cardCount: 0, cards: [] };
        }
        workloads[nameToUse].totalPoints += sizeVal;
        workloads[nameToUse].cardCount += 1;
        workloads[nameToUse].cards.push(card);
      }
    });

    return workloads;
  }, [roster, featureMap.cards]);

  // Handle adding team member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      showToast('Please provide a team member name.', 'error');
      return;
    }
    const exists = roster.some(
      m => m.name.toLowerCase() === newMemberName.trim().toLowerCase()
    );
    if (exists) {
      showToast('Team member with this name already exists.', 'error');
      return;
    }

    const newMember: TeamMember = {
      id: `member-${Date.now()}`,
      name: newMemberName.trim(),
      capacity: newMemberCapacity || 8
    };

    setRoster([...roster, newMember]);
    setNewMemberName('');
    showToast(`Added ${newMember.name} to the roster.`, 'success');
  };

  // Remove team member
  const handleRemoveMember = (id: string, name: string) => {
    // Reassign their cards to Unassigned
    const assignedCards = featureMap.cards.filter(c => c.owner === name);
    assignedCards.forEach(c => {
      updateCard(lineId, c.id, { owner: 'Unassigned' });
    });

    setRoster(roster.filter(m => m.id !== id));
    if (assignedCards.length > 0) {
      showToast(`Removed ${name}. Reassigned ${assignedCards.length} cards back to Unassigned.`, 'info');
    } else {
      showToast(`Removed ${name} from roster.`, 'success');
    }
  };

  // Quick edit capacity
  const handleSaveCapacity = (id: string) => {
    setRoster(prev => prev.map(m => m.id === id ? { ...m, capacity: tempCapacity } : m));
    setCapacityEditId(null);
    showToast('Weekly story point capacity updated!', 'success');
  };

  const handleCardAssign = (cardId: ID, ownerName: string) => {
    updateCard(lineId, cardId, { owner: ownerName });
    showToast(`Reassigned card to ${ownerName || 'Unassigned'}`, 'success');
  };

  // Compute stats
  const totalRosterPoints = useMemo(() => {
    return Object.values(rosterWorkloads)
      .reduce((sum, w) => sum + w.totalPoints, 0);
  }, [rosterWorkloads]);

  const overallocationCount = useMemo(() => {
    return roster.filter(m => {
      const load = rosterWorkloads[m.name.toLowerCase()]?.totalPoints || 0;
      return load > m.capacity;
    }).length;
  }, [roster, rosterWorkloads]);

  return (
    <div className="flex-1 flex flex-col xl:flex-row gap-8 px-8 py-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 font-sans">
      
      {/* LHS sidebar: team roster and metrics */}
      <div className="w-full xl:w-96 shrink-0 flex flex-col gap-6">
        
        {/* Workload overall summary */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-4 h-4" />
            </span>
            Roster Analysis
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-2xl">
              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wide leading-none">Total Effort Mapped</span>
              <span className="text-xl font-black text-slate-805 dark:text-white mt-1 block">
                {totalRosterPoints} SP
              </span>
              <span className="text-[8px] text-slate-400 font-semibold block mt-1">Across all columns</span>
            </div>

            <div className={`p-4 border rounded-2xl transition-all ${
              overallocationCount > 0 
                ? 'bg-rose-50/75 dark:bg-rose-955/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-400'
                : 'bg-emerald-50/75 dark:bg-emerald-955/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-400'
            }`}>
              <span className="text-[9px] font-black block uppercase tracking-wide leading-none">Overallocations</span>
              <span className="text-xl font-black mt-1 block flex items-center gap-1.5">
                {overallocationCount > 0 ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse shrink-0" />
                    {overallocationCount} Critical
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    All Good
                  </>
                )}
              </span>
              <span className="text-[8px] opacity-80 font-semibold block mt-1">
                {overallocationCount > 0 ? 'Workload exceeds limits' : 'Roster sits below limits'}
              </span>
            </div>
          </div>

          {overallocationCount > 0 && (
            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-[10px] text-rose-600 dark:text-rose-450 leading-relaxed font-semibold flex gap-2">
              <Info className="w-4 h-4 shrink-0 text-rose-500" />
              <span>Some team members are assigned tasks whose combined story point complexity exceeds their allocated capacity thresholds. Redistribute cards across segments to balance the load.</span>
            </div>
          )}
        </div>

        {/* Team roster view + Add user */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </span>
            Active Assignees ({roster.length})
          </h3>

          <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-1">
            {roster.map(member => {
              const workload = rosterWorkloads[member.name.toLowerCase()] || { totalPoints: 0, cardCount: 0 };
              const percent = Math.min((workload.totalPoints / member.capacity) * 100, 100);
              const isOver = workload.totalPoints > member.capacity;
              const isNear = workload.totalPoints > member.capacity * 0.8 && !isOver;

              return (
                <div 
                  key={member.id} 
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isOver 
                      ? 'border-rose-100 dark:border-rose-900/60 bg-rose-50/15'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase
                        ${isOver ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'}
                      `}>
                        {member.name.split(' ').map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                          {member.name}
                        </h4>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight">
                          {workload.cardCount} associated {workload.cardCount === 1 ? 'card' : 'cards'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {capacityEditId === member.id ? (
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="number" 
                            className="w-12 p-1.5 text-xs font-black text-slate-850 border border-slate-300 rounded-xl text-center"
                            value={tempCapacity}
                            onChange={e => setTempCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <button 
                            onClick={() => handleSaveCapacity(member.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-[9px] font-black uppercase rounded-lg shadow"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="font-extrabold text-xs leading-none">
                            <span className={isOver ? 'text-rose-600' : 'text-slate-800 dark:text-slate-300'}>
                              {workload.totalPoints}
                            </span>
                            <span className="text-slate-400 mx-0.5">/</span>
                            <span className="text-slate-400 font-bold">{member.capacity} SP</span>
                          </div>
                          
                          <button 
                            onClick={() => {
                              setCapacityEditId(member.id);
                              setTempCapacity(member.capacity);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all cursor-pointer"
                            title="Edit capacity limit"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meter Progress */}
                  <div className="mt-2.5">
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver 
                            ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' 
                            : isNear 
                              ? 'bg-amber-400' 
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Overload warning label */}
                  {isOver && (
                    <div className="mt-2 text-[9px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 animate-bounce shrink-0" />
                      OVERALLOCATED BY {workload.totalPoints - member.capacity} STORY POINTS
                    </div>
                  )}

                  {/* Remove Assignee Option */}
                  {member.name !== 'Sarah Chen' && (
                    <div className="flex justify-end mt-1.5">
                      <button 
                        onClick={() => handleRemoveMember(member.id, member.name)}
                        className="text-[9px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 uppercase tracking-widest flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 shrink-0" />
                        Discharge
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add member form */}
          <form onSubmit={handleAddMember} className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Join New Team Member</span>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Name. e.g. Liam Porter"
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100/50 border border-slate-200 dark:border-slate-750 focus:border-indigo-500 rounded-xl text-xs font-semibold outline-none focus:bg-white text-slate-800 dark:text-slate-100"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
              />
              <div className="w-20">
                <input 
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 focus:border-indigo-500 rounded-xl text-xs font-bold text-center outline-none"
                  value={newMemberCapacity}
                  onChange={e => setNewMemberCapacity(Math.max(1, parseInt(e.target.value) || 8))}
                  placeholder="Limit"
                  title="Weekly SP Capacity"
                />
              </div>
              <button 
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shadow-md cursor-pointer shrink-0 transition-transform active:scale-95 flex items-center justify-center"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Unassigned ledger drawer */}
        <div className="bg-slate-900 border border-slate-950 rounded-3xl p-6 text-slate-100 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <Inbox className="w-4 h-4 shrink-0 text-indigo-400" />
              Unassigned Backlog
            </h3>
            <span className="text-[10px] font-black font-mono px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-slate-300">
              {rosterWorkloads['unassigned']?.cardCount || 0} items
            </span>
          </div>

          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {(rosterWorkloads['unassigned']?.cards || []).length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs font-bold leading-normal italic">
                🎉 No unassigned items left! Fully allocated.
              </div>
            ) : (
              (rosterWorkloads['unassigned']?.cards || []).map(card => {
                const cardSegment = segments.find(s => s.id === card.sourceSegmentId);
                return (
                  <div key={card.id} className="p-3 bg-slate-950 border border-slate-850 hover:border-slate-750 rounded-xl flex flex-col gap-2 transition-all">
                    <div className="flex justify-between items-start gap-2">
                      <button 
                        onClick={() => onEditCard(card)}
                        className="text-[11px] font-black hover:text-indigo-450 text-left leading-snug cursor-pointer flex-1 text-slate-100"
                      >
                        {card.title}
                      </button>
                      <span className="text-[10px] font-black text-indigo-400 shrink-0 font-mono">
                        {card.complexityScore || 1} SP
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-900 pt-2">
                      <span className="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[120px]">
                        📍 {cardSegment?.title || 'Segment'}
                      </span>
                      
                      <select
                        onChange={(e) => handleCardAssign(card.id, e.target.value)}
                        defaultValue=""
                        className="p-1 px-2 border border-slate-800 bg-slate-900/90 rounded text-[9px] font-black text-slate-200 uppercase tracking-wider cursor-pointer"
                      >
                        <option value="" disabled>Assign To...</option>
                        {roster.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* RHS: Horizontal Planner Matrix (Horizontal Timeline Columns matching track segments) */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-x-auto">
        <div className="min-w-[1000px] flex flex-col h-full">

          {/* Matrix Description Header */}
          <div className="mb-6 flex justify-between items-center select-none pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-50 flex items-center gap-2">
                📂 Workforce Allocation Matrices
              </h3>
              <p className="text-[10px] text-zinc-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                Visualizing resource allocation rows mapped against delivery track segments sequentially to isolate bottlenecks
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-black px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full uppercase">
              💡 Drag segments inside roadmap to align columns
            </div>
          </div>

          {/* Header Row: Column boundaries corresponding to Segments */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 pb-3 font-semibold pb-4">
            
            {/* LHS Buffer matching assignee details width */}
            <div className="w-56 shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-end">
              Team Member Row
            </div>

            {/* Segment Headers */}
            <div className="flex-1 flex gap-4">
              {segments.map((segment, idx) => {
                if (!segment) return null;
                const segCards = featureMap.cards.filter(c => c.sourceSegmentId === segment.id);
                const segPoints = segCards.reduce((acc, c) => acc + (c.complexityScore || 1), 0);
                return (
                  <div key={segment.id} className="flex-1 min-w-[160px] flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px] font-black leading-none">
                      <span className="text-zinc-600 dark:text-slate-300 uppercase truncate tracking-tight">{segment.title}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 shrink-0 font-mono">#{idx+1}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1 leading-none">
                      <span>Column load:</span>
                      <span className="font-mono">{segPoints} SP ({segCards.length} cards)</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Table Rows per Roster Member */}
          <div className="flex-1 flex flex-col gap-4 pt-4 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-y-auto">
            {roster.map(member => {
              const workload = rosterWorkloads[member.name.toLowerCase()] || { totalPoints: 0, cardCount: 0, cards: [] };
              const isOver = workload.totalPoints > member.capacity;

              return (
                <div key={member.id} className={`flex pt-4 items-stretch ${isOver ? 'bg-rose-50/5 dark:bg-rose-955/5' : ''}`}>
                  
                  {/* Row Left Label: Member details */}
                  <div className="w-56 shrink-0 flex flex-col justify-start gap-1.5 pr-4 select-none">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full inline-block ${isOver ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                      {member.name}
                    </span>
                    <div className="text-[10px] font-semibold text-slate-400 leading-normal">
                      Allocated Load: <span className={`font-mono font-black ${isOver ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>{workload.totalPoints} SP</span>
                      <br/>
                      Limit: <span className="font-mono font-bold">{member.capacity} SP</span>
                    </div>

                    {isOver && (
                      <span className="text-[8px] bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded font-black uppercase tracking-tight w-max mt-1 border border-rose-200/40">
                        Overloaded ⚠️
                      </span>
                    )}
                  </div>

                  {/* Horizontal Columns: Cards for this member grouped by segment */}
                  <div className="flex-1 flex gap-4 min-h-[110px]">
                    {segments.map(segment => {
                      if (!segment) return null;
                      
                      // Cards assigned to this member in this exact column segment
                      const cellCards = workload.cards.filter(c => c.sourceSegmentId === segment.id);
                      const cellPointsSum = cellCards.reduce((acc, c) => acc + (c.complexityScore || 1), 0);

                      // Cell bottleneck check (e.g. if one single developer handles more than 6 story points in a single segment, alert!)
                      const isCellOverloaded = cellPointsSum > (member.capacity * 0.7);

                      return (
                        <div 
                          key={segment.id} 
                          className={`flex-1 min-w-[160px] rounded-2xl p-2.5 transition-colors border flex flex-col gap-2 ${
                            isCellOverloaded 
                              ? 'bg-rose-50/20 dark:bg-rose-955/10 border-rose-100 dark:border-rose-900/30' 
                              : cellCards.length > 0
                                ? 'bg-slate-50/50 dark:bg-slate-850/40 border-slate-150 dark:border-slate-800'
                                : 'bg-slate-50/10 dark:bg-slate-900/10 border-dashed border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {/* Cell point header if items exist */}
                          {cellCards.length > 0 && (
                            <div className="flex justify-between items-center text-[9px] font-black tracking-tight select-none border-b border-slate-100 dark:border-slate-800 pb-1 leading-none uppercase">
                              <span className="text-slate-400">Total</span>
                              <span className={isCellOverloaded ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}>
                                {cellPointsSum} SP
                              </span>
                            </div>
                          )}

                          {cellCards.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-[9px] text-slate-350 dark:text-slate-650 italic leading-snug text-center font-bold">
                              No load assigned
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {cellCards.map(card => {
                                return (
                                  <div 
                                    key={card.id} 
                                    className="p-2.5 bg-white dark:bg-slate-950 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all flex flex-col gap-1.5"
                                  >
                                    <div className="flex justify-between items-start gap-1">
                                      <button 
                                        onClick={() => onEditCard(card)}
                                        className="text-[10px] font-black leading-tight text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-left cursor-pointer truncate max-w-[150px]"
                                        title={card.title}
                                      >
                                        {card.title}
                                      </button>
                                      
                                      <span className="text-[9px] font-black text-slate-400 leading-none shrink-0 font-mono">
                                        {card.complexityScore || 1}
                                      </span>
                                    </div>

                                    {/* Action button to unassign/reassign */}
                                    <div className="flex items-center justify-between gap-1 border-t border-slate-50 dark:border-slate-850/50 pt-1.5 mt-0.5">
                                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded border capitalize tracking-tighter shrink-0 ${
                                        card.status === 'Completed' || card.status === 'Done'
                                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-100'
                                          : card.status === 'Blocked'
                                          ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border-rose-100'
                                          : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border-indigo-100'
                                      }`}>
                                        {card.status}
                                      </span>

                                      <select
                                        value={member.name}
                                        onChange={(e) => handleCardAssign(card.id, e.target.value)}
                                        className="p-0.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 rounded text-[8px] font-black uppercase text-slate-500 hover:text-slate-800 cursor-pointer max-w-[80px]"
                                      >
                                        <option value="Unassigned">Unassign</option>
                                        {roster.map(m => (
                                          <option key={m.id} value={m.name}>{m.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}

            {/* Unassigned row visualized inside horizontal swimlanes to make it complete */}
            <div className="flex pt-4 items-stretch border-t-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-100/10 dark:bg-slate-900/5">
              
              <div className="w-56 shrink-0 flex flex-col justify-start gap-1 pr-4 select-none">
                <span className="font-extrabold text-xs text-indigo-550 dark:text-indigo-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                  Unassigned Sandbox
                </span>
                <p className="text-[9px] text-zinc-400 block font-semibold uppercase tracking-wide mt-1 leading-normal">
                  backlog items with no designated owner mapped
                </p>
              </div>

              <div className="flex-1 flex gap-4 min-h-[90px]">
                {segments.map(segment => {
                  if (!segment) return null;
                  const unassignedCards = (rosterWorkloads['unassigned']?.cards || [])
                    .filter(c => c.sourceSegmentId === segment.id);

                  return (
                    <div 
                      key={segment.id} 
                      className={`flex-1 min-w-[160px] rounded-2xl p-2.5 border-dashed border border-slate-300 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/5 flex flex-col gap-2`}
                    >
                      {unassignedCards.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-[8px] text-zinc-350 dark:text-zinc-600 italic text-center font-bold">
                          All assigned
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {unassignedCards.map(card => (
                            <div key={card.id} className="p-2 bg-slate-950 border border-slate-800 rounded-lg shadow-xs flex flex-col gap-1.5 text-slate-100">
                              <button 
                                onClick={() => onEditCard(card)}
                                className="text-[9.5px] font-black text-left hover:text-indigo-400 leading-tight truncate max-w-[145px] text-zinc-100"
                              >
                                {card.title}
                              </button>
                              
                              <div className="flex items-center justify-between border-t border-slate-900 pt-1 mt-0.5">
                                <span className="text-[8px] font-mono text-zinc-400 font-bold shrink-0">{card.complexityScore || 1} SP</span>
                                <select
                                  onChange={(e) => handleCardAssign(card.id, e.target.value)}
                                  defaultValue=""
                                  className="p-0.5 border border-slate-800 bg-slate-900 text-[8px] font-black uppercase text-slate-350 cursor-pointer"
                                >
                                  <option value="" disabled>Assign To</option>
                                  {roster.map(m => (
                                    <option key={m.id} value={m.name}>{m.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
};
