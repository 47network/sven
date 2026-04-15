// ---------------------------------------------------------------------------
// Docker Optimizer Skill — Analyze & optimize Dockerfiles
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'analyze': {
      const dockerfile = (input.dockerfile as string) || '';
      if (!dockerfile) return { error: 'Provide a dockerfile to analyze.' };

      const lines = dockerfile.split('\n');
      const issues = analyzeDockerfile(lines);
      const stats = getDockerfileStats(lines);

      return {
        result: {
          ...stats,
          issues,
          issue_count: issues.length,
          critical: issues.filter((i) => i.severity === 'critical').length,
          warnings: issues.filter((i) => i.severity === 'warning').length,
          info: issues.filter((i) => i.severity === 'info').length,
        },
      };
    }

    case 'optimize': {
      const dockerfile = (input.dockerfile as string) || '';
      if (!dockerfile) return { error: 'Provide a dockerfile to optimize.' };

      const lines = dockerfile.split('\n');
      const suggestions = generateOptimizations(lines);

      return {
        result: {
          original_line_count: lines.length,
          suggestions,
          suggestion_count: suggestions.length,
          estimated_size_reduction: suggestions.reduce((s, sg) => s + (sg.size_impact_percent || 0), 0),
        },
      };
    }

    case 'security_scan': {
      const dockerfile = (input.dockerfile as string) || '';
      if (!dockerfile) return { error: 'Provide a dockerfile to scan.' };

      const lines = dockerfile.split('\n');
      const findings = securityScan(lines);

      return {
        result: {
          findings,
          finding_count: findings.length,
          risk_level: findings.some((f) => f.severity === 'critical') ? 'high'
            : findings.some((f) => f.severity === 'warning') ? 'medium' : 'low',
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: analyze, optimize, security_scan` };
  }
}

/* -------- Types -------- */

interface Issue {
  line: number;
  severity: 'critical' | 'warning' | 'info';
  rule: string;
  message: string;
  fix?: string;
}

interface Suggestion {
  type: string;
  description: string;
  before?: string;
  after?: string;
  size_impact_percent?: number;
}

/* -------- Dockerfile Analysis -------- */

function analyzeDockerfile(lines: string[]): Issue[] {
  const issues: Issue[] = [];

  let hasUser = false;
  let lastFrom = '';
  let runCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip comments and blank lines
    if (!line || line.startsWith('#')) continue;

    const instruction = line.split(/\s+/)[0].toUpperCase();

    if (instruction === 'FROM') {
      lastFrom = line;
      if (line.includes(':latest') || (!line.includes(':') && !line.includes(' AS '))) {
        issues.push({ line: lineNum, severity: 'warning', rule: 'DL3007', message: 'Using latest tag. Pin a specific version.', fix: 'Use a specific version tag (e.g., node:20-alpine)' });
      }
    }

    if (instruction === 'RUN') {
      runCount++;
      if (line.includes('apt-get install') && !line.includes('--no-install-recommends')) {
        issues.push({ line: lineNum, severity: 'warning', rule: 'DL3015', message: 'apt-get install without --no-install-recommends', fix: 'Add --no-install-recommends' });
      }
      if (line.includes('apt-get install') && !lines.slice(i).some((l) => l.includes('apt-get clean') || l.includes('rm -rf /var/lib/apt'))) {
        issues.push({ line: lineNum, severity: 'warning', rule: 'DL3009', message: 'apt cache not cleaned after install', fix: 'Add && rm -rf /var/lib/apt/lists/*' });
      }
      if (line.includes('pip install') && !line.includes('--no-cache-dir')) {
        issues.push({ line: lineNum, severity: 'info', rule: 'DL3042', message: 'pip install without --no-cache-dir', fix: 'Add --no-cache-dir' });
      }
      if (line.includes('curl') && line.includes('| sh')) {
        issues.push({ line: lineNum, severity: 'critical', rule: 'DL4006', message: 'Piping curl to shell is a security risk', fix: 'Download first, verify, then execute' });
      }
    }

    if (instruction === 'COPY' || instruction === 'ADD') {
      if (line.includes('.') && !line.includes('.dockerignore') && line.match(/\.\s+\./)) {
        issues.push({ line: lineNum, severity: 'info', rule: 'DL3020', message: 'COPY . copies everything — use .dockerignore', fix: 'Create a .dockerignore or copy specific files' });
      }
      if (instruction === 'ADD' && !line.includes('.tar') && !line.includes('http')) {
        issues.push({ line: lineNum, severity: 'info', rule: 'DL3010', message: 'Use COPY instead of ADD for non-archive files', fix: 'Replace ADD with COPY' });
      }
    }

    if (instruction === 'USER') hasUser = true;

    if (instruction === 'EXPOSE') {
      const port = parseInt(line.split(/\s+/)[1], 10);
      if (port < 1024 && port !== 80 && port !== 443) {
        issues.push({ line: lineNum, severity: 'info', rule: 'PRIV_PORT', message: `Privileged port ${port} — may need root`, fix: 'Use a port > 1024 or configure capabilities' });
      }
    }

    if (instruction === 'ENV' && (line.includes('PASSWORD') || line.includes('SECRET') || line.includes('TOKEN') || line.includes('API_KEY'))) {
      issues.push({ line: lineNum, severity: 'critical', rule: 'SECRET_ENV', message: 'Secrets should not be set via ENV in Dockerfile', fix: 'Use Docker secrets or runtime env vars' });
    }
  }

  if (!hasUser) {
    issues.push({ line: 0, severity: 'warning', rule: 'DL3002', message: 'No USER instruction — container runs as root', fix: 'Add USER node (or appropriate user) before CMD' });
  }

  if (runCount > 5) {
    issues.push({ line: 0, severity: 'info', rule: 'MANY_RUN', message: `${runCount} RUN instructions — consider combining with &&`, fix: 'Merge consecutive RUN commands to reduce layers' });
  }

  if (lastFrom && !lastFrom.includes('alpine') && !lastFrom.includes('slim') && !lastFrom.includes('distroless')) {
    issues.push({ line: 0, severity: 'info', rule: 'LARGE_BASE', message: 'Consider using alpine, slim, or distroless base image', fix: 'Switch to a smaller base (e.g., node:20-alpine)' });
  }

  return issues;
}

function getDockerfileStats(lines: string[]): Record<string, number> {
  const instructions: Record<string, number> = {};
  let stages = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const instr = trimmed.split(/\s+/)[0].toUpperCase();
    instructions[instr] = (instructions[instr] || 0) + 1;
    if (instr === 'FROM') stages++;
  }

  return {
    total_lines: lines.length,
    instruction_lines: Object.values(instructions).reduce((a, b) => a + b, 0),
    stages,
    run_count: instructions['RUN'] || 0,
    copy_count: instructions['COPY'] || 0,
    env_count: instructions['ENV'] || 0,
  };
}

/* -------- Optimization Suggestions -------- */

function generateOptimizations(lines: string[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  let hasMultiStage = false;
  let fromCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith('FROM')) {
      fromCount++;
      if (trimmed.includes(' AS ') || trimmed.includes(' as ')) hasMultiStage = true;
    }
  }

  if (!hasMultiStage && fromCount === 1) {
    suggestions.push({
      type: 'multi_stage_build',
      description: 'Use multi-stage build to separate build and runtime dependencies',
      size_impact_percent: 40,
    });
  }

  // Check for combined package install + cleanup
  const runLines = lines.filter((l) => l.trim().toUpperCase().startsWith('RUN'));
  const consecutiveRuns = runLines.length;
  if (consecutiveRuns > 3) {
    suggestions.push({
      type: 'combine_runs',
      description: `Combine ${consecutiveRuns} RUN instructions into fewer layers`,
      size_impact_percent: 5,
    });
  }

  // Check for .dockerignore mention
  const hasCopyAll = lines.some((l) => /COPY\s+\.\s+/.test(l));
  if (hasCopyAll) {
    suggestions.push({
      type: 'dockerignore',
      description: 'Use .dockerignore to exclude node_modules, .git, tests, docs',
      size_impact_percent: 20,
    });
  }

  // Check for npm ci vs npm install
  const hasNpmInstall = lines.some((l) => l.includes('npm install') && !l.includes('npm ci'));
  if (hasNpmInstall) {
    suggestions.push({
      type: 'npm_ci',
      description: 'Use "npm ci" instead of "npm install" for deterministic builds',
      before: 'RUN npm install',
      after: 'RUN npm ci --omit=dev',
      size_impact_percent: 10,
    });
  }

  return suggestions;
}

/* -------- Security Scan -------- */

function securityScan(lines: string[]): Issue[] {
  const findings: Issue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (/chmod\s+777/.test(line)) {
      findings.push({ line: lineNum, severity: 'critical', rule: 'SEC_CHMOD', message: 'chmod 777 grants world-writable permissions', fix: 'Use specific permissions (e.g., chmod 755)' });
    }

    if (/--privileged/.test(line)) {
      findings.push({ line: lineNum, severity: 'critical', rule: 'SEC_PRIV', message: 'Privileged mode grants full host access', fix: 'Use specific capabilities instead' });
    }

    if (/ssh.*key|id_rsa|id_ed25519/.test(line.toLowerCase())) {
      findings.push({ line: lineNum, severity: 'critical', rule: 'SEC_SSH', message: 'SSH keys should not be in Docker images', fix: 'Use Docker build secrets (--secret)' });
    }

    if (/wget.*-q.*http:/.test(line) || /curl.*http:(?!s)/.test(line)) {
      findings.push({ line: lineNum, severity: 'warning', rule: 'SEC_HTTP', message: 'Downloading over HTTP (not HTTPS)', fix: 'Use HTTPS for all downloads' });
    }
  }

  return findings;
}
