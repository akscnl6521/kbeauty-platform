#!/usr/bin/env bash
# PreToolUse guard for Edit/Write.
# Blocks: writes to .env* files, and hardcoded Supabase service-role
# keys / generic secret-looking API keys inside file content.
# Emits a PreToolUse deny decision as JSON when a match is found;
# otherwise exits silently so normal permission rules apply.

parsed="$(node -e '
let d="";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(d || "{}");
    const ti = input.tool_input || {};
    const filePath = ti.file_path || "";
    const content = ti.content || ti.new_string || "";
    process.stdout.write(JSON.stringify({ filePath, content }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ filePath: "", content: "" }));
  }
});
')"

file_path="$(printf '%s' "$parsed" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{process.stdout.write(JSON.parse(d).filePath||"")}catch(e){}})')"
content="$(printf '%s' "$parsed" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{process.stdout.write(JSON.parse(d).content||"")}catch(e){}})')"

reason=""

base="$(basename -- "$file_path" 2>/dev/null)"
case "$base" in
  .env|.env.local|.env.production|.env.*)
    reason="editing $file_path is blocked by project safety policy (.env files)"
    ;;
esac

if [ -z "$reason" ]; then
  if printf '%s' "$content" | grep -qE 'SUPABASE_SERVICE_ROLE_KEY[[:space:]]*[:=][[:space:]]*["'"'"']?ey[A-Za-z0-9_-]{20,}'; then
    reason="hardcoded Supabase service role key detected in code"
  elif printf '%s' "$content" | grep -qiE '(service_role|api[_-]?key|secret[_-]?key)[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_\.-]{20,}["'"'"']'; then
    reason="hardcoded API/secret key detected in code"
  fi
fi

if [ -n "$reason" ]; then
  esc_reason=$(printf '%s' "$reason" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$esc_reason"
fi
