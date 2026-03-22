/**
 * Git Operations Integration
 *
 * Supports:
 * - Local repositories (git CLI or isomorphic-git)
 * - Forgejo (self-hosted Git forge)
 * - GitHub (cloud-based)
 */

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type GitProvider = 'local' | 'forgejo' | 'github';

export interface GitDiff {
  filesChanged: number;
  insertions: number;
  deletions: number;
  diff: string;
}

export interface GitCommit {
  hash: string;
  author: string;
  message: string;
  date: string;
}

export interface GitStatus {
  currentBranch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  isDirty: boolean;
}

export interface GitPullRequest {
  id: string;
  number?: number;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'open' | 'closed' | 'merged' | 'draft';
  url?: string;
}

const LOCAL_GIT_LOG_FIELD_SEPARATOR = '\u0000';
const LOCAL_GIT_LOG_RECORD_SEPARATOR = '\u001e';

function parseLocalGitLogOutput(output: string): GitCommit[] {
  const commits: GitCommit[] = [];
  const records = output
    .split(LOCAL_GIT_LOG_RECORD_SEPARATOR)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const record of records) {
    const fields = record.split(LOCAL_GIT_LOG_FIELD_SEPARATOR);
    if (fields.length < 4) continue;
    const [hash, author, message, date] = fields;
    if (!hash || !author || !date) continue;
    commits.push({ hash, author, message: message || '', date });
  }

  return commits;
}

/**
 * Local Git Repository Handler
 * Uses git CLI for operations on local repositories
 */
export class LocalGitRepo {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  private runGit(...args: string[]): string {
    const result = spawnSync('git', args, {
      cwd: this.repoPath,
      encoding: 'utf8',
    });

    if (result.error) {
      throw new Error(`Git command failed: ${result.error.message}`);
    }

    if (result.status !== 0) {
      throw new Error(`Git error (${result.status}): ${result.stderr || result.stdout}`);
    }

    return result.stdout.trim();
  }

  async getStatus(): Promise<GitStatus> {
    const branchOutput = this.runGit('branch', '--show-current');
    const statusOutput = this.runGit('status', '--porcelain');

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    statusOutput.split('\n').forEach((line) => {
      if (!line) return;
      const status = line.slice(0, 2);
      const file = line.slice(3);

      if (status[0] !== ' ') staged.push(file);
      if (status !== '??' && status[1] !== ' ') unstaged.push(file);
      if (status === '??') untracked.push(file);
    });

    return {
      currentBranch: branchOutput,
      staged,
      unstaged,
      untracked,
      isDirty: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
    };
  }

  async getDiff(baseRef: string = 'HEAD', headRef: string = 'HEAD~1', filePattern?: string): Promise<GitDiff> {
    const args = ['diff', baseRef, headRef];
    if (filePattern) {
      args.push('--', filePattern);
    }

    const diff = this.runGit(...args);

    // Parse diff stats
    const statArgs = ['diff', '--numstat', baseRef, headRef];
    if (filePattern) {
      statArgs.push('--', filePattern);
    }
    const statsOutput = this.runGit(...statArgs);
    let insertions = 0;
    let deletions = 0;
    let filesChanged = 0;

    statsOutput.split('\n').forEach((line) => {
      if (!line) return;
      const [adds, deletes] = line.split('\t');
      if (adds !== '-') insertions += parseInt(adds, 10);
      if (deletes !== '-') deletions += parseInt(deletes, 10);
      filesChanged += 1;
    });

    return {
      filesChanged,
      insertions,
      deletions,
      diff: diff.slice(0, 10000), // Limit diff output
    };
  }

  async getLog(branch: string = 'HEAD', maxCommits: number = 20, author?: string, since?: string, until?: string): Promise<GitCommit[]> {
    const args = [
      'log',
      `--max-count=${maxCommits}`,
      '--pretty=format:%H%x00%an%x00%s%x00%aI%x1e',
    ];
    if (author) {
      args.push(`--author=${author}`);
    }
    if (since) {
      args.push(`--since=${since}`);
    }
    if (until) {
      args.push(`--until=${until}`);
    }
    args.push(branch);

    const output = this.runGit(...args);
    return parseLocalGitLogOutput(output);
  }

  async createBranch(branchName: string, fromRef: string = 'HEAD'): Promise<void> {
    this.runGit('checkout', '-b', branchName, fromRef);
  }

  async createCommit(message: string, authorName?: string, authorEmail?: string): Promise<string> {
    const args = ['commit', '-m', message];
    if (authorName && authorEmail) {
      args.push('--author', `${authorName} <${authorEmail}>`);
    }

    this.runGit(...args);

    // Return the new commit hash
    return this.runGit('rev-parse', 'HEAD');
  }

  async push(branch: string, remote: string = 'origin'): Promise<void> {
    this.runGit('push', remote, branch);
  }

  async pull(branch: string = 'HEAD', remote: string = 'origin'): Promise<void> {
    this.runGit('pull', remote, branch);
  }

  async getMergeBase(branch1: string, branch2: string): Promise<string> {
    return this.runGit('merge-base', branch1, branch2);
  }
}

/**
 * Forgejo Git Repository Handler
 * Uses Forgejo REST API
 */
export class ForgejoGitRepo {
  private baseUrl: string;
  private token: string;
  private owner: string;
  private repo: string;

  constructor(baseUrl: string, token: string, owner: string, repo: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  private async request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT', endpoint: string, body?: unknown): Promise<unknown> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `token ${this.token}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Forgejo API error (${response.status}): ${text}`);
    }

    return response.json();
  }

  async getStatus(): Promise<GitStatus> {
    const repo = (await this.request('GET', `/repos/${this.owner}/${this.repo}`)) as any;
    const defaultBranch = String(repo?.default_branch || '').trim() || 'main';

    return {
      currentBranch: defaultBranch,
      staged: [],
      unstaged: [],
      untracked: [],
      isDirty: false,
    };
  }

  async getDiff(baseRef: string, headRef: string): Promise<GitDiff> {
    const data = (await this.request('GET', `/repos/${this.owner}/${this.repo}/compare/${baseRef}...${headRef}`)) as any;

    return {
      filesChanged: data.files?.length || 0,
      insertions: data.files?.reduce((sum: number, f: any) => sum + (f.additions || 0), 0) || 0,
      deletions: data.files?.reduce((sum: number, f: any) => sum + (f.deletions || 0), 0) || 0,
      diff: data.diff || '',
    };
  }

  async getLog(branch: string, maxCommits: number = 20): Promise<GitCommit[]> {
    const commits = (await this.request('GET', `/repos/${this.owner}/${this.repo}/commits?sha=${branch}&limit=${maxCommits}`)) as any[];

    return commits.map((c) => ({
      hash: c.commit?.id || c.sha,
      author: c.commit?.author?.name || c.author?.login || 'unknown',
      message: c.commit?.message || '',
      date: c.commit?.author?.date || c.created_at || '',
    }));
  }

  async createBranch(branchName: string, fromRef: string = 'main'): Promise<void> {
    await this.request('POST', `/repos/${this.owner}/${this.repo}/branches`, {
      branch_name: branchName,
      old_branch_name: fromRef,
    });
  }

  async createPullRequest(title: string, description: string, sourceBranch: string, targetBranch: string): Promise<GitPullRequest> {
    const response = (await this.request('POST', `/repos/${this.owner}/${this.repo}/pulls`, {
      title,
      body: description,
      head: sourceBranch,
      base: targetBranch,
    })) as any;

    return {
      id: `forgejo-${response.id}`,
      number: response.number,
      title: response.title,
      description: response.body,
      sourceBranch: response.head?.ref,
      targetBranch: response.base?.ref,
      status: response.state || 'open',
      url: response.html_url,
    };
  }

  async mergePullRequest(number: string, mergeMethod: string = 'merge'): Promise<string> {
    const response = (await this.request('POST', `/repos/${this.owner}/${this.repo}/pulls/${number}/merge`, {
      merge_method: mergeMethod,
      delete_branch_after_merge: true,
    })) as any;

    return response.sha;
  }
}

/**
 * GitHub Git Repository Handler
 * Uses GitHub REST API v3
 */
export class GitHubGitRepo {
  private token: string;
  private owner: string;
  private repo: string;
  private baseUrl: string = 'https://api.github.com';

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  private async request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT', endpoint: string, body?: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `token ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${text}`);
    }

    return response.json();
  }

  async getStatus(): Promise<GitStatus> {
    const repo = (await this.request('GET', `/repos/${this.owner}/${this.repo}`)) as any;

    return {
      currentBranch: repo.default_branch || 'main',
      staged: [],
      unstaged: [],
      untracked: [],
      isDirty: false,
    };
  }

  async getDiff(baseRef: string, headRef: string): Promise<GitDiff> {
    const comparison = (await this.request('GET', `/repos/${this.owner}/${this.repo}/compare/${baseRef}...${headRef}`)) as any;
    const files = Array.isArray(comparison.files) ? comparison.files : [];
    const diff = files
      .map((file: any) => (typeof file?.patch === 'string' ? file.patch : ''))
      .filter(Boolean)
      .join('\n')
      .slice(0, 10000);

    return {
      filesChanged: files.length,
      insertions: comparison.additions || 0,
      deletions: comparison.deletions || 0,
      diff,
    };
  }

  async getLog(branch: string, maxCommits: number = 20): Promise<GitCommit[]> {
    const commits = (await this.request('GET', `/repos/${this.owner}/${this.repo}/commits?sha=${branch}&per_page=${maxCommits}`)) as any[];

    return commits.map((c) => ({
      hash: c.sha,
      author: c.commit?.author?.name || c.author?.login || 'unknown',
      message: c.commit?.message || '',
      date: c.commit?.author?.date || c.created_at || '',
    }));
  }

  async createBranch(branchName: string, fromRef: string = 'main'): Promise<void> {
    const sourceCommit = (await this.request('GET', `/repos/${this.owner}/${this.repo}/commits/${fromRef}`)) as any;

    await this.request('POST', `/repos/${this.owner}/${this.repo}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: sourceCommit.sha,
    });
  }

  async createPullRequest(title: string, description: string, sourceBranch: string, targetBranch: string): Promise<GitPullRequest> {
    const response = (await this.request('POST', `/repos/${this.owner}/${this.repo}/pulls`, {
      title,
      body: description,
      head: sourceBranch,
      base: targetBranch,
    })) as any;

    return {
      id: `github-${response.id}`,
      number: response.number,
      title: response.title,
      description: response.body,
      sourceBranch: response.head?.ref,
      targetBranch: response.base?.ref,
      status: response.state === 'closed' ? 'closed' : 'open',
      url: response.html_url,
    };
  }

  async mergePullRequest(number: string, mergeMethod: string = 'merge'): Promise<string> {
    const response = (await this.request('PUT', `/repos/${this.owner}/${this.repo}/pulls/${number}/merge`, {
      merge_method: mergeMethod === 'squash' ? 'squash' : mergeMethod === 'rebase' ? 'rebase' : 'merge',
    })) as any;

    return response.sha;
  }
}

/**
 * Factory for creating git repo handlers
 */
export function createGitRepo(provider: GitProvider, config: Record<string, unknown>) {
  switch (provider) {
    case 'local':
      return new LocalGitRepo(config.repoPath as string);
    case 'forgejo':
      return new ForgejoGitRepo(config.baseUrl as string, config.token as string, config.owner as string, config.repo as string);
    case 'github':
      return new GitHubGitRepo(config.token as string, config.owner as string, config.repo as string);
    default:
      throw new Error(`Unsupported git provider: ${provider}`);
  }
}
