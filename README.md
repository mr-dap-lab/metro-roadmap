# 🚇 Metro Roadmap

> A visual product roadmap tool styled as a metro map — where **product lines are transit tracks**, **milestones are stations**, and **user stories are the backlog that rides the rails**.

Built for Product Owners and Scrum Masters who think spatially about delivery. Plan multiple product streams on a shared canvas, link dependencies between milestones, and drill into swimlane story maps — all without leaving the app. No backend. No sign-up. Everything lives in your browser.

---

## ✨ What it does

Metro Roadmap is a four-view product planning workspace:

### 🗺️ Metro Roadmap Editor
An interactive SVG canvas where you lay out your roadmap as a metro map. Each **product line** (stream or team track) is a colored rail. Each **station** is a milestone, feature release, phase boundary, or integration gate. Drag stations freely, connect dependencies with arrows, and see the full delivery picture at a glance.

### 📋 Feature Board
Drill into any product line and get a **two-dimensional story map** — swimlane rows (layers) on the Y axis, timeline segments on the X axis. Cards can be Epics, Capabilities, Features, Stories, or Tasks. Move, reorder, tag, estimate, and prioritize without losing context.

### 🏠 Workspace Dashboard
The top-level view showing all your product lines at once with high-level stats. Add or remove lines, jump into any roadmap or feature board, and capture workspace snapshots.

### 📸 Snapshot Manager
Save named snapshots of your entire workspace at any point in time — lines, stations, dependencies, and story cards. Compare states, restore previous versions, and keep an audit trail of decisions.

---

## 🛠️ Tech stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (99%+) |
| Framework | React 18 |
| Animations | Motion/React (Framer Motion) |
| State | Custom Zustand-style store with localStorage persistence |
| Styling | Tailwind CSS (dark mode supported) |
| Build | Vite |
| AI scaffold | Google AI Studio / Gemini API |

---

## 🚀 Run locally

**Prerequisites:** Node.js 18+

```bash
# 1. Clone the repo
git clone https://github.com/mr-dap-lab/metro-roadmap.git
cd metro-roadmap

# 2. Install dependencies
npm install

# 3. Set your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 4. Start the dev server
npm run dev
```

> 🔑 Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com)

---

## 📐 Data model

The workspace is a self-contained JSON graph you can export at any time.

```
Workspace
├── Lines[]          → Product streams / team tracks (colored rails)
│   └── stationIds[] → Ordered milestone sequence on this track
├── Stations[]       → Milestones, features, phase boundaries, integrations
│   ├── type         → MILESTONE | PHASE_BOUNDARY | FEATURE | INTEGRATION
│   ├── lineIds[]    → Which lines pass through (enables junctions)
│   ├── status       → Planned | In Progress | Completed
│   └── x, y         → Canvas coordinates (drag-and-drop)
├── Dependencies[]   → Directional blocking arrows between stations
├── FeatureMaps[]    → One story map grid per product line
│   ├── Layers[]     → Swimlane rows (e.g. MVP, Stretch Goals)
│   └── Cards[]      → User stories mapped to segments & layers
│       └── type     → EPIC | CAPABILITY | FEATURE | STORY | TASK
├── ActivityLog[]    → Full audit trail of create/update/delete/move actions
└── Snapshots[]      → Named point-in-time workspace saves
```

---

## 📂 Project structure

```
metro-roadmap/
├── components/          # All React UI components
│   ├── RoadmapEditor    # SVG metro canvas with drag/drop
│   ├── FeatureBoard     # Swimlane story map grid
│   ├── WorkspaceList    # Dashboard & stats
│   ├── SnapshotManager  # Version capture & restore
│   ├── Header           # Global nav & search
│   ├── Toast            # Notification system
│   └── ThemeContext     # Dark/light mode provider
├── utils/               # Shared helpers
├── App.tsx              # Root app & view router
├── store.ts             # Global state with localStorage persistence
├── types.ts             # Full TypeScript type definitions
├── documentation.tsx    # In-app docs component
├── index.tsx            # React entry point
└── vite.config.ts       # Build configuration
```

---

## 🗺️ Roadmap

- [ ] Export to PNG / PDF
- [ ] Multi-user / real-time collaboration
- [ ] Jira / Linear import
- [ ] AI-assisted story generation via Gemini
- [ ] Sprint capacity overlay on the roadmap canvas
- [ ] Public shareable read-only link

---

## 🤝 Contributing

PRs welcome. Keep changes focused, TypeScript strict, and the build green.

## 📄 License

[MIT](./LICENSE)

---

*Built by [Diego Avella](https://github.com/mr-dap-lab) · Certified Scrum Master & Product Owner · AI product strategist.*


# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/efa94894-8b1b-4c6a-8080-9b34551c4838

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
