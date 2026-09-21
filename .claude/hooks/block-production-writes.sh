#!/bin/bash
# Blocks the two commands that reach production irreversibly from this repo.
# Matches anywhere in the command, so `npx`, an absolute path, a leading `cd x &&`
# or an env-var prefix do not get past it.
#
# - `vercel env pull`   writes production values into .env.local, which Next loads
#                       ahead of .env in every mode.
# - `prisma migrate reset` drops and re-seeds the database it is pointed at, and the
#                       Prisma CLI does not import the production guard in
#                       src/server/infra/prisma.ts.
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

PATTERNS=(
  'vercel([[:space:]]+[^|;&]*)?[[:space:]]+env[[:space:]]+pull'
  'prisma([[:space:]]+[^|;&]*)?[[:space:]]+migrate[[:space:]]+reset'
)

REASONS=(
  'Blocked: `vercel env pull` writes production secrets into .env.local, which Next loads ahead of .env in dev and in production-mode local runs. Read the value in the Vercel dashboard instead. See CLAUDE.md.'
  'Blocked: `prisma migrate reset` drops and re-seeds whatever database it is pointed at, and the Prisma CLI does not import the guard in src/server/infra/prisma.ts. Ask the user before touching any database this way.'
)

for i in "${!PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE "${PATTERNS[$i]}"; then
    jq -n --arg reason "${REASONS[$i]}" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }'
    exit 0
  fi
done

exit 0
