import React, { useState } from 'react';
import { useWorkspaceStore } from './store';
import RoadmapEditor from './components/RoadmapEditor';
import FeatureBoard from './components/FeatureBoard';
import WorkspaceList from './components/WorkspaceList';
import Header from './components/Header';
import { ID } from './types';
import { ToastProvider, useToast } from './components/Toast';
import { SnapshotManager } from './components/SnapshotManager';
import { ThemeProvider } from './components/ThemeContext';
// Import animate capabilities from motion/react as mandated by React guidelines
import { motion, AnimatePresence } from 'motion/react';

// ============================================================================
// APP ENTRY POINT & CORE CONTROLLER
// ============================================================================
// Manages application-wide views (Workspace dashboard, Metro Roadmap Editor,
// and User Story Feature board) and proxies data-sharing integrations like JSON exports.

function AppContent() {
  // Navigation view router: 
  // - "workspace": Multi-product line list & high-level stats dashboard.
  // - "roadmap": Interactive SVG metro roadmap editor with drag/drop layout control.
  // - "feature": Two-dimensional Story Map (Feature Board) aligned with a selected product line.
  // - "snapshots": Dynamic database backup baseline capture & side-by-side comparative diagnostics.
  const [view, setView] = useState<'workspace' | 'roadmap' | 'feature' | 'snapshots'>('workspace');
  
  // Stores the active Product Line context when drilling down into a Story Map.
  const [activeLineId, setActiveLineId] = useState<ID | null>(null);
  
  // Custom global React Store hook connecting state state-modifiers, localStorage, and activity logs.
  const store = useWorkspaceStore();
  const { showToast } = useToast();

  // Stores transient search-highlighted indices queried from the Global Search box.
  const [searchSelectedStationId, setSearchSelectedStationId] = useState<ID | null>(null);
  const [searchSelectedCardId, setSearchSelectedCardId] = useState<ID | null>(null);

  /**
   * Navigates safely back to the high-level interactive Roadmap SVG editor.
   */
  const navigateToRoadmap = () => {
    setSearchSelectedStationId(null);
    setSearchSelectedCardId(null);
    setView('roadmap');
  };

  /**
   * Navigates into the Columnar Story Map corresponding to a specific product track.
   * Dynamically bootlegs or verifies backing layout tables/swimlanes exist.
   */
  const navigateToFeatureMap = (lineId: ID) => {
    setActiveLineId(lineId);
    store.ensureFeatureMap(lineId);
    setView('feature');
  };

  /**
   * Navigates up to the top-level Workspace Dashboard list.
   */
  const navigateHome = () => {
    setSearchSelectedStationId(null);
    setSearchSelectedCardId(null);
    setView('workspace');
  };

  /**
   * Triggered when a station is clicked inside Global Header search.
   * Forces view focus onto the Roadmap editor and registers high-contrast selection outlines.
   */
  const handleSelectStation = (stationId: ID) => {
    setSearchSelectedStationId(stationId);
    setSearchSelectedCardId(null);
    setView('roadmap');
  };

  /**
   * Triggered when a story card is clicked inside Global Header search.
   * Automatically switches view to the matching Feature Board swimlane layout and highlights the card.
   */
  const handleSelectCard = (lineId: ID, cardId: ID) => {
    setSearchSelectedCardId(cardId);
    setSearchSelectedStationId(null);
    navigateToFeatureMap(lineId);
  };

  /**
   * Compiles the entire current user workspace (lines, stations, story cards, dependencies, 
   * and historic audit logs) into a beautifully structured, indented local JSON text blob 
   * and initiates a client-side file download.
   */
  const handleExport = () => {
    try {
      const jsonString = JSON.stringify(store.workspace, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchorElement = document.createElement('a');
      downloadAnchorElement.setAttribute("href", url);
      
      const workspaceName = store.workspace.name || 'default';
      const cleanName = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchorElement.setAttribute("download", `metromap-roadmap-${cleanName}-${dateStr}.json`);
      
      document.body.appendChild(downloadAnchorElement);
      downloadAnchorElement.click();
      
      document.body.removeChild(downloadAnchorElement);
      URL.revokeObjectURL(url);
      
      showToast('Roadmap workspace exported successfully!', 'success');
    } catch (error) {
      console.error("Export failed:", error);
      showToast('Export failed. Please try again.', 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-150">
      {/* Global Navigation and Command Header */}
      <Header 
        view={view} 
        onHome={navigateHome} 
        onBack={navigateHome} 
        onExport={handleExport} 
        onSnapshots={() => setView('snapshots')}
        lastSaved={store.lastSaved} 
        workspace={store.workspace}
        onSelectStation={handleSelectStation}
        onSelectCard={handleSelectCard}
        onSelectLine={navigateToFeatureMap}
        onSelectRoadmap={navigateToRoadmap}
      />
      
      {/* 
        Active Worksite Render Canvas Portals
        Equipped with standard fluid entrance and exit transitions to prevent layout jumps 
        as the user toggles between the Multi-Line Dashboard, the Roadmap, and the Feature Board.
      */}
      <main className="flex-1 relative overflow-hidden">
        {/* AnimatePresence handles dynamic exit lifecycle synchronization for unmounting react nodes */}
        <AnimatePresence mode="wait">
          <motion.div
            // Unique key binds the animation lifecycle directly to active views and specific boards
            key={view === 'feature' ? `feature-${activeLineId}` : view}
            
            // Defines the state of the component when it first mounts (Subtle fade-in with minor y offset)
            initial={{ opacity: 0, y: 12 }}
            
            // Defines the active fully-loaded state
            animate={{ opacity: 1, y: 0 }}
            
            // Defines the exit state during view shifts (Graceful fade-out with slight upward momentum)
            exit={{ opacity: 0, y: -12 }}
            
            // High-precision timing parameters with customized cubic bezier-like easeCurves
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
            
            // Render on top of the layout container absolute viewport
            className="w-full h-full absolute inset-0 overflow-hidden"
          >
            {/* VIEW 1: Multi-Line Workspace Dashboard & Reporting Analytics */}
            {view === 'workspace' && (
              <WorkspaceList 
                workspace={store.workspace} 
                onOpenRoadmap={navigateToRoadmap}
                onOpenFeatureMap={navigateToFeatureMap}
                addLine={store.addLine}
                deleteLine={store.deleteLine}
                createSnapshot={store.createSnapshot}
              />
            )}
            
            {/* VIEW 2: Metro-Style Canvas Roadmap Editor with SVG rendering */}
            {view === 'roadmap' && (
              <RoadmapEditor 
                workspace={store.workspace} 
                updateStationPos={store.updateStationPos}
                updateStation={store.updateStation}
                deleteStation={store.deleteStation}
                addStation={store.addStation}
                toggleLineOnStation={store.toggleLineOnStation}
                addDependency={store.addDependency}
                removeDependency={store.removeDependency}
                deleteLine={store.deleteLine}
                highlightedStationId={searchSelectedStationId}
                moveStations={store.moveStations}
                deleteStations={store.deleteStations}
                duplicateStations={store.duplicateStations}
                bulkUpdateStations={store.bulkUpdateStations}
                bulkUpdateStationPositions={store.bulkUpdateStationPositions}
              />
            )}

            {/* VIEW 3: Two-Dimensional Swimlane Board mapping User Story Backlogs */}
            {view === 'feature' && activeLineId && (
              <FeatureBoard 
                workspace={store.workspace}
                lineId={activeLineId}
                addCard={store.addCard}
                updateCard={store.updateCard}
                deleteCard={store.deleteCard}
                moveCard={store.moveCard}
                reorderCard={store.reorderCard}
                searchedCardId={searchSelectedCardId}
              />
            )}

            {/* VIEW 4: Workspace Snapshot & Side-by-Side Compare Portal */}
            {view === 'snapshots' && (
              <SnapshotManager
                workspace={store.workspace}
                createSnapshot={store.createSnapshot}
                deleteSnapshot={store.deleteSnapshot}
                restoreSnapshot={store.restoreSnapshot}
                onBack={navigateHome}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Auto-Persistence Feedback Indicator */}
      <div className="fixed bottom-4 right-4 text-[10px] text-slate-400 uppercase tracking-widest pointer-events-none w-auto h-auto z-10">
        Local-First Storage Active
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
