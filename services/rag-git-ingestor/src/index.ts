import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import fg from "fast-glob";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { connect, JSONCodec } from "nats";
import { v4 as uuidv4 } from "uuid";
import { createLogger, NATS_SUBJECTS, sha256 } from "@sven/shared";
import type { EventEnvelope, RagIndexRequestEvent } from "@sven/shared";

const logger = createLogger("rag-git-ingestor");
const jc = JSONCodec();

const DEFAULT_INCLUDE = ["**/*.md", "**/*.txt", "**/*.mdx", "**/*.pdf", "**/*.docx"];
const DEFAULT_EXCLUDE = ["**/.git/**", "**/node_modules/**", "**/.DS_Store"];
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

const natsUrl = process.env.NATS_URL || "nats://nats:4222";
const intervalMs = parsePositiveIntervalMs(process.env.GIT_INGEST_INTERVAL_MS, DEFAULT_INTERVAL_MS);
const includeGlobs = parseGlobs(process.env.GIT_INGEST_INCLUDE, DEFAULT_INCLUDE);
const excludeGlobs = parseGlobs(process.env.GIT_INGEST_EXCLUDE, DEFAULT_EXCLUDE);
const maxFileSizeBytes = Number(process.env.GIT_INGEST_MAX_FILE_SIZE || DEFAULT_MAX_FILE_SIZE);
const visibility = normalizeVisibility(process.env.GIT_INGEST_VISIBILITY);
const allowedUsers = parseGlobs(process.env.GIT_INGEST_ALLOW_USERS, []);
const allowedChats = parseGlobs(process.env.GIT_INGEST_ALLOW_CHATS, []);

const localRoot = process.env.GIT_INGEST_LOCAL_ROOT || "/nas/git";
const localRepos = parseList(process.env.GIT_INGEST_REPOS || "");
const cloneRoot = process.env.GIT_INGEST_CLONE_ROOT || "/var/lib/sven/git";
const githubRepos = parseList(process.env.GIT_INGEST_GITHUB_REPOS || "");
const forgejoRepos = parseList(process.env.GIT_INGEST_FORGEJO_REPOS || "");
const githubToken = process.env.GIT_INGEST_GITHUB_TOKEN || "";
const forgejoToken = process.env.GIT_INGEST_FORGEJO_TOKEN || "";

async function main() {
  const nc = await connect({
    servers: natsUrl,
    name: "rag-git-ingestor",
    maxReconnectAttempts: -1,
  });

  async function runCycle() {
    await ingestLocalMirrors(nc);
    await ingestRemoteRepos(nc, "github", githubRepos, githubToken);
    await ingestRemoteRepos(nc, "forgejo", forgejoRepos, forgejoToken);
  }

  logger.info("git ingestion worker starting", {
    interval_ms: intervalMs,
    scheduler_mode: "periodic",
  });

  await runCycle();
  setInterval(() => {
    runCycle().catch((error) => {
      logger.error("git-ingest cycle failed", { err: String(error) });
    });
  }, intervalMs);
}

async function ingestLocalMirrors(nc: Awaited<ReturnType<typeof connect>>) {
  if (!localRepos.length) {
    return;
  }

  const roots = localRepos.map((repoPath) =>
    repoPath.startsWith("/") ? repoPath : path.join(localRoot, repoPath)
  );

  for (const repoPath of roots) {
    await ingestRepo(nc, repoPath, repoPath, "local");
  }
}

async function ingestRemoteRepos(
  nc: Awaited<ReturnType<typeof connect>>,
  source: "github" | "forgejo",
  repos: string[],
  token: string
) {
  if (!repos.length) {
    return;
  }

  await fs.mkdir(cloneRoot, { recursive: true });

  for (const repoUrl of repos) {
    const { url, safeName } = normalizeRepoUrl(repoUrl, source);
    const gitAuthArgs = buildGitAuthArgs(token, url);
    const repoPath = path.join(cloneRoot, safeName);

    if (await exists(repoPath)) {
      await runGit([...gitAuthArgs, "-C", repoPath, "fetch", "--prune"], cloneRoot);
      await runGit(["-C", repoPath, "reset", "--hard", "origin/HEAD"], cloneRoot);
    } else {
      await runGit([...gitAuthArgs, "clone", "--depth", "1", url, repoPath], cloneRoot);
    }

    await ingestRepo(nc, repoPath, repoUrl, source);
  }
}

async function ingestRepo(
  nc: Awaited<ReturnType<typeof connect>>,
  repoPath: string,
  repoId: string,
  source: "local" | "github" | "forgejo"
) {
  if (!(await exists(repoPath))) {
    logger.warn("git-ingest missing repo", { repo_path: repoPath });
    return;
  }

  const files = await fg(includeGlobs, {
    cwd: repoPath,
    ignore: excludeGlobs,
    dot: false,
    onlyFiles: true,
    unique: true,
  });

  for (const relativePath of files) {
    try {
      const absolutePath = path.join(repoPath, relativePath);
      const stat = await fs.stat(absolutePath);
      if (stat.size > maxFileSizeBytes) {
        continue;
      }

      const { text, contentType } = await readFileContent(absolutePath);
      if (!text.trim()) {
        continue;
      }

      const sourceLabel = `git:${repoId}:${relativePath}`;
      const envelope: EventEnvelope<RagIndexRequestEvent> = {
        schema_version: "1.0",
        event_id: uuidv4(),
        occurred_at: new Date().toISOString(),
        data: {
          source: sourceLabel,
          source_type: "git",
          title: path.basename(relativePath),
          content: text,
          visibility,
          allow_users: allowedUsers.length ? allowedUsers : undefined,
          allow_chats: allowedChats.length ? allowedChats : undefined,
          metadata: {
            repo: repoId,
            path: relativePath,
            source,
            size_bytes: stat.size,
            modified_at: stat.mtime.toISOString(),
            content_type: contentType,
            content_hash: sha256(text),
          },
        },
      };

      nc.publish(NATS_SUBJECTS.RAG_INDEX_REQUEST, jc.encode(envelope));
    } catch (err) {
      logger.error("Failed to ingest git file", {
        repo: repoId,
        path: relativePath,
        err: String(err),
      });
    }
  }
}

async function readFileContent(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".pdf") {
    const data = await fs.readFile(filePath);
    const parsed = await pdfParse(data);
    return { text: parsed.text || "", contentType: "application/pdf" };
  }

  if (extension === ".docx") {
    const parsed = await mammoth.extractRawText({ path: filePath });
    return {
      text: parsed.value || "",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  const data = await fs.readFile(filePath, "utf8");
  return { text: data, contentType: "text/plain" };
}

function parseGlobs(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function parseList(raw: string): string[] {
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function parsePositiveIntervalMs(raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid GIT_INGEST_INTERVAL_MS: expected a positive integer milliseconds value, got "${raw}"`
    );
  }

  return parsed;
}

function normalizeVisibility(raw: string | undefined): "global" | "chat" | "user" {
  if (raw === "chat" || raw === "user") return raw;
  return "global";
}

function normalizeRepoUrl(repoUrl: string, source: "github" | "forgejo") {
  const trimmed = repoUrl.trim();
  return { url: trimmed, safeName: sanitizeRepoName(trimmed, source) };
}

function buildGitAuthArgs(token: string, repoUrl: string): string[] {
  if (!token) {
    return [];
  }

  try {
    const parsed = new URL(repoUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return ["-c", `http.extraHeader=Authorization: Bearer ${token}`];
    }
  } catch {
    return [];
  }

  return [];
}

function sanitizeRepoName(repoUrl: string, source: string) {
  const safeBase = repoUrl
    .replace(/^https?:\/\//, "")
    .replace(/[/:@]+/g, "-")
    .replace(/\.+$/, "")
    .toLowerCase();
  return `${source}-${safeBase}`;
}

function runGit(args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git ${detectGitOperation(args)} failed with code ${code}`));
      }
    });
  });
}

function detectGitOperation(args: string[]): string {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-c" || arg === "-C") {
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    if (arg.startsWith("http.extraHeader=")) {
      continue;
    }
    return arg;
  }

  return "command";
}

async function exists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  logger.fatal("rag-git-ingestor fatal", { err: String(error) });
  process.exit(1);
});
