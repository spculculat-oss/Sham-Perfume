import { magneticField, MODEL_EPOCH, MODEL_VALID_UNTIL } from 'magvar';
import { normalizeBearing } from './visitorCompass';

export const KAABA = { latitude: 21.422487, longitude: 39.826206 } as const;
const RAD = Math.PI / 180;
const EARTH_RADIUS_METERS = 6_371_000;
const MAX_POSITION_ERROR = Math.sin(10 * RAD);
// NOAA's WMM caution/blackout regions have weak horizontal fields. Keep a geographic
// diagram there rather than correcting (and trusting) a shaky magnetic heading.
const MIN_HORIZONTAL_FIELD_NT = 6000;

export interface QiblaDirection {
  /** Initial great-circle bearing, clockwise from geographic north. */
  bearing: number;
  /** East-positive magnetic variation. Missing outside the model's valid date or area. */
  declination?: number;
}

/** No map or geocoding service: this needs only the position chosen for the compass. */
export function qiblaAt(latitude: number, longitude: number, accuracyMeters = 0, date = new Date()): QiblaDirection | undefined {
  if (!Number.isFinite(latitude) || Math.abs(latitude) >= 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || !Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 25_000) return undefined;
  const here = latitude * RAD;
  const target = KAABA.latitude * RAD;
  const delta = (KAABA.longitude - longitude) * RAD;
  const east = Math.cos(target) * Math.sin(delta);
  const north = Math.cos(here) * Math.sin(target) - Math.sin(here) * Math.cos(target) * Math.cos(delta);
  const dot = Math.sin(here) * Math.sin(target) + Math.cos(here) * Math.cos(target) * Math.cos(delta);
  const distance = Math.atan2(Math.hypot(east, north), dot);
  // The bearing is undefined at the destination and antipode. Near either, even a
  // good-looking GPS fix can swing the arrow a lot; bound its angular uncertainty.
  if (Math.min(distance, Math.PI - distance) * EARTH_RADIUS_METERS <= 10
    || Math.sin(accuracyMeters / EARTH_RADIUS_METERS) > Math.sin(distance) * MAX_POSITION_ERROR) return undefined;
  const bearing = normalizeBearing(Math.atan2(east, north) / RAD);
  const year = date.getUTCFullYear();
  if (Number.isFinite(year) && year >= MODEL_EPOCH && year < MODEL_VALID_UNTIL) {
    const { declination, h } = magneticField(latitude, longitude, 0, date);
    if (Number.isFinite(declination) && h >= MIN_HORIZONTAL_FIELD_NT) return { bearing, declination };
  }
  return { bearing };
}

/** A north-up map if no defensible live north is available. Keep angles continuous for CSS. */
export function qiblaDial(direction: QiblaDirection, magneticRotation?: number) {
  if (magneticRotation === undefined || !Number.isFinite(magneticRotation) || direction.declination === undefined) {
    return { live: false, northRotation: 0, pointerRotation: direction.bearing, aligned: false };
  }
  const heading = magneticRotation + direction.declination;
  const pointerRotation = direction.bearing - heading;
  const turn = normalizeBearing(pointerRotation + 180) - 180;
  return { live: true, northRotation: -heading, pointerRotation, aligned: Math.abs(turn) <= 5 };
}
