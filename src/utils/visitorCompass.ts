export interface CompassOrientation {
  absolute: boolean;
  alpha: number | null;
  beta?: number | null;
  gamma?: number | null;
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

export const COMPASS_POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const;
const RAD = Math.PI / 180;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const normalizeBearing = (degrees: number) => ((degrees % 360) + 360) % 360;
export const compassPoint = (degrees: number) => COMPASS_POINTS[Math.round(normalizeBearing(degrees) / 45) % COMPASS_POINTS.length];

/** Absolute bearing of the top of the screen, clockwise from north. A relative
 * yaw is arbitrary (often zero wherever the page was opened), not a compass. */
export function readCompassBearing(sample: CompassOrientation, screenAngle = 0): number | undefined {
  // Project the screen's up-vector onto the ground, before the final yaw in
  // DeviceOrientation's Z-X'-Y'' rotation. Landscape uses a physical side edge.
  if (!finite(sample.beta) || Math.abs(sample.beta) > 180 || !finite(sample.gamma) || Math.abs(sample.gamma) > 90) return undefined;
  const offset = (finite(screenAngle) ? screenAngle : 0) * RAD;
  const b = sample.beta * RAD;
  const g = sample.gamma * RAD;
  const portraitNorth = Math.cos(b);
  const horizontalX = Math.cos(g) * Math.sin(offset);
  const horizontalY = portraitNorth * Math.cos(offset) + Math.sin(b) * Math.sin(g) * Math.sin(offset);
  if (Math.hypot(horizontalX, horizontalY) < 0.1) return undefined;
  const projected = Math.atan2(horizontalX, horizontalY) / RAD;

  const heading = sample.webkitCompassHeading;
  const accuracy = sample.webkitCompassAccuracy;
  if (finite(heading) && heading >= 0 && heading <= 360 && Math.abs(portraitNorth) >= 0.1
    && (accuracy === undefined || (finite(accuracy) && accuracy >= 0 && accuracy <= 25))) {
    // Safari's heading already references the natural portrait edge. Correct
    // only the angle between that edge and the current screen top, not yaw again.
    return normalizeBearing(heading + projected - (portraitNorth < 0 ? 180 : 0));
  }
  if (!sample.absolute || !finite(sample.alpha) || sample.alpha < 0 || sample.alpha > 360) return undefined;
  return normalizeBearing(projected - sample.alpha);
}

/** Keep a continuous angle so 359° → 0° sweeps one degree, not a full lap. */
export function nextCompassRotation(previous: number, bearing: number): number {
  return previous + normalizeBearing(bearing - previous + 180) - 180;
}

export function compassXY(degrees: number, radius: number, center: number): { x: number; y: number } {
  return { x: center + Math.sin(degrees * RAD) * radius, y: center - Math.cos(degrees * RAD) * radius };
}
