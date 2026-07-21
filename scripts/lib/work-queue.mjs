/**
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
    const lines = section.split(/\r?\n/);
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

      const listMatch = line.match(/^\s*-\s+(.*)$/);
      if (listMatch && currentList) {
        task[currentList].push(listMatch[1].trim());
        continue;
      }

      const kv = line.match(/^([a-z_]+):\s*(.*)$/);
      if (!kv) {
        currentList = null;
        continue;
      }

      const [, key, rawVal] = kv;
      const val = rawVal.trim();

      if (key === "tests" || key === "deps") {
        currentList = key;
        if (val) {
          task[key].push(...val.split(/,\s*/).filter(Boolean));
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
  const marker = `### TASK ${id}`;
  const idx = text.indexOf(marker);
  if (idx === -1) throw new Error(`task not found: ${id}`);

  const nextTask = text.indexOf("\n### TASK ", idx + marker.length);
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
  const re = new RegExp(`^${key}:\\s*.*$`, "m");
  if (re.test(block)) {
    return block.replace(re, `${key}: ${value}`);
  }
  const firstBlank = block.indexOf("\n\n");
  const insertAt = firstBlank === -1 ? block.length : firstBlank;
  return (
    block.slice(0, insertAt) +
    `\n${key}: ${value}` +
    block.slice(insertAt)
  );
}
