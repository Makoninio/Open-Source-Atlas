import {
  forceCollide,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import { clamp, MAP_HEIGHT, MAP_WIDTH, pointRadius, scaleX, scaleY } from "./layout";
import { getContinent } from "./taxonomy";

function buildIslandTargets(nodes) {
  const grouped = {};

  nodes.forEach((node) => {
    const continent = getContinent(node);
    if (!grouped[continent]) grouped[continent] = [];
    grouped[continent].push(node);
  });

  return Object.fromEntries(
    Object.entries(grouped).map(([island, islandNodes]) => {
      const x = islandNodes.reduce((sum, node) => sum + node.targetX, 0) / islandNodes.length;
      const y = islandNodes.reduce((sum, node) => sum + node.targetY, 0) / islandNodes.length;
      return [island, { x, y }];
    }),
  );
}

function islandForce(islandTargets, strength = 0.06) {
  let nodes = [];

  function force(alpha) {
    nodes.forEach((node) => {
      const islandTarget = islandTargets[getContinent(node)];
      if (!islandTarget) return;

      node.vx += (islandTarget.x - node.x) * strength * alpha;
      node.vy += (islandTarget.y - node.y) * strength * alpha;
    });
  }

  force.initialize = (nextNodes) => {
    nodes = nextNodes;
  };

  return force;
}

export function runForceLayout(repos) {
  const repoCount = repos.length;
  const nodes = repos.map((repo) => ({
    ...repo,
    radius: pointRadius(repo.metrics.stars, repoCount),
    targetX: scaleX(repo.classification.time_to_value_score),
    targetY: scaleY(repo.classification.ecosystem_score),
  }));

  const islandTargets = buildIslandTargets(nodes);

  nodes.forEach((node) => {
    node.x = node.targetX;
    node.y = node.targetY;
  });

  const simulation = forceSimulation(nodes)
    .force("x", forceX((node) => node.targetX).strength(0.3))
    .force("y", forceY((node) => node.targetY).strength(0.3))
    .force("cluster", islandForce(islandTargets, 0.08))
    .force("collide", forceCollide((node) => node.radius + (repoCount > 220 ? 1.6 : 3)).iterations(repoCount > 220 ? 2 : 3))
    .stop();

  for (let i = 0; i < (repoCount > 220 ? 280 : 220); i += 1) simulation.tick();

  return nodes.map((node) => ({
    ...node,
    x: clamp(node.x, node.radius + 8, MAP_WIDTH - node.radius - 8),
    y: clamp(node.y, node.radius + 8, MAP_HEIGHT - node.radius - 8),
  }));
}
