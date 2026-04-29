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

// Three-tier influence scale for repo markers.
export function pointRadius(stars, repoCount = 96) {
  let radius;
  if      (stars >= 50000) radius = 5.5;
  else if (stars >= 5000)  radius = 3.8;
  else                     radius = 2.6;

  const densityScale =
    repoCount > 500 ? 0.68 : repoCount > 320 ? 0.76 : repoCount > 180 ? 0.86 : 1;

  return radius * densityScale;
}
