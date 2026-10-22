/** Minimal GitHub REST client for «طبيب شاهين» (uses the workflow's GITHUB_TOKEN). */
export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'GitHubError'; }
}

export interface CommitStatus { context: string; state: 'success' | 'failure' | 'error' | 'pending'; description: string | null; created_at: string; updated_at: string; target_url?: string | null }
export interface WorkflowRun { id: number; head_sha: string; status: string; conclusion: string | null; html_url: string; created_at: string; updated_at: string; event: string }
export interface Issue { number: number; body: string | null; html_url: string; title: string }

export class GitHub {
  constructor(readonly repo: string, private token?: string, private request: typeof fetch = fetch, private base = 'https://api.github.com') {}

  get canWrite() { return Boolean(this.token); }

  async api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(`${this.base}${path.startsWith('/repos/') || path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sham-doctor',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers as Record<string, string> || {}),
      },
      signal: init.signal || AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!response.ok) throw new GitHubError(response.status, `${init.method || 'GET'} ${path} → ${response.status} ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  private r = (path: string) => `/repos/${this.repo}${path}`;

  async head(branch = 'main') {
    const commit = await this.api<{ sha: string; commit: { committer: { date: string }; message: string } }>(this.r(`/commits/${branch}`));
    return { sha: commit.sha, date: commit.commit.committer.date, message: commit.commit.message };
  }

  async repoId() { return (await this.api<{ id: number }>(this.r(''))).id; }

  /** Newest status per context for a commit. */
  async statuses(sha: string): Promise<CommitStatus[]> {
    const all = await this.api<CommitStatus[]>(this.r(`/commits/${sha}/statuses?per_page=100`));
    const newest = new Map<string, CommitStatus>();
    for (const s of all) if (!newest.has(s.context)) newest.set(s.context, s); // API returns newest first
    return [...newest.values()];
  }

  async runs(workflow: string, branch = 'main', perPage = 5): Promise<WorkflowRun[]> {
    return (await this.api<{ workflow_runs: WorkflowRun[] }>(this.r(`/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(branch)}&per_page=${perPage}`))).workflow_runs;
  }

  async failedJobs(runId: number) {
    const { jobs } = await this.api<{ jobs: { id: number; name: string; conclusion: string | null; steps?: { name: string; conclusion: string | null }[] }[] }>(this.r(`/actions/runs/${runId}/jobs`));
    return jobs.filter((j) => j.conclusion === 'failure').map((j) => ({ id: j.id, name: j.name, steps: (j.steps || []).filter((s) => s.conclusion === 'failure').map((s) => s.name) }));
  }

  /** Raw log of a job (redirect followed by fetch). Truncated to the tail, where errors are. */
  async jobLog(jobId: number, maxChars = 15_000): Promise<string> {
    try {
      const response = await this.request(`${this.base}${this.r(`/actions/jobs/${jobId}/logs`)}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sham-doctor', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        signal: AbortSignal.timeout(20_000),
      });
      const text = await response.text();
      return text.replace(/^\S+Z /gm, '').slice(-maxChars);
    } catch { return ''; }
  }

  async annotations(jobId: number) {
    try {
      return await this.api<{ path: string; start_line: number; annotation_level: string; message: string; title?: string }[]>(this.r(`/check-runs/${jobId}/annotations?per_page=50`));
    } catch { return []; }
  }

  async dispatch(workflow: string, ref = 'main', inputs?: Record<string, string>) {
    await this.api(this.r(`/actions/workflows/${workflow}/dispatches`), { method: 'POST', body: JSON.stringify({ ref, ...(inputs ? { inputs } : {}) }) });
  }

  async findIssue(label: string): Promise<Issue | undefined> {
    const issues = await this.api<(Issue & { pull_request?: unknown })[]>(this.r(`/issues?labels=${encodeURIComponent(label)}&state=open&per_page=5`));
    return issues.find((i) => !i.pull_request);
  }

  async ensureLabel(name: string, color: string, description: string) {
    try { await this.api(this.r(`/labels/${encodeURIComponent(name)}`)); }
    catch (error) {
      if (!(error instanceof GitHubError) || error.status !== 404) throw error;
      await this.api(this.r('/labels'), { method: 'POST', body: JSON.stringify({ name, color, description }) });
    }
  }

  createIssue(title: string, body: string, labels: string[]) {
    return this.api<Issue>(this.r('/issues'), { method: 'POST', body: JSON.stringify({ title, body, labels }) });
  }

  updateIssue(number: number, body: string) {
    return this.api<Issue>(this.r(`/issues/${number}`), { method: 'PATCH', body: JSON.stringify({ body }) });
  }

  comment(number: number, body: string) {
    return this.api(this.r(`/issues/${number}/comments`), { method: 'POST', body: JSON.stringify({ body }) });
  }

  createPull(head: string, title: string, body: string, base = 'main') {
    return this.api<{ number: number; html_url: string }>(this.r('/pulls'), { method: 'POST', body: JSON.stringify({ head, base, title, body }) });
  }

  addLabels(number: number, labels: string[]) {
    return this.api(this.r(`/issues/${number}/labels`), { method: 'POST', body: JSON.stringify({ labels }) });
  }

  mergePull(number: number, title: string, message?: string) {
    return this.api<{ sha: string; merged: boolean }>(this.r(`/pulls/${number}/merge`), { method: 'PUT', body: JSON.stringify({ merge_method: 'squash', commit_title: title, ...(message ? { commit_message: message } : {}) }) });
  }

  deleteBranch(branch: string) {
    return this.api(this.r(`/git/refs/heads/${branch}`), { method: 'DELETE' }).catch(() => undefined);
  }
}
