import type {
  AgentArtifact,
  AgentArtifactLanguage,
  CodeVerificationDiagnostic,
  CodeVerificationReport,
} from '../types/shaheenAgent';

const SELF_CLOSING_HTML = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr', 'path', 'circle', 'rect',
  'line', 'polygon', 'polyline', 'ellipse', 'stop', 'use',
]);

export function normalizeArtifactLanguage(raw: unknown): AgentArtifactLanguage {
  const s = String(raw || 'html').trim().toLowerCase();
  if (s === 'html' || s === 'htm') return 'html';
  if (s === 'react' || s === 'jsx' || s === 'tsx') return 'react';
  if (s === 'typescript' || s === 'ts') return 'typescript';
  if (s === 'javascript' || s === 'js') return 'javascript';
  if (s === 'python' || s === 'py') return 'python';
  if (s === 'sql' || s === 'postgres' || s === 'postgresql') return 'sql';
  if (s === 'css' || s === 'scss') return 'css';
  if (s === 'json') return 'json';
  if (s === 'mermaid' || s === 'mmd') return 'mermaid';
  if (s === 'svg') return 'svg';
  return 'typescript';
}

export function defaultFilenameFor(lang: AgentArtifactLanguage, title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 32) || 'shaheen-artifact';
  const ext: Record<AgentArtifactLanguage, string> = {
    html: 'html',
    react: 'tsx',
    typescript: 'ts',
    javascript: 'js',
    python: 'py',
    sql: 'sql',
    css: 'css',
    json: 'json',
    mermaid: 'mmd',
    svg: 'svg',
  };
  return `${slug}.${ext[lang]}`;
}

function checkBalancedDelimiters(code: string): CodeVerificationDiagnostic[] {
  const diagnostics: CodeVerificationDiagnostic[] = [];
  const stack: { ch: string; line: number }[] = [];
  const match: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let line = 1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];
    const prev = code[i - 1];

    if (ch === '\n') {
      line++;
      inLineComment = false;
      continue;
    }
    if (inLineComment) continue;
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === '/' && next === '/') {
        inLineComment = true;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (ch === "'" && !inDouble && !inTemplate && prev !== '\\') {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle && !inTemplate && prev !== '\\') {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '`' && !inSingle && !inDouble && prev !== '\\') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push({ ch, line });
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const top = stack.pop();
      if (!top || top.ch !== match[ch]) {
        diagnostics.push({
          level: 'error',
          line,
          message: `Unmatched closing delimiter '${ch}' at line ${line}.`,
        });
        break;
      }
    }
  }

  if (inSingle || inDouble || inTemplate) {
    diagnostics.push({
      level: 'error',
      line,
      message: 'Unclosed string or template literal before end of file.',
    });
  }
  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    diagnostics.push({
      level: 'error',
      line: unclosed.line,
      message: `Unclosed '${unclosed.ch}' opened at line ${unclosed.line}.`,
    });
  }
  return diagnostics;
}

function tryParseJavascriptSyntax(code: string): CodeVerificationDiagnostic | null {
  try {
    // Strip ESM import/export wrappers so Function constructor validates pure statement syntax cleanly.
    const normalized = code
      .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '')
      .replace(/^\s*import\s+['"][^'"]+['"];?/gm, '')
      .replace(/^\s*export\s+(default\s+)?/gm, '');
    // Safe parse-only check: Function body is NEVER invoked.
    // eslint-disable-next-line no-new-func
    new Function(normalized);
    return null;
  } catch (err: any) {
    return {
      level: 'error',
      message: `JavaScript syntax error: ${String(err?.message || 'Invalid syntax')}`,
    };
  }
}

function checkHtmlStructure(code: string): CodeVerificationDiagnostic[] {
  const diagnostics: CodeVerificationDiagnostic[] = [];
  const tagStack: string[] = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^<>]*?)?\/?>/g;
  const cleaned = code
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>');

  for (const m of cleaned.matchAll(tagRegex)) {
    const raw = m[0];
    const tag = m[1].toLowerCase();
    if (raw.endsWith('/>') || SELF_CLOSING_HTML.has(tag)) continue;
    if (raw.startsWith('</')) {
      const idx = tagStack.lastIndexOf(tag);
      if (idx === -1) {
        diagnostics.push({ level: 'warning', message: `Unexpected closing tag </${tag}>.` });
      } else {
        tagStack.splice(idx);
      }
    } else {
      tagStack.push(tag);
    }
  }
  if (tagStack.length > 0 && tagStack.length <= 5) {
    diagnostics.push({
      level: 'warning',
      message: `Unclosed HTML tag(s): ${tagStack.map((t) => `<${t}>`).join(', ')}.`,
    });
  }

  for (const scriptMatch of code.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const scriptBody = scriptMatch[1].trim();
    if (!scriptBody) continue;
    const err = tryParseJavascriptSyntax(scriptBody);
    if (err) diagnostics.push({ ...err, message: `Inline <script> ${err.message}` });
  }

  if (/\bdocument\.write\s*\(/i.test(code)) {
    diagnostics.push({ level: 'warning', message: 'Avoid document.write(); use DOM APIs instead.' });
  }
  if (/\beval\s*\(/.test(code)) {
    diagnostics.push({ level: 'warning', message: 'Avoid eval() for sandbox security.' });
  }
  if (!/<meta[^>]+viewport/i.test(code) && /<html/i.test(code)) {
    diagnostics.push({ level: 'info', message: 'Tip: include <meta name="viewport"> for responsive layouts.' });
  }

  return diagnostics;
}

export function verifyCodeSnippet(language: string, code: string): CodeVerificationReport {
  const normLang = normalizeArtifactLanguage(language);
  const trimmed = String(code || '').trim();
  const lines = trimmed ? trimmed.split('\n').length : 0;
  const characters = trimmed.length;
  const functionsEstimate = (
    trimmed.match(/\b(function|def|class|=>|CREATE\s+TABLE|CREATE\s+INDEX|interface|type)\b/g) || []
  ).length;

  const diagnostics: CodeVerificationDiagnostic[] = [];

  if (!trimmed) {
    diagnostics.push({ level: 'error', message: 'Artifact code is empty.' });
    return { valid: false, score: 0, diagnostics, metrics: { lines: 0, characters: 0, functionsEstimate: 0 } };
  }

  if (normLang === 'json') {
    try {
      JSON.parse(trimmed);
      diagnostics.push({ level: 'info', message: 'Valid JSON document parsed cleanly.' });
    } catch (err: any) {
      diagnostics.push({ level: 'error', message: `Invalid JSON: ${String(err?.message || 'parse error')}` });
    }
  } else if (normLang === 'html') {
    diagnostics.push(...checkHtmlStructure(trimmed));
  } else if (normLang === 'svg') {
    if (!/<svg\b[^>]*>/i.test(trimmed) || !/<\/svg>/i.test(trimmed)) {
      diagnostics.push({ level: 'error', message: 'SVG artifact must include a root <svg>...</svg> element.' });
    }
    diagnostics.push(...checkHtmlStructure(trimmed));
  } else if (normLang === 'javascript') {
    diagnostics.push(...checkBalancedDelimiters(trimmed));
    if (diagnostics.every((d) => d.level !== 'error')) {
      const jsErr = tryParseJavascriptSyntax(trimmed);
      if (jsErr) diagnostics.push(jsErr);
    }
  } else if (normLang === 'typescript' || normLang === 'react' || normLang === 'css') {
    diagnostics.push(...checkBalancedDelimiters(trimmed));
    if (/\beval\s*\(/.test(trimmed)) {
      diagnostics.push({ level: 'warning', message: 'Avoid eval() in production code.' });
    }
    if (/while\s*\(\s*true\s*\)/.test(trimmed) && !/\bbreak\b|\breturn\b/.test(trimmed)) {
      diagnostics.push({ level: 'warning', message: 'Detected while(true) without obvious break/return guard.' });
    }
  } else if (normLang === 'sql') {
    diagnostics.push(...checkBalancedDelimiters(trimmed));
    if (/\b(?:DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i.test(trimmed)) {
      diagnostics.push({ level: 'warning', message: 'Destructive DDL statement detected (DROP/TRUNCATE).' });
    }
    if (/\bDELETE\s+FROM\b/i.test(trimmed) && !/\bWHERE\b/i.test(trimmed)) {
      diagnostics.push({ level: 'warning', message: 'DELETE FROM without WHERE clause affects all rows.' });
    }
  } else if (normLang === 'python') {
    diagnostics.push(...checkBalancedDelimiters(trimmed));
    const tabIndents = /^\t+/m.test(trimmed);
    const spaceIndents = /^ {2,}/m.test(trimmed);
    if (tabIndents && spaceIndents) {
      diagnostics.push({ level: 'warning', message: 'Mixed tabs and spaces in Python indentation.' });
    }
  } else if (normLang === 'mermaid') {
    if (!/^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie)\b/m.test(trimmed)) {
      diagnostics.push({ level: 'warning', message: 'Mermaid diagram should begin with a diagram header (e.g., flowchart TD).' });
    }
  }

  const errors = diagnostics.filter((d) => d.level === 'error').length;
  const warnings = diagnostics.filter((d) => d.level === 'warning').length;
  const valid = errors === 0;
  const score = Math.max(0, Math.min(100, 100 - errors * 35 - warnings * 8));

  if (valid && diagnostics.length === 0) {
    diagnostics.push({ level: 'info', message: 'Static syntax & safety verification passed cleanly.' });
  }

  return {
    valid,
    score,
    diagnostics,
    metrics: { lines, characters, functionsEstimate },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMermaidOfflineHtml(mermaidCode: string, title: string): string {
  const lines = mermaidCode.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
  const nodes = new Map<string, string>();
  const edges: { from: string; to: string; label?: string }[] = [];

  const registerNode = (raw: string) => {
    const clean = raw.trim();
    const m = clean.match(/^([A-Za-z0-9_-]+)\s*(?:\[(.*?)\]|\((.*?)\)|\{(.*?)\}|"(.*?)")?/);
    if (!m) return clean;
    const id = m[1];
    const lbl = (m[2] || m[3] || m[4] || m[5] || id).replace(/^["']|["']$/g, '');
    if (!nodes.has(id) || lbl !== id) nodes.set(id, lbl);
    return id;
  };

  for (const line of lines.slice(1)) {
    const arrow = line.match(/^(.+?)\s*(?:--+>?|==+>?|\.-+>?|->>|-->>)\s*(?:\|([^|]+)\|\s*)?(.+?)(?:;)?$/);
    if (arrow) {
      const from = registerNode(arrow[1]);
      const to = registerNode(arrow[3]);
      const label = arrow[2]?.trim();
      edges.push({ from, to, label });
    } else if (/^([A-Za-z0-9_-]+)\s*[\[({]/.test(line)) {
      registerNode(line);
    }
  }

  const nodeList = [...nodes.entries()];
  if (nodeList.length === 0) {
    return `<!DOCTYPE html><html dir="auto"><body style="margin:0;padding:24px;font-family:system-ui;background:#faf8f5;color:#1c1917"><h3 style="margin:0 0 12px">${escapeHtml(title)}</h3><pre style="background:#fff;border:1px solid #e7e5e4;padding:16px;border-radius:12px;overflow:auto">${escapeHtml(mermaidCode)}</pre></body></html>`;
  }

  const isHorizontal = /\b(LR|RL)\b/i.test(lines[0] || '');
  const cols = isHorizontal ? Math.min(4, Math.max(2, nodeList.length)) : Math.min(2, nodeList.length);
  const boxW = 190;
  const boxH = 54;
  const gapX = 58;
  const gapY = 48;
  const pad = 28;

  const pos = new Map<string, { x: number; y: number }>();
  nodeList.forEach(([id], idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    pos.set(id, {
      x: pad + col * (boxW + gapX),
      y: pad + row * (boxH + gapY),
    });
  });

  const maxRows = Math.ceil(nodeList.length / cols);
  const svgW = pad * 2 + cols * boxW + Math.max(0, cols - 1) * gapX;
  const svgH = pad * 2 + maxRows * boxH + Math.max(0, maxRows - 1) * gapY;

  const edgeSvg = edges
    .map((e) => {
      const p1 = pos.get(e.from);
      const p2 = pos.get(e.to);
      if (!p1 || !p2) return '';
      const x1 = p1.x + boxW / 2;
      const y1 = p1.y + boxH / 2;
      const x2 = p2.x + boxW / 2;
      const y2 = p2.y + boxH / 2;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      return `<g>
        <path d="M ${x1} ${y1} Q ${mx} ${y1}, ${x2} ${y2}" fill="none" stroke="#b45309" stroke-width="2" marker-end="url(#arrow)" />
        ${e.label ? `<rect x="${mx - 42}" y="${my - 11}" width="84" height="20" rx="6" fill="#fffbeb" stroke="#fcd34d"/><text x="${mx}" y="${my + 3}" text-anchor="middle" font-size="10" fill="#78350f" font-family="system-ui">${escapeHtml(e.label.slice(0, 18))}</text>` : ''}
      </g>`;
    })
    .join('');

  const nodeSvg = nodeList
    .map(([id, label]) => {
      const p = pos.get(id)!;
      return `<g>
        <rect x="${p.x}" y="${p.y}" width="${boxW}" height="${boxH}" rx="10" fill="#ffffff" stroke="#d6d3d1" stroke-width="1.5"/>
        <text x="${p.x + boxW / 2}" y="${p.y + boxH / 2 + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="#1c1917" font-family="system-ui">${escapeHtml(label.slice(0, 26))}</text>
      </g>`;
    })
    .join('');

  return `<!DOCTYPE html><html dir="auto"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:18px;background:#faf8f5;font-family:system-ui,-apple-system,sans-serif;color:#1c1917">
  <div style="margin-bottom:10px;font-size:13px;font-weight:700;color:#78350f">${escapeHtml(title)}</div>
  <div style="overflow:auto;border:1px solid #e7e5e4;border-radius:12px;background:#fff;padding:8px">
    <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
      <defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#b45309"/></marker></defs>
      ${edgeSvg}
      ${nodeSvg}
    </svg>
  </div></body></html>`;
}

export function buildArtifactPreviewHtml(artifact: AgentArtifact, liveCode?: string): string | null {
  const code = liveCode ?? artifact.code;
  if (artifact.previewHtml && liveCode === undefined) {
    return artifact.previewHtml;
  }
  if (artifact.language === 'html') {
    return code;
  }
  if (artifact.language === 'svg') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf8f5;padding:24px">${code}</body></html>`;
  }
  if (artifact.language === 'mermaid') {
    return renderMermaidOfflineHtml(code, artifact.title);
  }
  if (artifact.language === 'javascript') {
    return `<!DOCTYPE html><html dir="auto"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#0c0a09;color:#f5f5f4;margin:0;padding:16px;font-size:13px;line-height:1.55}.line{padding:4px 8px;border-bottom:1px solid #292524}.err{color:#fca5a5;background:#450a0a}</style></head><body>
    <div id="out"></div>
    <script>
      const out = document.getElementById('out');
      const print = (cls, args) => {
        const div = document.createElement('div');
        div.className = 'line ' + cls;
        div.textContent = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        out.appendChild(div);
      };
      console.log = (...a) => print('', a);
      console.warn = (...a) => print('', a);
      console.error = (...a) => print('err', a);
      try {
        ${code.replace(/<\/script>/gi, '<\\/script>')}
      } catch (e) {
        print('err', ['Runtime Error:', e && e.message ? e.message : e]);
      }
      if (!out.children.length) print('', ['✓ Executed with zero errors (no console output).']);
    </script></body></html>`;
  }
  if (artifact.previewHtml) {
    return artifact.previewHtml;
  }
  return null;
}
