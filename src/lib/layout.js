export const MAP_WIDTH = 1240;
export const MAP_HEIGHT = 820;

export const PLOT_BOUNDS = {
  top: 54,
  right: 38,
  bottom: 54,
  left: 38,
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function scaleX(score) {
  const innerWidth = MAP_WIDTH - PLOT_BOUNDS.left - PLOT_BOUNDS.right;
  return PLOT_BOUNDS.left + score * innerWidth;
}

export function scaleY(score) {
  const innerHeight = MAP_HEIGHT - PLOT_BOUNDS.top - PLOT_BOUNDS.bottom;
  return PLOT_BOUNDS.top + (1 - score) * innerHeight;
}

export function pointRadius(stars, repoCount = 96) {
  let radius = 4.4;
  if (stars > 200000) radius = 8;
  else if (stars > 100000) radius = 6.8;
  else if (stars > 50000) radius = 5.6;

  const densityScale =
    repoCount > 500 ? 0.66 : repoCount > 320 ? 0.74 : repoCount > 180 ? 0.84 : 1;

  return radius * densityScale;
}
