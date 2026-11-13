/**
 * Running the visitor's code in his own browser, isolated: Python (the Pyodide build of CPython, loaded from the open
 * CDN the first time it is needed) and JavaScript each in a Web Worker that is ended when it takes too long. A web
 * page is previewed in a sandboxed frame by the view (see codeBlocks.previewDocument).
 */
export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export interface RunResult { output: string; error?: string; images: string[]; timedOut?: boolean; ms: number }
export interface RunOptions { timeoutMs?: number; onOutput?: (text: string) => void; onStage?: (stage: 'loading' | 'running') => void }

const PY_WORKER = `
importScripts(${JSON.stringify(`${PYODIDE_BASE}pyodide.js`)});
let ready;
const post = (m) => self.postMessage(m);
async function boot() { const py = await loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_BASE)} }); return py; }
const PLOTS = \`
import sys
if 'matplotlib' in sys.modules:
    import io, base64
    import matplotlib.pyplot as _plt
    _out = []
    for _n in _plt.get_fignums():
        _buf = io.BytesIO(); _plt.figure(_n).savefig(_buf, format='png', bbox_inches='tight', dpi=110); _out.append(base64.b64encode(_buf.getvalue()).decode())
    _plt.close('all')
    _out
else:
    []
\`;
self.onmessage = async (e) => {
  const { code } = e.data;
  try {
    post({ type: 'stage', stage: 'loading' });
    const py = await (ready ||= boot());
    py.setStdout({ batched: (s) => post({ type: 'out', text: s + '\\n' }) });
    py.setStderr({ batched: (s) => post({ type: 'out', text: s + '\\n' }) });
    await py.loadPackagesFromImports(code, { messageCallback: () => {}, errorCallback: () => {} });
    if (/matplotlib/.test(code)) { await py.runPythonAsync("import matplotlib\\nmatplotlib.use('Agg')"); }
    post({ type: 'stage', stage: 'running' });
    const value = await py.runPythonAsync(code);
    let shown = '';
    if (value !== undefined && value !== null) { try { shown = String(value.toString ? value.toString() : value); } catch (_) {} if (value && value.destroy) value.destroy(); }
    let images = [];
    try { const p = await py.runPythonAsync(PLOTS); images = p.toJs ? p.toJs() : []; if (p.destroy) p.destroy(); } catch (_) {}
    post({ type: 'done', value: shown, images: Array.from(images) });
  } catch (err) {
    post({ type: 'error', error: String(err && err.message || err) });
  }
};`;

const JS_WORKER = `
const post = (m) => self.postMessage(m);
const show = (v) => { if (typeof v === 'string') return v; try { return JSON.stringify(v, null, 2) ?? String(v); } catch (_) { return String(v); } };
for (const k of ['log', 'info', 'warn', 'error', 'debug', 'table']) console[k] = (...a) => post({ type: 'out', text: (k === 'error' || k === 'warn' ? '⚠ ' : '') + a.map(show).join(' ') + '\\n' });
self.onmessage = async (e) => {
  post({ type: 'stage', stage: 'running' });
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const value = await new AsyncFunction(e.data.code)();
    post({ type: 'done', value: value === undefined ? '' : show(value), images: [] });
  } catch (err) { post({ type: 'error', error: String(err && err.stack || err) }); }
};`;

let pythonWorker: Worker | undefined;
const workerFrom = (source: string) => {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return worker;
};

function runIn(worker: Worker, code: string, { timeoutMs = 60_000, onOutput, onStage }: RunOptions, keep: boolean, onKill: () => void): Promise<RunResult> {
  const started = Date.now();
  let output = '';
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: Omit<RunResult, 'ms' | 'output'>) => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (!keep || r.timedOut || r.error === 'worker') { worker.terminate(); onKill(); }
      resolve({ output: output.slice(-200_000), ms: Date.now() - started, ...r });
    };
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => finish({ timedOut: true, images: [] }), timeoutMs); };
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; text?: string; stage?: 'loading' | 'running'; value?: string; images?: string[]; error?: string };
      if (m.type === 'out' && m.text) { output += m.text; onOutput?.(m.text); }
      else if (m.type === 'stage' && m.stage) { onStage?.(m.stage); if (m.stage === 'running') arm(); }
      else if (m.type === 'done') { if (m.value) output += (output && !output.endsWith('\n') ? '\n' : '') + m.value; finish({ images: (m.images || []).map((b) => `data:image/png;base64,${b}`) }); }
      else if (m.type === 'error') finish({ error: m.error || 'Error', images: [] });
    };
    worker.onerror = (e) => { e.preventDefault?.(); finish({ error: e.message || 'worker', images: [] }); };
    // The first Python run downloads the runtime: allow it 3 minutes before the run's own clock starts.
    timer = setTimeout(() => finish({ timedOut: true, images: [] }), Math.max(timeoutMs, 180_000));
    worker.postMessage({ code });
  });
}

export function runPython(code: string, options: RunOptions = {}): Promise<RunResult> {
  pythonWorker ||= workerFrom(PY_WORKER);
  return runIn(pythonWorker, code, options, true, () => { pythonWorker = undefined; });
}
export function runJavaScript(code: string, options: RunOptions = {}): Promise<RunResult> {
  return runIn(workerFrom(JS_WORKER), code, { timeoutMs: 15_000, ...options }, false, () => undefined);
}
