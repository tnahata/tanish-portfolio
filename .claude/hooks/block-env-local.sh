#!/usr/bin/env bash
#
# PreToolUse hook: refuse any tool call that touches a real dotenv file.
#
# .env.local holds live credentials (DATABASE_URL, VOYAGE_API_KEY). Nothing the
# assistant does needs their values: code reads them from process.env at runtime,
# and a missing variable already fails loudly with its own message. So the safe
# rule is total, not selective.
#
# The check is deliberately blunt. It denies when the tool input mentions `.env`
# at all, after removing mentions of `.env.example`, which is a committed template
# holding only placeholder keys. Matching the literal `.env.local` alone would be
# defeated by a glob (`cat .env*`), by a bare `.env`, or by any future dotenv
# variant, and this hook is worth more as a wall than as a clever filter.
#
# Consequence worth knowing: a Bash command that merely mentions `.env` in passing,
# such as a heredoc writing documentation about it, is also denied. That is the
# intended direction of the tradeoff. Editing docs through Write and Edit still
# works, since those tools are not matched.

set -uo pipefail

input=$(cat)

# tostring flattens the whole tool_input object, so this sees a Read file_path, a
# Bash command, a Grep pattern, and a Glob path without special-casing each tool.
payload=$(printf '%s' "$input" | jq -r '.tool_input // {} | tostring' 2>/dev/null)

# jq failed or gave us nothing useful: fall back to scanning the raw stdin rather
# than allowing the call through unchecked. Failing closed is the whole point.
if [ -z "$payload" ]; then
  payload="$input"
fi

# Remove the phrases that legitimately contain the dotenv prefix before testing.
# `process.env` and `import.meta.env` are how code reads these variables at
# runtime and appear all over a Next.js repo, so leaving them in would deny most
# ordinary commands. `.env.example` is a committed template of placeholder keys.
scrubbed=${payload//.env.example/}
scrubbed=${scrubbed//process.env/}
scrubbed=${scrubbed//import.meta.env/}

if printf '%s' "$scrubbed" | grep -q '\.env'; then
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Blocked by the block-env-local hook. Dotenv files in this repo hold live credentials and are never readable by any tool. Do not try another command, another tool, or an indirect path: they are all denied. If you need to know whether a variable is set, check that behaviour in code rather than reading the file, and ask the user to confirm the value themselves. Only .env.example, which holds placeholders, is permitted."
  }
}
JSON
  exit 0
fi

exit 0
