import { memo, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { runForceLayout } from "../lib/forces";
import { clamp, MAP_HEIGHT, MAP_WIDTH } from "../lib/layout";
import { buildAtlas } from "../lib/regions";
import { getContinent } from "../lib/taxonomy";

const DEFAULT_SCALE    = 0.74;
const MIN_SCALE        = 0.68;
const MAX_SCALE        = 4.8;
const REPO_FOCUS_SCALE = 2.35;
const ISLAND_FOCUS_SCALE = 1.35;
const COMP_LEFT = 26;
const COMP_TOP  = 26;
const COMP_SIZE = 132;

// Zoom breakpoints for progressive disclosure
const FAR_SCALE = 1.2;
const NEAR_SCALE = 2.45;
const SHOW_SUBCATEGORY_LABELS = false;
const SHOW_LAYOUT_DEBUG = false;

// ─── Repo marker helpers ─────────────────────────────────────────────────────

function getSizeTier(stars) {
  if (stars >= 50000) return "large";
  if (stars >= 5000) return "medium";
  return "small";
}

function getLastCommitDate(repo) {
  return (
    repo.last_commit_at ||
    repo.last_commit ||
    repo.pushed_at ||
    repo.updated_at ||
    repo.metrics?.last_commit_at ||
    repo.metrics?.last_commit ||
    repo.metrics?.pushed_at ||
    repo.metrics?.updated_at ||
    repo.activity?.last_commit_at ||
    repo.activity?.last_commit ||
    null
  );
}

function getRecencyOpacity(repo) {
  const dateValue = getLastCommitDate(repo);
  if (!dateValue) return 0.5;

  const lastCommit = new Date(dateValue);
  if (Number.isNaN(lastCommit.getTime())) return 0.5;

  const ageMonths = (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
  if (ageMonths < 6) return 1.0;
  if (ageMonths < 18) return 0.75;
  return 0.5;
}

// Circular repo markers.
// color: island fill color
// isActive: boolean for thicker stroke
function RepoMarker({ vr, color, opacity, isActive }) {
  const sw = isActive ? 1.6 : 1.0;
  const border = "rgba(16, 10, 4, 0.52)";

  return (
    <circle
      r={vr}
      fill={color}
      fillOpacity={opacity}
      stroke={border}
      strokeWidth={sw}
      className="sett__body"
    />
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function shortNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function hashString(text) {
  return [...text].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function buildWaves() {
  const waves = [];
  const random = seeded(42);
  for (let i = 0; i < 86; i++) {
    waves.push({
      x: 20 + random() * (MAP_WIDTH - 40),
      y: 16 + random() * (MAP_HEIGHT - 32),
      width: 22 + random() * 32,
      amplitude: 5 + random() * 6,
    });
  }
  return waves;
}

function buildOceanGlow() {
  return [
    { x: 620, y: 410, rx: 330, ry: 230, opacity: 0.22 },
    { x: 430, y: 240, rx: 180, ry: 120, opacity: 0.12 },
    { x: 915, y: 255, rx: 210, ry: 150, opacity: 0.13 },
    { x: 980, y: 635, rx: 190, ry: 135, opacity: 0.11 },
    { x: 290, y: 650, rx: 170, ry: 120, opacity: 0.10 },
  ];
}

function buildRegionDecor(regions, atoms) {
  return regions.map((region) => {
    const random = seeded(hashString(region.island));
    const regionAtoms = region.atomIndices.map((index) => atoms[index]);
    const markers = [];
    const speckles = [];
    const markerCount  = Math.max(9,  Math.round(regionAtoms.length * 0.05));
    const speckleCount = Math.max(48, Math.round(regionAtoms.length * 0.38));

    while (markers.length < markerCount) {
      const atom = regionAtoms[Math.floor(random() * regionAtoms.length)];
      markers.push({ x: atom.x + atom.driftX * 1.8, y: atom.y + atom.driftY * 1.8,
        scale: 0.8 + random() * 0.42, type: random() > 0.6 ? "ring" : "spire" });
    }
    while (speckles.length < speckleCount) {
      const atom = regionAtoms[Math.floor(random() * regionAtoms.length)];
      speckles.push({ x: atom.x + atom.driftX, y: atom.y + atom.driftY,
        r: 0.45 + random() * 0.9, opacity: 0.06 + random() * 0.08 });
    }
    return { island: region.island, markers, speckles };
  });
}

function labelLines(text) {
  const words = text.toUpperCase().split(" ");
  if (words.length <= 1) return [text.toUpperCase()];
  if (words.length === 2) return words;
  if (words.length === 3) return [`${words[0]} ${words[1]}`, words[2]];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function rectsOverlap(a, b, padding = 0) {
  return !(
    a.x + a.w + padding <= b.x ||
    b.x + b.w + padding <= a.x ||
    a.y + a.h + padding <= b.y ||
    b.y + b.h + padding <= a.y
  );
}

function buildLabelRect(repo, islandTransforms) {
  const transform = islandTransforms[getContinent(repo)];
  const point = transform ? applyIslandTransform(repo, transform) : { x: repo.x, y: repo.y };
  const vr = Math.max(1.9, repo.radius);
  const width = Math.max(30, repo.name.length * 5.4 + 12);
  const height = 12;
  return {
    id: repo.id,
    x: point.x - width / 2,
    y: point.y - (vr + 18),
    w: width,
    h: height,
  };
}

function buildLabelExclusionRects(regions, islandTransforms) {
  return regions.flatMap((region) => {
    const transform = islandTransforms[region.island];
    if (!transform) return [];
    return (region.labelExclusionZones || []).map((zone) => {
      const center = applyIslandTransform({ x: zone.x, y: zone.y }, transform);
      const scale = transform.scale ?? 1;
      return {
        x: center.x - zone.rx * scale - 10,
        y: center.y - zone.ry * scale - 8,
        w: zone.rx * scale * 2 + 20,
        h: zone.ry * scale * 2 + 16,
      };
    });
  });
}

function buildDefaultCamera() {
  return {
    scale: DEFAULT_SCALE,
    x: MAP_WIDTH / 2 - (MAP_WIDTH / 2) * DEFAULT_SCALE,
    y: MAP_HEIGHT / 2 - (MAP_HEIGHT / 2) * DEFAULT_SCALE,
  };
}

function buildIslandTransforms(regions) {
  return Object.fromEntries(
    regions.map((region) => [
      region.island,
      { cx: region.centerX, cy: region.centerY, scale: 1, offsetX: 0, offsetY: 0 },
    ]),
  );
}

function applyIslandTransform(point, transform) {
  return {
    x: (point.x - transform.cx) * transform.scale + transform.cx + transform.offsetX,
    y: (point.y - transform.cy) * transform.scale + transform.cy + transform.offsetY,
  };
}

function islandTransformString(transform) {
  return `translate(${transform.offsetX} ${transform.offsetY}) translate(${transform.cx} ${transform.cy}) scale(${transform.scale}) translate(${-transform.cx} ${-transform.cy})`;
}

function focusCamera(point, scale) {
  return { scale, x: MAP_WIDTH / 2 - point.x * scale, y: MAP_HEIGHT / 2 - point.y * scale };
}

function focusCameraAtViewportPoint(point, scale, viewportX, viewportY) {
  return { scale, x: viewportX - point.x * scale, y: viewportY - point.y * scale };
}

function renderCameraTransform(camera) {
  return `matrix(${camera.scale} 0 0 ${camera.scale} ${camera.x} ${camera.y})`;
}

function screenToSVG(svgEl, clientX, clientY) {
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svgEl.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  return pt.matrixTransform(ctm.inverse());
}

function snapReposToIslands(repos, atoms) {
  return repos.map((repo) => {
    const myAtoms = atoms.filter((a) => a.island === getContinent(repo));
    if (!myAtoms.length) return repo;
    let nearestDist = Infinity, nearestAtom = myAtoms[0];
    for (const atom of myAtoms) {
      const d = Math.hypot(repo.x - atom.x, repo.y - atom.y);
      if (d < nearestDist) { nearestDist = d; nearestAtom = atom; }
    }
    if (nearestDist < 40) return repo;
    return { ...repo, x: nearestAtom.x, y: nearestAtom.y };
  });
}

// ─── AtlasScene ──────────────────────────────────────────────────────────────

const AtlasScene = memo(function AtlasScene({
  atlas,
  colors,
  focusedIsland,
  islandTransforms,
  positionedReposByIsland,
  regionDecor,
  activeRepoId,
  introHighlightedRepoId,
  hoveredRepoId,
  isInteracting,
  visibleRepoLabelIds,
  showSubcategoryLabels,
  debugMode,
  onSelectRepo,
  onSelectIsland,
  onHoverRepo,
  onLeaveRepo,
}) {
  return (
    <>
      {atlas.regions.map((region) => {
        const transform   = islandTransforms[region.island];
        const decor       = regionDecor.find((d) => d.island === region.island);
        const islandRepos = positionedReposByIsland[region.island] || [];
        const fillColor   = colors[region.island] || "#c7b08a";
        const fillPath    = atlas.islandFillPaths[region.island] || "";
        const gridPath    = atlas.internalParcelPaths?.[region.island] || "";
        const isFocused   = focusedIsland === region.island;
        const isDimmed    = Boolean(focusedIsland && !isFocused);
        const isIntroFocused = Boolean(
          introHighlightedRepoId && islandRepos.some((repo) => repo.id === introHighlightedRepoId),
        );
        const isIntroDimmed = Boolean(introHighlightedRepoId && !isIntroFocused);

        return (
          <g
            key={region.island}
            transform={islandTransformString(transform)}
            className={`atlas-region ${isFocused ? "is-focused" : ""} ${isDimmed ? "is-dimmed" : ""} ${isIntroFocused ? "is-intro-focused" : ""} ${isIntroDimmed ? "is-intro-dimmed" : ""}`}
          >
            {/* Region fill */}
            <path
              d={fillPath}
              fill={fillColor}
              className="island-fill"
              onClick={(e) => { e.stopPropagation(); onSelectIsland(region.island); }}
              style={{ cursor: "pointer" }}
            />
            <path
              d={fillPath}
              className="island-wash"
              onClick={(e) => { e.stopPropagation(); onSelectIsland(region.island); }}
              style={{ cursor: "pointer" }}
            />

            {/* Internal grid */}
            {gridPath && (
              <path d={gridPath} fill="none" stroke="rgba(43,38,30,0.22)" strokeWidth="0.72" className="island-grid" />
            )}

            {/* Border lines */}
            {region.coastPaths.map((path, idx) => (
              <path key={`${region.island}-b${idx}`} d={path} className="atlas-coast"
                filter={isInteracting ? undefined : "url(#coastShadow)"} />
            ))}

            {/* Terrain speckles */}
            {decor?.speckles.map((sp, idx) => (
              <circle key={`${region.island}-sp${idx}`} cx={sp.x} cy={sp.y} r={sp.r}
                className="region-speckle" opacity={sp.opacity} />
            ))}

            {/* POI markers */}
            {!isInteracting && decor?.markers.map((marker, idx) => (
              <g key={`${region.island}-m${idx}`}
                transform={`translate(${marker.x},${marker.y}) scale(${marker.scale})`}
                className="poi-marker"
              >
                {marker.type === "ring" ? (
                  <>
                    <circle cx="0" cy="-2.2" r="2.5" className="poi-marker__ring" />
                    <circle cx="0" cy="-2.2" r="1.05" className="poi-marker__core" />
                  </>
                ) : (
                  <>
                    <path d="M 0 -5.6 L 1.5 -2.2 L 0.2 -2.2 L 0.2 3.8 L -0.2 3.8 L -0.2 -2.2 L -1.5 -2.2 Z" className="poi-marker__spire" />
                    <circle cx="0" cy="-5.8" r="0.75" className="poi-marker__cap" />
                  </>
                )}
              </g>
            ))}

            {showSubcategoryLabels && (
              <g className="subcategory-group">
                <text
                  x={region.centerX}
                  y={region.centerY}
                  className="subcategory-label"
                  textAnchor="middle"
                >
                  {focusedIsland === region.island ? "Subcategory Debug" : ""}
                </text>
              </g>
            )}

            {/* ── Repo settlement nodes ───────────────────────────────────── */}
            {islandRepos.map((repo) => {
              const isIntroHighlighted = introHighlightedRepoId === repo.id;
              const isActive = activeRepoId === repo.id || isIntroHighlighted;
              const isHovered = hoveredRepoId === repo.id;
              const sizeTier = getSizeTier(repo.metrics?.stars || 0);
              const vr   = Math.max(1.9, repo.radius);
              // Slight organic scale variation per repo
              const iconScale = 0.9 + (hashString(repo.id) % 12) * 0.008;
              const islandColor = colors[getContinent(repo)] || "#8a7463";
              const recencyOpacity = getRecencyOpacity(repo);
              const lift = isHovered ? 1.8 : isActive ? 1.2 : 0;

              return (
                <g
                  key={repo.id}
                  className={`repo-node repo-node--${sizeTier} ${isActive ? "is-active" : ""} ${isIntroHighlighted ? "is-intro-highlight" : ""} ${isHovered ? "is-hovered" : ""}`}
                  transform={`translate(${repo.x},${repo.y - lift})`}
                  onClick={(e) => { e.stopPropagation(); onSelectRepo(repo); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => { e.stopPropagation(); onSelectRepo(repo); }}
                  onPointerCancel={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => onHoverRepo(repo, e.clientX, e.clientY)}
                  onMouseMove={(e) => onHoverRepo(repo, e.clientX, e.clientY)}
                  onMouseLeave={() => onLeaveRepo()}
                  onFocus={() => onSelectRepo(repo)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${repo.name} — ${sizeTier}`}
                  style={{ cursor: "pointer" }}
                >
                  {/* Pulse ring — active only */}
                  {isActive && (
                    <circle r={repo.radius + 7} className="repo-node__pulse" />
                  )}
                  {/* Transparent enlarged hit area */}
                  <circle r={repo.radius + 11} fill="transparent" />
                  {/* Hover halo */}
                  <circle r={repo.radius + (isActive ? 4.8 : isHovered ? 3.4 : 2.4)} className="repo-node__halo" />
                  {/* Settlement icon */}
                  <g transform={`scale(${iconScale})`} className="settlement">
                    <RepoMarker vr={vr} color={islandColor} opacity={recencyOpacity} isActive={isActive} />
                  </g>
                  {/* Repo name label — progressive disclosure with collision filtering */}
                  {visibleRepoLabelIds.has(repo.id) && (
                    <text
                      y={-(vr + 6)}
                      className="repo-name-label"
                      textAnchor="middle"
                    >
                      {repo.name}
                    </text>
                  )}
                </g>
              );
            })}

            {debugMode && region.bounds && (
              <g className="layout-debug" pointerEvents="none">
                <rect
                  x={region.bounds.xMin}
                  y={region.bounds.yMin}
                  width={region.bounds.xMax - region.bounds.xMin}
                  height={region.bounds.yMax - region.bounds.yMin}
                  className="layout-debug__bounds"
                />
                {(region.labelExclusionZones || []).map((zone, index) => (
                  <ellipse
                    key={`${region.island}-zone-${index}`}
                    cx={zone.x}
                    cy={zone.y}
                    rx={zone.rx}
                    ry={zone.ry}
                    className="layout-debug__zone"
                  />
                ))}
              </g>
            )}

            {/* Region labels are rendered in an unclipped layer — see Map.jsx */}
          </g>
        );
      })}

      {/* Outer coastline */}
      {atlas.coastlinePath && (
        <>
          <path d={atlas.coastlinePath} fill="none" className="atlas-coastline-shelf" />
          <path d={atlas.coastlinePath} fill="none" className="atlas-coastline-rim" />
          <path d={atlas.coastlinePath} fill="none" className="atlas-coastline" />
        </>
      )}
    </>
  );
});

// ─── Map ─────────────────────────────────────────────────────────────────────

export default function Map({
  repos, colors, focusedIsland, labelMeta,
  activeRepo, introStep, preserveMapView, onSelectRepo, onSelectIsland, onReset,
}) {
  const svgRef   = useRef(null);
  const sceneRef = useRef(null);
  const dragRef  = useRef(null);
  const pointerDownRef = useRef(null);
  const dragMoved      = useRef(false);
  const cameraTweenRef = useRef(null);
  const interactionTimeoutRef = useRef(null);

  const [tooltip, setTooltip] = useState(null);
  const [hoveredRepoId, setHoveredRepoId] = useState(null);

  const positionedRepos = useMemo(() => runForceLayout(repos), [repos]);
  const atlas           = useMemo(() => buildAtlas(positionedRepos), [positionedRepos]);

  const snappedRepos = useMemo(
    () => snapReposToIslands(positionedRepos, atlas.atoms),
    [positionedRepos, atlas],
  );

  const waves      = useMemo(() => buildWaves(), []);
  const oceanGlow  = useMemo(() => buildOceanGlow(), []);
  const regionDecor = useMemo(() => buildRegionDecor(atlas.regions, atlas.atoms), [atlas]);
  const islandTransforms = useMemo(() => buildIslandTransforms(atlas.regions), [atlas.regions]);

  const compassRepoPoints = useMemo(() => {
    const sx = COMP_SIZE / MAP_WIDTH, sy = COMP_SIZE / MAP_HEIGHT;
    return snappedRepos.map((repo) => {
      const continent = getContinent(repo);
      const t = applyIslandTransform(repo, islandTransforms[continent]);
      return { id: repo.id, island: continent, x: COMP_LEFT + t.x * sx, y: COMP_TOP + t.y * sy };
    });
  }, [snappedRepos, islandTransforms]);

  const compassRegionPoints = useMemo(() => {
    const sx = COMP_SIZE / MAP_WIDTH, sy = COMP_SIZE / MAP_HEIGHT;
    return atlas.regions.map((region) => {
      const t = applyIslandTransform(
        { x: region.centerX, y: region.centerY },
        islandTransforms[region.island],
      );
      return { island: region.island, worldX: t.x, worldY: t.y,
        x: COMP_LEFT + t.x * sx, y: COMP_TOP + t.y * sy };
    });
  }, [atlas.regions, islandTransforms]);

  const positionedReposByIsland = useMemo(
    () => snappedRepos.reduce((acc, repo) => {
      const continent = getContinent(repo);
      if (!acc[continent]) acc[continent] = [];
      acc[continent].push(repo);
      return acc;
    }, {}),
    [snappedRepos],
  );

  const activeNode = useMemo(() => {
    if (!activeRepo) return null;
    const match = snappedRepos.find((r) => r.id === activeRepo.id);
    if (!match) return null;
    return applyIslandTransform(match, islandTransforms[getContinent(match)]);
  }, [activeRepo, islandTransforms, snappedRepos]);

  const introNode = useMemo(() => {
    if (!introStep?.highlightedRepoId) return null;
    const match = snappedRepos.find((r) => r.id === introStep.highlightedRepoId);
    if (!match) return null;
    return applyIslandTransform(match, islandTransforms[getContinent(match)]);
  }, [introStep?.highlightedRepoId, islandTransforms, snappedRepos]);

  const cameraRef = useRef(buildDefaultCamera());
  const [isInteracting, setIsInteracting] = useState(false);
  const [navState, setNavState] = useState(() => ({
    camera: buildDefaultCamera(),
    currentIsland: compassRegionPoints[0]?.island ?? null,
  }));

  // Scale breakpoint: only changes at FAR_SCALE and NEAR_SCALE thresholds
  const scaleBreakpoint = useMemo(() => {
    const s = navState.camera.scale;
    if (s >= NEAR_SCALE) return "near";
    if (s >= FAR_SCALE)  return "mid";
    return "far";
  }, [navState.camera.scale]);

  const visibleRepoLabelIds = useMemo(() => {
    const ids = new Set();
    if (scaleBreakpoint === "far") return ids;

    const focusIslandForLabels = focusedIsland || navState.currentIsland;
    const exclusionRects = buildLabelExclusionRects(atlas.regions, islandTransforms);
    const acceptedRects = [];

    const candidates = snappedRepos
      .filter((repo) => {
        if (scaleBreakpoint === "mid") {
          return repo.id === activeRepo?.id || repo.id === introStep?.highlightedRepoId || repo.id === hoveredRepoId;
        }
        return !focusIslandForLabels || getContinent(repo) === focusIslandForLabels;
      })
      .map((repo) => {
        const isActive = repo.id === activeRepo?.id;
        const isIntroHighlighted = repo.id === introStep?.highlightedRepoId;
        const isHovered = repo.id === hoveredRepoId;
        return {
          repo,
          isActive,
          isHovered,
          priority: isHovered ? 4 : isIntroHighlighted ? 3 : isActive ? 2 : 1,
          stars: repo.metrics?.stars ?? 0,
          rect: buildLabelRect(repo, islandTransforms),
        };
      })
      .sort((a, b) => b.priority - a.priority || b.stars - a.stars || a.repo.name.localeCompare(b.repo.name));

    candidates.forEach((candidate) => {
      const overlapsIslandLabel = exclusionRects.some((rect) => rectsOverlap(rect, candidate.rect, 4));
      if (overlapsIslandLabel) return;

      const overlapsRepoLabel = acceptedRects.some((rect) => rectsOverlap(rect, candidate.rect, 4));
      if (overlapsRepoLabel) return;

      ids.add(candidate.repo.id);
      acceptedRects.push(candidate.rect);
    });

    return ids;
  }, [
    activeRepo?.id,
    atlas.regions,
    focusedIsland,
    hoveredRepoId,
    introStep?.highlightedRepoId,
    islandTransforms,
    navState.currentIsland,
    scaleBreakpoint,
    snappedRepos,
  ]);

  function deriveNavState(camera) {
    const vcx = (MAP_WIDTH / 2 - camera.x) / camera.scale;
    const vcy = (MAP_HEIGHT / 2 - camera.y) / camera.scale;
    const currentRegion = compassRegionPoints.reduce((closest, region) => {
      if (!closest) return region;
      const cd = Math.hypot(closest.worldX - vcx, closest.worldY - vcy);
      const rd = Math.hypot(region.worldX  - vcx, region.worldY  - vcy);
      return rd < cd ? region : closest;
    }, null);
    return { camera: { ...camera }, currentIsland: currentRegion?.island ?? null };
  }

  function applyCamera(camera) {
    if (sceneRef.current) {
      sceneRef.current.setAttribute("transform", renderCameraTransform(camera));
    }
    setNavState(deriveNavState(camera));
  }

  function markInteractionActive() {
    if (!isInteracting) setIsInteracting(true);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      interactionTimeoutRef.current = null;
    }, 180);
  }

  function animateCamera(targetCamera, options = {}) {
    const { duration = 0.32, ease = "power2.out" } = options;
    cameraTweenRef.current?.kill();
    cameraTweenRef.current = gsap.to(cameraRef.current, {
      ...targetCamera, duration, ease, overwrite: true,
      onUpdate: () => applyCamera(cameraRef.current),
    });
  }

  function buildRepoFocusCamera(point) {
    const scale = clamp(Math.max(cameraRef.current.scale, REPO_FOCUS_SCALE), MIN_SCALE, MAX_SCALE);
    return focusCamera(point, scale);
  }

  function buildIntroCamera() {
    if (!introStep) return null;
    if (introNode) {
      return focusCameraAtViewportPoint(
        introNode,
        clamp(introStep.zoom ?? 2.6, MIN_SCALE, MAX_SCALE),
        MAP_WIDTH * 0.5,
        MAP_HEIGHT * 0.62,
      );
    }
    if (introStep.cameraTarget) {
      return focusCamera(
        introStep.cameraTarget,
        clamp(introStep.zoom ?? DEFAULT_SCALE, MIN_SCALE, MAX_SCALE),
      );
    }
    return {
      ...buildDefaultCamera(),
      scale: clamp(introStep.zoom ?? DEFAULT_SCALE, MIN_SCALE, MAX_SCALE),
    };
  }

  useEffect(() => {
    applyCamera(cameraRef.current);
    return () => {
      cameraTweenRef.current?.kill();
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    };
  }, []);

  // Unified camera effect: repo > island > default
  useEffect(() => {
    const introCamera = buildIntroCamera();
    if (introCamera) {
      animateCamera(introCamera, { duration: introNode ? 0.82 : 0.62, ease: "power3.inOut" });
      return;
    }
    if (activeNode) {
      animateCamera(buildRepoFocusCamera(activeNode), { duration: 0.55, ease: "power3.out" });
      return;
    }
    if (focusedIsland) {
      const region = compassRegionPoints.find((r) => r.island === focusedIsland);
      if (region) {
        animateCamera(
          focusCamera({ x: region.worldX, y: region.worldY }, ISLAND_FOCUS_SCALE),
          { duration: 0.5, ease: "power2.out" },
        );
        return;
      }
    }
    if (!preserveMapView) {
      animateCamera(buildDefaultCamera(), { duration: 0.4 });
    }
  }, [activeNode, focusedIsland, introNode, introStep, preserveMapView]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        onSelectRepo(null);
        setTooltip(null);
        setHoveredRepoId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelectRepo]);

  // ── Input handlers ─────────────────────────────────────────────────────────

  function handleWheel(event) {
    event.preventDefault();
    markInteractionActive();
    if (!svgRef.current) return;
    const svgPt = screenToSVG(svgRef.current, event.clientX, event.clientY);
    const prev  = cameraRef.current;
    const nextScale = clamp(prev.scale * (event.deltaY < 0 ? 1.12 : 0.9), MIN_SCALE, MAX_SCALE);
    const worldX = (svgPt.x - prev.x) / prev.scale;
    const worldY = (svgPt.y - prev.y) / prev.scale;
    animateCamera(
      { scale: nextScale, x: svgPt.x - worldX * nextScale, y: svgPt.y - worldY * nextScale },
      { duration: 0.18, ease: "power1.out" },
    );
  }

  function handlePointerDown(event) {
    dragMoved.current = false;
    pointerDownRef.current = { clientX: event.clientX, clientY: event.clientY };
    setTooltip(null);
    setHoveredRepoId(null);
    if (cameraRef.current.scale <= DEFAULT_SCALE + 0.02) return;
    markInteractionActive();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      camera: { ...cameraRef.current },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (pointerDownRef.current) {
      const dx = event.clientX - pointerDownRef.current.clientX;
      const dy = event.clientY - pointerDownRef.current.clientY;
      if (!dragMoved.current && Math.hypot(dx, dy) > 5) {
        dragMoved.current = true;
        setTooltip(null);
      }
    }
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    markInteractionActive();
    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    cameraTweenRef.current?.kill();
    cameraRef.current.x = dragRef.current.camera.x + deltaX;
    cameraRef.current.y = dragRef.current.camera.y + deltaY;
    applyCamera(cameraRef.current);
  }

  function handlePointerUp(event) {
    pointerDownRef.current = null;
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    markInteractionActive();
  }

  function handleHoverRepo(repo, clientX, clientY) {
    if (dragMoved.current) return;
    setHoveredRepoId(repo.id);
    setTooltip({ name: repo.name, stars: repo.metrics?.stars || 0, sub: repo.taxonomy?.subcategory, x: clientX, y: clientY });
  }

  function handleLeaveRepo() {
    setTooltip(null);
    setHoveredRepoId(null);
  }

  // Compass viewport
  const cam = navState.camera;
  const compViewport = {
    x: COMP_LEFT + ((-cam.x / cam.scale) / MAP_WIDTH) * COMP_SIZE,
    y: COMP_TOP  + ((-cam.y / cam.scale) / MAP_HEIGHT) * COMP_SIZE,
    w: (MAP_WIDTH  / cam.scale / MAP_WIDTH)  * COMP_SIZE,
    h: (MAP_HEIGHT / cam.scale / MAP_HEIGHT) * COMP_SIZE,
  };

  return (
    <div className={`map-wrapper ${introStep ? "is-intro-mode" : ""} ${introStep?.highlightedRepoId ? "has-intro-repo" : ""} ${introStep?.emphasizeIslands ? "is-intro-islands" : ""}`}>
      <div className="map-scale" aria-hidden="true">
        <div className="map-scale__bar"><span /><span /><span /></div>
        <div className="map-scale__label">Scale of influence</div>
      </div>

      <div className="map-coordinates" aria-hidden="true">
        <span>36.4N</span><span>122.1W</span>
      </div>

      {/* Floating repo tooltip */}
      {tooltip && (
        <div className="repo-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 46 }} aria-hidden="true">
          <span className="repo-tooltip__name">{tooltip.name}</span>
          <span className="repo-tooltip__meta">
            ★ {shortNumber(tooltip.stars)}
            {tooltip.sub && <> · {tooltip.sub}</>}
          </span>
        </div>
      )}

      {/* Mini compass */}
      <div className="compass">
        <svg viewBox="0 0 184 184" className="compass__svg" aria-hidden="true">
          <rect x="0" y="0" width="184" height="184" className="compass__bg" rx="8" />
          <line x1="92" y1="26" x2="92" y2="158" className="compass__cross" />
          <line x1="26" y1="92" x2="158" y2="92" className="compass__cross" />
          {compassRepoPoints.map((pt) => (
            <circle key={pt.id} cx={pt.x} cy={pt.y} r="2.4"
              className={`compass__dot ${navState.currentIsland === pt.island ? "compass__dot--active" : ""}`} />
          ))}
          <rect x={compViewport.x} y={compViewport.y} width={compViewport.w} height={compViewport.h}
            className="compass__viewport" />
          <path d="M 92 54 L 97 82 L 92 78 L 87 82 Z" className="compass__needle" />
          <circle cx="92" cy="92" r="4.5" className="compass__core" />
        </svg>
        <p className="compass__label">{navState.currentIsland || "Atlas"}</p>
      </div>

      {/* Toolbar */}
      <div className="map-toolbar">
        <button
          type="button" className="map-toolbar__button"
          onClick={() => {
            animateCamera(buildDefaultCamera(), { duration: 0.45 });
            onSelectRepo(null);
            onReset();
            setTooltip(null);
          }}
        >
          Reset view
        </button>
        {activeRepo && (
          <button
            type="button" className="map-toolbar__button"
            onClick={() => activeNode && animateCamera(buildRepoFocusCamera(activeNode), { duration: 0.55, ease: "power3.out" })}
          >
            Focus
          </button>
        )}
      </div>

      {/* Map surface */}
      <div
        className="map-surface"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => { if (!dragMoved.current) { onSelectRepo(null); setTooltip(null); } }}
      >
        <svg
          ref={svgRef}
          className="map-svg"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Open source atlas map"
        >
          <defs>
            <radialGradient id="oceanGradient" cx="50%" cy="44%" r="70%">
              <stop offset="0%"   stopColor="#c4e1f4" />
              <stop offset="28%"  stopColor="#88bcd7" />
              <stop offset="58%"  stopColor="#537da0" />
              <stop offset="100%" stopColor="#3d607e" />
            </radialGradient>
            <radialGradient id="oceanBloom" cx="50%" cy="44%" r="52%">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.14)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <pattern id="oceanFine" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(84,123,156,0.06)" strokeWidth="0.7"/>
            </pattern>
            <pattern id="paperGrain" width="72" height="72" patternUnits="userSpaceOnUse">
              <circle cx="11" cy="16" r="0.7" fill="rgba(255,255,255,0.04)" />
              <circle cx="31" cy="38" r="0.55" fill="rgba(0,0,0,0.05)" />
              <circle cx="48" cy="20" r="0.65" fill="rgba(255,255,255,0.035)" />
              <circle cx="61" cy="54" r="0.75" fill="rgba(0,0,0,0.04)" />
              <circle cx="25" cy="60" r="0.6" fill="rgba(255,255,255,0.03)" />
            </pattern>
            <linearGradient id="landWash" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.14)" />
              <stop offset="55%"  stopColor="rgba(255,255,255,0.02)" />
              <stop offset="100%" stopColor="rgba(26,18,10,0.1)" />
            </linearGradient>
            <filter id="coastShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2.4" floodColor="#6f9bbb" floodOpacity="0.24" />
            </filter>
            <filter id="labelShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#204664" floodOpacity="0.42" />
            </filter>
            <filter id="subtitleShadow" x="-40%" y="-60%" width="180%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="2.2" floodColor="#0e1a08" floodOpacity="0.78" />
            </filter>
            <filter id="pinGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#fff8a0" floodOpacity="0.82" />
            </filter>
            <filter id="subLabelShadow" x="-40%" y="-60%" width="180%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.8" floodColor="#0e1004" floodOpacity="0.72" />
            </filter>
            <clipPath id="atlasLandClip">
              <path d={atlas.landClipPath || atlas.coastlinePath || ""} />
            </clipPath>
          </defs>

          <g>
            {/* Ocean */}
            <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#oceanGradient)" />
            <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#oceanFine)" />
            {[0.44, 0.62, 0.84, 1.10, 1.42].map((r, i) => (
              <ellipse key={`bathy-${i}`}
                cx={MAP_WIDTH * 0.5} cy={MAP_HEIGHT * 0.48}
                rx={MAP_WIDTH * r * 0.40} ry={MAP_HEIGHT * r * 0.46}
                fill="none"
                stroke={`rgba(106,151,184,${0.085 - i * 0.011})`}
                strokeWidth="1.1" strokeDasharray="5 10"
              />
            ))}
            {oceanGlow.map((glow, i) => (
              <ellipse key={`og-${i}`} cx={glow.x} cy={glow.y} rx={glow.rx} ry={glow.ry}
                fill="url(#oceanBloom)" opacity={glow.opacity} />
            ))}
            {waves.map((wave, i) => {
              const a = wave.amplitude, s = wave.width * 0.34;
              return (
                <path key={`w-${i}`}
                  d={`M ${wave.x} ${wave.y} q ${s * 0.5} ${-a} ${s} 0 q ${s * 0.5} ${a} ${s} 0 q ${s * 0.5} ${-a} ${s} 0`}
                  className="ocean-wave"
                />
              );
            })}

            {/* Islands and repos */}
            <g ref={sceneRef} className="map-scene" transform={renderCameraTransform(cameraRef.current)}>
              <g clipPath="url(#atlasLandClip)">
                <path d={atlas.landClipPath || atlas.coastlinePath || ""} className="atlas-land-base" />
                <path d={atlas.landClipPath || atlas.coastlinePath || ""} className="atlas-land-grain" fill="url(#paperGrain)" />
                <AtlasScene
                  atlas={atlas}
                  colors={colors}
                  focusedIsland={focusedIsland}
                  islandTransforms={islandTransforms}
                  positionedReposByIsland={positionedReposByIsland}
                  regionDecor={regionDecor}
                  activeRepoId={activeRepo?.id ?? null}
                  introHighlightedRepoId={introStep?.highlightedRepoId ?? null}
                  hoveredRepoId={hoveredRepoId}
                  isInteracting={isInteracting}
                  scaleBreakpoint={scaleBreakpoint}
                  visibleRepoLabelIds={visibleRepoLabelIds}
                  showSubcategoryLabels={SHOW_SUBCATEGORY_LABELS && scaleBreakpoint === "near"}
                  debugMode={SHOW_LAYOUT_DEBUG}
                  onSelectRepo={onSelectRepo}
                  onSelectIsland={onSelectIsland}
                  onHoverRepo={handleHoverRepo}
                  onLeaveRepo={handleLeaveRepo}
                />
              </g>
              {/* Region labels — outside the land clip so taglines on edge islands are never cropped */}
              <g style={{ pointerEvents: "none" }}>
                {atlas.regions.map((region) => {
                  const transform = islandTransforms[region.island];
                  const tagline   = labelMeta?.[region.island]?.tagline;
                  const lines     = labelLines(region.island);
                  return (
                    <g key={`lbl-${region.island}`} transform={islandTransformString(transform)}>
                      <text
                        x={region.labelX} y={region.labelY}
                        className="region-label"
                        textAnchor="middle"
                        filter="url(#labelShadow)"
                        style={{ fontSize: `${region.labelSize}px`, letterSpacing: `${region.labelSpacing}em` }}
                        transform={`rotate(${region.labelRotation} ${region.labelX} ${region.labelY})`}
                      >
                        {lines.map((line, i) => (
                          <tspan key={`${region.island}-l${i}`} x={region.labelX} dy={i === 0 ? 0 : 24}>{line}</tspan>
                        ))}
                      </text>
                      {tagline && (
                        <text
                          x={region.labelX}
                          y={region.labelY + lines.length * 26 + 9}
                          className="region-subtitle"
                          textAnchor="middle"
                          filter="url(#subtitleShadow)"
                          transform={`rotate(${region.labelRotation} ${region.labelX} ${region.labelY})`}
                        >
                          {tagline}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>

            {/* Axis labels */}
            <g aria-hidden="true" style={{ pointerEvents: "none" }}>
              <line x1={48} y1={MAP_HEIGHT - 28} x2={MAP_WIDTH - 48} y2={MAP_HEIGHT - 28} className="map-axis-rule" />
              <text x={64} y={MAP_HEIGHT - 14} className="map-axis-label" textAnchor="start">← FAST</text>
              <text x={MAP_WIDTH / 2} y={MAP_HEIGHT - 14} className="map-axis-label" textAnchor="middle">TIME TO VALUE</text>
              <text x={MAP_WIDTH - 64} y={MAP_HEIGHT - 14} className="map-axis-label" textAnchor="end">SLOW →</text>
              <line x1={28} y1={48} x2={28} y2={MAP_HEIGHT - 48} className="map-axis-rule" />
              <text x={14} y={80} className="map-axis-label" textAnchor="middle" transform="rotate(-90 14 80)">HIGH ↑</text>
              <text x={14} y={MAP_HEIGHT / 2} className="map-axis-label" textAnchor="middle" transform={`rotate(-90 14 ${MAP_HEIGHT / 2})`}>ECOSYSTEM IMPACT</text>
              <text x={14} y={MAP_HEIGHT - 80} className="map-axis-label" textAnchor="middle" transform={`rotate(-90 14 ${MAP_HEIGHT - 80})`}>↓ LOW</text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
