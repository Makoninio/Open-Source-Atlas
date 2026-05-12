import { useEffect, useMemo, useState } from "react";
import sourceRepos from "../500_popular_repos.json";
import Map from "./components/Map";
import { continentMeta, getContinent, normalizeRepo } from "./lib/taxonomy";

const repos = sourceRepos.map(normalizeRepo);
const INTRO_STORAGE_KEY = "open-source-atlas-intro-complete";
const SEARCH_DEBOUNCE_MS = 180;

const REGION_OPTIONS = [
  "Infrastructure",
  "Utility",
  "Startup",
  "Viral Tools",
  "Creative",
  "Learning",
  "Ambitious but Obscure",
];

const LANGUAGE_OPTIONS = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C++", "Other"];
const STAR_OPTIONS = ["Under 1K", "1K-10K", "10K-50K", "50K-100K", "100K+"];
const TIME_TO_VALUE_OPTIONS = ["Immediate", "Short setup", "Moderate learning curve", "Long adoption curve"];
const ECOSYSTEM_OPTIONS = ["Low", "Medium", "High", "Foundational"];

const FILTER_GROUPS = [
  { key: "regions", title: "Region", options: REGION_OPTIONS },
  { key: "languages", title: "Primary language", options: LANGUAGE_OPTIONS },
  { key: "stars", title: "Stars", options: STAR_OPTIONS },
  { key: "timeToValue", title: "Time to value", options: TIME_TO_VALUE_OPTIONS },
  { key: "ecosystemImpact", title: "Ecosystem impact", options: ECOSYSTEM_OPTIONS },
];

const emptyFilters = {
  query: "",
  regions: [],
  languages: [],
  stars: [],
  activity: [],
  projectTypes: [],
  timeToValue: [],
  ecosystemImpact: [],
};

const introSteps = [
  {
    id: "opening",
    title: "Every repo began as a decision to share.",
    body: "This is an atlas of open source creation: the people, problems, and communities behind the software we use every day.",
    highlightedRepoId: null,
    zoom: 0.74,
  },
  {
    id: "map-shows",
    title: "Each point is a project.",
    body: "Every marker represents an open source repository. The islands group projects by the kind of value they create, from infrastructure and learning resources to creative tools and fast-growing developer platforms.",
    highlightedRepoId: null,
    zoom: 0.82,
    emphasizeIslands: true,
  },
  {
    id: "beyond-stars",
    title: "This map goes beyond stars.",
    body: "Stars can show what people notice, but they do not tell the full story. Behind each repo is a creator, a motivation, a community, and a moment when the project became useful beyond its original audience.",
    highlightedRepoId: null,
    zoom: 0.86,
  },
  {
    id: "homebrew",
    title: "Some tools begin with one person solving their own problem.",
    body: "Homebrew started as a simpler way for Max Howell to install Unix tools on macOS. It shows how open source often begins with personal frustration and grows into something millions rely on.",
    highlightedRepoId: "homebrew",
    sublabel: "Personal frustration -> shared utility",
    zoom: 2.6,
  },
  {
    id: "linux",
    title: "Some projects become infrastructure for the world.",
    body: "Linux began as a personal operating system project, but it became one of the clearest examples of open collaboration at scale. It represents the kind of open source infrastructure that other software is built on top of.",
    highlightedRepoId: "linux",
    sublabel: "Infrastructure -> essential foundations",
    zoom: 2.6,
  },
  {
    id: "system-design-primer",
    title: "Open source is also a classroom.",
    body: "Not every important repository is a framework or a tool. Some teach. System Design Primer became valuable because it helped people learn, prepare, and enter the field through shared knowledge.",
    highlightedRepoId: "system-design-primer",
    sublabel: "Learning -> shared knowledge",
    zoom: 2.6,
  },
  {
    id: "three-js",
    title: "Open source expands what people can make.",
    body: "Three.js made 3D graphics on the web far more approachable. It shows how open source is not only practical and infrastructural, but also creative and expressive.",
    highlightedRepoId: "three-js",
    sublabel: "Creative tools -> expressive possibilities",
    zoom: 2.6,
  },
  {
    id: "storybook",
    title: "Open source becomes powerful when communities form around it.",
    body: "Storybook helped teams build and document interfaces in a more collaborative way. Like many open source projects, its importance comes not only from code, but from the community of people who adopt it, contribute to it, and build with it.",
    highlightedRepoId: "storybook",
    sublabel: "Community impact -> shared building",
    closing: "This map is not asking which repo is biggest. It is asking how small acts of sharing become the foundations of software culture.",
    finalCta: "Start exploring",
    zoom: 2.6,
  },
];

function shortNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function present(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function repoText(repo) {
  return [
    repo.name,
    repo.repo_full_name,
    repo.creator?.name,
    repo.summary?.description,
    repo.summary?.origin_story,
    repo.story?.origin,
    repo.story?.motivation,
    repo.story?.turning_point,
    repo.story?.philosophy,
    repo.story?.story_type,
    getContinent(repo),
  ].filter(Boolean).join(" ").toLowerCase();
}

function inferLanguage(repo) {
  const text = repoText(repo);
  const name = `${repo.name} ${repo.repo_full_name}`.toLowerCase();
  if (/\btypescript\b|\bts\b|angular|next\.?js|deno|trpc/.test(text)) return "TypeScript";
  if (/\bjavascript\b|\bjs\b|node|react|vue|svelte|webpack|vite|electron|three\.?js/.test(text)) return "JavaScript";
  if (/\bpython\b|django|flask|fastapi|pytorch|tensorflow|scikit|jupyter/.test(text)) return "Python";
  if (/\bgolang\b|\bgo\b|kubernetes|docker|prometheus|terraform|caddy/.test(text)) return "Go";
  if (/\brust\b|cargo|tauri|deno/.test(text)) return "Rust";
  if (/\bjava\b|spring|android|kotlin/.test(text)) return "Java";
  if (/\bc\+\+\b|cpp|opencv|llvm|unreal|nodejs\/node/.test(text) || /\bcpp\b/.test(name)) return "C++";
  return "Other";
}

function starBucket(repo) {
  const stars = repo.metrics?.stars || 0;
  if (stars < 1000) return "Under 1K";
  if (stars < 10000) return "1K-10K";
  if (stars < 50000) return "10K-50K";
  if (stars < 100000) return "50K-100K";
  return "100K+";
}

function activityBucket(repo) {
  if (repo.research_status?.notes?.toLowerCase().includes("archived")) return "Inactive / archived";
  const stars = repo.metrics?.stars || 0;
  const contributors = repo.metrics?.contributors || 0;
  if (stars >= 50000 || contributors >= 500) return "Active";
  if (stars >= 10000 || contributors >= 50) return "Occasionally maintained";
  return "Inactive / archived";
}

function projectType(repo) {
  const text = repoText(repo);
  if (/dataset|data set|data directory|api directory|public apis/.test(text)) return "Dataset";
  if (/docs|documentation|guide|awesome|roadmap|primer|curriculum|interview|learn|tutorial/.test(text)) {
    return getContinent(repo) === "Learning" ? "Learning Resource" : "Documentation";
  }
  if (/framework|next|vue|react|angular|svelte|django|rails|spring|laravel|fastapi/.test(text)) return "Framework";
  if (/library|sdk|client|package|component|validation|parser/.test(text)) return "Library";
  if (/cli|developer tool|devtool|tooling|formatter|lint|build tool|terminal|editor|debug/.test(text)) return "Developer Tool";
  if (/app|application|desktop|productivity|chat|server|platform/.test(text)) return "Application";
  return getContinent(repo) === "Learning" ? "Learning Resource" : "Developer Tool";
}

function timeToValueBucket(repo) {
  const score = repo.classification?.time_to_value_score ?? 0.5;
  if (score <= 0.2) return "Immediate";
  if (score <= 0.42) return "Short setup";
  if (score <= 0.68) return "Moderate learning curve";
  return "Long adoption curve";
}

function ecosystemBucket(repo) {
  const score = repo.classification?.ecosystem_score ?? 0.5;
  if (score < 0.3) return "Low";
  if (score < 0.62) return "Medium";
  if (score < 0.85) return "High";
  return "Foundational";
}

function repoFilterMeta(repo) {
  return {
    searchText: repoText(repo),
    region: getContinent(repo),
    language: inferLanguage(repo),
    stars: starBucket(repo),
    activity: activityBucket(repo),
    projectType: projectType(repo),
    timeToValue: timeToValueBucket(repo),
    ecosystemImpact: ecosystemBucket(repo),
  };
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.query.trim() ||
    FILTER_GROUPS.some((group) => filters[group.key].length > 0)
  );
}

function matchesSelected(value, selected) {
  return !selected.length || selected.includes(value);
}

// Flexible fuzzy matcher for story step → actual repo.
// Handles "three-js" → "three.js", "homebrew" → "Homebrew/brew", etc.
function findStoryRepo(storyId) {
  if (!storyId) return null;
  const norm = (s) => (s || "").toLowerCase().replace(/[-_. ]/g, "");
  const q = norm(storyId);
  return repos.find((r) => {
    const name = norm(r.name);
    const full = norm(r.repo_full_name || "");
    const id   = norm(r.id || "");
    return name === q || id.endsWith(q) || full.endsWith(q) || full.startsWith(q);
  }) || null;
}

function creatorLine(repo) {
  return [
    repo.creator?.name && `Built by ${repo.creator.name}`,
    repo.creator?.type,
    repo.year_created,
  ].filter(Boolean).join(" · ");
}

function communityImpact(repo) {
  return [
    repo.metrics?.stars ? `${shortNumber(repo.metrics.stars)} stars` : null,
    repo.metrics?.contributors ? `${shortNumber(repo.metrics.contributors)} contributors` : null,
    repo.metrics?.forks ? `${shortNumber(repo.metrics.forks)} forks` : null,
  ].filter(Boolean).join(" · ");
}

function whyItMatters(repo, motivation, origin) {
  const basis = present(motivation) || present(origin) || present(repo.summary?.description);
  if (!basis) {
    return `${repo.name} matters because it gave the open-source community a shared project to build on, learn from, and improve together.`;
  }

  const phrase = basis.replace(/\.$/, "");
  const readablePhrase = `${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
  if (phrase.split(/\s+/).length <= 4) {
    return `${repo.name} matters because it helped make ${readablePhrase} easier to share, improve, and rely on across the developer community.`;
  }
  return `${repo.name} matters because it helped turn ${readablePhrase} into shared infrastructure for the developer community.`;
}

export default function App() {
  const [activeRepoId, setActiveRepoId] = useState(null);
  const [activeIsland, setActiveIsland] = useState(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [introStepIndex, setIntroStepIndex] = useState(0);
  const [introStarted, setIntroStarted] = useState(false);
  const [preserveMapView, setPreserveMapView] = useState(false);
  const [introActive, setIntroActive] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(INTRO_STORAGE_KEY) !== "true";
  });

  const repoMeta = useMemo(
    () => Object.fromEntries(repos.map((repo) => [repo.id, repoFilterMeta(repo)])),
    [],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(filters.query.trim().toLowerCase());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [filters.query]);

  const filteredRepos = useMemo(() => {
    return repos.filter((repo) => {
      const meta = repoMeta[repo.id];
      if (!meta) return true;
      const queryMatches =
        !debouncedQuery ||
        meta.searchText.includes(debouncedQuery) ||
        meta.language.toLowerCase().includes(debouncedQuery) ||
        meta.region.toLowerCase().includes(debouncedQuery);

      return (
        queryMatches &&
        matchesSelected(meta.region, filters.regions) &&
        matchesSelected(meta.language, filters.languages) &&
        matchesSelected(meta.stars, filters.stars) &&
        matchesSelected(meta.activity, filters.activity) &&
        matchesSelected(meta.projectType, filters.projectTypes) &&
        matchesSelected(meta.timeToValue, filters.timeToValue) &&
        matchesSelected(meta.ecosystemImpact, filters.ecosystemImpact)
      );
    });
  }, [debouncedQuery, filters, repoMeta]);

  const visibleRepos = useMemo(
    () => filteredRepos.filter((repo) => !activeIsland || getContinent(repo) === activeIsland),
    [filteredRepos, activeIsland],
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.query.trim()) {
      chips.push({ key: "query", group: "query", label: filters.query.trim() });
    }
    FILTER_GROUPS.forEach((group) => {
      filters[group.key].forEach((value) => {
        chips.push({ key: `${group.key}:${value}`, group: group.key, label: value });
      });
    });
    return chips;
  }, [filters]);

  const filtersActive = hasActiveFilters(filters);

  const activeRepo = useMemo(
    () => repos.find((repo) => repo.id === activeRepoId) || null,
    [activeRepoId],
  );
  const repoHomepage = activeRepo?.story?.links?.homepage;
  const repoLink = activeRepo?.story?.links?.github || activeRepo?.url;
  const repoMotivation =
    present(activeRepo?.story?.motivation) ||
    present(activeRepo?.summary?.origin_story) ||
    present(activeRepo?.summary?.description);
  const repoOrigin =
    present(activeRepo?.story?.origin) ||
    present(activeRepo?.summary?.origin_story);
  const repoTurningPoint = present(activeRepo?.story?.turning_point);
  const repoPhilosophy = present(activeRepo?.story?.philosophy);
  const repoCreatorLine = activeRepo ? creatorLine(activeRepo) : null;
  const repoCommunityImpact = activeRepo ? communityImpact(activeRepo) : null;
  const repoIsland = activeRepo?.classification?.island || getContinent(activeRepo);
  const repoWhyMatters = activeRepo
    ? whyItMatters(activeRepo, repoMotivation, repoOrigin)
    : null;

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
  const keyData = activeRepo ? null : focusedData;

  const focusedRepos = useMemo(
    () => visibleRepos.filter((repo) => !focusedIsland || getContinent(repo) === focusedIsland),
    [focusedIsland, visibleRepos],
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
  const introStep = introActive && introStarted ? introSteps[introStepIndex] : null;
  const isFinalIntroStep = introStepIndex === introSteps.length - 1;

  // Resolve story slug IDs ("three-js", "homebrew") to actual normalized repo IDs
  const introHighlightedRepo = useMemo(
    () => findStoryRepo(introStep?.highlightedRepoId ?? null),
    [introStep?.highlightedRepoId],
  );

  const resolvedIntroStep = useMemo(() => {
    if (!introStep) return null;
    if (!introHighlightedRepo) return introStep;
    return { ...introStep, highlightedRepoId: introHighlightedRepo.id };
  }, [introStep, introHighlightedRepo]);

  function completeIntro() {
    setIntroActive(false);
    setIntroStarted(false);
    setPreserveMapView(true);
    setActiveRepoId(null);
    setActiveIsland(null);
    setFilterPanelOpen(false);
    setInfoPanelOpen(false);
    // Preserve step index on skip so "Back to story" resumes where they left off.
    // Reset only after finishing the final step.
    if (isFinalIntroStep) setIntroStepIndex(0);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "true");
    }
  }

  function returnToStory() {
    // If the user finished the whole story, restart from the beginning
    if (introStepIndex >= introSteps.length - 1) setIntroStepIndex(0);
    setIntroActive(true);
    setIntroStarted(false);
    setPreserveMapView(false);
    setFilterPanelOpen(false);
    setInfoPanelOpen(false);
  }

  function startIntro() {
    setIntroStepIndex(0);
    setIntroStarted(true);
    setPreserveMapView(false);
    setActiveRepoId(null);
    setActiveIsland(null);
    setFilterPanelOpen(false);
    setInfoPanelOpen(false);
  }

  function goToPreviousIntroStep() {
    if (!introStarted) return;
    setIntroStepIndex((index) => Math.max(0, index - 1));
  }

  function goToNextIntroStep() {
    if (!introStarted) {
      startIntro();
      return;
    }
    if (isFinalIntroStep) {
      completeIntro();
      return;
    }
    setIntroStepIndex((index) => Math.min(introSteps.length - 1, index + 1));
  }

  function updateFilterGroup(groupKey, value) {
    setFilters((current) => {
      const selected = current[groupKey];
      const nextSelected = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [groupKey]: nextSelected };
    });
  }

  function setFilterGroup(groupKey, values) {
    setFilters((current) => ({ ...current, [groupKey]: values }));
  }

  function removeFilterChip(chip) {
    if (chip.group === "query") {
      setFilters((current) => ({ ...current, query: "" }));
      return;
    }
    setFilters((current) => ({
      ...current,
      [chip.group]: current[chip.group].filter((value) => value !== chip.label),
    }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setActiveRepoId(null);
  }

  function selectIsland(island) {
    setPreserveMapView(false);
    setActiveRepoId(null);
    setActiveIsland((prev) => (prev === island ? null : island));
  }

  function clearIslandSelection() {
    setPreserveMapView(false);
    setActiveRepoId(null);
    setActiveIsland(null);
  }

  // Auto-select the featured repo when a story step calls for one
  useEffect(() => {
    if (!introActive || !introStarted) return;
    setActiveRepoId(introHighlightedRepo?.id ?? null);
    if (!introHighlightedRepo) setActiveIsland(null);
  }, [introHighlightedRepo?.id, introActive, introStarted]);

  useEffect(() => {
    if (!introActive) return undefined;

    function handleIntroKey(event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousIntroStep();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextIntroStep();
      } else if (event.key === "Escape") {
        event.preventDefault();
        completeIntro();
      }
    }

    window.addEventListener("keydown", handleIntroKey);
    return () => window.removeEventListener("keydown", handleIntroKey);
  }, [introActive, introStepIndex, isFinalIntroStep]);

  useEffect(() => {
    function handlePanelKey(event) {
      if (event.key !== "Escape") return;
      setFilterPanelOpen(false);
      setInfoPanelOpen(false);
    }

    window.addEventListener("keydown", handlePanelKey);
    return () => window.removeEventListener("keydown", handlePanelKey);
  }, []);

  return (
    <div className={`atlas-shell ${hasSelection ? "has-selection" : ""} ${introActive ? "has-intro" : ""}`}>
      <div className="atlas-body">
        <main className="atlas-map-area">
          <div className="atlas-brand-corner">
            <div className="atlas-brand-corner__title">Open Source atlas</div>
            <div className="atlas-brand-corner__meta">
              <span className="atlas-brand-corner__stars">{shortNumber(totalStars)} stars · </span>
              <span>
                {repos.length} repos · {yearRange}
              </span>
            </div>
          </div>

          <div className="atlas-top-actions">
            <button
              type="button"
              className="atlas-button atlas-button--secondary atlas-info-trigger"
              onClick={() => {
                setInfoPanelOpen(true);
                setFilterPanelOpen(false);
              }}
            >
              About
            </button>
            <button
              type="button"
              className={`atlas-button atlas-button--secondary atlas-filter-trigger ${filtersActive ? "has-filters" : ""}`}
              onClick={() => {
                setFilterPanelOpen(true);
                setInfoPanelOpen(false);
              }}
            >
              Filter
              {filtersActive && <span>{activeFilterChips.length}</span>}
            </button>
          </div>

          <div className="atlas-floating-bar" role="navigation" aria-label="Section filter">
            <button
              type="button"
              className={`atlas-filter-pill floating-pill ${focusedIsland === null ? "atlas-filter-pill--active is-active" : ""}`}
              onClick={clearIslandSelection}
            >
              <span className="floating-pill__label">All</span>
            </button>
            {legendItems.map((item) => (
              <button
                key={item.island}
                type="button"
                className={`atlas-filter-pill floating-pill ${focusedIsland === item.island ? "atlas-filter-pill--active is-active" : ""}`}
                onClick={() => selectIsland(item.island)}
                title={item.island}
              >
                <span className="floating-pill__dot" style={{ background: item.color }} />
                <span className="floating-pill__label">{item.island.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          <aside className={`atlas-filter-panel ${filterPanelOpen ? "is-open" : ""}`} aria-hidden={!filterPanelOpen}>
            <div className="atlas-filter-panel__header">
              <div>
                <p className="atlas-filter-panel__eyebrow">Archive index</p>
                <h2>Search the Atlas</h2>
                <p>Filter repositories by language, influence, region, and activity.</p>
              </div>
              <button
                type="button"
                className="atlas-filter-panel__close"
                onClick={() => setFilterPanelOpen(false)}
                aria-label="Close filters"
              >
                ×
              </button>
            </div>

            <label className="atlas-search-field">
              <span>Search</span>
              <input
                type="search"
                value={filters.query}
                placeholder="Search repos, tools, languages..."
                onChange={(event) =>
                  setFilters((current) => ({ ...current, query: event.target.value }))
                }
              />
            </label>

            {activeFilterChips.length > 0 && (
              <div className="atlas-filter-chips" aria-label="Selected filters">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="atlas-filter-chip"
                    onClick={() => removeFilterChip(chip)}
                  >
                    {chip.label}
                    <span>×</span>
                  </button>
                ))}
              </div>
            )}

            <div className="atlas-filter-panel__groups">
              {FILTER_GROUPS.map((group) => (
                <section key={group.key} className="atlas-filter-group">
                  <div className="atlas-filter-group__head">
                    <h3>{group.title}</h3>
                    <div>
                      <button type="button" onClick={() => setFilterGroup(group.key, group.options)}>
                        All
                      </button>
                      <button type="button" onClick={() => setFilterGroup(group.key, [])}>
                        None
                      </button>
                    </div>
                  </div>
                  <div className="atlas-filter-options">
                    {group.options.map((option) => {
                      const selected = filters[group.key].includes(option);
                      return (
                        <label key={option} className={`atlas-filter-option ${selected ? "is-selected" : ""}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => updateFilterGroup(group.key, option)}
                          />
                          <span className="atlas-filter-option__box" />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="atlas-filter-panel__footer">
              <strong>{visibleRepos.length} repos found</strong>
              {visibleRepos.length === 0 && (
                <p className="atlas-filter-empty">No repositories found. Try clearing a filter.</p>
              )}
              <div>
                <button type="button" className="atlas-button atlas-button--secondary atlas-filter-panel__secondary" onClick={clearFilters}>
                  Clear all
                </button>
                <button
                  type="button"
                  className="atlas-button atlas-button--secondary atlas-filter-panel__primary"
                  onClick={() => setFilterPanelOpen(false)}
                >
                  Apply filters
                </button>
              </div>
            </div>
          </aside>

          <aside className={`atlas-info-panel ${infoPanelOpen ? "is-open" : ""}`} aria-hidden={!infoPanelOpen}>
            <div className="atlas-info-panel__header">
              <div>
                <p className="atlas-filter-panel__eyebrow">Project notes</p>
                <h2>Open Source Atlas</h2>
                <p>by Tanaka Makoni</p>
              </div>
              <button
                type="button"
                className="atlas-filter-panel__close"
                onClick={() => setInfoPanelOpen(false)}
                aria-label="Close project information"
              >
                ×
              </button>
            </div>
            <div className="atlas-info-panel__body">
              <h3>Project Rationale</h3>
              <p>
                This project was created for DIG 345: Radical Software. This course asks us to build a project that challenges traditional software norms. Open source projects are often built in public, maintained collaboratively, and shaped by communities rather than a single company. Open source software challenges the idea that software must be proprietary, paid for, or built inside a company. Many of the tools developers rely on every day are created by distributed communities who care about a problem and choose to build in public. Thus open source software challenges traditional software production, not just economically, but socially and culturally.
              </p>
              <p>
                This project attempts to achieve 2 main tasks:
              </p>
              <ol>
                <li>Center the stories of the developers who are building open source.</li>
                <li>Answer the question: what does the open source community seem to value most?</li>
              </ol>
              <p>
                To explore this question, I worked with a dataset of 500 repositories designed to provide a broad and holistic view of the open source world. Rather than focusing only on the most popular projects or presenting repositories as a simple ranking, I organized them into a vintage atlas of software territories. Each region represents a different kind of open source value, and each marker represents an individual repository.
              </p>

              <h3>Data Methodology</h3>
              <p>
                Repository data comes from a local JSON dataset built from the GitHub API. Rather than selecting only the most starred repositories, I wanted the dataset to represent different kinds of open source work, including infrastructure, utility tools, startup-oriented frameworks, viral developer tools, creative software, learning resources, and ambitious or more experimental projects.
              </p>
              <p>
                Each repository in the dataset is organized around a consistent schema. The data includes the repository name, full GitHub path, URL, creator information, year created, and core metrics such as stars, forks, and contributors. Each project also includes a classification section with its assigned atlas region, a time-to-value score, and an ecosystem-impact score. These fields allow the visualization to position repositories not only by popularity, but also by the kind of value they appear to create within the broader open source world. Additionally, these categories are interpretive rather than absolute, often overlapping in purpose so this classification should be read as one way of understanding the ecosystem rather than a fixed universal classification.
              </p>
              <p>
                The dataset also includes narrative fields for each repository. These include a short description, origin story, motivation, turning point, philosophy, story type, and links to external sources such as GitHub pages, homepages, articles, videos, or interviews when available.
              </p>

              <h3>Map Methodology</h3>
              <p>
                The atlas uses a map metaphor to turn the dataset into a navigable software landscape. Major categories become regions, and repositories are positioned as markers within those regions.
              </p>
              <p>
                The x-axis represents time to value, or how quickly a project becomes useful. The y-axis represents ecosystem impact, or how foundational and influential a project is within the wider software landscape. The map works partly like a scatterplot, but it is not plotted on a strict Cartesian grid. Repositories are constrained into organic atlas territories, so the final layout balances data structure, spatial readability, and the visual language of a vintage map.
              </p>

              <h3>Technical Stack</h3>
              <p>
                The project is built with React and Vite. The atlas is rendered as an SVG map, with CSS defining the vintage visual system. D3 force/layout utilities are used to position repository markers so they spread naturally inside their regions. GSAP powers animated camera and zoom movement. Static JSON serves as the project's data source.
              </p>

              <h3>Interaction Design</h3>
              <p>
                Users can explore repositories by clicking markers, filtering by category or metadata, opening story cards, resetting the map view, and navigating the atlas through zoom and pan interactions.
              </p>
              <p>
                The interface is designed as a bright vintage guidebook map rather than a dashboard. The goal is to make open source feel like a landscape that can be explored, not just a list that can be sorted.
              </p>

              <h3>Sources</h3>
              <p>
                Data collected from the GitHub API. Project created for DIG 345: Radical Software.
              </p>
            </div>
          </aside>

          <aside className={`atlas-flyout ${keyData ? "is-open" : ""}`}>
            {keyData && (
              <>
                <div className="atlas-flyout__header">
                  <div>
                    <p className="atlas-flyout__label">Map Key</p>
                    <div className="atlas-flyout__title-row">
                      <span className="atlas-flyout__swatch" style={{ background: keyData.color }} />
                      <span className="atlas-flyout__title">{keyData.island}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="repo-detail__close atlas-flyout__close"
                    onClick={clearIslandSelection}
                    aria-label="Close map key"
                  >
                    ×
                  </button>
                </div>
                <p className="atlas-flyout__desc">{keyData.description}</p>
                <div className="territory-detail">
                  <div className="territory-detail__count">
                    {keyData.count} repositories
                  </div>
                  <div className="territory-detail__tagline">
                    {continentMeta[keyData.island]?.tagline || "Atlas territory"}
                  </div>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <div className="stat-item__value">{shortNumber(focusedStats.stars)}</div>
                      <div className="stat-item__label">Stars in region</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-item__value">{keyData.count}</div>
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
            repos={visibleRepos}
            colors={colors}
            focusedIsland={focusedIsland}
            labelMeta={continentMeta}
            activeRepo={activeRepo}
            introStep={resolvedIntroStep}
            preserveMapView={preserveMapView}
            onSelectRepo={(repo) => {
              setPreserveMapView(!repo);
              setActiveRepoId(repo?.id ?? null);
              if (repo) setActiveIsland(null);
            }}
            onReset={() => {
              setPreserveMapView(false);
              setActiveRepoId(null);
              setActiveIsland(null);
            }}
          />

          {introActive && !introStarted && (
            <div className="intro-layer intro-layer--start" aria-label="Intro story start">
              <div className="intro-start-controls">
                <button
                  type="button"
                  className="atlas-button atlas-button--secondary intro-button intro-start-button"
                  onClick={startIntro}
                >
                  Begin the Journey
                </button>
                <button type="button" className="atlas-button atlas-button--secondary intro-skip-btn intro-start-skip" onClick={completeIntro}>
                  Skip story
                </button>
              </div>
            </div>
          )}

          {introStep && (
            <div className="intro-layer" aria-live="polite">
              <article key={introStep.id} className="intro-card">
                <div className="intro-card__progress">
                  {introStepIndex + 1} / {introSteps.length}
                </div>
                {introStep.sublabel && (
                  <p className="intro-card__sublabel">{introStep.sublabel}</p>
                )}
                <h2>{introStep.title}</h2>
                <p className="intro-card__body">{introStep.body}</p>
                {introStep.closing && (
                  <p className="intro-card__closing">{introStep.closing}</p>
                )}
              </article>

              <div className="intro-controls" aria-label="Intro story controls">
                <div className="intro-nav-row">
                  <button
                    type="button"
                    className="atlas-button atlas-button--secondary intro-button"
                    onClick={goToPreviousIntroStep}
                    disabled={introStepIndex === 0}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="atlas-button atlas-button--secondary intro-button"
                    onClick={goToNextIntroStep}
                  >
                    {introStep.finalCta || "Next"}
                  </button>
                </div>
                <button type="button" className="atlas-button atlas-button--secondary intro-skip-btn" onClick={completeIntro}>
                  Skip story
                </button>
              </div>
            </div>
          )}

          {!introActive && (
            <button type="button" className="atlas-button atlas-button--primary back-to-story-btn" onClick={returnToStory}>
              Back to story
            </button>
          )}
        </main>

        {activeRepo && (
          <aside className="atlas-rightpanel">
            <div className="panel-card">
              <div className="panel-card__header">
                <p className="panel-card__label">Open Source Story</p>
                <button
                  type="button"
                  className="repo-detail__close"
                  onClick={() => {
                    setPreserveMapView(true);
                    setActiveRepoId(null);
                  }}
                  aria-label="Close repository story"
                >
                  ×
                </button>
              </div>
              <div className="repo-detail">
                <div className="repo-detail__name">{activeRepo.name}</div>
                {repoCreatorLine && (
                  <div className="repo-detail__creator">{repoCreatorLine}</div>
                )}
                {repoCommunityImpact && (
                  <div className="repo-detail__impact">{repoCommunityImpact}</div>
                )}

                {repoMotivation && (
                  <section className="repo-story-section">
                    <h3 className="repo-story-section__label">Why it exists</h3>
                    <p>{repoMotivation}</p>
                  </section>
                )}

                {repoOrigin && (
                  <section className="repo-story-section">
                    <h3 className="repo-story-section__label">Origin</h3>
                    <p>{repoOrigin}</p>
                  </section>
                )}

                {repoTurningPoint && (
                  <section className="repo-story-section">
                    <h3 className="repo-story-section__label">Turning point</h3>
                    <p>{repoTurningPoint}</p>
                  </section>
                )}

                {repoPhilosophy && (
                  <section className="repo-story-section">
                    <h3 className="repo-story-section__label">Philosophy</h3>
                    <p>{repoPhilosophy}</p>
                  </section>
                )}

                {repoWhyMatters && (
                  <p className="repo-detail__matters">{repoWhyMatters}</p>
                )}

                <div className="repo-detail__links">
                  {repoLink && (
                    <a
                      className="repo-detail__link"
                      href={repoLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Explore code
                    </a>
                  )}
                  {repoHomepage && (
                    <a
                      className="repo-detail__link"
                      href={repoHomepage}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit project
                    </a>
                  )}
                </div>
                <div className="repo-detail__chips">
                  {repoIsland && (
                    <span className="repo-detail__chip">Island: {repoIsland}</span>
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
