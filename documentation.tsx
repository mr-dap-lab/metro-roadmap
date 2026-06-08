
import React from 'react';

const Documentation: React.FC = () => {
  return (
    <div className="p-8 prose prose-slate max-w-none">
      <h1>Functional Specification & UX Flow</h1>
      
      <h3>Module 1: Metro Roadmap Builder</h3>
      <ul>
        <li>Spatial metaphor for product strategy. Projects move from one logical milestone to another.</li>
        <li>UX Flow: User lands on Workspace -> Creates a Line -> Enters Roadmap Canvas -> Clicks to place Stations -> Drags Stations to form Metro Path.</li>
        <li>Geometry: Constraints ensure segments are Horizontal, Vertical, or 45-degree diagonal, mirroring professional transit maps.</li>
      </ul>

      <h3>Module 2: Feature Map (Story Map)</h3>
      <ul>
        <li>Tactical decomposition of the roadmap. Horizontal axis is derived directly from the roadmap's stations.</li>
        <li>UX Flow: Select a Line from Workspace -> Feature Board opens -> Columns match segments between Stations -> Vertical layers represent Priority/Delivery phases.</li>
        <li>Sync: If a station title changes in the Roadmap, it reflects in the Feature Board column header immediately.</li>
      </ul>

      <h1>Domain Model (TypeScript)</h1>
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl">
{`interface Station {
  id: ID;
  title: string;
  x: number;
  y: number;
  lineIds: ID[]; // Junctions
}

interface Line {
  id: ID;
  color: string;
  stationIds: ID[]; // Ordered path
}

interface FeatureMap {
  lineId: ID;
  layers: Layer[];
  cards: Card[];
}`}
      </pre>

      <h1>Implementation Milestones</h1>
      
      <h3>Milestone 1: The Infinite Canvas</h3>
      <ul>
        <li>Goal: Functional SVG grid with pan/zoom.</li>
        <li>Demo: User can click to spawn nodes on a persistent grid.</li>
      </ul>

      <h3>Milestone 2: The Metro Engine</h3>
      <ul>
        <li>Goal: Path rendering with snapping logic.</li>
        <li>Demo: Moving a station makes the connecting line segments snap to 45/90 degrees. No geometry hiccups allowed.</li>
      </ul>

      <h3>Milestone 3: Feature Board Transformation</h3>
      <ul>
        <li>Goal: Map roadmap segments to columns.</li>
        <li>Demo: Create a roadmap path with 3 stations. See 2 columns appear in the Feature Board.</li>
      </ul>

      <h3>Milestone 4: Backlog Management</h3>
      <ul>
        <li>Goal: Card CRUD and persistence.</li>
        <li>Demo: Add cards to columns, drag them between priority layers. Data survives browser refresh via localStorage.</li>
      </ul>

      <h1>Critical Algorithms</h1>
      
      <h3>Metro Snapping</h3>
      <p>Calculates the angle between current point and anchor point. If within ~22.5 degrees of a cardinal or ordinal direction, it snaps the x/y coordinates to maintain the angle precisely.</p>

      <h3>Safe Sync</h3>
      <p>When syncing, we never delete user-created backlog cards. We match <code>sourceSegmentId</code>. If a segment is removed from the roadmap, the column is marked "Stale" or "Archived" in the UI rather than disappearing with its data.</p>
    </div>
  );
};

export default Documentation;
