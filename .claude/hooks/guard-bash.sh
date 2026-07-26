#!/usr/bin/env bash
# PreToolUse guard for Bash commands.
# Blocks: push/merge to main, force push, reset --hard, rm -rf,
# Production deploy commands, and destructive SQL keywords.
# Emits a PreToolUse deny decision as JSON when a match is found;
# otherwise exits silently so normal permission rules apply.

cmd="$(node -e '
let d="";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(d || "{}");
    process.stdout.write(String((input.tool_input && input.tool_input.command) || ""));
  } catch (e) {
    process.stdout.write("");
  }
});
')"
lc="$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')"

reason=""

if printf '%s' "$lc" | grep -qE 'git[[:space:]]+push'; then
  if printf '%s' "$lc" | grep -qE '(^|[[:space:]])(--force|-f)([[:space:]]|$)'; then
    reason="force push (git push --force/-f) is blocked by project safety policy"
  elif printf '%s' "$lc" | grep -qE '(^|[[:space:]])(origin|upstream)?[[:space:]]*main(:|[[:space:]]|$)'; then
    reason="push to main is blocked by project safety policy"
  fi
fi

if [ -z "$reason" ] && printf '%s' "$lc" | grep -qE 'git[[:space:]]+merge'; then
  if printf '%s' "$lc" | grep -qE '(^|[[:space:]])(origin/)?main([[:space:]]|$)'; then
    reason="merge into main is blocked by project safety policy"
  fi
fi

if [ -z "$reason" ] && printf '%s' "$lc" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard'; then
  reason="git reset --hard is blocked by project safety policy"
fi

if [ -z "$reason" ] && printf '%s' "$lc" | grep -qE 'rm[[:space:]]+(-[a-z]*[rf][a-z]*[rf]?[a-z]*[[:space:]]|--recursive[[:space:]].*--force|--force[[:space:]].*--recursive)'; then
  reason="rm -rf is blocked by project safety policy"
fi

if [ -z "$reason" ] && printf '%s' "$lc" | grep -qE 'vercel[[:space:]]+(deploy[[:space:]]+)?--prod'; then
  reason="Production deploy command is blocked by project safety policy"
fi

if [ -z "$reason" ] && printf '%s' "$lc" | grep -qE '(drop[[:space:]]+table|drop[[:space:]]+database|truncate[[:space:]]+table|delete[[:space:]]+from)'; then
  reason="destructive SQL (DROP/TRUNCATE/DELETE FROM) is blocked by project safety policy"
fi

if [ -n "$reason" ]; then
  esc_reason=$(printf '%s' "$reason" | sed 's/\\/\\\\/g; s/"/\\"/g')
  esc_cmd=$(printf '%s' "$cmd" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s. Command: %s"}}\n' "$esc_reason" "$esc_cmd"
fi
