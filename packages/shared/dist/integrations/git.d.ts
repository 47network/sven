/**
 * Git Operations Integration
 *
 * Supports:
 * - Local repositories (git CLI or isomorphic-git)
 * - Forgejo (self-hosted Git forge)
 * - GitHub (cloud-based)
 */
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
/**
 * Local Git Repository Handler
 * Uses git CLI for operations on local repositories
 */
export declare class LocalGitRepo {
    private repoPath;
    constructor(repoPath: string);
    private runGit;
    getStatus(): Promise<GitStatus>;
    getDiff(baseRef?: string, headRef?: string, filePattern?: string): Promise<GitDiff>;
    getLog(branch?: string, maxCommits?: number, author?: string, since?: string, until?: string): Promise<GitCommit[]>;
    createBranch(branchName: string, fromRef?: string): Promise<void>;
    createCommit(message: string, authorName?: string, authorEmail?: string): Promise<string>;
    push(branch: string, remote?: string): Promise<void>;
    pull(branch?: string, remote?: string): Promise<void>;
    getMergeBase(branch1: string, branch2: string): Promise<string>;
}
/**
 * Forgejo Git Repository Handler
 * Uses Forgejo REST API
 */
export declare class ForgejoGitRepo {
    private baseUrl;
    private token;
    private owner;
    private repo;
    constructor(baseUrl: string, token: string, owner: string, repo: string);
    private request;
    getStatus(): Promise<GitStatus>;
    getDiff(baseRef: string, headRef: string): Promise<GitDiff>;
    getLog(branch: string, maxCommits?: number): Promise<GitCommit[]>;
    createBranch(branchName: string, fromRef?: string): Promise<void>;
    createPullRequest(title: string, description: string, sourceBranch: string, targetBranch: string): Promise<GitPullRequest>;
    mergePullRequest(number: string, mergeMethod?: string): Promise<string>;
}
/**
 * GitHub Git Repository Handler
 * Uses GitHub REST API v3
 */
export declare class GitHubGitRepo {
    private token;
    private owner;
    private repo;
    private baseUrl;
    constructor(token: string, owner: string, repo: string);
    private request;
    getStatus(): Promise<GitStatus>;
    getDiff(baseRef: string, headRef: string): Promise<GitDiff>;
    getLog(branch: string, maxCommits?: number): Promise<GitCommit[]>;
    createBranch(branchName: string, fromRef?: string): Promise<void>;
    createPullRequest(title: string, description: string, sourceBranch: string, targetBranch: string): Promise<GitPullRequest>;
    mergePullRequest(number: string, mergeMethod?: string): Promise<string>;
}
/**
 * Factory for creating git repo handlers
 */
export declare function createGitRepo(provider: GitProvider, config: Record<string, unknown>): LocalGitRepo | ForgejoGitRepo | GitHubGitRepo;
//# sourceMappingURL=git.d.ts.map