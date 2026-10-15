/** Reads the status board that «طبيب شاهين» (scripts/doctor) keeps in its GitHub issue. */
export interface DoctorReport { url: string; headline: string; lastRun?: string; rows: { check: string; status: string; detail: string }[]; timeline: string; fixes: { at: string; summary?: string; problem: string; result: string; url?: string }[] }

export function parseDoctorIssue(body: string, url: string): DoctorReport {
  const rows = body.split('\n').filter((l) => /^\| [^-|]/.test(l) && !l.startsWith('| الفحص')).map((l) => {
    const [check, status, detail] = l.split('|').slice(1, 4).map((c) => c.trim());
    return { check, status, detail };
  });
  let state: { lastRunAt?: string; fixes?: DoctorReport['fixes'] } = {};
  const encoded = body.match(/<!-- doctor-state:([A-Za-z0-9+/=_-]+) -->/)?.[1];
  if (encoded) {
    try { state = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)))); } catch { /* old or broken state */ }
  }
  return {
    url, rows, headline: body.match(/^## (.+)$/m)?.[1] || '',
    timeline: body.match(/\*\*آخر 6 ساعات:\*\* (.+)$/m)?.[1] || '',
    lastRun: state.lastRunAt, fixes: (state.fixes || []).slice(-8).reverse(),
  };
}
