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

export function pointRadius(stars) {
  if (stars > 200000) return 8;
  if (stars > 100000) return 6.8;
  if (stars > 50000) return 5.6;
  return 4.4;
}
