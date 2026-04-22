import React, { useMemo, useState } from "react";
import sourceRepos from "../data.json";
import Map from "./components/Map";

const colors = {
  "Viral Tools": "#d98c4e",
  Infrastructure: "#819f88",
  Utility: "#c9b07d",
  Learning: "#d8cfc0",
  Creative: "#b48b73",
  Startup: "#d6a26c",
  "Ambitious but Obscure": "#9e9787",
};

const islandDescriptions = {
  "Viral Tools": "Fast to adopt, easy to show to other people, often spread through immediate usefulness.",
  Infrastructure: "Foundational systems, frameworks, and tools that support a lot of downstream work.",
  Utility: "Smaller practical tools that fit into personal workflows without becoming broad platforms.",
  Learning: "Repos that teach, document, or help people enter a field through examples and guides.",
  Creative: "Tools oriented toward expression, experimentation, or making media, art, games, and interfaces.",
  Startup: "Product-minded tools that package a bigger workflow or business use case into something usable.",
  "Ambitious but Obscure": "Strong ideas and deeper commitments, but with smaller audiences or more specialized appeal.",
};

const repos = sourceRepos.map((repo, index) => ({
  ...repo,
  id:
    repo.id ||
    repo.repo_full_name?.replace("/", "-").toLowerCase() ||
    `${repo.name.toLowerCase().replace(/\s+/g, "-")}-${index}`,
}));

export default function App() {
  const [activeRepoId, setActiveRepoId] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const activeRepo = useMemo(
    () => repos.find((repo) => repo.id === activeRepoId) || null,
    [activeRepoId],
  );

  const legendItems = useMemo(
    () =>
      Object.keys(colors).map((island) => ({
        island,
        color: colors[island],
        description: islandDescriptions[island],
        count: repos.filter((repo) => repo.classification.island === island).length,
      })),
    [],
  );

  return (
    <main className="page-shell">
      <section className="map-panel map-panel--full">
        <div className="section-heading">
          <div className="section-heading__text">
            <h1>Map of open source success</h1>
          </div>
          <p className="section-note">x = time to value, y = ecosystem impact</p>
        </div>

        <Map
          repos={repos}
          colors={colors}
          activeRepo={activeRepo}
          onSelectRepo={(repo) => setActiveRepoId(repo?.id ?? null)}
        />

        <div className={`legend ${legendOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="legend__toggle"
            onClick={() => setLegendOpen((open) => !open)}
            aria-expanded={legendOpen}
            aria-controls="atlas-legend-panel"
          >
            <span>Island key</span>
            <span className="legend__toggle-icon">{legendOpen ? "−" : "+"}</span>
          </button>

          <div id="atlas-legend-panel" className="legend__panel" hidden={!legendOpen}>
            <div className="legend__intro">
              <p className="eyebrow">categories</p>
            </div>

            <div className="legend__grid">
              {legendItems.map((item) => (
                <button
                  key={item.island}
                  type="button"
                  className={`legend__item ${activeRepo?.classification.island === item.island ? "is-active" : ""}`}
                  onClick={() => {
                    const match = repos.find((repo) => repo.classification.island === item.island);
                    if (match) setActiveRepoId(match.id);
                    setLegendOpen(false);
                  }}
                >
                  <span className="legend__swatch" style={{ background: item.color }} />
                  <div>
                    <strong>
                      {item.island} <span className="legend__count">({item.count})</span>
                    </strong>
                    <p>{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
