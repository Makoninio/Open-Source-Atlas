import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
import { CELL_H, CELL_W, buildIslandLayout } from "./regions";
import { clamp, MAP_HEIGHT, MAP_WIDTH, pointRadius } from "./layout";
import { getContinent } from "./taxonomy";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Per-island placement personalities.
// Hubs are normalized inside each island's usable bounds and act like town centers.
const PERSONALITIES = {
  "Viral Tools": {
    spreadX: 0.92,
    spreadY: 0.86,
    jitterFrac: 0.05,
    collPad: 4.4,
    strength: 0.20,
    labelPad: 18,
    hubBias: 0.66,
    loadPenalty: 1.50,
    indexPenalty: 0.52,
    ringStep: 25,
    radialX: 1.08,
    radialY: 0.88,
    hubWeights: [0.95, 1.05, 1.18, 1.05, 0.90],
    hubs: [[0.13, 0.18], [0.30, 0.34], [0.50, 0.49], [0.68, 0.63], [0.85, 0.77]],
  },
  Infrastructure: {
    spreadX: 0.93,
    spreadY: 0.90,
    jitterFrac: 0.05,
    collPad: 4.8,
    strength: 0.17,
    labelPad: 20,
    hubBias: 0.52,
    loadPenalty: 1.55,
    indexPenalty: 0.36,
    ringStep: 28,
    radialX: 1.10,
    radialY: 0.84,
    hubWeights: [1, 1.06, 0.98, 1.02, 0.98],
    hubs: [[0.16, 0.20], [0.44, 0.16], [0.75, 0.28], [0.28, 0.70], [0.74, 0.74]],
  },
  Startup: {
    spreadX: 0.92,
    spreadY: 0.84,
    jitterFrac: 0.05,
    collPad: 4.2,
    strength: 0.19,
    labelPad: 16,
    hubBias: 0.64,
    loadPenalty: 1.48,
    indexPenalty: 0.48,
    ringStep: 25,
    radialX: 1.12,
    radialY: 0.88,
    hubWeights: [0.90, 1.05, 1.32, 1.06, 0.92],
    hubs: [[0.11, 0.65], [0.28, 0.50], [0.49, 0.40], [0.68, 0.32], [0.87, 0.24]],
  },
  Creative: {
    spreadX: 0.91,
    spreadY: 0.88,
    jitterFrac: 0.07,
    collPad: 3.8,
    strength: 0.21,
    labelPad: 16,
    hubBias: 0.42,
    loadPenalty: 1.30,
    indexPenalty: 0.28,
    ringStep: 23,
    radialX: 1.08,
    radialY: 0.90,
    hubWeights: [0.86, 1.34, 0.90, 0.82, 0.78],
    hubs: [[0.14, 0.76], [0.32, 0.58], [0.55, 0.44], [0.78, 0.26], [0.84, 0.76]],
  },
  Utility: {
    spreadX: 0.94,
    spreadY: 0.91,
    jitterFrac: 0.05,
    collPad: 4.0,
    strength: 0.21,
    labelPad: 15,
    hubBias: 0.30,
    loadPenalty: 1.60,
    indexPenalty: 0.16,
    ringStep: 23,
    radialX: 1.06,
    radialY: 0.88,
    hubWeights: [1, 1, 1, 1, 1, 1, 1],
    hubs: [[0.12, 0.18], [0.32, 0.22], [0.56, 0.18], [0.80, 0.30], [0.20, 0.64], [0.50, 0.58], [0.80, 0.70]],
  },
  Learning: {
    spreadX: 0.91,
    spreadY: 0.89,
    jitterFrac: 0.07,
    collPad: 3.4,
    strength: 0.23,
    labelPad: 17,
    hubBias: 0.36,
    loadPenalty: 1.40,
    indexPenalty: 0.26,
    ringStep: 22,
    radialX: 1.02,
    radialY: 0.90,
    hubWeights: [0.92, 1.28, 0.94, 0.82],
    hubs: [[0.18, 0.26], [0.44, 0.54], [0.70, 0.38], [0.58, 0.76]],
  },
  "Ambitious but Obscure": {
    spreadX: 0.94,
    spreadY: 0.92,
    jitterFrac: 0.08,
    collPad: 5.5,
    strength: 0.16,
    labelPad: 22,
    hubBias: 0.48,
    loadPenalty: 1.50,
    indexPenalty: 0.36,
    ringStep: 28,
    radialX: 1.14,
    radialY: 0.80,
    hubWeights: [1, 1, 1, 1],
    hubs: [[0.15, 0.22], [0.57, 0.18], [0.26, 0.80], [0.82, 0.72]],
  },
};

const DEFAULT_PERSONALITY = {
  spreadX: 0.91,
  spreadY: 0.88,
  jitterFrac: 0.06,
  collPad: 3.5,
  strength: 0.22,
  labelPad: 16,
  hubBias: 0.50,
  loadPenalty: 1.30,
  indexPenalty: 0.40,
  ringStep: 22,
  radialX: 1.08,
  radialY: 0.88,
  hubWeights: [1, 1, 1],
  hubs: [[0.24, 0.30], [0.52, 0.52], [0.76, 0.72]],
};

function seeded(seed) {
  let value = (Math.abs(seed | 0) % 2147483646) + 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hashString(text) {
  return [...text].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 17);
}

function islandBoundaryForce(center, strength = 0.03) {
  let nodes = [];
  function force(alpha) {
    nodes.forEach((node) => {
      node.vx += (center.x - node.x) * strength * alpha;
      node.vy += (center.y - node.y) * strength * alpha;
    });
  }
  force.initialize = (nextNodes) => {
    nodes = nextNodes;
  };
  return force;
}

function exclusionForce(zones, padding = 16, strength = 0.12) {
  let nodes = [];
  function force(alpha) {
    nodes.forEach((node) => {
      zones.forEach((zone) => {
        const rx = zone.rx + node.radius + padding;
        const ry = zone.ry + node.radius + padding;
        let dx = node.x - zone.x;
        let dy = node.y - zone.y;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
          dx = 0.1;
          dy = 0.1;
        }
        const inside = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (inside >= 1) return;

        const angle = Math.atan2(dy, dx);
        const tx = zone.x + Math.cos(angle) * rx * 1.02;
        const ty = zone.y + Math.sin(angle) * ry * 1.02;
        node.vx += (tx - node.x) * strength * alpha;
        node.vy += (ty - node.y) * strength * alpha;
      });
    });
  }
  force.initialize = (nextNodes) => {
    nodes = nextNodes;
  };
  return force;
}

function rankOf(values) {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [0.5];

  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(n);

  let j = 0;
  while (j < n) {
    let k = j;
    while (k < n && indexed[k].v === indexed[j].v) k += 1;
    const avgRank = (j + k - 1) / 2;
    for (let m = j; m < k; m += 1) ranks[indexed[m].i] = avgRank / (n - 1);
    j = k;
  }

  return ranks;
}

function scaleToBounds(bounds, personality, [nx, ny]) {
  const islandW = bounds.xMax - bounds.xMin;
  const islandH = bounds.yMax - bounds.yMin;
  const mX = islandW * (1 - personality.spreadX) / 2;
  const mY = islandH * (1 - personality.spreadY) / 2;
  const xLo = bounds.xMin + mX;
  const xHi = bounds.xMax - mX;
  const yLo = bounds.yMin + mY;
  const yHi = bounds.yMax - mY;
  return {
    x: xLo + nx * (xHi - xLo),
    y: yLo + ny * (yHi - yLo),
  };
}

function pushOutOfZones(point, zones, padding = 16) {
  let next = { ...point };
  zones.forEach((zone) => {
    const rx = zone.rx + padding;
    const ry = zone.ry + padding;
    let dx = next.x - zone.x;
    let dy = next.y - zone.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      dx = 0.1;
      dy = -0.1;
    }
    const inside = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    if (inside >= 1) return;
    const angle = Math.atan2(dy, dx);
    next = {
      x: zone.x + Math.cos(angle) * rx * 1.04,
      y: zone.y + Math.sin(angle) * ry * 1.04,
    };
  });
  return next;
}

function projectPointToCells(x, y, radius, cells, padding = 2) {
  let best = { x, y };
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const x0 = cell.x + Math.min(radius + padding, CELL_W * 0.45);
    const x1 = cell.x + CELL_W - Math.min(radius + padding, CELL_W * 0.45);
    const y0 = cell.y + Math.min(radius + padding, CELL_H * 0.45);
    const y1 = cell.y + CELL_H - Math.min(radius + padding, CELL_H * 0.45);

    const px = clamp(x, Math.min(x0, x1), Math.max(x0, x1));
    const py = clamp(y, Math.min(y0, y1), Math.max(y0, y1));
    const distance = (px - x) ** 2 + (py - y) ** 2;

    if (distance === 0) return { x, y };
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: px, y: py };
    }
  }

  return best;
}

function projectNodeToIsland(node, cells, padding = 2) {
  const projected = projectPointToCells(node.x, node.y, node.radius, cells, padding);
  if (projected.x === node.x && projected.y === node.y) return;
  node.x = projected.x;
  node.y = projected.y;
  node.vx *= 0.18;
  node.vy *= 0.18;
}

function createHubTarget(hub, indexWithinHub, repo, personality, rng, scoreBias) {
  if (indexWithinHub === 0) {
    return {
      x: hub.x + (rng() - 0.5) * 3,
      y: hub.y + (rng() - 0.5) * 3,
    };
  }

  const tierScale =
    repo.metrics?.stars >= 200000 ? 0.48 :
    repo.metrics?.stars >= 100000 ? 0.64 :
    repo.metrics?.stars >= 50000 ? 0.82 :
    repo.metrics?.stars >= 20000 ? 0.96 :
    repo.metrics?.stars >= 5000 ? 1.08 : 1.18;

  const radius = personality.ringStep * Math.sqrt(indexWithinHub + 0.25) * tierScale;
  const angle = hub.angleOffset + indexWithinHub * GOLDEN_ANGLE + scoreBias * 0.95 + (rng() - 0.5) * 0.4;

  return {
    x: hub.x + Math.cos(angle) * radius * personality.radialX,
    y: hub.y + Math.sin(angle) * radius * personality.radialY,
  };
}

function buildAssignmentsForIsland(islandRepos, bounds, personality) {
  const tvsValues = islandRepos.map((repo) => clamp(repo.classification.time_to_value_score ?? 0.5, 0, 1));
  const ecoValues = islandRepos.map((repo) => clamp(repo.classification.ecosystem_score ?? 0.5, 0, 1));
  const tvsRanks = rankOf(tvsValues);
  const ecoRanks = rankOf(ecoValues);

  const globalHubs = personality.hubs.map((hub, index) => {
    const point = scaleToBounds(bounds, personality, hub);
    return { ...point, index, angleOffset: index * 0.46 };
  });

  const assignments = new Array(islandRepos.length);
  const hubLoad = new Array(globalHubs.length).fill(0);
  const weightedRepos = islandRepos
    .map((repo, index) => ({
      repo,
      index,
      routeBias: clamp(
        tvsRanks[index] * 0.45 +
          (1 - ecoRanks[index]) * 0.3 +
          tvsValues[index] * 0.15 +
          (1 - ecoValues[index]) * 0.1,
        0,
        1,
      ),
      scoreBias: tvsValues[index] * 0.8 - ecoValues[index] * 0.55,
      seed: hashString(repo.id || repo.name || `${index}`),
    }))
    .sort((a, b) => (b.repo.metrics?.stars ?? 0) - (a.repo.metrics?.stars ?? 0));

  weightedRepos.forEach((entry) => {
    const random = seeded(entry.seed);
    const selector = clamp(
      entry.routeBias * personality.hubBias + random() * (1 - personality.hubBias),
      0,
      1,
    );
    const preferredHubIndex = Math.round(selector * (globalHubs.length - 1));

    let bestHubIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    globalHubs.forEach((_hub, hubIndex) => {
      const weight = personality.hubWeights?.[hubIndex] ?? 1;
      const loadScore = hubLoad[hubIndex] / weight;
      const indexDistance = Math.abs(hubIndex - preferredHubIndex);
      const noise = (random() - 0.5) * 0.08;
      const score =
        loadScore * personality.loadPenalty +
        indexDistance * personality.indexPenalty +
        noise;

      if (score < bestScore) {
        bestScore = score;
        bestHubIndex = hubIndex;
      }
    });

    const slot = hubLoad[bestHubIndex];
    hubLoad[bestHubIndex] += 1;

    assignments[entry.index] = {
      hub: globalHubs[bestHubIndex],
      indexWithinHub: slot,
      scoreBias: entry.scoreBias,
    };
  });

  return assignments;
}

export function runForceLayout(repos) {
  const repoCount = repos.length;
  const byIsland = {};

  repos.forEach((repo) => {
    const island = getContinent(repo);
    if (!byIsland[island]) byIsland[island] = [];
    byIsland[island].push(repo);
  });

  const islandLayout = buildIslandLayout(Object.keys(byIsland));
  const islandBounds = islandLayout.bounds;
  const islandRegions = Object.fromEntries(
    islandLayout.regions.map((region) => [region.island, region]),
  );

  const allNodes = [];

  for (const [islandName, islandRepos] of Object.entries(byIsland)) {
    const bounds = islandBounds[islandName];
    const region = islandRegions[islandName];
    const personality = PERSONALITIES[islandName] || DEFAULT_PERSONALITY;
    const zones = region?.labelExclusionZones || [];

    if (!bounds) {
      const fallbackX = MAP_WIDTH / 2;
      const fallbackY = MAP_HEIGHT / 2;
      allNodes.push(
        ...islandRepos.map((repo, index) => ({
          ...repo,
          radius: pointRadius(repo.metrics?.stars ?? 0, repoCount),
          x: fallbackX + index * 2,
          y: fallbackY + index * 2,
        })),
      );
      continue;
    }

    const islandW = bounds.xMax - bounds.xMin;
    const islandH = bounds.yMax - bounds.yMin;
    const placementCells = bounds.innerCells || bounds.cells;
    const hubAssignments = buildAssignmentsForIsland(islandRepos, bounds, personality);

    const nodes = islandRepos.map((repo, index) => {
      const radius = pointRadius(repo.metrics?.stars ?? 0, repoCount);
      const rng = seeded(hashString(repo.id || repo.name || `${islandName}-${index}`));
      const { hub, indexWithinHub, scoreBias } = hubAssignments[index];
      const target = createHubTarget(hub, indexWithinHub, repo, personality, rng, scoreBias);
      const nudged = pushOutOfZones(target, zones, personality.labelPad + radius);
      const projected = projectPointToCells(nudged.x, nudged.y, radius, placementCells, 2);

      return {
        ...repo,
        radius,
        targetX: projected.x,
        targetY: projected.y,
        x: projected.x + (rng() - 0.5) * islandW * personality.jitterFrac,
        y: projected.y + (rng() - 0.5) * islandH * personality.jitterFrac,
      };
    });

    const islandCenter = {
      x: region?.centerX ?? (bounds.xMin + bounds.xMax) / 2,
      y: region?.centerY ?? (bounds.yMin + bounds.yMax) / 2,
    };

    const ticks = Math.max(320, 240 + nodes.length * 1.8);
    const simulation = forceSimulation(nodes)
      .force("x", forceX((node) => node.targetX).strength(personality.strength))
      .force("y", forceY((node) => node.targetY).strength(personality.strength))
      .force("boundary", islandBoundaryForce(islandCenter, 0.022))
      .force("labels", exclusionForce(zones, personality.labelPad, 0.18))
      .force("collide", forceCollide((node) => node.radius + personality.collPad).iterations(8))
      .stop();

    for (let tick = 0; tick < ticks; tick += 1) {
      simulation.tick();
      if (tick % 6 === 0 || tick === ticks - 1) {
        nodes.forEach((node) => projectNodeToIsland(node, placementCells, 2));
      }
    }

    // Compute inner-cell bounds for final clamping so repos stay away from the smoothed coastline
    const ixMin = placementCells.reduce((m, c) => Math.min(m, c.x), Infinity);
    const ixMax = placementCells.reduce((m, c) => Math.max(m, c.x + CELL_W), -Infinity);
    const iyMin = placementCells.reduce((m, c) => Math.min(m, c.y), Infinity);
    const iyMax = placementCells.reduce((m, c) => Math.max(m, c.y + CELL_H), -Infinity);

    nodes.forEach((node) => {
      const projected = projectPointToCells(node.x, node.y, node.radius, placementCells, 2);
      node.x = clamp(projected.x, ixMin + node.radius + 2, ixMax - node.radius - 2);
      node.y = clamp(projected.y, iyMin + node.radius + 2, iyMax - node.radius - 2);
    });

    allNodes.push(...nodes);
  }

  return allNodes;
}
