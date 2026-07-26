#!/usr/bin/env node
/**
 * One-shot generator for Fast Execution System v1 (UTF-8 safe on Windows).
 * Run: node scripts/generate-fast-execution-system.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  console.log("wrote", rel);
}

// --- docs/APPROVAL_POLICY.md ---
write(
  "docs/APPROVAL_POLICY.md",
  `# Approval Policy — 승인 경계

K-Beauty Match Fast Execution System v1 승인 정책.

## Environment refs / 환경 식별자

| 환경 | ref (masked) | full ref (internal only) |
|------|--------------|--------------------------|
| Staging | \`jfnj***gfd\` | jfnjufmldiqlgvgyugfd |
| Production | \`rhfr***mns\` | rhfrmvkjsummaylpzmns |

에이전트·스크립트 출력에는 **masked ref만** 사용한다. full ref는 safe-command-gate 내부 검사용.

## Auto-allowed / 자동 허용 (반복 승인 불필요)

- feature 브랜치 코드·문서·테스트·dry-run
- \`npm run test:*\`, \`npm run gate:*\`, \`npm run project:*\` (orchestrator)
- Staging Preview 배포 (Production 아님)
- Staging migration **파일 작성** (Dashboard 적용 전 게이트·self-test)
- SELECT, Staging GRANT SELECT/INSERT/UPDATE TO service_role
- CREATE TABLE / INDEX / FUNCTION, RLS, REVOKE (Staging migration 범위)
- feature 브랜치 \`git push\` (main 아님)
- WORK_QUEUE / PROJECT_STATUS 문서 갱신
- probe·read-only Staging REST/RPC (키·값 출력 없음)

## Must-stop / 반드시 중단 (명시 승인 전 금지)

- Production ref (\`rhfr***mns\`) 대상 **모든** 쓰기·link·배포
- \`git checkout main\`, \`git merge main\`, main 직접 push
- \`vercel --prod\`, Production Supabase link/apply
- DROP, TRUNCATE, scope 밖 DELETE
- Resend / 이메일 provider **live send**
- .env·service_role·API 키 값 덤프·로그 출력
- \`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY\` 생성
- pipeline worker 운영 실행 (\`run-pipeline-worker.mjs\`)
- WORK_QUEUE task \`approval_required: true\` (예: WQ-G) 자동 complete

## Human-only / 사람만 (에이전트 exit 2)

- Staging Dashboard SQL Editor에서 migration 붙여넣기·Run
- Production 배포·DB·환경변수
- main 병합

## Task-level approval

\`WORK_QUEUE.md\` 필드 \`approval_required: true\` → \`project:complete\`는 \`--force-docs-only\` 없이 verify만으로 complete 불가; 사용자 승인 후 진행.
`
);

// --- docs/FAST_EXECUTION_SYSTEM.md ---
write(
  "docs/FAST_EXECUTION_SYSTEM.md",
  `# Fast Execution System v1

에이전트·운영자가 **한 작업씩** 안전하게 진행하기 위한 로컬 오케스트레이션.

## Doc read order

1. \`PROJECT_STATUS.md\` — 현재 완료·차단
2. \`ROADMAP.md\` — 중기 목표
3. \`WORK_QUEUE.md\` — 실행 큐 (active 1개)
4. \`docs/APPROVAL_POLICY.md\` — 승인 경계
5. \`docs/NEXT_TASK_PREVIEW_VALIDATION.md\` — Preview 검증 (해당 시)

## npm commands

| Command | 설명 |
|---------|------|
| \`npm run project:status\` | 브랜치·커밋·active/next task·보호 상태 |
| \`npm run project:next\` | 다음 queued → active |
| \`npm run project:verify\` | active task 테스트 + safe gate + secret scan |
| \`npm run project:complete\` | verify 통과 후 completed 기록 |
| \`npm run project:continue\` | status → (next) → verify; Dashboard 차단 시 exit 2 |
| \`npm run test:work-queue\` | WORK_QUEUE 파서 selftest |
| \`npm run test:safe-command-gate\` | 명령/SQL 게이트 selftest |
| \`npm run test:project-orchestrator\` | 오케스트레이터 selftest |

## Agent rules

1. **active task 하나만** — \`WORK_QUEUE.md\`의 \`status: active\`
2. complete 전 **반드시** \`npm run project:verify\`
3. Production(\`rhfr***mns\`)·main merge·live email send **금지** — \`safe-command-gate\`가 차단
4. Staging Dashboard SQL은 **한국어 one-shot 안내** 후 exit 2; 에이전트가 SQL 실행하지 않음
5. commit은 에이전트가 \`--commit\` 없이는 자동하지 않음
6. complete 후 \`PROJECT_STATUS.md\` 한 줄 갱신은 **사람/에이전트 수동** (orchestrator는 reminder만)

## Files

- \`WORK_QUEUE.md\` — task 큐
- \`scripts/lib/work-queue.mjs\` — 파서·상태 갱신
- \`scripts/safe-command-gate.mjs\` — 위험 명령 차단
- \`scripts/project-state-summary.mjs\` — 상태 요약
- \`scripts/verify-current-task.mjs\` — active task 검증
- \`scripts/project-orchestrator.mjs\` — CLI 진입점
`
);

// --- WORK_QUEUE.md ---
write(
  "WORK_QUEUE.md",
  `# WORK_QUEUE — Fast Execution Task Queue

단일 \`active\` task. complete 후 \`npm run project:next\`.

### TASK WQ-A-checkin-email-queue-staging

id: WQ-A-checkin-email-queue-staging
title: Checkin email queue Staging migration and verify
priority: 10
status: active
environment: staging
deps:
tests:
  - npm run test:checkin-email-queue
  - npm run test:checkin-email-queue-migration
  - npm run test:checkin-email-queue-persistence
  - npm run test:admin-care-readiness
  - npm run gate:checkin-email-queue-staging
approval_required: false
dashboard_sql: true
dashboard_sql_file: supabase/migrations/20260722010000_create_checkin_email_queue.sql
notes: Staging Dashboard SQL apply pending; probe after apply

### TASK WQ-B-photo-compare-consent

id: WQ-B-photo-compare-consent
title: Photo compare consent and deletion flow
priority: 20
status: queued
environment: staging
deps: WQ-A-checkin-email-queue-staging
tests:
  - npm run test:care-data
approval_required: false

### TASK WQ-C-revisit-dashboard

id: WQ-C-revisit-dashboard
title: Revisit dashboard enhancements
priority: 30
status: queued
environment: staging
deps: WQ-B-photo-compare-consent
tests:
  - npm run test:care-dashboard
approval_required: false

### TASK WQ-D-checkin-scheduling

id: WQ-D-checkin-scheduling
title: Checkin scheduling and notification channels
priority: 40
status: queued
environment: staging
deps: WQ-A-checkin-email-queue-staging
tests:
  - npm run test:checkin-policy
  - npm run test:reminder-delivery
approval_required: false

### TASK WQ-E-care-worker-admin

id: WQ-E-care-worker-admin
title: Care worker admin and dry-run delivery
priority: 50
status: queued
environment: staging
deps: WQ-D-checkin-scheduling
tests:
  - npm run test:care-guidance
  - npm run test:routine-adjustment
approval_required: false

### TASK WQ-F-catalog-remaining

id: WQ-F-catalog-remaining
title: Catalog remaining sprint and refresh
priority: 60
status: queued
environment: staging
deps:
tests:
  - npm run test:catalog-refresh
  - npm run test:catalog-refresh-due
approval_required: false

### TASK WQ-G-prelaunch-integration

id: WQ-G-prelaunch-integration
title: Prelaunch integration and production readiness gate
priority: 90
status: queued
environment: production
deps: WQ-C-revisit-dashboard, WQ-E-care-worker-admin, WQ-F-catalog-remaining
tests:
  - npm run check:production
  - npm run check:release-security
approval_required: true
`
);

// --- scripts/lib/work-queue.mjs ---
write(
  "scripts/lib/work-queue.mjs",
  `/**
 * Parse and update WORK_QUEUE.md task entries.
 */
import fs from "node:fs";
import path from "node:path";

export const WORK_QUEUE_FILE = "WORK_QUEUE.md";

/**
 * @param {string} text
 * @returns {import('./work-queue.types.js') extends never ? object[] : object[]}
 */
export function parseWorkQueue(text) {
  const tasks = [];
  const sections = text.split(/^### TASK /m).slice(1);

  for (const section of sections) {
    const lines = section.split(/\\r?\\n/);
    const headerLine = lines[0] || "";
    const idFromHeader = headerLine.trim();
    const task = {
      id: idFromHeader,
      title: "",
      priority: 999,
      status: "queued",
      environment: "",
      deps: [],
      tests: [],
      approval_required: false,
      dashboard_sql: false,
      dashboard_sql_file: "",
      notes: "",
      result_commit: "",
    };

    let currentList = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("### TASK ")) break;

      const listMatch = line.match(/^\\s*-\\s+(.*)$/);
      if (listMatch && currentList) {
        task[currentList].push(listMatch[1].trim());
        continue;
      }

      const kv = line.match(/^([a-z_]+):\\s*(.*)$/);
      if (!kv) {
        currentList = null;
        continue;
      }

      const [, key, rawVal] = kv;
      const val = rawVal.trim();

      if (key === "tests" || key === "deps") {
        currentList = key;
        if (val) {
          task[key].push(...val.split(/,\\s*/).filter(Boolean));
        }
        continue;
      }

      currentList = null;

      if (key === "priority") {
        task.priority = Number(val) || 999;
      } else if (key === "approval_required") {
        task.approval_required = val === "true";
      } else if (key === "dashboard_sql") {
        task.dashboard_sql = val === "true";
      } else if (key === "id") {
        task.id = val;
      } else {
        task[key] = val;
      }
    }

    tasks.push(task);
  }

  return tasks.sort((a, b) => a.priority - b.priority);
}

export function loadWorkQueue(root = process.cwd()) {
  const file = path.join(root, WORK_QUEUE_FILE);
  const text = fs.readFileSync(file, "utf8");
  return parseWorkQueue(text);
}

export function getActiveTask(tasks) {
  return tasks.find((t) => t.status === "active") || null;
}

export function getNextQueuedTask(tasks) {
  const completed = new Set(
    tasks.filter((t) => t.status === "completed").map((t) => t.id)
  );

  const eligible = tasks.filter((t) => {
    if (t.status !== "queued") return false;
    if (!t.deps || t.deps.length === 0) return true;
    return t.deps.every((d) => completed.has(d));
  });

  eligible.sort((a, b) => a.priority - b.priority);
  return eligible[0] || null;
}

/**
 * @param {string} root
 * @param {string} id
 * @param {string} status
 * @param {Record<string, string|boolean|number>} [extraFields]
 */
export function setTaskStatus(root, id, status, extraFields = {}) {
  const file = path.join(root, WORK_QUEUE_FILE);
  let text = fs.readFileSync(file, "utf8");
  const marker = \`### TASK \${id}\`;
  const idx = text.indexOf(marker);
  if (idx === -1) throw new Error(\`task not found: \${id}\`);

  const nextTask = text.indexOf("\\n### TASK ", idx + marker.length);
  const end = nextTask === -1 ? text.length : nextTask;
  let block = text.slice(idx, end);

  block = replaceField(block, "status", status);
  for (const [key, value] of Object.entries(extraFields)) {
    block = replaceField(block, key, String(value));
  }

  text = text.slice(0, idx) + block + text.slice(end);
  fs.writeFileSync(file, text, "utf8");
}

export function markCompleted(root, id, commitHash) {
  setTaskStatus(root, id, "completed", {
    result_commit: commitHash,
  });
}

function replaceField(block, key, value) {
  const re = new RegExp(\`^\${key}:\\\\s*.*$\`, "m");
  if (re.test(block)) {
    return block.replace(re, \`\${key}: \${value}\`);
  }
  const firstBlank = block.indexOf("\\n\\n");
  const insertAt = firstBlank === -1 ? block.length : firstBlank;
  return (
    block.slice(0, insertAt) +
    \`\\n\${key}: \${value}\` +
    block.slice(insertAt)
  );
}
`
);

// --- scripts/safe-command-gate.mjs ---
write(
  "scripts/safe-command-gate.mjs",
  `#!/usr/bin/env node
/**
 * Evaluate shell command or SQL text for approval-boundary violations.
 * CLI: node scripts/safe-command-gate.mjs --check "command here"
 */
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";

/** @type {{ pattern: RegExp, reason: string, allow?: RegExp }[]} */
const RULES = [
  {
    pattern: new RegExp(PROD_REF, "i"),
    reason: "Production Supabase ref (rhfr***mns) blocked",
  },
  {
    pattern: /\\brhfr\\*\\*\\*mns\\b/i,
    reason: "Production environment target blocked",
  },
  {
    pattern: /git\\s+checkout\\s+main\\b/i,
    reason: "git checkout main blocked",
  },
  {
    pattern: /git\\s+merge\\s+main\\b/i,
    reason: "git merge main blocked",
  },
  {
    pattern: /vercel\\s+.*--prod\\b/i,
    reason: "vercel --prod blocked",
  },
  {
    pattern: /vercel\\s+deploy\\s+.*production/i,
    reason: "vercel production deploy blocked",
  },
  {
    pattern: /supabase\\s+link\\s+.*production/i,
    reason: "supabase production link blocked",
  },
  {
    pattern: new RegExp(\`supabase\\\\s+link\\\\s+.*\${PROD_REF}\`, "i"),
    reason: "supabase link to Production ref blocked",
  },
  {
    pattern: /\\bDROP\\s+(TABLE|DATABASE|SCHEMA|INDEX|FUNCTION)\\b/i,
    reason: "DROP statement blocked",
  },
  {
    pattern: /\\bTRUNCATE\\b/i,
    reason: "TRUNCATE blocked",
  },
  {
    pattern: /\\bDELETE\\s+FROM\\b/i,
    allow: /synthetic[-_]test|fixture|_test_|test_fixture|dry[-_]run/i,
    reason: "DELETE without synthetic-test/fixture scope blocked",
  },
  {
    pattern: /resend\\.com.*\\/emails/i,
    reason: "resend.com live send blocked",
  },
  {
    pattern: /emails\\.send\\s*\\(/i,
    allow: /dry[-_]run|mock|selftest|self-test|preview_checkin_email_test/i,
    reason: "provider live email send blocked",
  },
  {
    pattern: /RESEND_API_KEY\\s*=\\s*['"]?re_[a-zA-Z0-9]+/i,
    reason: ".env RESEND_API_KEY value dump blocked",
  },
  {
    pattern: /SUPABASE_SERVICE_ROLE_KEY\\s*=\\s*['"]?eyJ/i,
    reason: "service_role key dump blocked",
  },
  {
    pattern: /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/i,
    reason: "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY forbidden",
  },
  {
    pattern: /sk_live_[a-zA-Z0-9]+/,
    reason: "Stripe live secret in diff blocked",
  },
  {
    pattern: /console\\.log\\(.*process\\.env\\.(SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY)/i,
    reason: "logging secret env vars blocked",
  },
];

/** @type {{ pattern: RegExp, label: string }[]} */
export const ALLOW_HINTS = [
  { pattern: /^\\s*SELECT\\b/im, label: "SELECT queries" },
  {
    pattern: /GRANT\\s+(SELECT|INSERT|UPDATE)\\s+ON\\b.*\\bTO\\s+service_role/i,
    label: "GRANT to service_role",
  },
  {
    pattern: /CREATE\\s+(TABLE|INDEX|FUNCTION|OR\\s+REPLACE\\s+FUNCTION)\\b/i,
    label: "CREATE DDL (Staging migration)",
  },
  {
    pattern: /ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY|ALTER\\s+TABLE.*ENABLE\\s+RLS/i,
    label: "RLS enable",
  },
  { pattern: /\\bREVOKE\\b/i, label: "REVOKE" },
  {
    pattern: /npm\\s+run\\s+(test:|gate:|project:)/i,
    label: "local npm tests/orchestrator",
  },
  {
    pattern: /vercel\\s+(deploy|)/i,
    allowBlock: /vercel\\s+.*--prod/i,
    label: "Preview deploy (non-prod)",
  },
  {
    pattern: /git\\s+push\\s+origin\\s+(feature\\/|fix\\/)/i,
    label: "feature branch push",
  },
  {
    pattern: new RegExp(STAGING_REF, "i"),
    label: "Staging ref (jfnj***gfd)",
  },
];

/**
 * @param {string} text
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function evaluateCommandOrSql(text) {
  const reasons = [];
  const normalized = String(text || "");

  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      if (rule.allow && rule.allow.test(normalized)) continue;
      reasons.push(rule.reason);
    }
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function main() {
  const args = process.argv.slice(2);
  const checkIdx = args.indexOf("--check");
  if (checkIdx === -1) {
    console.error("Usage: node scripts/safe-command-gate.mjs --check \\"command\\"");
    process.exit(2);
  }
  const payload = args.slice(checkIdx + 1).join(" ");
  const result = evaluateCommandOrSql(payload);
  if (result.ok) {
    console.log("OK");
    process.exit(0);
  }
  console.error("BLOCKED:", result.reasons.join("; "));
  process.exit(1);
}

if (import.meta.url === \`file://\${process.argv[1]?.replace(/\\\\/g, "/")}\` ||
    process.argv[1]?.endsWith("safe-command-gate.mjs")) {
  main();
}
`
);

// --- scripts/project-state-summary.mjs ---
write(
  "scripts/project-state-summary.mjs",
  `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  loadWorkQueue,
  getActiveTask,
  getNextQueuedTask,
} from "./lib/work-queue.mjs";

const PROD_MASK = "rhfr***mns";
const STAGING_MASK = "jfnj***gfd";

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return (r.stdout || "").trim();
}

export function buildProjectStateSummary(root = process.cwd()) {
  const branch =
    run("git", ["rev-parse", "--abbrev-ref", "HEAD"]) || "(unknown)";
  const lastCommit =
    run("git", ["log", "-1", "--oneline"]) || "(no commits)";
  const gitStatus =
    run("git", ["status", "--short"]) || "(clean)";

  let tasks = [];
  try {
    tasks = loadWorkQueue(root);
  } catch {
    tasks = [];
  }

  const active = getActiveTask(tasks);
  const next = getNextQueuedTask(tasks);

  return {
    branch,
    lastCommit,
    gitStatus,
    activeTask: active,
    nextTask: next,
    protection: {
      productionRef: PROD_MASK,
      stagingRef: STAGING_MASK,
      productionWritesBlocked: true,
      mainMergeBlocked: true,
    },
  };
}

export function printProjectStateSummary(root = process.cwd()) {
  const s = buildProjectStateSummary(root);
  console.log("=== Project State ===");
  console.log("branch:", s.branch);
  console.log("last_commit:", s.lastCommit);
  console.log("git_status:", s.gitStatus.replace(/\\n/g, " | "));
  console.log(
    "active_task:",
    s.activeTask ? \`\${s.activeTask.id} (p\${s.activeTask.priority})\` : "(none)"
  );
  console.log(
    "next_queued:",
    s.nextTask ? \`\${s.nextTask.id} (p\${s.nextTask.priority})\` : "(none)"
  );
  console.log("staging:", s.protection.stagingRef, "| prod blocked:", s.protection.productionRef);
  return s;
}

if (import.meta.url.endsWith("project-state-summary.mjs")) {
  printProjectStateSummary(path.resolve(import.meta.dirname, ".."));
}
`
);

// --- scripts/verify-current-task.mjs ---
write(
  "scripts/verify-current-task.mjs",
  `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadWorkQueue, getActiveTask } from "./lib/work-queue.mjs";
import { evaluateCommandOrSql } from "./safe-command-gate.mjs";

const root = path.resolve(import.meta.dirname, "..");
const skipBuild = process.argv.includes("--skip-build");

const SECRET_PATTERNS = [
  { re: /sk_live_[a-zA-Z0-9]{8,}/, label: "sk_live secret" },
  {
    re: /eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}/,
    label: "JWT-like service_role token",
  },
  { re: /RESEND_API_KEY\\s*=\\s*re_[a-zA-Z0-9]+/, label: "RESEND_API_KEY value" },
];

function runShell(command) {
  console.log(">>", command);
  const r = spawnSync(command, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, npm_config_loglevel: "silent" },
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

function gitDiff() {
  const r = spawnSync("git", ["diff", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const unstaged = spawnSync("git", ["diff"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return (r.stdout || "") + (unstaged.stdout || "");
}

function scanSecrets(diff) {
  const hits = [];
  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(diff)) hits.push(label);
  }
  return hits;
}

export async function verifyCurrentTask(options = {}) {
  const skip = options.skipBuild ?? skipBuild;
  const tasks = loadWorkQueue(root);
  const active = getActiveTask(tasks);
  if (!active) {
    console.error("No active task in WORK_QUEUE.md");
    return { ok: false, code: 1 };
  }

  console.log("Verifying active task:", active.id);

  for (const testCmd of active.tests || []) {
    const code = runShell(testCmd);
    if (code !== 0) {
      console.error("Test failed:", testCmd);
      return { ok: false, code };
    }
  }

  if (!skip) {
    const buildCode = runShell("npm run build");
    if (buildCode !== 0) {
      console.error("Build failed (use --skip-build to skip)");
      return { ok: false, code: buildCode };
    }
  }

  const diff = gitDiff();
  const gate = evaluateCommandOrSql(diff);
  if (!gate.ok) {
    console.error("Safe gate failed on git diff:");
    for (const r of gate.reasons) console.error(" -", r);
    return { ok: false, code: 1 };
  }

  const secrets = scanSecrets(diff);
  if (secrets.length) {
    console.error("Secret pattern scan failed:", secrets.join(", "));
    return { ok: false, code: 1 };
  }

  console.log("VERIFY OK:", active.id);
  return { ok: true, code: 0, task: active };
}

if (import.meta.url.endsWith("verify-current-task.mjs")) {
  verifyCurrentTask().then((r) => process.exit(r.code));
}
`
);

// --- scripts/project-orchestrator.mjs ---
write(
  "scripts/project-orchestrator.mjs",
  `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  loadWorkQueue,
  getActiveTask,
  getNextQueuedTask,
  setTaskStatus,
  markCompleted,
} from "./lib/work-queue.mjs";
import { printProjectStateSummary } from "./project-state-summary.mjs";
import { verifyCurrentTask } from "./verify-current-task.mjs";
import { evaluateCommandOrSql } from "./safe-command-gate.mjs";

const root = path.resolve(import.meta.dirname, "..");
const cmd = process.argv[2] || "status";
const forceDocsOnly = process.argv.includes("--force-docs-only");
const doCommit = process.argv.includes("--commit");
const skipBuild = process.argv.includes("--skip-build");

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return (r.stdout || "").trim();
}

function demoteOtherActive(exceptId) {
  const tasks = loadWorkQueue(root);
  for (const t of tasks) {
    if (t.status === "active" && t.id !== exceptId) {
      setTaskStatus(root, t.id, "queued");
      console.log("Demoted previous active:", t.id);
    }
  }
}

function cmdStatus() {
  printProjectStateSummary(root);
  return 0;
}

function cmdNext() {
  const tasks = loadWorkQueue(root);
  const active = getActiveTask(tasks);
  if (active) {
    console.log("Active task already set:", active.id);
    console.log("Complete it first or use project:complete");
    return 1;
  }
  const next = getNextQueuedTask(tasks);
  if (!next) {
    console.log("No eligible queued task");
    return 0;
  }
  setTaskStatus(root, next.id, "active");
  console.log("Activated:", next.id);
  return 0;
}

async function cmdVerify() {
  const r = await verifyCurrentTask({ skipBuild });
  return r.code;
}

async function cmdComplete() {
  const tasks = loadWorkQueue(root);
  const active = getActiveTask(tasks);
  if (!active) {
    console.error("No active task to complete");
    return 1;
  }

  if (active.approval_required && !forceDocsOnly) {
    console.error(
      "Task requires approval (approval_required: true). Use --force-docs-only after explicit user approval."
    );
    return 1;
  }

  if (!forceDocsOnly) {
    const v = await verifyCurrentTask({ skipBuild });
    if (!v.ok) {
      console.error("Verify failed; not completing");
      return v.code;
    }
  }

  const hash = gitHead();
  markCompleted(root, active.id, hash);
  console.log("Completed:", active.id, "commit:", hash.slice(0, 8));
  console.log("");
  console.log("Next steps:");
  console.log("  1. Update PROJECT_STATUS.md (one-line status for this task)");
  console.log("  2. npm run project:next");
  console.log("  3. git commit (agent/manual) — orchestrator does not auto-commit by default");

  if (doCommit) {
    const commitMsg = \`complete: \${active.id}\`;
    const gate = evaluateCommandOrSql(\`git commit -m "\${commitMsg}"\`);
    if (!gate.ok) {
      console.error("Commit blocked by safe gate");
      return 1;
    }
    const add = spawnSync("git", ["add", "WORK_QUEUE.md"], {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (add.status !== 0) return add.status ?? 1;
    const c = spawnSync("git", ["commit", "-m", commitMsg], {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (c.status !== 0) {
      console.error("git commit failed (maybe nothing to commit)");
      return c.status ?? 1;
    }
    console.log("Committed WORK_QUEUE.md");
  }

  return 0;
}

function printDashboardBlock(task) {
  const file = task.dashboard_sql_file || "supabase/migrations/20260722010000_create_checkin_email_queue.sql";
  console.log("");
  console.log("=== 사람 확인 필요 (Staging Dashboard SQL) ===");
  console.log("1. Supabase Dashboard → Staging 프로젝트 (jfnj***gfd) 열기");
  console.log("2. SQL Editor → New query");
  console.log(\`3. 로컬 파일 내용 전체 복사: \${file}\`);
  console.log("4. Run 실행 (Production 아님 확인)");
  console.log("5. 완료 후: node scripts/probe-checkin-email-queue-staging.mjs");
  console.log("6. ready 나오면 npm run project:verify 재실행");
  console.log("");
}

async function cmdContinue() {
  cmdStatus();
  const tasks = loadWorkQueue(root);
  let active = getActiveTask(tasks);

  if (!active) {
    const code = cmdNext();
    if (code !== 0) return code;
    active = getActiveTask(loadWorkQueue(root));
  }

  if (active?.dashboard_sql === true || active?.dashboard_sql === "true") {
    printDashboardBlock(active);
    return 2;
  }

  return cmdVerify();
}

async function main() {
  switch (cmd) {
    case "status":
      return cmdStatus();
    case "next":
      return cmdNext();
    case "verify":
      return cmdVerify();
    case "complete":
      return cmdComplete();
    case "continue":
      return cmdContinue();
    default:
      console.error("Unknown command:", cmd);
      console.error("Usage: status | next | verify | complete | continue");
      return 2;
  }
}

main().then((code) => process.exit(code ?? 0));
`
);

// --- selftests ---
write(
  "scripts/work-queue-parser-selftest.mjs",
  `#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  parseWorkQueue,
  getActiveTask,
  getNextQueuedTask,
} from "./lib/work-queue.mjs";

const SAMPLE = \`
### TASK WQ-A-checkin-email-queue-staging
id: WQ-A-checkin-email-queue-staging
priority: 10
status: active
deps:
tests:
  - npm run test:checkin-email-queue

### TASK WQ-B-photo-compare-consent
id: WQ-B-photo-compare-consent
priority: 20
status: queued
deps: WQ-A-checkin-email-queue-staging
tests:
  - npm run test:care-data
\`;

const tasks = parseWorkQueue(SAMPLE);
assert.equal(tasks.length, 2);
assert.equal(getActiveTask(tasks).id, "WQ-A-checkin-email-queue-staging");

const pending = tasks.map((t) =>
  t.id === "WQ-A-checkin-email-queue-staging"
    ? { ...t, status: "completed" }
    : t
);
const next = getNextQueuedTask(pending);
assert.equal(next.id, "WQ-B-photo-compare-consent");

console.log("work-queue-parser-selftest OK");
`
);

write(
  "scripts/safe-command-gate-selftest.mjs",
  `#!/usr/bin/env node
import assert from "node:assert/strict";
import { evaluateCommandOrSql } from "./safe-command-gate.mjs";

const allow = [
  "SELECT * FROM checkin_email_queue LIMIT 1",
  "GRANT SELECT, INSERT, UPDATE ON TABLE public.checkin_email_queue TO service_role",
  "CREATE TABLE IF NOT EXISTS public.foo (id uuid primary key)",
  "npm run test:checkin-email-queue",
  "git push origin feature/my-branch",
  "vercel deploy",
];

for (const a of allow) {
  const r = evaluateCommandOrSql(a);
  assert.equal(r.ok, true, \`should allow: \${a} -> \${r.reasons}\`);
}

const block = [
  "supabase link --project-ref rhfrmvkjsummaylpzmns",
  "git checkout main",
  "git merge main",
  "vercel deploy --prod",
  "DROP TABLE users",
  "TRUNCATE checkin_email_queue",
  "DELETE FROM products WHERE id = 1",
  "RESEND_API_KEY=re_abc123secret",
  "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig",
];

for (const b of block) {
  const r = evaluateCommandOrSql(b);
  assert.equal(r.ok, false, \`should block: \${b}\`);
}

const allowDelete = evaluateCommandOrSql(
  "DELETE FROM synthetic_test_rows WHERE run_id = 'fixture-1'"
);
assert.equal(allowDelete.ok, true);

console.log("safe-command-gate-selftest OK");
`
);

write(
  "scripts/project-orchestrator-selftest.mjs",
  `#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseWorkQueue,
  setTaskStatus,
  getActiveTask,
  getNextQueuedTask,
} from "./lib/work-queue.mjs";
import { evaluateCommandOrSql } from "./safe-command-gate.mjs";
import { buildProjectStateSummary } from "./project-state-summary.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fes-"));
const wq = \`# tmp queue
### TASK WQ-X-one
id: WQ-X-one
priority: 1
status: active
deps:
tests:

### TASK WQ-X-two
id: WQ-X-two
priority: 2
status: queued
deps: WQ-X-one
tests:
\`;
fs.writeFileSync(path.join(tmp, "WORK_QUEUE.md"), wq, "utf8");

process.chdir(tmp);
const tasks = parseWorkQueue(wq);
assert.equal(getActiveTask(tasks).id, "WQ-X-one");

setTaskStatus(tmp, "WQ-X-one", "completed", { result_commit: "abc123" });
const updated = fs.readFileSync(path.join(tmp, "WORK_QUEUE.md"), "utf8");
assert.match(updated, /status: completed/);
assert.match(updated, /result_commit: abc123/);

const after = parseWorkQueue(updated).map((t) =>
  t.id === "WQ-X-one" ? { ...t, status: "completed" } : t
);
assert.equal(getNextQueuedTask(after).id, "WQ-X-two");

const gate = evaluateCommandOrSql("SELECT 1");
assert.equal(gate.ok, true);

const summary = buildProjectStateSummary(path.resolve(import.meta.dirname, ".."));
assert.ok(summary.protection.productionWritesBlocked);

console.log("project-orchestrator-selftest OK");
`
);

// --- probe script ---
write(
  "scripts/probe-checkin-email-queue-staging.mjs",
  `#!/usr/bin/env node
/**
 * Probe Staging checkin_email_queue (no secret prints).
 * Reports: ready | missing | permission_missing
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const root = path.resolve(import.meta.dirname, "..");

function maskRef(ref) {
  if (!ref || ref.length < 8) return "***";
  return ref.slice(0, 4) + "***" + ref.slice(-3);
}

function loadEnvFile(name) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\\r?\\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function extractRef(url) {
  const m = String(url || "").match(/https:\\/\\/([a-z0-9]+)\\.supabase\\.co/i);
  return m ? m[1] : "";
}

async function main() {
  const env = {
    ...loadEnvFile(".env.staging"),
    ...loadEnvFile(".env.local"),
  };

  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    console.log("status: missing");
    console.log("reason: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not in .env.staging");
    process.exit(1);
  }

  const ref = extractRef(url);
  if (ref === PROD_REF) {
    console.log("status: missing");
    console.log("reason: URL points to Production (blocked)");
    process.exit(1);
  }
  if (ref !== STAGING_REF) {
    console.log("status: missing");
    console.log("reason: URL ref is not Staging (" + maskRef(STAGING_REF) + ")");
    process.exit(1);
  }

  console.log("environment: staging (" + maskRef(ref) + ")");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { error: selErr } = await admin
    .from("checkin_email_queue")
    .select("id")
    .limit(1);

  if (selErr) {
    const msg = selErr.message || String(selErr);
    if (/does not exist|relation.*not found|42P01/i.test(msg)) {
      console.log("status: missing");
      console.log("reason: table checkin_email_queue not found (apply Dashboard SQL)");
      process.exit(0);
    }
    if (/permission denied|42501/i.test(msg)) {
      console.log("status: permission_missing");
      console.log("reason: service_role SELECT denied");
      process.exit(0);
    }
    console.log("status: missing");
    console.log("reason:", msg.slice(0, 120));
    process.exit(1);
  }

  console.log("status: ready");
  console.log("select: ok (limit 1)");

  const { data: claimData, error: claimErr } = await admin.rpc(
    "claim_checkin_email_jobs",
    { p_limit: 1, p_stale_seconds: 900 }
  );

  if (claimErr) {
    console.log("claim: error");
    console.log("claim_reason:", (claimErr.message || "").slice(0, 120));
    process.exit(0);
  }

  const count = Array.isArray(claimData) ? claimData.length : 0;
  console.log("claim_dry: ok");
  console.log("claim_count:", count);
  process.exit(0);
}

main().catch((e) => {
  console.error("probe failed:", e.message || e);
  process.exit(1);
});
`
);

// --- patch package.json ---
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const newScripts = {
  "project:status": "node scripts/project-orchestrator.mjs status",
  "project:next": "node scripts/project-orchestrator.mjs next",
  "project:verify": "node scripts/project-orchestrator.mjs verify",
  "project:complete": "node scripts/project-orchestrator.mjs complete",
  "project:continue": "node scripts/project-orchestrator.mjs continue",
  "test:project-orchestrator": "node scripts/project-orchestrator-selftest.mjs",
  "test:safe-command-gate": "node scripts/safe-command-gate-selftest.mjs",
  "test:work-queue": "node scripts/work-queue-parser-selftest.mjs",
};
Object.assign(pkg.scripts, newScripts);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("patched package.json");

console.log("\nDone. Run selftests next.");
