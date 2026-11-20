declare module 'magvar' {
  export const MODEL_EPOCH: number;
  export const MODEL_VALID_UNTIL: number;
  export function magneticField(latitude: number, longitude: number, altitudeKm: number, when: Date): {
    declination: number;
    h: number;
  };
}
