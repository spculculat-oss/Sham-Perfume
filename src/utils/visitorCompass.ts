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
  const offset = finite(screenAngle) ? screenAngle : 0;
  const heading = sample.webkitCompassHeading;
  if (finite(heading) && heading >= 0 && heading <= 360 && !(finite(sample.webkitCompassAccuracy) && sample.webkitCompassAccuracy < 0)) {
    return normalizeBearing(heading + offset);
  }
  if (!sample.absolute || !finite(sample.alpha) || sample.alpha < 0 || sample.alpha > 360) return undefined;

  // Project the screen's up-vector onto the ground using the absolute
  // DeviceOrientation Z-X'-Y'' rotation. In flat portrait this is 360 − alpha;
  // a landscape screen instead uses the corresponding device side as its top.
  const a = sample.alpha * RAD;
  const b = (finite(sample.beta) ? sample.beta : 0) * RAD;
  const g = (finite(sample.gamma) ? sample.gamma : 0) * RAD;
  const x = Math.sin(offset * RAD);
  const y = Math.cos(offset * RAD);
  const horizontalX = Math.cos(g) * x;
  const horizontalY = Math.cos(b) * y + Math.sin(b) * Math.sin(g) * x;
  const east = Math.cos(a) * horizontalX - Math.sin(a) * horizontalY;
  const north = Math.sin(a) * horizontalX + Math.cos(a) * horizontalY;
  // Nearly vertical up-vector: a tiny sensor change would swing the pointer.
  if (Math.hypot(east, north) < 0.1) return undefined;
  return normalizeBearing(Math.atan2(east, north) / RAD);
}

/** Keep a continuous angle so 359° → 0° sweeps one degree, not a full lap. */
export function nextCompassRotation(previous: number, bearing: number): number {
  return previous + normalizeBearing(bearing - previous + 180) - 180;
}

export function compassXY(degrees: number, radius: number, center: number): { x: number; y: number } {
  return { x: center + Math.sin(degrees * RAD) * radius, y: center - Math.cos(degrees * RAD) * radius };
}
