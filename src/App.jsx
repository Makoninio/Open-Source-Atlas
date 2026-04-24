import { useMemo, useState } from "react";
import sourceRepos from "../data.json";
import Map from "./components/Map";
import { continentMeta, getContinent, normalizeRepo } from "./lib/taxonomy";

const repos = sourceRepos.map(normalizeRepo);

function shortNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function App() {
  const [activeRepoId, setActiveRepoId] = useState(null);
  const [activeIsland, setActiveIsland] = useState(null);

  const activeRepo = useMemo(
    () => repos.find((repo) => repo.id === activeRepoId) || null,
    [activeRepoId],
  );
  const repoHomepage = activeRepo?.story?.links?.homepage;
  const repoLink = activeRepo?.url;

  const totalStars = useMemo(
    () => repos.reduce((sum, r) => sum + (r.metrics?.stars || 0), 0),
    [],
  );

  const legendItems = useMemo(() => {
    const counts = repos.reduce((acc, repo) => {
      const continent = getContinent(repo);
      acc[continent] = (acc[continent] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([continent, count]) => ({
        island: continent,
        color: continentMeta[continent]?.color || "#8f8a7c",
        description: continentMeta[continent]?.description || "",
        count,
      }));
  }, []);

  const colors = useMemo(
    () => Object.fromEntries(legendItems.map((item) => [item.island, item.color])),
    [legendItems],
  );

  const focusedIsland =
    (activeRepo && getContinent(activeRepo) !== "Unclassified"
      ? getContinent(activeRepo)
      : null) ?? activeIsland;

  const focusedData = focusedIsland
    ? legendItems.find((item) => item.island === focusedIsland)
    : null;

  const focusedRepos = useMemo(
    () => repos.filter((repo) => !focusedIsland || getContinent(repo) === focusedIsland),
    [focusedIsland],
  );

  const focusedStats = useMemo(() => {
    const scope = focusedRepos.length ? focusedRepos : repos;
    const totalScopeStars = scope.reduce((sum, repo) => sum + (repo.metrics?.stars || 0), 0);
    const averageTime =
      scope.reduce((sum, repo) => sum + (repo.classification?.time_to_value_score || 0), 0) /
      scope.length;
    const averageImpact =
      scope.reduce((sum, repo) => sum + (repo.classification?.ecosystem_score || 0), 0) /
      scope.length;

    return {
      stars: totalScopeStars,
      averageTime,
      averageImpact,
    };
  }, [focusedRepos]);

  const yearRange = useMemo(() => {
    const years = repos.map((r) => r.year_created).filter(Boolean);
    if (!years.length) return "—";
    return `${Math.min(...years)}–${Math.max(...years)}`;
  }, []);

  const hasSelection = Boolean(activeRepo);

  return (
    <div className={`atlas-shell ${hasSelection ? "has-selection" : ""}`}>
      <div className="atlas-body">
        <main className="atlas-map-area">
          <div className="atlas-brand-corner">
            <div className="atlas-brand-corner__title">Open Source Atlas</div>
            <div className="atlas-brand-corner__meta">
              {shortNumber(totalStars)} stars · {repos.length} repos · {yearRange}
            </div>
          </div>

          <div className="atlas-floating-bar" role="navigation" aria-label="Section filter">
            <button
              type="button"
              className={`floating-pill ${focusedIsland === null ? "is-active" : ""}`}
              onClick={() => setActiveIsland(null)}
            >
              <span className="floating-pill__label">All</span>
            </button>
            {legendItems.map((item) => (
              <button
                key={item.island}
                type="button"
                className={`floating-pill ${focusedIsland === item.island ? "is-active" : ""}`}
                onClick={() =>
                  setActiveIsland((prev) => (prev === item.island ? null : item.island))
                }
                title={item.island}
              >
                <span className="floating-pill__dot" style={{ background: item.color }} />
                <span className="floating-pill__label">{item.island.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          <aside className={`atlas-flyout ${focusedData ? "is-open" : ""}`}>
            {focusedData && (
              <>
                <p className="atlas-flyout__label">Map Key</p>
                <div className="atlas-flyout__title-row">
                  <span className="atlas-flyout__swatch" style={{ background: focusedData.color }} />
                  <span className="atlas-flyout__title">{focusedData.island}</span>
                </div>
                <p className="atlas-flyout__desc">{focusedData.description}</p>
                <div className="territory-detail">
                  <div className="territory-detail__count">
                    {focusedData.count} repositories
                  </div>
                  <div className="territory-detail__tagline">
                    {continentMeta[focusedData.island]?.tagline || "Atlas territory"}
                  </div>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <div className="stat-item__value">{shortNumber(focusedStats.stars)}</div>
                      <div className="stat-item__label">Stars in region</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-item__value">{focusedData.count}</div>
                      <div className="stat-item__label">Repos mapped</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-item__value">{focusedStats.averageTime.toFixed(2)}</div>
                      <div className="stat-item__label">Avg. time score</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-item__value">{focusedStats.averageImpact.toFixed(2)}</div>
                      <div className="stat-item__label">Avg. impact score</div>
                    </div>
                  </div>
                </div>
                <div className="atlas-flyout__axes">
                  <div><strong>x</strong> Time to value</div>
                  <div><strong>y</strong> Ecosystem impact</div>
                </div>
              </>
            )}
          </aside>

          <Map
            repos={repos}
            colors={colors}
            focusedIsland={focusedIsland}
            labelMeta={continentMeta}
            activeRepo={activeRepo}
            onSelectRepo={(repo) => {
              setActiveRepoId(repo?.id ?? null);
              if (repo) setActiveIsland(getContinent(repo));
            }}
          />
        </main>

        {activeRepo && (
          <aside className="atlas-rightpanel">
            <div className="panel-card">
              <p className="panel-card__label">Repo Profile</p>
              <div className="repo-detail">
                <div className="repo-detail__name">{activeRepo.name}</div>
                <div className="repo-detail__meta">
                  {activeRepo.creator?.name} · {activeRepo.year_created}
                </div>
                <div className="repo-detail__stars">
                  ★ {shortNumber(activeRepo.metrics?.stars || 0)}
                </div>
                <p className="repo-detail__story">
                  {activeRepo.story?.motivation || activeRepo.story?.origin || activeRepo.summary?.origin_story}
                </p>
                <div className="repo-detail__links">
                  {repoLink && (
                    <a
                      className="repo-detail__link"
                      href={repoLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View repository
                    </a>
                  )}
                  {repoHomepage && (
                    <a
                      className="repo-detail__link"
                      href={repoHomepage}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit website
                    </a>
                  )}
                </div>
                <div className="repo-detail__chips">
                  <span className="repo-detail__chip">{getContinent(activeRepo)}</span>
                  {activeRepo.taxonomy?.country && (
                    <span className="repo-detail__chip">{activeRepo.taxonomy.country}</span>
                  )}
                  {activeRepo.taxonomy?.state && (
                    <span className="repo-detail__chip">{activeRepo.taxonomy.state}</span>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
