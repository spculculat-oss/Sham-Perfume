/**
 * «شارك تركيبك مجهولاً» — the sender behind the lab's share button (src/utils/labSignals.ts holds the shape).
 * One deliberate press sends the material ids + type + coarse band to `/api/lab/signal`; nothing is ever sent
 * while the visitor is designing, and a failure is silent (the design itself is never at risk).
 */
import { requestApi } from './api';
import { labSignalFromDesign, readLabSignalPayload, type DesignLike } from './labSignals';

export type LabShareResult = 'shared' | 'nothing' | 'offline' | 'failed';

export async function shareLabSignal(design: DesignLike): Promise<LabShareResult> {
  const payload = labSignalFromDesign(design);
  if (!payload) return 'nothing';
  try {
    await requestApi('/api/lab/signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(readLabSignalPayload(payload)),
    }, 12_000);
    return 'shared';
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return /no API server/i.test(message) ? 'offline' : 'failed';
  }
}
