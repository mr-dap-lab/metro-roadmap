
/**
 * Global ID type used across the application.
 */
export type ID = string;

/**
 * Enumeration representing the different visual shapes and functional types of Metro Stations.
 */
export enum StationType {
  MILESTONE = 'MILESTONE',          // A standard delivery milestone or milestone marker
  PHASE_BOUNDARY = 'PHASE_BOUNDARY', // Boundary marking a shift from one project phase to another
  FEATURE = 'FEATURE',              // A general feature release point on the line
  INTEGRATION = 'INTEGRATION'       // An integration gate matching other third-party dependencies
}

/**
 * Enumeration representing different priority tiers or granularity types for story board Cards.
 */
export enum CardType {
  EPIC = 'EPIC',
  CAPABILITY = 'CAPABILITY',
  FEATURE = 'FEATURE',
  STORY = 'STORY',
  TASK = 'TASK'
}

/**
 * Dynamic metadata block for flexible attribute binding on various objects.
 */
export interface Metadata {
  [key: string]: string | number | boolean;
}

/**
 * Definition of a Station (Transit Node on a Metro Track).
 * Represented as nodes on the roadmap canvas.
 */
export interface Station {
  id: ID;
  title: string;
  type: StationType;
  x: number;                        // Relative canvas coordinates (horizontal position)
  y: number;                        // Relative canvas coordinates (vertical position)
  lineIds: ID[];                    // Track lines passing through this station (enabling junctions/interchanges)
  startDate?: string;               // Optional target start scheduling bounds
  endDate?: string;                 // Optional target completion or milestone delivery date
  status?: string;                  // Milestone active status ('Planned', 'In Progress', 'Completed', etc.)
  owner?: string;                   // Lead owner or squad name
  icon?: string;                    // Emoji or SVG glyph symbol used for the node rendering
  metadata: Metadata;               // Arbitrary dynamic attributes
}

/**
 * Definition of a Metro Line (representing a Product Line, Stream, or Track).
 */
export interface Line {
  id: ID;
  name: string;                     // The name of the Product Stream (e.g. "Platform", "Mobile App")
  color: string;                    // Saturated HEX color used to stroke track lines & highlight theme elements
  shortCode: string;                // Short identifier (e.g. "PT", "MOB")
  stationIds: ID[];                 // Ordered list of Station IDs that form this line track sequentially
  isVisible: boolean;               // Visibility toggle in viewer sidebar
  metadata: Metadata;
}

/**
 * Represents a directional dependency connection line linking two different Stations on the map.
 */
export interface Dependency {
  id: ID;
  fromStationId: ID;                // Blocking/preceding station node ID
  toStationId: ID;                  // Blocked/subsequent target milestone node ID
  metadata: Metadata;
}

/**
 * A user-story / backlog card placed within the User Story Feature Map board grid.
 */
export interface Card {
  id: ID;
  title: string;
  description: string;
  type: CardType;
  status: string;                   // Workflow column status
  priority: number;                 // Order relative to other cards inside the cell
  owner?: string;
  estimate?: string;                // T-Shirt size or story points
  complexityScore?: number;         // Complexity score (effort estimate in story points or hours)
  tags: string[];
  sourceStationId?: ID;             // Mapped directly to an exact station node
  sourceSegmentId?: ID;             // Mapped directly to a segment (represented by its starting station ID)
  dueDate?: string;                 // Target due date for completion (YYYY-MM-DD)
  isHighPriority?: boolean;         // Flag representing high priority item
  metadata: Metadata;               // Custom layout mappings (e.g. layerId/priority row indexes)
}

/**
 * Horizontal priority slice or theme layer segment on the Story Map (Feature Board grid).
 */
export interface Layer {
  id: ID;
  name: string;                     // Row name (e.g., "MVP Layer", "Stretch Goals")
  color?: string;                   // Optional accent color for row cards
}

/**
 * Maps a single Metro Line to its corresponding user story grid board,
 * binding story layers (swimlanes/rows) and backlog cards.
 */
export interface FeatureMap {
  id: ID;
  lineId: ID;                       // Associated Metro Line track
  name: string;
  layers: Layer[];                  // Swimlane definitions
  cards: Card[];                    // Flat story collection mapped by segment & layer attributes
}

/**
 * Top-level workspace structure containing the entire graph roadmap and backlog model.
 */
export interface Workspace {
  id: ID;
  name: string;
  schemaVersion: number;
  lines: Line[];
  stations: Station[];
  dependencies: Dependency[];
  featureMaps: FeatureMap[];
  activityLog?: ActivityLogItem[];  // Historic audit trail of updates made inside the workspace
  snapshots?: WorkspaceSnapshot[];  // Saved versions of the workspace configuration
}

/**
 * Capture of a workspace state at a specific point in time.
 * Allows comparison or rollbacks.
 */
export interface WorkspaceSnapshot {
  id: ID;
  name: string;
  description?: string;
  timestamp: string;                // ISO 8601 string of when the snapshot was saved
  lines: Line[];                    // Deep independent clone of visual track lines
  stations: Station[];              // Deep independent clone of milestones/interchanges
  dependencies: Dependency[];      // Deep independent clone of prerequisite mappings
  featureMaps: FeatureMap[];        // Deep independent clone of backlog matrices
}

/**
 * Item element in the audit trail / activity logger showing change operations.
 */
export interface ActivityLogItem {
  id: ID;
  timestamp: string;                // Accurate action execution moment (ISO 8601 string)
  action: 'create' | 'update' | 'delete' | 'move' | 'associate' | 'dependency_add' | 'dependency_remove';
  entityType: 'line' | 'station' | 'card' | 'dependency';
  entityId: ID;
  entityName: string;
  details: string;                  // Detailed summary explanation of the user's action
}

