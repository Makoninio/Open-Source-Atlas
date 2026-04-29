import { useEffect, useMemo, useState } from "react";
import sourceRepos from "../500-repos.json";
import Map from "./components/Map";
import { continentMeta, getContinent, normalizeRepo } from "./lib/taxonomy";

const repos = sourceRepos.map(normalizeRepo);
const INTRO_STORAGE_KEY = "open-source-atlas-intro-complete";

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
  const [introStepIndex, setIntroStepIndex] = useState(0);
  const [introStarted, setIntroStarted] = useState(false);
  const [preserveMapView, setPreserveMapView] = useState(false);
  const [introActive, setIntroActive] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(INTRO_STORAGE_KEY) !== "true";
  });

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
  }

  function startIntro() {
    setIntroStepIndex(0);
    setIntroStarted(true);
    setPreserveMapView(false);
    setActiveRepoId(null);
    setActiveIsland(null);
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

  return (
    <div className={`atlas-shell ${hasSelection ? "has-selection" : ""} ${introActive ? "has-intro" : ""}`}>
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

          <aside className={`atlas-flyout ${keyData ? "is-open" : ""}`}>
            {keyData && (
              <>
                <p className="atlas-flyout__label">Map Key</p>
                <div className="atlas-flyout__title-row">
                  <span className="atlas-flyout__swatch" style={{ background: keyData.color }} />
                  <span className="atlas-flyout__title">{keyData.island}</span>
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
            repos={repos}
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
            onSelectIsland={(island) => {
              setPreserveMapView(false);
              setActiveRepoId(null);
              setActiveIsland((prev) => (prev === island ? null : island));
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
                  className="intro-button intro-button--primary intro-start-button"
                  onClick={startIntro}
                >
                  Start story
                </button>
                <button type="button" className="intro-skip-btn intro-start-skip" onClick={completeIntro}>
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
                    className="intro-button"
                    onClick={goToPreviousIntroStep}
                    disabled={introStepIndex === 0}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="intro-button intro-button--primary"
                    onClick={goToNextIntroStep}
                  >
                    {introStep.finalCta || "Next"}
                  </button>
                </div>
                <button type="button" className="intro-skip-btn" onClick={completeIntro}>
                  Skip story
                </button>
              </div>
            </div>
          )}

          {!introActive && (
            <button type="button" className="back-to-story-btn" onClick={returnToStory}>
              Back to story
            </button>
          )}
        </main>

        {activeRepo && (
          <aside className="atlas-rightpanel">
            <div className="panel-card">
              <p className="panel-card__label">Open Source Story</p>
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
