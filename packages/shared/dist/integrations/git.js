/**
 * Git Operations Integration
 *
 * Supports:
 * - Local repositories (git CLI or isomorphic-git)
 * - Forgejo (self-hosted Git forge)
 * - GitHub (cloud-based)
 */
import { spawnSync } from 'node:child_process';
const LOCAL_GIT_LOG_FIELD_SEPARATOR = '\u0000';
const LOCAL_GIT_LOG_RECORD_SEPARATOR = '\u001e';
function parseLocalGitLogOutput(output) {
    const commits = [];
    const records = output
        .split(LOCAL_GIT_LOG_RECORD_SEPARATOR)
        .map((entry) => entry.trim())
        .filter(Boolean);
    for (const record of records) {
        const fields = record.split(LOCAL_GIT_LOG_FIELD_SEPARATOR);
        if (fields.length < 4)
            continue;
        const [hash, author, message, date] = fields;
        if (!hash || !author || !date)
            continue;
        commits.push({ hash, author, message: message || '', date });
    }
    return commits;
}
/**
 * Local Git Repository Handler
 * Uses git CLI for operations on local repositories
 */
export class LocalGitRepo {
    repoPath;
    constructor(repoPath) {
        this.repoPath = repoPath;
    }
    runGit(...args) {
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
    async getStatus() {
        const branchOutput = this.runGit('branch', '--show-current');
        const statusOutput = this.runGit('status', '--porcelain');
        const staged = [];
        const unstaged = [];
        const untracked = [];
        statusOutput.split('\n').forEach((line) => {
            if (!line)
                return;
            const status = line.slice(0, 2);
            const file = line.slice(3);
            if (status[0] !== ' ')
                staged.push(file);
            if (status !== '??' && status[1] !== ' ')
                unstaged.push(file);
            if (status === '??')
                untracked.push(file);
        });
        return {
            currentBranch: branchOutput,
            staged,
            unstaged,
            untracked,
            isDirty: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
        };
    }
    async getDiff(baseRef = 'HEAD', headRef = 'HEAD~1', filePattern) {
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
            if (!line)
                return;
            const [adds, deletes] = line.split('\t');
            if (adds !== '-')
                insertions += parseInt(adds, 10);
            if (deletes !== '-')
                deletions += parseInt(deletes, 10);
            filesChanged += 1;
        });
        return {
            filesChanged,
            insertions,
            deletions,
            diff: diff.slice(0, 10000), // Limit diff output
        };
    }
    async getLog(branch = 'HEAD', maxCommits = 20, author, since, until) {
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
    async createBranch(branchName, fromRef = 'HEAD') {
        this.runGit('checkout', '-b', branchName, fromRef);
    }
    async createCommit(message, authorName, authorEmail) {
        const args = ['commit', '-m', message];
        if (authorName && authorEmail) {
            args.push('--author', `${authorName} <${authorEmail}>`);
        }
        this.runGit(...args);
        // Return the new commit hash
        return this.runGit('rev-parse', 'HEAD');
    }
    async push(branch, remote = 'origin') {
        this.runGit('push', remote, branch);
    }
    async pull(branch = 'HEAD', remote = 'origin') {
        this.runGit('pull', remote, branch);
    }
    async getMergeBase(branch1, branch2) {
        return this.runGit('merge-base', branch1, branch2);
    }
}
/**
 * Forgejo Git Repository Handler
 * Uses Forgejo REST API
 */
export class ForgejoGitRepo {
    baseUrl;
    token;
    owner;
    repo;
    constructor(baseUrl, token, owner, repo) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
        this.owner = owner;
        this.repo = repo;
    }
    async request(method, endpoint, body) {
        const url = `${this.baseUrl}/api/v1${endpoint}`;
        const options = {
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
    async getStatus() {
        const repo = (await this.request('GET', `/repos/${this.owner}/${this.repo}`));
        const defaultBranch = String(repo?.default_branch || '').trim() || 'main';
        return {
            currentBranch: defaultBranch,
            staged: [],
            unstaged: [],
            untracked: [],
            isDirty: false,
        };
    }
    async getDiff(baseRef, headRef) {
        const data = (await this.request('GET', `/repos/${this.owner}/${this.repo}/compare/${baseRef}...${headRef}`));
        return {
            filesChanged: data.files?.length || 0,
            insertions: data.files?.reduce((sum, f) => sum + (f.additions || 0), 0) || 0,
            deletions: data.files?.reduce((sum, f) => sum + (f.deletions || 0), 0) || 0,
            diff: data.diff || '',
        };
    }
    async getLog(branch, maxCommits = 20) {
        const commits = (await this.request('GET', `/repos/${this.owner}/${this.repo}/commits?sha=${branch}&limit=${maxCommits}`));
        return commits.map((c) => ({
            hash: c.commit?.id || c.sha,
            author: c.commit?.author?.name || c.author?.login || 'unknown',
            message: c.commit?.message || '',
            date: c.commit?.author?.date || c.created_at || '',
        }));
    }
    async createBranch(branchName, fromRef = 'main') {
        await this.request('POST', `/repos/${this.owner}/${this.repo}/branches`, {
            branch_name: branchName,
            old_branch_name: fromRef,
        });
    }
    async createPullRequest(title, description, sourceBranch, targetBranch) {
        const response = (await this.request('POST', `/repos/${this.owner}/${this.repo}/pulls`, {
            title,
            body: description,
            head: sourceBranch,
            base: targetBranch,
        }));
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
    async mergePullRequest(number, mergeMethod = 'merge') {
        const response = (await this.request('POST', `/repos/${this.owner}/${this.repo}/pulls/${number}/merge`, {
            merge_method: mergeMethod,
            delete_branch_after_merge: true,
        }));
        return response.sha;
    }
}
/**
 * GitHub Git Repository Handler
 * Uses GitHub REST API v3
 */
export class GitHubGitRepo {
    token;
    owner;
    repo;
    baseUrl = 'https://api.github.com';
    constructor(token, owner, repo) {
        this.token = token;
        this.owner = owner;
        this.repo = repo;
    }
    async request(method, endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
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
    async getStatus() {
        const repo = (await this.request('GET', `/repos/${this.owner}/${this.repo}`));
        return {
            currentBranch: repo.default_branch || 'main',
            staged: [],
            unstaged: [],
            untracked: [],
            isDirty: false,
        };
    }
    async getDiff(baseRef, headRef) {
        const comparison = (await this.request('GET', `/repos/${this.owner}/${this.repo}/compare/${baseRef}...${headRef}`));
        const files = Array.isArray(comparison.files) ? comparison.files : [];
        const diff = files
            .map((file) => (typeof file?.patch === 'string' ? file.patch : ''))
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
    async getLog(branch, maxCommits = 20) {
        const commits = (await this.request('GET', `/repos/${this.owner}/${this.repo}/commits?sha=${branch}&per_page=${maxCommits}`));
        return commits.map((c) => ({
            hash: c.sha,
            author: c.commit?.author?.name || c.author?.login || 'unknown',
            message: c.commit?.message || '',
            date: c.commit?.author?.date || c.created_at || '',
        }));
    }
    async createBranch(branchName, fromRef = 'main') {
        const sourceCommit = (await this.request('GET', `/repos/${this.owner}/${this.repo}/commits/${fromRef}`));
        await this.request('POST', `/repos/${this.owner}/${this.repo}/git/refs`, {
            ref: `refs/heads/${branchName}`,
            sha: sourceCommit.sha,
        });
    }
    async createPullRequest(title, description, sourceBranch, targetBranch) {
        const response = (await this.request('POST', `/repos/${this.owner}/${this.repo}/pulls`, {
            title,
            body: description,
            head: sourceBranch,
            base: targetBranch,
        }));
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
    async mergePullRequest(number, mergeMethod = 'merge') {
        const response = (await this.request('PUT', `/repos/${this.owner}/${this.repo}/pulls/${number}/merge`, {
            merge_method: mergeMethod === 'squash' ? 'squash' : mergeMethod === 'rebase' ? 'rebase' : 'merge',
        }));
        return response.sha;
    }
}
/**
 * Factory for creating git repo handlers
 */
export function createGitRepo(provider, config) {
    switch (provider) {
        case 'local':
            return new LocalGitRepo(config.repoPath);
        case 'forgejo':
            return new ForgejoGitRepo(config.baseUrl, config.token, config.owner, config.repo);
        case 'github':
            return new GitHubGitRepo(config.token, config.owner, config.repo);
        default:
            throw new Error(`Unsupported git provider: ${provider}`);
    }
}
//# sourceMappingURL=git.js.map