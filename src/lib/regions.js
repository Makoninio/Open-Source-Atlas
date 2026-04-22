import { Delaunay } from "d3-delaunay";
import { MAP_HEIGHT, MAP_WIDTH } from "./layout";

const ATLAS_COLUMNS = 52;
const ATLAS_ROWS = 30;
const MAP_INSET = 32;

function hashString(text) {
  return [...text].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function seeded(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function polygonArea(points) {
  let total = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    total += x1 * y2 - x2 * y1;
  }

  return Math.abs(total) / 2;
}

function polygonCentroid(points) {
  if (!points.length) return { x: 0, y: 0 };

  const areaFactor = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point[0] * next[1] - next[0] * point[1];
  }, 0);

  if (Math.abs(areaFactor) < 1e-6) {
    return {
      x: points.reduce((sum, point) => sum + point[0], 0) / points.length,
      y: points.reduce((sum, point) => sum + point[1], 0) / points.length,
    };
  }

  let cx = 0;
  let cy = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    const factor = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * factor;
    cy += (y1 + y2) * factor;
  }

  return {
    x: cx / (3 * areaFactor),
    y: cy / (3 * areaFactor),
  };
}

function polygonPath(points) {
  if (!points.length) return "";

  return points.reduce((path, point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${path}${command} ${point[0]} ${point[1]} `;
  }, "").concat("Z");
}

function organicPolygonPath(points, seed) {
  if (!points.length) return "";

  const random = seeded(seed);
  const center = polygonCentroid(points);
  const softened = points.map(([x, y]) => {
    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nudge = (random() - 0.5) * Math.min(4.8, distance * 0.16);

    return [
      x + (dx / distance) * nudge,
      y + (dy / distance) * nudge,
    ];
  });

  let path = "";

  softened.forEach((point, index) => {
    const previous = softened[(index - 1 + softened.length) % softened.length];
    const next = softened[(index + 1) % softened.length];
    const startX = (previous[0] + point[0]) / 2;
    const startY = (previous[1] + point[1]) / 2;
    const endX = (point[0] + next[0]) / 2;
    const endY = (point[1] + next[1]) / 2;

    if (index === 0) {
      path += `M ${startX} ${startY}`;
    }

    path += ` Q ${point[0]} ${point[1]} ${endX} ${endY}`;
  });

  return `${path} Z`;
}

function distanceScore(x1, y1, x2, y2, width, height) {
  return Math.abs(x1 - x2) / width + Math.abs(y1 - y2) / height;
}

function generateAtomSites() {
  const sites = [];
  const random = seeded(20260422);
  const usableWidth = MAP_WIDTH - MAP_INSET * 2;
  const usableHeight = MAP_HEIGHT - MAP_INSET * 2;
  const cellWidth = usableWidth / ATLAS_COLUMNS;
  const cellHeight = usableHeight / ATLAS_ROWS;

  for (let row = 0; row < ATLAS_ROWS; row += 1) {
    for (let column = 0; column < ATLAS_COLUMNS; column += 1) {
      const baseX = MAP_INSET + (column + 0.5) * cellWidth;
      const baseY = MAP_INSET + (row + 0.5) * cellHeight;
      const offsetX = (random() - 0.5) * cellWidth * 0.72;
      const offsetY = (random() - 0.5) * cellHeight * 0.72;

      sites.push([baseX + offsetX, baseY + offsetY]);
    }
  }

  return sites;
}

function buildIslandMeta(positionedRepos) {
  const grouped = positionedRepos.reduce((acc, repo) => {
    if (!acc[repo.classification.island]) acc[repo.classification.island] = [];
    acc[repo.classification.island].push(repo);
    return acc;
  }, {});

  const islands = Object.entries(grouped).map(([island, repos]) => {
    const centerX = repos.reduce((sum, repo) => sum + repo.targetX, 0) / repos.length;
    const centerY = repos.reduce((sum, repo) => sum + repo.targetY, 0) / repos.length;
    const totalStars = repos.reduce((sum, repo) => sum + repo.metrics.stars, 0);
    const averageImpact =
      repos.reduce((sum, repo) => sum + repo.classification.ecosystem_score, 0) / repos.length;

    return {
      island,
      repos,
      centerX,
      centerY,
      weight: repos.length * 10 + Math.sqrt(totalStars) * 0.14 + averageImpact * 18,
    };
  });

  const minWeight = Math.min(...islands.map((island) => island.weight));
  const maxWeight = Math.max(...islands.map((island) => island.weight));

  return islands.map((island) => ({
    ...island,
    expansionRate: 0.88 + ((island.weight - minWeight) / (maxWeight - minWeight || 1)) * 0.48,
  }));
}

function chooseSeeds(islands, atoms) {
  const used = new Set();

  islands.forEach((island) => {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    atoms.forEach((atom, index) => {
      if (used.has(index)) return;

      const score = distanceScore(
        atom.x,
        atom.y,
        island.centerX,
        island.centerY,
        MAP_WIDTH,
        MAP_HEIGHT,
      );

      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    island.seedIndex = bestIndex;
    used.add(bestIndex);
  });
}

function atomClaimCost(island, atom) {
  const centerDistance = distanceScore(
    atom.x,
    atom.y,
    island.centerX,
    island.centerY,
    MAP_WIDTH,
    MAP_HEIGHT,
  );

  let repoDistance = Number.POSITIVE_INFINITY;

  island.repos.forEach((repo) => {
    repoDistance = Math.min(
      repoDistance,
      distanceScore(atom.x, atom.y, repo.targetX, repo.targetY, MAP_WIDTH, MAP_HEIGHT),
    );
  });

  const axisBias =
    Math.min(
      Math.abs(atom.x - island.centerX) / MAP_WIDTH,
      Math.abs(atom.y - island.centerY) / MAP_HEIGHT,
    ) * 0.9;

  return (0.58 + centerDistance * 1.3 + repoDistance * 1.6 + axisBias) / island.expansionRate;
}

function buildClaimedAtlas(islands, atoms, neighbors) {
  const claimed = new Array(atoms.length).fill(null);
  const queue = [];

  islands.forEach((island) => {
    queue.push({ island, atomIndex: island.seedIndex, cost: 0 });
  });

  while (queue.length) {
    queue.sort((left, right) => left.cost - right.cost);
    const next = queue.shift();

    if (claimed[next.atomIndex]) continue;

    claimed[next.atomIndex] = next.island.island;

    neighbors[next.atomIndex].forEach((neighborIndex) => {
      if (claimed[neighborIndex]) return;
      queue.push({
        island: next.island,
        atomIndex: neighborIndex,
        cost: next.cost + atomClaimCost(next.island, atoms[neighborIndex]),
      });
    });
  }

  return claimed;
}

function buildBoundaryPaths(atoms) {
  const edgeMap = new Map();

  atoms.forEach((atom) => {
    atom.polygon.forEach((point, index) => {
      const next = atom.polygon[(index + 1) % atom.polygon.length];
      const start = `${point[0].toFixed(2)},${point[1].toFixed(2)}`;
      const end = `${next[0].toFixed(2)},${next[1].toFixed(2)}`;
      const key = start < end ? `${start}|${end}` : `${end}|${start}`;

      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          path: `M ${point[0]} ${point[1]} L ${next[0]} ${next[1]}`,
          owners: [],
        });
      }

      edgeMap.get(key).owners.push(atom.island);
    });
  });

  const coastPathsByIsland = {};

  edgeMap.forEach((edge) => {
    if (edge.owners.length === 1) {
      const [owner] = edge.owners;
      if (!coastPathsByIsland[owner]) coastPathsByIsland[owner] = [];
      coastPathsByIsland[owner].push(edge.path);
      return;
    }

    if (edge.owners[0] !== edge.owners[1]) {
      edge.owners.forEach((owner) => {
        if (!coastPathsByIsland[owner]) coastPathsByIsland[owner] = [];
        coastPathsByIsland[owner].push(edge.path);
      });
    }
  });

  return { coastPathsByIsland };
}

function landAtomCost(island, atom) {
  const centerDistance = distanceScore(
    atom.x,
    atom.y,
    island.centerX,
    island.centerY,
    MAP_WIDTH,
    MAP_HEIGHT,
  );

  let repoDistance = Number.POSITIVE_INFINITY;

  island.repos.forEach((repo) => {
    repoDistance = Math.min(
      repoDistance,
      distanceScore(atom.x, atom.y, repo.targetX, repo.targetY, MAP_WIDTH, MAP_HEIGHT),
    );
  });

  const edgeDistance = Math.min(atom.x, atom.y, MAP_WIDTH - atom.x, MAP_HEIGHT - atom.y);
  const edgePenalty = (1 - Math.min(edgeDistance / 170, 1)) * 0.22;

  return repoDistance * 1.9 + centerDistance * 1.05 + edgePenalty;
}

function chooseLandAtoms(islands, atoms) {
  const ownerSets = Object.fromEntries(
    islands.map((island) => [
      island.island,
      new Set(atoms.filter((atom) => atom.island === island.island).map((atom) => atom.index)),
    ]),
  );

  const landAtomsByIsland = {};

  islands.forEach((island) => {
    const owned = ownerSets[island.island];
    const queue = [{ atomIndex: island.seedIndex, cost: 0 }];
    const visited = new Set();
    const chosen = [];
    const targetCount = Math.max(
      68,
      Math.min(
        240,
        Math.round(island.repos.length * 16 + Math.sqrt(island.weight) * 15),
      ),
    );

    while (queue.length && chosen.length < targetCount) {
      queue.sort((left, right) => left.cost - right.cost);
      const next = queue.shift();

      if (visited.has(next.atomIndex) || !owned.has(next.atomIndex)) continue;
      visited.add(next.atomIndex);
      chosen.push(next.atomIndex);

      atoms[next.atomIndex].neighbors.forEach((neighborIndex) => {
        if (visited.has(neighborIndex) || !owned.has(neighborIndex)) return;
        queue.push({
          atomIndex: neighborIndex,
          cost: next.cost + landAtomCost(island, atoms[neighborIndex]),
        });
      });
    }

    // Add a thin fringe around the main landmass so the outer coastline feels
    // less clipped and more like a complete geographic silhouette.
    const fringe = new Set(chosen);
    chosen.forEach((atomIndex) => {
      atoms[atomIndex].neighbors.forEach((neighborIndex) => {
        if (!owned.has(neighborIndex)) return;
        if (fringe.has(neighborIndex)) return;
        if (landAtomCost(island, atoms[neighborIndex]) > 0.9) return;
        fringe.add(neighborIndex);
      });
    });

    landAtomsByIsland[island.island] = [...fringe];
  });

  return landAtomsByIsland;
}

export function buildAtlas(positionedRepos) {
  // The atlas keeps a dense Voronoi field as hidden structure, then assigns
  // ownership to atoms so each island can be rendered as a textured landmass.
  const islands = buildIslandMeta(positionedRepos);
  const sites = generateAtomSites();
  const delaunay = Delaunay.from(sites);
  // Extend Voronoi bounds to the full SVG canvas so edge atoms' cells reach the
  // SVG boundary. Islands on the edges/corners are then complete shapes clipped
  // by the SVG viewBox rather than by an arbitrary inner rectangle.
  const voronoi = delaunay.voronoi([0, 0, MAP_WIDTH, MAP_HEIGHT]);

  const atoms = sites.map(([x, y], index) => {
    const polygon = voronoi.cellPolygon(index)?.slice(0, -1) || [];
    const centroid = polygonCentroid(polygon);
    return {
      index,
      x: centroid.x || x,
      y: centroid.y || y,
      polygon,
      path: polygonPath(polygon),
      organicPath: organicPolygonPath(polygon, index + 17),
      area: polygonArea(polygon),
      neighbors: [...delaunay.neighbors(index)],
    };
  });

  chooseSeeds(islands, atoms);

  const claims = buildClaimedAtlas(
    islands,
    atoms,
    atoms.map((atom) => atom.neighbors),
  );

  atoms.forEach((atom, index) => {
    const island = claims[index];
    const random = seeded(hashString(`${island}-${index}`));
    atom.island = island;
    atom.fillOpacity = 0.86 + random() * 0.2;
    atom.textureOpacity = 0.08 + random() * 0.08;
    atom.driftX = (random() - 0.5) * Math.sqrt(atom.area) * 0.34;
    atom.driftY = (random() - 0.5) * Math.sqrt(atom.area) * 0.34;
  });

  // Second pass: keep only the strongest contiguous atoms near each island's
  // conceptual center. This prevents the land from expanding to the SVG edges
  // and replaces the "framed picture" look with a closed coastline silhouette.
  const landAtomsByIsland = chooseLandAtoms(islands, atoms);
  const landAtomSet = new Set(Object.values(landAtomsByIsland).flat());
  const landAtoms = atoms.filter((atom) => landAtomSet.has(atom.index));

  const regions = islands.map((island) => {
    const atomIndices = landAtomsByIsland[island.island] || [];
    const regionAtoms = atomIndices.map((index) => atoms[index]);
    const meanX = regionAtoms.reduce((sum, atom) => sum + atom.x, 0) / regionAtoms.length;
    const meanY = regionAtoms.reduce((sum, atom) => sum + atom.y, 0) / regionAtoms.length;
    const labelAtom = regionAtoms.reduce((best, atom) => {
      if (!best) return atom;
      const bestScore = distanceScore(best.x, best.y, meanX, meanY, MAP_WIDTH, MAP_HEIGHT);
      const atomScore = distanceScore(atom.x, atom.y, meanX, meanY, MAP_WIDTH, MAP_HEIGHT);
      return atomScore < bestScore ? atom : best;
    }, null);
    const labelRandom = seeded(hashString(island.island));
    const labelSize = 18 + Math.min(12, Math.sqrt(atomIndices.length) * 0.7);

    return {
      island: island.island,
      labelX: (labelAtom?.x ?? island.centerX) + (labelRandom() - 0.5) * 10,
      labelY: (labelAtom?.y ?? island.centerY) + (labelRandom() - 0.5) * 12,
      labelSize,
      labelRotation: (labelRandom() - 0.5) * 6,
      labelSpacing: 0.02 + labelRandom() * 0.05,
      glowRadius: Math.max(48, Math.sqrt(atomIndices.length) * 15),
      atomIndices,
      coastPaths: [],
      centerX: island.centerX,
      centerY: island.centerY,
    };
  });

  const { coastPathsByIsland } = buildBoundaryPaths(landAtoms);

  regions.forEach((region) => {
    region.coastPaths = coastPathsByIsland[region.island] || [];
  });

  // Build one solid fill path per island by concatenating only the kept land
  // atoms. The hidden Voronoi grid still organizes the map, but the visible
  // coastline is now a bounded landmass instead of a rectangular tiling.
  const islandFillPaths = Object.fromEntries(
    islands.map(({ island }) => [
      island,
      (landAtomsByIsland[island] || []).map((index) => atoms[index].organicPath).join(" "),
    ]),
  );

  return {
    atoms,
    regions,
    islandFillPaths,
  };
}
