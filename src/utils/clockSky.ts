/**
 * The clock bar's living atmosphere: the glass shifts its light with the visitor's
 * local hour, from first light to deep night, and can be played with by hand.
 * Pure helpers live here so the phase rules stay testable without a browser.
 */

export type SkyPhase = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';

export const SKY_PHASES: readonly SkyPhase[] = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'];

/** Each theme keeps the bronze card intact and only moves the light across it. */
export const SKY_THEMES: Record<SkyPhase, {
  /** Light pooled near the top of the glass. */
  glow: string;
  /** Warm secondary wash that drifts with the compass and the pointer. */
  wash: string;
  /** Colour of the little sheen that travels along the glass edge. */
  sheen: string;
  /** Deepest tone of the card gradient. */
  base: string;
}> = {
  dawn: { glow: 'rgba(255, 176, 130, 0.5)', wash: 'rgba(255, 208, 168, 0.22)', sheen: 'rgba(255, 222, 186, 0.85)', base: '#4a332a' },
  morning: { glow: 'rgba(255, 214, 150, 0.44)', wash: 'rgba(255, 233, 190, 0.18)', sheen: 'rgba(255, 235, 199, 0.8)', base: '#5a402e' },
  noon: { glow: 'rgba(255, 240, 205, 0.5)', wash: 'rgba(255, 233, 178, 0.2)', sheen: 'rgba(255, 248, 226, 0.9)', base: '#6b4d34' },
  afternoon: { glow: 'rgba(255, 198, 132, 0.46)', wash: 'rgba(255, 176, 112, 0.2)', sheen: 'rgba(255, 213, 164, 0.84)', base: '#63412a' },
  dusk: { glow: 'rgba(255, 142, 118, 0.44)', wash: 'rgba(214, 126, 148, 0.2)', sheen: 'rgba(255, 178, 150, 0.8)', base: '#432a24' },
  night: { glow: 'rgba(150, 178, 255, 0.3)', wash: 'rgba(120, 148, 214, 0.16)', sheen: 'rgba(196, 214, 255, 0.7)', base: '#251d1c' },
};

/** Hours are inclusive of their start: 5 is dawn, 7 is morning, 20 is night. */
export function skyPhaseAtHour(hour: number): SkyPhase {
  if (!Number.isFinite(hour)) return 'night';
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'noon';
  if (h >= 15 && h < 18) return 'afternoon';
  if (h >= 18 && h < 20) return 'dusk';
  return 'night';
}

/** The visitor's hour in their own zone; UTC is the explicit fallback. */
export function hourInZone(now: Date, timeZone: string): number | undefined {
  if (Number.isNaN(now.getTime())) return undefined;
  try {
    const part = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone })
      .formatToParts(now)
      .find((piece) => piece.type === 'hour');
    const hour = Number(part?.value);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : undefined;
  } catch {
    return undefined;
  }
}

export function skyPhaseFor(now: Date | undefined, timeZone: string): SkyPhase {
  if (!now) return 'night';
  const hour = hourInZone(now, timeZone) ?? now.getUTCHours();
  return skyPhaseAtHour(hour);
}

/** Manual play steps forward through the day and wraps around. */
export function nextSkyPhase(phase: SkyPhase): SkyPhase {
  const index = SKY_PHASES.indexOf(phase);
  return SKY_PHASES[(index + 1) % SKY_PHASES.length];
}

/**
 * A drag across the glass turns the light by up to 22°; the value is clamped so
 * the shine never spins past the edge of the card.
 */
export function skyTilt(deltaX: number, cardWidth: number): number {
  if (!Number.isFinite(deltaX) || !Number.isFinite(cardWidth) || cardWidth <= 0) return 0;
  const degrees = (deltaX / cardWidth) * 180;
  return Math.max(-22, Math.min(22, Math.round(degrees * 10) / 10));
}

/** How far the shine is thrown sideways, as a percentage of the card width. */
export function skyGlowX(clientX: number, left: number, width: number): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(left) || !Number.isFinite(width) || width <= 0) return 50;
  const ratio = ((clientX - left) / width) * 100;
  return Math.max(4, Math.min(96, Math.round(ratio)));
}
