
/**
 * Simple container representing 2D Cartesian coordinates.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Snaps a target point relative to an anchor point to conform to standard 
 * Metro Line design constraints (0°, 45°, 90°, or 135° angle paths).
 * This makes the transit networks look professional, clean, and structurally precise.
 * 
 * @param point  The current dynamic coordinate of the node being dragged/evaluated.
 * @param anchor The coordinate of the adjacent station connected to it on the line.
 */
export function snapToMetro(point: Point, anchor: Point): Point {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Determine angle slope ratio to check if the path is closer to flat, vertical, or 45 degrees
  const ratio = absDx === 0 ? 999999 : absDy / absDx;

  if (ratio < 0.414) {
    // Slope < 22.5°: Snap directly to Horizontal axis
    return { x: point.x, y: anchor.y };
  } else if (ratio > 2.414) {
    // Slope > 67.5°: Snap directly to Vertical axis
    return { x: anchor.x, y: point.y };
  } else {
    // Slope is around 45°: Snap to perfect diagonal lines (isosceles right triangle)
    const dist = (absDx + absDy) / 2;
    return {
      x: anchor.x + Math.sign(dx) * dist,
      y: anchor.y + Math.sign(dy) * dist
    };
  }
}

/**
 * Rounds a coordinate to the nearest grid increment (Cartesian Snapping).
 * Improves layout consistency and pixel alignments for stations.
 * 
 * @param x    Absolute coordinate on the x-axis.
 * @param y    Absolute coordinate on the y-axis.
 * @param step Grid size interval (default is 20, editor uses 40).
 */
export function getGridPoint(x: number, y: number, step: number = 20): Point {
  return {
    x: Math.round(x / step) * step,
    y: Math.round(y / step) * step
  };
}

