import { MAP_HEIGHT, MAP_WIDTH } from "./layout";

const COLS = 60;
const ROWS = 34;
const BASE_COLS = 50;
const BASE_ROWS = 28;

export const CELL_W = MAP_WIDTH / COLS;
export const CELL_H = MAP_HEIGHT / ROWS;

function seeded(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hashString(text) {
  return [...text].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function idx(col, row) {
  return row * COLS + col;
}

function seedCell(name, col, row) {
  return {
    name,
    col: Math.round((col / BASE_COLS) * COLS),
    row: Math.round((row / BASE_ROWS) * ROWS),
  };
}

function countLandNeighbors(cells, col, row, predicate) {
  let total = 0;
  [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ].forEach(([dx, dy]) => {
    const nextCol = col + dx;
    const nextRow = row + dy;
    if (nextCol < 0 || nextCol >= COLS || nextRow < 0 || nextRow >= ROWS) return;
    if (predicate(cells[idx(nextCol, nextRow)])) total += 1;
  });
  return total;
}

function isLandAt(col, row) {
  const nx = (col + 0.5) / COLS - 0.5;
  const ny = (row + 0.5) / ROWS - 0.5;
  const angle = Math.atan2(ny * 0.88, nx * 1.06);
  const stretch = Math.sqrt((nx / 1.06) ** 2 + (ny / 0.88) ** 2);
  const noise =
    0.052 * Math.sin(angle * 3 + 0.8) +
    0.034 * Math.sin(angle * 5 + 1.55) +
    0.021 * Math.sin(angle * 7 + 0.26) +
    0.014 * Math.sin(angle * 11 + 2.15) +
    0.009 * Math.sin(angle * 17 + 0.72);
  const shelf =
    0.014 * Math.sin(nx * 10.5) +
    0.01 * Math.sin(ny * 11.5) +
    0.007 * Math.sin((nx + ny) * 16);

  return stretch < 0.405 + noise + shelf;
}

const ALL_SEEDS = [
  seedCell("Viral Tools", 9, 9),
  seedCell("Startup", 25, 7),
  seedCell("Infrastructure", 39, 9),
  seedCell("Learning", 7, 19),
  seedCell("Utility", 19, 19),
  seedCell("Creative", 31, 21),
  seedCell("Ambitious but Obscure", 42, 18),
  seedCell("Developer Experience", 28, 14),
  seedCell("Data & AI", 14, 13),
  seedCell("Security & Privacy", 43, 13),
  seedCell("Scientific Computing", 37, 14),
  seedCell("Community Knowledge", 21, 13),
  seedCell("Protocols & Networks", 7, 13),
];

function buildCells() {
  const cells = new Array(COLS * ROWS);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      cells[idx(col, row)] = {
        col,
        row,
        x: col * CELL_W,
        y: row * CELL_H,
        cx: (col + 0.5) * CELL_W,
        cy: (row + 0.5) * CELL_H,
        isLand: isLandAt(col, row),
        region: null,
        parcel: null,
      };
    }
  }

  return cells;
}

function assignRegions(cells, seeds) {
  const aspect = COLS / ROWS;

  cells.forEach((cell) => {
    if (!cell.isLand) return;

    let bestDistance = Number.POSITIVE_INFINITY;

    seeds.forEach((seed) => {
      const distance =
        Math.abs(cell.col - seed.col) +
        Math.abs(cell.row - seed.row) * aspect;

      if (distance < bestDistance) {
        bestDistance = distance;
        cell.region = seed.name;
      }
    });
  });
}

function buildFillPath(cells, regionName) {
  let path = "";

  for (let row = 0; row < ROWS; row += 1) {
    let start = -1;
    let length = 0;

    for (let col = 0; col <= COLS; col += 1) {
      const inRegion = col < COLS && cells[idx(col, row)].region === regionName;

      if (inRegion) {
        if (start < 0) {
          start = col;
          length = 0;
        }
        length += 1;
      } else if (start >= 0) {
        const x = (start * CELL_W).toFixed(1);
        const y = (row * CELL_H).toFixed(1);
        const w = (length * CELL_W).toFixed(1);
        const h = CELL_H.toFixed(1);
        path += `M${x} ${y}h${w}v${h}h-${w}Z `;
        start = -1;
        length = 0;
      }
    }
  }

  return path.trimEnd();
}

function assignParcels(cells, seeds) {
  seeds.forEach(({ name }) => {
    const regionCells = cells.filter((cell) => cell.region === name);
    if (!regionCells.length) return;

    const random = seeded(hashString(`parcel-${name}`));
    const spacing = Math.max(3, Math.min(5, Math.round(Math.sqrt(regionCells.length) / 3.8)));
    const parcelSeeds = [];

    regionCells.forEach((cell) => {
      const neighborCount = countLandNeighbors(cells, cell.col, cell.row, (next) => next.region === name);
      const gate = ((cell.col * 11 + cell.row * 7 + hashString(name)) % spacing) === 0;

      if (neighborCount >= 2 && gate) {
        parcelSeeds.push({
          id: `${name}-${parcelSeeds.length}`,
          col: cell.col + (random() - 0.5) * 1.6,
          row: cell.row + (random() - 0.5) * 1.2,
        });
      }
    });

    if (parcelSeeds.length < 8) {
      regionCells
        .filter((_, index) => index % Math.max(2, Math.floor(regionCells.length / 10)) === 0)
        .slice(0, 10)
        .forEach((cell) => {
          parcelSeeds.push({
            id: `${name}-${parcelSeeds.length}`,
            col: cell.col,
            row: cell.row,
          });
        });
    }

    regionCells.forEach((cell) => {
      let bestSeed = parcelSeeds[0];
      let bestDistance = Number.POSITIVE_INFINITY;

      parcelSeeds.forEach((seed) => {
        const distance =
          Math.abs(cell.col - seed.col) * (1 + random() * 0.15) +
          Math.abs(cell.row - seed.row) * (1.08 + random() * 0.18);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestSeed = seed;
        }
      });

      cell.parcel = bestSeed.id;
    });
  });
}

function buildParcelPaths(cells, regionName) {
  let path = "";

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = cells[idx(col, row)];
      if (cell.region !== regionName) continue;

      if (col + 1 < COLS) {
        const right = cells[idx(col + 1, row)];
        if (right.region === regionName && right.parcel !== cell.parcel) {
          const x = ((col + 1) * CELL_W).toFixed(1);
          const y0 = (row * CELL_H).toFixed(1);
          const y1 = ((row + 1) * CELL_H).toFixed(1);
          path += `M${x} ${y0}L${x} ${y1} `;
        }
      }

      if (row + 1 < ROWS) {
        const bottom = cells[idx(col, row + 1)];
        if (bottom.region === regionName && bottom.parcel !== cell.parcel) {
          const x0 = (col * CELL_W).toFixed(1);
          const x1 = ((col + 1) * CELL_W).toFixed(1);
          const y = ((row + 1) * CELL_H).toFixed(1);
          path += `M${x0} ${y}L${x1} ${y} `;
        }
      }
    }
  }

  return path.trimEnd();
}

function buildBorderPaths(cells) {
  const pathsByRegion = {};

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const current = cells[idx(col, row)];
      if (!current.isLand) continue;

      if (col + 1 < COLS) {
        const right = cells[idx(col + 1, row)];
        if (right.isLand && right.region !== current.region) {
          const x = ((col + 1) * CELL_W).toFixed(1);
          const y0 = (row * CELL_H).toFixed(1);
          const y1 = ((row + 1) * CELL_H).toFixed(1);
          const segment = `M${x} ${y0}L${x} ${y1} `;
          pathsByRegion[current.region] = (pathsByRegion[current.region] || "") + segment;
          pathsByRegion[right.region] = (pathsByRegion[right.region] || "") + segment;
        }
      }

      if (row + 1 < ROWS) {
        const bottom = cells[idx(col, row + 1)];
        if (bottom.isLand && bottom.region !== current.region) {
          const x0 = (col * CELL_W).toFixed(1);
          const x1 = ((col + 1) * CELL_W).toFixed(1);
          const y = ((row + 1) * CELL_H).toFixed(1);
          const segment = `M${x0} ${y}L${x1} ${y} `;
          pathsByRegion[current.region] = (pathsByRegion[current.region] || "") + segment;
          pathsByRegion[bottom.region] = (pathsByRegion[bottom.region] || "") + segment;
        }
      }
    }
  }

  return pathsByRegion;
}

function buildCoastSegments(cells) {
  const segments = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = cells[idx(col, row)];
      if (!cell.isLand) continue;

      const x0 = col * CELL_W;
      const x1 = (col + 1) * CELL_W;
      const y0 = row * CELL_H;
      const y1 = (row + 1) * CELL_H;

      if (row === 0 || !cells[idx(col, row - 1)].isLand) {
        segments.push([[x0, y0], [x1, y0]]);
      }
      if (col === COLS - 1 || !cells[idx(col + 1, row)].isLand) {
        segments.push([[x1, y0], [x1, y1]]);
      }
      if (row === ROWS - 1 || !cells[idx(col, row + 1)].isLand) {
        segments.push([[x1, y1], [x0, y1]]);
      }
      if (col === 0 || !cells[idx(col - 1, row)].isLand) {
        segments.push([[x0, y1], [x0, y0]]);
      }
    }
  }

  return segments;
}

function pointKey([x, y]) {
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function buildCoastLoops(cells) {
  const segments = buildCoastSegments(cells);
  const outgoing = new Map();

  segments.forEach(([start, end], index) => {
    const key = pointKey(start);
    if (!outgoing.has(key)) outgoing.set(key, []);
    outgoing.get(key).push({ start, end, index });
  });

  const used = new Set();
  const loops = [];

  segments.forEach((segment, index) => {
    if (used.has(index)) return;

    const loop = [];
    let current = { start: segment[0], end: segment[1], index };

    while (current && !used.has(current.index)) {
      used.add(current.index);
      loop.push(current.start);
      const nextOptions = outgoing.get(pointKey(current.end)) || [];
      current = nextOptions.find((option) => !used.has(option.index)) || null;
    }

    if (loop.length > 2) loops.push(loop);
  });

  return loops;
}

function smoothLoopPath(points, radius = Math.min(CELL_W, CELL_H) * 0.42) {
  if (!points.length) return "";

  const trimPoint = (from, to) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const distance = Math.hypot(dx, dy) || 1;
    const trim = Math.min(radius, distance * 0.45);
    return [to[0] - (dx / distance) * trim, to[1] - (dy / distance) * trim];
  };

  const advancePoint = (from, to) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const distance = Math.hypot(dx, dy) || 1;
    const trim = Math.min(radius, distance * 0.45);
    return [from[0] + (dx / distance) * trim, from[1] + (dy / distance) * trim];
  };

  let path = "";

  points.forEach((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const start = trimPoint(previous, point);
    const end = advancePoint(point, next);

    if (index === 0) {
      path += `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
    }

    path += `L${start[0].toFixed(1)} ${start[1].toFixed(1)}Q${point[0].toFixed(1)} ${point[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  });

  return `${path}Z`;
}

function buildCoastlinePath(cells) {
  const loops = buildCoastLoops(cells);
  return loops.map((loop) => smoothLoopPath(loop)).join(" ");
}

export function buildAtlas(positionedRepos) {
  const dataRegions = new Set(
    positionedRepos.map(
      (repo) => repo.classification?.island || repo.classification?.continent || "Unknown",
    ),
  );

  let seeds = ALL_SEEDS.filter((seed) => dataRegions.has(seed.name));
  if (seeds.length < 2) seeds = ALL_SEEDS.slice(0, 7);

  const cells = buildCells();
  assignRegions(cells, seeds);
  assignParcels(cells, seeds);

  const islandFillPaths = {};
  const internalParcelPaths = {};

  seeds.forEach(({ name }) => {
    islandFillPaths[name] = buildFillPath(cells, name);
    internalParcelPaths[name] = buildParcelPaths(cells, name);
  });

  const borderByRegion = buildBorderPaths(cells);
  const coastlinePath = buildCoastlinePath(cells);

  const landCells = cells.filter((cell) => cell.isLand);
  landCells.forEach((cell, index) => {
    cell._ai = index;
  });

  const regions = seeds
    .map(({ name }) => {
      const regionCells = cells.filter((cell) => cell.region === name);
      if (!regionCells.length) return null;

      const meanX = regionCells.reduce((sum, cell) => sum + cell.cx, 0) / regionCells.length;
      const meanY = regionCells.reduce((sum, cell) => sum + cell.cy, 0) / regionCells.length;

      const labelCell = regionCells.reduce((best, cell) => {
        const bestDistance = (best.cx - meanX) ** 2 + (best.cy - meanY) ** 2;
        const candidateDistance = (cell.cx - meanX) ** 2 + (cell.cy - meanY) ** 2;
        return candidateDistance < bestDistance ? cell : best;
      });

      const random = seeded(hashString(name));
      const labelSize = 17 + Math.min(12, Math.sqrt(regionCells.length) * 0.56);

      return {
        island: name,
        labelX: labelCell.cx + (random() - 0.5) * 18,
        labelY: labelCell.cy + (random() - 0.5) * 14,
        labelSize,
        labelRotation: (random() - 0.5) * 2.6,
        labelSpacing: 0.026 + random() * 0.032,
        glowRadius: Math.max(44, Math.sqrt(regionCells.length) * 14),
        centerX: meanX,
        centerY: meanY,
        atomIndices: regionCells.map((cell) => cell._ai),
        coastPaths: [(borderByRegion[name] || "").trimEnd()],
      };
    })
    .filter(Boolean);

  const atoms = landCells.map((cell, index) => {
    const random = seeded(hashString(`${cell.region || "?"}-${index}`));

    return {
      index,
      x: cell.cx,
      y: cell.cy,
      island: cell.region,
      area: CELL_W * CELL_H,
      polygon: [],
      path: "",
      organicPath: "",
      driftX: (random() - 0.5) * CELL_W * 0.46,
      driftY: (random() - 0.5) * CELL_H * 0.46,
      neighbors: [],
    };
  });

  return {
    cells,
    atoms,
    regions,
    islandFillPaths,
    internalParcelPaths,
    coastlinePath,
    landClipPath: coastlinePath,
  };
}
