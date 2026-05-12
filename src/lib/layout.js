export const MAP_WIDTH = 1240;
export const MAP_HEIGHT = 820;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
