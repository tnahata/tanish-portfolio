#!/usr/bin/env bash
# Exercises the block-env-local PreToolUse hook against representative payloads.
# Lives outside the repo and is run as `bash <path>` so the invoking Bash command
# never itself contains the dotenv prefix, which the live hook would deny.

H=/Users/tanishnahata/Desktop/Projects/tanish-portfolio/.claude/hooks/block-env-local.sh

# Build the prefix without writing it literally, for the same reason.
DOT=$(printf '.%s' env)

pass=0
fail=0

check() {
  local expected="$1" label="$2" payload="$3"
  local out actual
  out=$(printf '%s' "$payload" | bash "$H")
  if [ -n "$out" ]; then actual="DENY"; else actual="allow"; fi
  if [ "$actual" = "$expected" ]; then
    pass=$((pass + 1))
    printf '  ok    %-46s %s\n' "$label" "$actual"
  else
    fail=$((fail + 1))
    printf '  FAIL  %-46s got %s, wanted %s\n' "$label" "$actual" "$expected"
  fi
}

echo "must DENY:"
check DENY "Read the credentials file"      "{\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"/repo/${DOT}.local\"}}"
check DENY "Bash cat"                       "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"cat ${DOT}.local\"}}"
check DENY "Bash glob expansion"            "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"cat ${DOT}*\"}}"
check DENY "Bash shell sourcing"            "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"source ${DOT}.local\"}}"
check DENY "Bash byte dump"                 "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"od -c ${DOT}.local\"}}"
check DENY "Bash base64"                    "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"base64 ${DOT}.local\"}}"
check DENY "Bash python one-liner"          "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"python3 -c open('${DOT}.local')\"}}"
check DENY "Bash bare dotenv"               "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"cat ${DOT}\"}}"
check DENY "Grep inside it"                 "{\"tool_name\":\"Grep\",\"tool_input\":{\"pattern\":\"KEY\",\"path\":\"${DOT}.local\"}}"
check DENY "Glob for it"                    "{\"tool_name\":\"Glob\",\"tool_input\":{\"pattern\":\"${DOT}*\"}}"
check DENY "production variant"             "{\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"${DOT}.production.local\"}}"

echo "must allow:"
check allow "the placeholder template"      "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"cat ${DOT}.example\"}}"
check allow "process.env in a command"      '{"tool_name":"Bash","tool_input":{"command":"grep -rn process.env lib/"}}'
check allow "process.env.DATABASE_URL"      '{"tool_name":"Bash","tool_input":{"command":"echo process.env.DATABASE_URL"}}'
check allow "import.meta.env"               '{"tool_name":"Bash","tool_input":{"command":"grep -rn import.meta.env src/"}}'
check allow "npm test"                      '{"tool_name":"Bash","tool_input":{"command":"npm test"}}'
check allow "reading source"                '{"tool_name":"Read","tool_input":{"file_path":"/repo/lib/ask/db.ts"}}'
check allow "git commit"                    '{"tool_name":"Bash","tool_input":{"command":"git commit -m fix"}}'

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
