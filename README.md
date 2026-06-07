# Open Source Atlas

Open Source Atlas is an interactive data-visualization project that maps 500 open source repositories into a navigable software landscape. Instead of presenting repositories as a ranked list of GitHub stars, the project organizes them by the type of value they create: infrastructure, utility, startup-oriented tools, viral developer tools, creative software, learning resources, and ambitious experimental projects.

The project was originally built for DIG 345: Radical Software, but it is also a full-stack software engineering portfolio project focused on structured data modeling, interactive UI architecture, client-side state management, and data-driven storytelling.

![Open Source Atlas demo](demo.png)

## Live Concept

The central question behind the project is:

> What does the open source community seem to value most?

To explore that question, the app treats open source as a cultural and technical ecosystem rather than a simple popularity contest. Each repository becomes a marker on a vintage atlas. Each region represents a different category of open source work. Clicking a repository opens a story card with its creator, origin, motivation, metrics, and external links when available.

## Key Features

- Interactive SVG atlas with zoom, pan, animated camera movement, and region focus states
- 500-repository local dataset based on GitHub repository metadata
- Schema-driven repository records with creator, metrics, classification, summary, story, and research status fields
- Search and filter system across region, primary language, star range, time to value, and ecosystem impact
- Repository story cards that connect technical metrics with project origin, motivation, turning point, and philosophy
- Guided intro sequence that highlights representative projects such as Homebrew, Linux, System Design Primer, Three.js, and Storybook
- Responsive vintage-map interface designed to feel exploratory rather than dashboard-like

## Technical Stack

- **React** for component architecture, UI state, filtering logic, and interaction flow
- **Vite** for local development and production builds
- **SVG** for the main atlas rendering layer
- **D3 force/layout utilities** for spatial marker positioning
- **GSAP** for camera transitions, zoom animation, and guided story movement
- **CSS** for the vintage atlas visual system, responsive layout, and interaction states
- **Static JSON** as the local data source

## Data Methodology

The dataset contains 500 repositories designed to show a broad cross-section of open source work. The goal was not to select only the most-starred repositories. Instead, the dataset intentionally includes different types of projects: foundational infrastructure, small utilities, developer tools, startup platforms, creative frameworks, learning resources, and experimental or niche projects.

Each repository follows a consistent data model:

- `name` and `repo_full_name`
- `url`
- `creator` metadata
- `year_created`
- `metrics`, including stars, forks, and contributors
- `classification`, including atlas region, time-to-value score, and ecosystem-impact score
- `summary`, including description and origin story
- `story`, including motivation, turning point, philosophy, story type, and external links
- `research_status`, used to track enrichment and verification state

The classifications are interpretive rather than absolute. Many open source projects fit multiple categories at once. For example, a tool can be both infrastructure and developer experience, or both a learning resource and a community reference. The atlas uses these categories as one analytical lens for understanding the ecosystem, not as a fixed universal taxonomy.

## Map Methodology

The map uses a hybrid layout approach. It behaves partly like a scatterplot, but it is intentionally constrained into organic atlas regions so the final interface reads as a software landscape.

- The **x-axis** represents time to value: how quickly a repository becomes useful to a developer or team.
- The **y-axis** represents ecosystem impact: how foundational or influential the repository appears to be within the broader software world.
- Repositories are grouped into atlas regions using their classification metadata.
- Marker placement is adjusted with layout utilities so repositories spread naturally, avoid excessive overlap, and remain visually readable.
- Region shapes, coastlines, parcel lines, labels, and decorative map details are generated in code rather than drawn manually.

This creates a balance between data structure and visual storytelling: the map preserves analytical meaning while still feeling like an explorable atlas.

## Engineering Highlights

- Built a normalized client-side data layer that converts raw repository records into stable IDs, taxonomy fields, filter metadata, and display-ready story content.
- Implemented multi-dimensional filtering with debounced search to keep the interface responsive while searching across names, creators, descriptions, stories, languages, and regions.
- Designed an interactive map component that separates data positioning, visual rendering, camera state, and repository selection behavior.
- Used deterministic layout helpers so the atlas remains stable across renders while still producing organic map-like placement.
- Added progressive disclosure in the map UI, including marker scaling, label collision handling, zoom-dependent labels, region flyouts, and selected-repository detail panels.
- Preserved a static-data architecture so the project can be deployed as a lightweight frontend while still demonstrating data modeling and product-level engineering decisions.

## Project Structure

```text
src/
  App.jsx              Main application state, filters, intro flow, and panels
  main.jsx             React entry point
  components/
    Map.jsx            Interactive SVG atlas renderer
  lib/
    forces.js          Repository positioning and layout helpers
    layout.js          Shared map dimensions and geometry utilities
    regions.js         Procedural atlas region generation
    taxonomy.js        Repository normalization and classification helpers
  styles.css           Visual system and responsive UI styles

500_popular_repos.json Local repository dataset used by the app
schema.json            Dataset schema reference
```

## Run Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Portfolio Relevance

This project demonstrates full-stack engineering skills through a frontend-heavy but data-rich application: schema design, data normalization, product reasoning, interactive rendering, algorithmic layout, state management, and deployment-friendly architecture. The app is intentionally built without a required backend so it can be served as a static project, but its data model and interaction patterns are designed to be extensible to an API-backed version.
