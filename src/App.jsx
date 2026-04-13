import { useState } from "react";
import sourceRepos from "../data.json";

const colors = {
  "Viral Tools": "#cf7047",
  Infrastructure: "#5c7280",
  Utility: "#6f8f55",
  Learning: "#a88452",
  Creative: "#8a68a7",
  Startup: "#bc6a84",
  "Ambitious but Obscure": "#8a7463",
};

const regions = [
  { name: "Viral Tools", className: "region-viral" },
  { name: "Infrastructure", className: "region-infra" },
  { name: "Utility", className: "region-utility" },
  { name: "Learning", className: "region-learning" },
  { name: "Creative", className: "region-creative" },
  { name: "Startup", className: "region-startup" },
  { name: "Ambitious but Obscure", className: "region-obscure" },
];

const repos = sourceRepos.map((repo, index) => ({
  ...repo,
  id:
    repo.id ||
    repo.repo_full_name?.replace("/", "-").toLowerCase() ||
    `${repo.name.toLowerCase().replace(/\s+/g, "-")}-${index}`,
}));

function shortNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function dotSize(stars) {
  if (stars > 200000) return 22;
  if (stars > 100000) return 18;
  if (stars > 50000) return 14;
  return 10;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function spreadRepos(repoList) {
  const buckets = {};

  repoList.forEach((repo) => {
    const x = repo.classification.time_to_value_score;
    const y = repo.classification.ecosystem_score;
    const bucketKey = `${Math.round(x * 12)}-${Math.round(y * 12)}`;

    if (!buckets[bucketKey]) buckets[bucketKey] = [];
    buckets[bucketKey].push(repo);
  });

  return repoList.map((repo) => {
    const x = repo.classification.time_to_value_score;
    const y = repo.classification.ecosystem_score;
    const bucketKey = `${Math.round(x * 12)}-${Math.round(y * 12)}`;
    const group = buckets[bucketKey];
    const index = group.findIndex((item) => item.id === repo.id);

    if (group.length === 1) {
      return {
        ...repo,
        plotX: x,
        plotY: y,
      };
    }

    const angle = (index / group.length) * Math.PI * 2;
    const ring = Math.floor(index / 6) + 1;
    const offset = 0.018 * ring;

    return {
      ...repo,
      plotX: clamp(x + Math.cos(angle) * offset, 0.02, 0.98),
      plotY: clamp(y + Math.sin(angle) * offset, 0.02, 0.98),
    };
  });
}

const plottedRepos = spreadRepos(repos);

export default function App() {
  const [activeRepo, setActiveRepo] = useState(plottedRepos[0]);

  return (
    <main className="page-shell">
      <section className="map-panel map-panel--full">
        <div className="section-heading">
          <div className="section-heading__text">
            <h1>Map of open source success</h1>
          </div>
          <p className="section-note">x = time to value, y = ecosystem impact</p>
        </div>

        <div className="map-wrapper">
          <div className="map-axis map-axis--x">
            <span>instant gratification</span>
            <span>long-term investment</span>
          </div>

          <div className="map-axis map-axis--y">
            <span>ecosystem builder</span>
            <span>solo use / niche</span>
          </div>

          <div className="map-surface">
            <div className="map-grid" />
            <div className="quadrant-label quadrant-label--tl">quick wins / big reach</div>
            <div className="quadrant-label quadrant-label--tr">slow burn / infrastructure</div>
            <div className="quadrant-label quadrant-label--bl">small helpful things</div>
            <div className="quadrant-label quadrant-label--br">deeper tools / smaller crowd</div>

            {regions.map((region) => (
              <div key={region.name} className={`region-shape ${region.className}`}>
                {region.name}
              </div>
            ))}

            {plottedRepos.map((repo) => {
              const left = `${repo.plotX * 100}%`;
              const top = `${(1 - repo.plotY) * 100}%`;
              const isActive = activeRepo?.id === repo.id;

              return (
                <button
                  key={repo.id}
                  type="button"
                  className={`repo-dot ${isActive ? "is-active" : ""}`}
                  style={{
                    left,
                    top,
                    width: `${dotSize(repo.metrics.stars)}px`,
                    height: `${dotSize(repo.metrics.stars)}px`,
                    background: colors[repo.classification.island] || "#8a7463",
                  }}
                  onMouseEnter={() => setActiveRepo(repo)}
                  onFocus={() => setActiveRepo(repo)}
                  onClick={() => setActiveRepo(repo)}
                  aria-label={repo.name}
                />
              );
            })}

            {activeRepo && (
              <div className="map-card">
                <p className="eyebrow">{activeRepo.classification.island}</p>
                <h2>{activeRepo.name}</h2>
                <p className="map-card__repo">{activeRepo.repo_full_name}</p>
                <p>{activeRepo.summary.description}</p>
                <p className="map-card__meta">
                  {activeRepo.creator.name} · {activeRepo.year_created} · {shortNumber(activeRepo.metrics.stars)} stars
                </p>
                <p className="map-card__story">{activeRepo.summary.origin_story}</p>
              </div>
            )}
          </div>
        </div>

        <div className="legend">
          <div className="legend__intro">
            <p className="eyebrow">island key</p>
          </div>

          <div className="legend__grid">
            <div className="legend__item">
              <span className="legend__swatch" style={{ background: colors["Viral Tools"] }} />
              <div>
                <strong>Viral Tools</strong>
                <p>Fast to adopt, easy to show to other people, often spread through immediate usefulness.</p>
              </div>
            </div>

            <div className="legend__item">
              <span className="legend__swatch" style={{ background: colors.Infrastructure }} />
              <div>
                <strong>Infrastructure</strong>
                <p>Foundational systems, frameworks, and tools that support a lot of downstream work.</p>
              </div>
            </div>

            <div className="legend__item">
              <span className="legend__swatch" style={{ background: colors.Utility }} />
              <div>
                <strong>Utility</strong>
                <p>Smaller practical tools that fit into personal workflows without becoming broad platforms.</p>
              </div>
            </div>

            <div className="legend__item">
              <span className="legend__swatch" style={{ background: colors.Learning }} />
              <div>
                <strong>Learning</strong>
                <p>Repos that teach, document, or help people enter a field through examples and guides.</p>
              </div>
            </div>

            <div className="legend__item">
              <span className="legend__swatch" style={{ background: colors.Creative }} />
              <div>
                <strong>Creative</strong>
                <p>Tools oriented toward expression, experimentation, or making media, art, games, and interfaces.</p>
              </div>
            </div>

            <div className="legend__item">
              <span className="legend__swatch" style={{ background: colors.Startup }} />
              <div>
                <strong>Startup</strong>
                <p>Product-minded tools that package a bigger workflow or business use case into something usable.</p>
              </div>
            </div>

            <div className="legend__item">
              <span className="legend__swatch" style={{ background: colors["Ambitious but Obscure"] }} />
              <div>
                <strong>Ambitious but Obscure</strong>
                <p>Strong ideas and deeper commitments, but with smaller audiences or more specialized appeal.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
