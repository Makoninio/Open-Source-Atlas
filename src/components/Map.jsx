import { memo, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { runForceLayout } from "../lib/forces";
import { clamp, MAP_HEIGHT, MAP_WIDTH } from "../lib/layout";
import { buildAtlas } from "../lib/regions";

const DEFAULT_SCALE = 0.74;
const MIN_SCALE = 0.68;
const MAX_SCALE = 4.8;
const REPO_FOCUS_SCALE = 2.35;
const COMP_LEFT = 26;
const COMP_TOP = 26;
const COMP_SIZE = 132;

function shortNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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
  for (let i = 0; i < 54; i += 1) {
    const x = 30 + random() * (MAP_WIDTH - 60);
    const y = 20 + random() * (MAP_HEIGHT - 40);
    const width = 18 + random() * 24;
    waves.push({ x, y, width });
  }
  return waves;
}

function buildOceanGlow() {
  return [
    { x: 620, y: 410, rx: 330, ry: 230, opacity: 0.22 },
    { x: 430, y: 240, rx: 180, ry: 120, opacity: 0.12 },
    { x: 915, y: 255, rx: 210, ry: 150, opacity: 0.13 },
    { x: 980, y: 635, rx: 190, ry: 135, opacity: 0.11 },
    { x: 290, y: 650, rx: 170, ry: 120, opacity: 0.1 },
  ];
}

function buildRegionDecor(regions, atoms) {
  return regions.map((region) => {
    const random = seeded(hashString(region.island));
    const regionAtoms = region.atomIndices.map((index) => atoms[index]);
    const figures = [];
    const speckles = [];
    const figureCount = Math.max(10, Math.round(regionAtoms.length * 0.08));
    const speckleCount = Math.max(40, Math.round(regionAtoms.length * 0.3));

    while (figures.length < figureCount) {
      const atom = regionAtoms[Math.floor(random() * regionAtoms.length)];
      figures.push({
        x: atom.x + atom.driftX * 1.8,
        y: atom.y + atom.driftY * 1.8,
        tone: random() > 0.75 ? "#794f4d" : random() > 0.55 ? "#4b5e5d" : "#473f35",
        scale: 0.75 + random() * 0.55,
      });
    }

    while (speckles.length < speckleCount) {
      const atom = regionAtoms[Math.floor(random() * regionAtoms.length)];
      speckles.push({
        x: atom.x + atom.driftX,
        y: atom.y + atom.driftY,
        r: 0.45 + random() * 0.9,
        opacity: 0.06 + random() * 0.08,
      });
    }

    return { island: region.island, figures, speckles };
  });
}

function labelLines(text) {
  const words = text.toUpperCase().split(" ");
  if (words.length <= 1) return [text.toUpperCase()];
  if (words.length === 2) return words;
  if (words.length === 3) return [`${words[0]} ${words[1]}`, words[2]];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function buildDefaultCamera() {
  return {
    scale: DEFAULT_SCALE,
    x: MAP_WIDTH / 2 - (MAP_WIDTH / 2) * DEFAULT_SCALE,
    y: MAP_HEIGHT / 2 - (MAP_HEIGHT / 2) * DEFAULT_SCALE,
  };
}

function buildIslandTransforms(regions) {
  const mapCenterX = MAP_WIDTH / 2;
  const mapCenterY = MAP_HEIGHT / 2;
  return Object.fromEntries(
    regions.map((region) => {
      const dx = region.centerX - mapCenterX;
      const dy = region.centerY - mapCenterY;
      const length = Math.hypot(dx, dy) || 1;
      const push = 8 + Math.min(24, length * 0.035);
      return [
        region.island,
        {
          cx: region.centerX,
          cy: region.centerY,
          scale: 0.87,
          offsetX: (dx / length) * push,
          offsetY: (dy / length) * push,
        },
      ];
    }),
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
  return {
    scale,
    x: MAP_WIDTH / 2 - point.x * scale,
    y: MAP_HEIGHT / 2 - point.y * scale,
  };
}

function renderCameraTransform(camera) {
  return `matrix(${camera.scale} 0 0 ${camera.scale} ${camera.x} ${camera.y})`;
}

// Convert screen coords to SVG viewBox coords accounting for preserveAspectRatio letterboxing
function screenToSVG(svgEl, clientX, clientY) {
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(ctm.inverse());
}

// Snap repos that land outside their island atoms back to the nearest island atom
function snapReposToIslands(repos, atoms) {
  return repos.map((repo) => {
    const myAtoms = atoms.filter((a) => a.island === repo.classification.island);
    if (!myAtoms.length) return repo;

    let nearestDist = Infinity;
    let nearestAtom = myAtoms[0];
    for (const atom of myAtoms) {
      const d = Math.hypot(repo.x - atom.x, repo.y - atom.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestAtom = atom;
      }
    }

    if (nearestDist < 40) return repo;
    return { ...repo, x: nearestAtom.x, y: nearestAtom.y };
  });
}

const AtlasScene = memo(function AtlasScene({
  atlas,
  colors,
  islandTransforms,
  positionedReposByIsland,
  regionDecor,
  activeRepoId,
  isInteracting,
  onSelectRepo,
}) {
  return (
    <>
      {atlas.regions.map((region) => {
        const transform = islandTransforms[region.island];
        const decor = regionDecor.find((item) => item.island === region.island);
        const islandRepos = positionedReposByIsland[region.island] || [];
        const fillColor = colors[region.island] || "#c7b08a";
        const fillPath = atlas.islandFillPaths[region.island] || "";

        return (
          <g key={region.island} transform={islandTransformString(transform)}>
            {/* Soft glow behind island */}
            <circle
              cx={region.labelX}
              cy={region.labelY}
              r={region.glowRadius * 1.5}
              className="island-glow"
              filter={isInteracting ? undefined : "url(#oceanGlow)"}
            />

            {/* SOLID island fill — single path, no cell mosaic */}
            <path
              d={fillPath}
              fill={fillColor}
              stroke={fillColor}
              strokeWidth="1.8"
              strokeLinejoin="round"
              className="island-fill"
            />

            {/* Shore highlight — subtle inner rim */}
            <path
              d={fillPath}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={3.5}
              strokeLinejoin="round"
              className="island-shore"
            />

            {/* Land texture grain */}
            {!isInteracting && (
              <path
                d={fillPath}
                fill="rgba(28,18,8,0.09)"
                filter="url(#landTexture)"
                className="island-texture"
              />
            )}

            {/* Coast shadow lines */}
            {region.coastPaths.map((path, index) => (
              <path
                key={`${region.island}-coast-${index}`}
                d={path}
                className="atlas-coast"
                filter={isInteracting ? undefined : "url(#coastShadow)"}
              />
            ))}

            {/* Terrain speckles */}
            {decor?.speckles.map((speckle, index) => (
              <circle
                key={`${region.island}-speckle-${index}`}
                cx={speckle.x}
                cy={speckle.y}
                r={speckle.r}
                className="region-speckle"
                opacity={speckle.opacity}
              />
            ))}

            {/* Mini figure decorations */}
            {!isInteracting && decor?.figures.map((figure, index) => (
              <g
                key={`${region.island}-figure-${index}`}
                transform={`translate(${figure.x}, ${figure.y}) scale(${figure.scale})`}
                className="mini-figure"
              >
                <circle cx="0" cy="-2.8" r="1.2" fill={figure.tone} />
                <path d="M -0.9 0 L 0.9 0 L 0.6 4 L -0.6 4 Z" fill={figure.tone} />
              </g>
            ))}

            {/* Repo nodes — only rendered inside their island */}
            {islandRepos.map((repo) => {
              const isActive = activeRepoId === repo.id;
              const glyphSpin = (hashString(repo.id) % 24) - 12;

              return (
                <g
                  key={repo.id}
                  className={`repo-node ${isActive ? "is-active" : ""}`}
                  transform={`translate(${repo.x}, ${repo.y})`}
                  onClick={(e) => { e.stopPropagation(); onSelectRepo(repo); }}
                  onFocus={() => onSelectRepo(repo)}
                  tabIndex={0}
                  role="button"
                  aria-label={repo.name}
                >
                  <circle r={repo.radius + (isActive ? 3.2 : 1.6)} className="repo-node__halo" />
                  <circle
                    r={Math.max(1.2, repo.radius * 0.38)}
                    fill={colors[repo.classification.island] || "#8a7463"}
                    className="repo-node__dot"
                  />
                  <g
                    className="repo-node__glyph"
                    transform={`rotate(${glyphSpin}) scale(${0.44 + repo.radius * 0.045})`}
                  >
                    <circle cx="0" cy="-4.2" r="1.65" className="repo-node__glyph-fill" />
                    <path
                      d="M -2.3 5.8 C -2 2.6 -1.2 0.9 0 0.9 C 1.2 0.9 2 2.6 2.3 5.8 L 1.2 5.8 L 0.7 9.6 L -0.7 9.6 L -1.2 5.8 Z"
                      className="repo-node__glyph-fill"
                    />
                    <path d="M -1.9 2.8 L -4.1 5.5" className="repo-node__glyph-stroke" />
                    <path d="M 1.9 2.8 L 4.1 5.5" className="repo-node__glyph-stroke" />
                  </g>
                </g>
              );
            })}

            {/* Island name label */}
            <text
              x={region.labelX}
              y={region.labelY}
              className="region-label"
              textAnchor="middle"
              filter="url(#labelShadow)"
              style={{
                fontSize: `${region.labelSize}px`,
                letterSpacing: `${region.labelSpacing}em`,
              }}
              transform={`rotate(${region.labelRotation} ${region.labelX} ${region.labelY})`}
            >
              {labelLines(region.island).map((line, index) => (
                <tspan key={`${region.island}-line-${index}`} x={region.labelX} dy={index === 0 ? 0 : 24}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </>
  );
});

export default function Map({ repos, colors, activeRepo, onSelectRepo }) {
  const svgRef = useRef(null);
  const sceneRef = useRef(null);
  const cardRef = useRef(null);
  const dragRef = useRef(null);
  const cameraTweenRef = useRef(null);
  const interactionTimeoutRef = useRef(null);

  const positionedRepos = useMemo(() => runForceLayout(repos), [repos]);
  const atlas = useMemo(() => buildAtlas(positionedRepos), [positionedRepos]);

  // Snap any repos that ended up outside their island back to the nearest island atom
  const snappedRepos = useMemo(
    () => snapReposToIslands(positionedRepos, atlas.atoms),
    [positionedRepos, atlas],
  );

  const waves = useMemo(() => buildWaves(), []);
  const oceanGlow = useMemo(() => buildOceanGlow(), []);
  const regionDecor = useMemo(() => buildRegionDecor(atlas.regions, atlas.atoms), [atlas]);
  const islandTransforms = useMemo(() => buildIslandTransforms(atlas.regions), [atlas.regions]);

  const compassRepoPoints = useMemo(() => {
    const scaleX = COMP_SIZE / MAP_WIDTH;
    const scaleY = COMP_SIZE / MAP_HEIGHT;
    return snappedRepos.map((repo) => {
      const t = applyIslandTransform(repo, islandTransforms[repo.classification.island]);
      return {
        id: repo.id,
        island: repo.classification.island,
        x: COMP_LEFT + t.x * scaleX,
        y: COMP_TOP + t.y * scaleY,
      };
    });
  }, [snappedRepos, islandTransforms]);

  const compassRegionPoints = useMemo(() => {
    const scaleX = COMP_SIZE / MAP_WIDTH;
    const scaleY = COMP_SIZE / MAP_HEIGHT;
    return atlas.regions.map((region) => {
      const t = applyIslandTransform(
        { x: region.centerX, y: region.centerY },
        islandTransforms[region.island],
      );
      return {
        island: region.island,
        worldX: t.x,
        worldY: t.y,
        x: COMP_LEFT + t.x * scaleX,
        y: COMP_TOP + t.y * scaleY,
      };
    });
  }, [atlas.regions, islandTransforms]);

  const cameraRef = useRef(buildDefaultCamera());
  const [isInteracting, setIsInteracting] = useState(false);
  const [navState, setNavState] = useState(() => ({
    camera: buildDefaultCamera(),
    currentIsland: compassRegionPoints[0]?.island ?? null,
  }));

  const positionedReposByIsland = useMemo(
    () =>
      snappedRepos.reduce((acc, repo) => {
        if (!acc[repo.classification.island]) acc[repo.classification.island] = [];
        acc[repo.classification.island].push(repo);
        return acc;
      }, {}),
    [snappedRepos],
  );

  const activeNode = useMemo(() => {
    if (!activeRepo) return null;
    const match = snappedRepos.find((repo) => repo.id === activeRepo.id);
    if (!match) return null;
    return applyIslandTransform(match, islandTransforms[match.classification.island]);
  }, [activeRepo, islandTransforms, snappedRepos]);

  const homepageLink = activeRepo?.story?.links?.homepage || activeRepo?.url;
  const homepageLabel = activeRepo?.story?.links?.homepage ? "Visit org / project site" : "View on GitHub";
  const activeScreenNode = activeNode
    ? {
        x: activeNode.x * cameraRef.current.scale + cameraRef.current.x,
        y: activeNode.y * cameraRef.current.scale + cameraRef.current.y,
      }
    : null;

  function deriveNavState(camera) {
    const viewportCenterX = (MAP_WIDTH / 2 - camera.x) / camera.scale;
    const viewportCenterY = (MAP_HEIGHT / 2 - camera.y) / camera.scale;
    const currentRegion = compassRegionPoints.reduce((closest, region) => {
      if (!closest) return region;
      const closestDist = Math.hypot(closest.worldX - viewportCenterX, closest.worldY - viewportCenterY);
      const regionDist = Math.hypot(region.worldX - viewportCenterX, region.worldY - viewportCenterY);
      return regionDist < closestDist ? region : closest;
    }, null);
    return {
      camera: { ...camera },
      currentIsland: currentRegion?.island ?? null,
    };
  }

  function syncCardPosition(camera) {
    if (!cardRef.current || !activeNode) return;
    cardRef.current.style.left = `${((activeNode.x * camera.scale + camera.x) / MAP_WIDTH) * 100}%`;
    cardRef.current.style.top = `${((activeNode.y * camera.scale + camera.y) / MAP_HEIGHT) * 100}%`;
  }

  function applyCamera(camera) {
    if (sceneRef.current) {
      sceneRef.current.setAttribute("transform", renderCameraTransform(camera));
    }
    syncCardPosition(camera);
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
      ...targetCamera,
      duration,
      ease,
      overwrite: true,
      onUpdate: () => applyCamera(cameraRef.current),
    });
  }

  useEffect(() => {
    applyCamera(cameraRef.current);
    return () => {
      cameraTweenRef.current?.kill();
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeNode) {
      animateCamera(buildDefaultCamera(), { duration: 0.4 });
      return;
    }
    animateCamera(focusCamera(activeNode, REPO_FOCUS_SCALE), { duration: 0.55, ease: "power3.out" });
  }, [activeNode]);

  // ESC key closes the card
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onSelectRepo(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelectRepo]);

  function handleWheel(event) {
    event.preventDefault();
    markInteractionActive();
    if (!svgRef.current) return;

    // Use SVG coordinate transform so zoom correctly tracks cursor regardless of aspect ratio
    const svgPt = screenToSVG(svgRef.current, event.clientX, event.clientY);
    const previous = cameraRef.current;
    const nextScale = clamp(
      previous.scale * (event.deltaY < 0 ? 1.12 : 0.9),
      MIN_SCALE,
      MAX_SCALE,
    );
    const worldX = (svgPt.x - previous.x) / previous.scale;
    const worldY = (svgPt.y - previous.y) / previous.scale;

    animateCamera(
      {
        scale: nextScale,
        x: svgPt.x - worldX * nextScale,
        y: svgPt.y - worldY * nextScale,
      },
      { duration: 0.18, ease: "power1.out" },
    );
  }

  function handlePointerDown(event) {
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
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    markInteractionActive();
  }

  // Compass viewport rectangle — corrected calculation
  const cam = navState.camera;
  const compViewport = {
    x: COMP_LEFT + ((-cam.x / cam.scale) / MAP_WIDTH) * COMP_SIZE,
    y: COMP_TOP + ((-cam.y / cam.scale) / MAP_HEIGHT) * COMP_SIZE,
    w: (MAP_WIDTH / cam.scale / MAP_WIDTH) * COMP_SIZE,
    h: (MAP_HEIGHT / cam.scale / MAP_HEIGHT) * COMP_SIZE,
  };

  return (
    <div className="map-wrapper">
      {/* Mini compass — bottom right */}
      <div className="compass">
        <svg viewBox="0 0 184 184" className="compass__svg" aria-hidden="true">
          <rect x="0" y="0" width="184" height="184" className="compass__bg" rx="8" />
          {/* Axis cross */}
          <line x1="92" y1="26" x2="92" y2="158" className="compass__cross" />
          <line x1="26" y1="92" x2="158" y2="92" className="compass__cross" />
          {/* Repo dots */}
          {compassRepoPoints.map((pt) => (
            <circle
              key={pt.id}
              cx={pt.x}
              cy={pt.y}
              r="2.4"
              className={`compass__dot ${navState.currentIsland === pt.island ? "compass__dot--active" : ""}`}
            />
          ))}
          {/* Viewport indicator */}
          <rect
            x={compViewport.x}
            y={compViewport.y}
            width={compViewport.w}
            height={compViewport.h}
            className="compass__viewport"
          />
          {/* North needle */}
          <path d="M 92 54 L 97 82 L 92 78 L 87 82 Z" className="compass__needle" />
          <circle cx="92" cy="92" r="4.5" className="compass__core" />
        </svg>
        <p className="compass__label">
          {navState.currentIsland || "Atlas"}
        </p>
      </div>

      {/* Toolbar */}
      <div className="map-toolbar">
        <button
          type="button"
          className="map-toolbar__button"
          onClick={() => animateCamera(buildDefaultCamera(), { duration: 0.45 })}
        >
          Reset view
        </button>
        {activeRepo && (
          <button
            type="button"
            className="map-toolbar__button"
            onClick={() =>
              activeNode && animateCamera(focusCamera(activeNode, REPO_FOCUS_SCALE), { duration: 0.55, ease: "power3.out" })
            }
          >
            Focus
          </button>
        )}
      </div>

      {/* Map surface — click ocean to deselect */}
      <div
        className="map-surface"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => onSelectRepo(null)}
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
            <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#486b93" />
              <stop offset="45%" stopColor="#557aa4" />
              <stop offset="100%" stopColor="#3d628a" />
            </linearGradient>
            <radialGradient id="oceanBloom" cx="50%" cy="42%" r="55%">
              <stop offset="0%" stopColor="rgba(114, 160, 212, 0.32)" />
              <stop offset="100%" stopColor="rgba(114, 160, 212, 0)" />
            </radialGradient>
            <filter id="coastShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#1c2c3e" floodOpacity="0.4" />
            </filter>
            <filter id="oceanGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <filter id="landTexture" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="noise" />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0.12 0"
                in="noise"
              />
            </filter>
            <filter id="labelShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0a1520" floodOpacity="0.9" />
            </filter>
            {/* Edge vignette gradients */}
            <linearGradient id="fadeL" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3a526e" stopOpacity="1" />
              <stop offset="100%" stopColor="#3a526e" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fadeR" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#3a526e" stopOpacity="1" />
              <stop offset="100%" stopColor="#3a526e" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fadeT" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3a526e" stopOpacity="1" />
              <stop offset="100%" stopColor="#3a526e" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fadeB" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#3a526e" stopOpacity="1" />
              <stop offset="100%" stopColor="#3a526e" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Ocean */}
          <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#oceanGradient)" />
          {oceanGlow.map((glow, index) => (
            <ellipse
              key={`ocean-glow-${index}`}
              cx={glow.x}
              cy={glow.y}
              rx={glow.rx}
              ry={glow.ry}
              fill="url(#oceanBloom)"
              opacity={glow.opacity}
            />
          ))}
          {waves.map((wave, index) => (
            <path
              key={`wave-${index}`}
              d={`M ${wave.x} ${wave.y} q ${wave.width * 0.18} -6 ${wave.width * 0.36} 0 q ${wave.width * 0.18} 6 ${wave.width * 0.36} 0 q ${wave.width * 0.18} -6 ${wave.width * 0.36} 0`}
              className="ocean-wave"
            />
          ))}

          {/* Islands and repos */}
          <g ref={sceneRef} className="map-scene" transform={renderCameraTransform(cameraRef.current)}>
            <AtlasScene
              atlas={atlas}
              colors={colors}
              islandTransforms={islandTransforms}
              positionedReposByIsland={positionedReposByIsland}
              regionDecor={regionDecor}
              activeRepoId={activeRepo?.id ?? null}
              isInteracting={isInteracting}
              onSelectRepo={onSelectRepo}
            />
          </g>

          {/* Edge vignette — fades island edges into ocean so the SVG frame feels like a coast */}
          <rect x={0} y={0} width={80} height={MAP_HEIGHT} fill="url(#fadeL)" pointerEvents="none" />
          <rect x={MAP_WIDTH - 80} y={0} width={80} height={MAP_HEIGHT} fill="url(#fadeR)" pointerEvents="none" />
          <rect x={0} y={0} width={MAP_WIDTH} height={60} fill="url(#fadeT)" pointerEvents="none" />
          <rect x={0} y={MAP_HEIGHT - 60} width={MAP_WIDTH} height={60} fill="url(#fadeB)" pointerEvents="none" />

        </svg>

        {/* Repo detail card */}
        {activeRepo && (
          <div
            ref={cardRef}
            className="map-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              left: activeScreenNode ? `${(activeScreenNode.x / MAP_WIDTH) * 100}%` : "50%",
              top: activeScreenNode ? `${(activeScreenNode.y / MAP_HEIGHT) * 100}%` : "50%",
            }}
          >
            <button
              type="button"
              className="map-card__close"
              onClick={() => onSelectRepo(null)}
              aria-label="Close"
            >
              ×
            </button>
            <p className="eyebrow">{activeRepo.classification.island}</p>
            <h2>{activeRepo.name}</h2>
            <p className="map-card__meta-line">
              {activeRepo.creator.name} · {activeRepo.year_created} · {shortNumber(activeRepo.metrics.stars)} stars
            </p>
            <p className="map-card__origin">{activeRepo.story?.origin || activeRepo.summary.origin_story}</p>
            {homepageLink && (
              <a className="map-card__link" href={homepageLink} target="_blank" rel="noreferrer">
                {homepageLabel} →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
