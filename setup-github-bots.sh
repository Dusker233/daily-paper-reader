#!/usr/bin/env bash
set -euo pipefail

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd bash
need_cmd python3
need_cmd openssl
need_cmd curl
need_cmd gh

BOT_CONFIG_DIR="$HOME/.config/claude-bots"
BIN_DIR="$HOME/bin"

mkdir -p "$BOT_CONFIG_DIR" "$BIN_DIR"

prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local default_value="${3:-}"
  local value

  if [[ -n "$default_value" ]]; then
    read -r -p "$prompt_text [$default_value]: " value
    value="${value:-$default_value}"
  else
    read -r -p "$prompt_text: " value
  fi

  printf -v "$var_name" '%s' "$value"
}

confirm() {
  local prompt_text="$1"
  local answer
  read -r -p "$prompt_text [y/N]: " answer
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]
}

echo
echo "============================================================"
echo " Claude Code dual-bot interactive setup"
echo "============================================================"
echo
echo "This setup creates two local Claude Code launchers:"
echo "  - cc-reviewer"
echo "  - cc-implementer"
echo
echo "Each launcher uses a different GitHub App identity."
echo
echo "IMPORTANT:"
echo "  You do NOT need to manually create or save a long-lived GitHub token."
echo
echo "  This setup uses:"
echo "    1) APP_ID"
echo "    2) INSTALLATION_ID"
echo "    3) GitHub App private key (.pem)"
echo
echo "  At runtime, the scripts automatically generate:"
echo "    - a JWT"
echo "    - a short-lived installation access token"
echo
echo "What you need to prepare for EACH GitHub App:"
echo
echo "  APP_ID"
echo "    GitHub -> Settings -> Developer settings -> GitHub Apps -> your app"
echo
echo "  PRIVATE KEY (.pem)"
echo "    In the GitHub App settings page:"
echo "    Private keys -> Generate a private key"
echo
echo "  INSTALLATION_ID"
echo "    Install the app to your account or organization first."
echo "    Then open the installed app / configure page and find the installation ID."
echo
echo "If the app is installed on ALL repositories under one owner/org,"
echo "the same installation can generally be reused for repos under that installation."
echo
echo "This script writes:"
echo "  Global files:"
echo "    ~/.config/claude-bots/"
echo "    ~/bin/"
echo
echo "  Project files:"
echo "    .claude/settings.local.json"
echo "    .claude/agents/reviewer.md"
echo "    .claude/agents/implementer.md"
echo "    CLAUDE.md"
echo "    .gitignore updates"
echo
echo "============================================================"
echo

DEFAULT_REPO_DIR="$(pwd)"
prompt REPO_DIR "Repository directory" "$DEFAULT_REPO_DIR"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "Repository directory does not exist: $REPO_DIR" >&2
  exit 1
fi

mkdir -p "$REPO_DIR/.claude/agents"

echo
echo "---------------- Reviewer App ----------------"
prompt REVIEWER_APP_ID "Reviewer APP_ID"
prompt REVIEWER_INSTALLATION_ID "Reviewer INSTALLATION_ID"
prompt REVIEWER_PRIVATE_KEY_SOURCE "Reviewer private key path (.pem)"

if [[ ! -f "$REVIEWER_PRIVATE_KEY_SOURCE" ]]; then
  echo "Reviewer private key not found: $REVIEWER_PRIVATE_KEY_SOURCE" >&2
  exit 1
fi

echo
echo "-------------- Implementer App ---------------"
prompt IMPLEMENTER_APP_ID "Implementer APP_ID"
prompt IMPLEMENTER_INSTALLATION_ID "Implementer INSTALLATION_ID"
prompt IMPLEMENTER_PRIVATE_KEY_SOURCE "Implementer private key path (.pem)"

if [[ ! -f "$IMPLEMENTER_PRIVATE_KEY_SOURCE" ]]; then
  echo "Implementer private key not found: $IMPLEMENTER_PRIVATE_KEY_SOURCE" >&2
  exit 1
fi

echo
echo "---------------- Default Models --------------"
prompt DEFAULT_REVIEWER_MODEL "Default reviewer model" "opus"
prompt DEFAULT_IMPLEMENTER_MODEL "Default implementer model" "sonnet"

REVIEWER_ENV="$BOT_CONFIG_DIR/reviewer.env"
IMPLEMENTER_ENV="$BOT_CONFIG_DIR/implementer.env"
REVIEWER_PEM="$BOT_CONFIG_DIR/reviewer-app.pem"
IMPLEMENTER_PEM="$BOT_CONFIG_DIR/implementer-app.pem"

REPO_CLAUDE_DIR="$REPO_DIR/.claude"
REPO_AGENTS_DIR="$REPO_CLAUDE_DIR/agents"
REPO_LOCAL_SETTINGS="$REPO_CLAUDE_DIR/settings.local.json"
REPO_CLAUDE_MD="$REPO_DIR/CLAUDE.md"
REPO_GITIGNORE="$REPO_DIR/.gitignore"

echo
echo "==================== Summary ===================="
echo "REPO_DIR=$REPO_DIR"
echo
echo "Reviewer:"
echo "  APP_ID=$REVIEWER_APP_ID"
echo "  INSTALLATION_ID=$REVIEWER_INSTALLATION_ID"
echo "  PRIVATE_KEY_SOURCE=$REVIEWER_PRIVATE_KEY_SOURCE"
echo
echo "Implementer:"
echo "  APP_ID=$IMPLEMENTER_APP_ID"
echo "  INSTALLATION_ID=$IMPLEMENTER_INSTALLATION_ID"
echo "  PRIVATE_KEY_SOURCE=$IMPLEMENTER_PRIVATE_KEY_SOURCE"
echo
echo "Default models:"
echo "  reviewer=$DEFAULT_REVIEWER_MODEL"
echo "  implementer=$DEFAULT_IMPLEMENTER_MODEL"
echo "================================================="
echo

confirm "Proceed with setup?" || exit 1

cp "$REVIEWER_PRIVATE_KEY_SOURCE" "$REVIEWER_PEM"
cp "$IMPLEMENTER_PRIVATE_KEY_SOURCE" "$IMPLEMENTER_PEM"
chmod 600 "$REVIEWER_PEM" "$IMPLEMENTER_PEM"

cat > "$REVIEWER_ENV" <<EOF
APP_ID=$REVIEWER_APP_ID
INSTALLATION_ID=$REVIEWER_INSTALLATION_ID
PRIVATE_KEY_PATH=$REVIEWER_PEM
REPO_DIR=$REPO_DIR
EOF

cat > "$IMPLEMENTER_ENV" <<EOF
APP_ID=$IMPLEMENTER_APP_ID
INSTALLATION_ID=$IMPLEMENTER_INSTALLATION_ID
PRIVATE_KEY_PATH=$IMPLEMENTER_PEM
REPO_DIR=$REPO_DIR
EOF

chmod 600 "$REVIEWER_ENV" "$IMPLEMENTER_ENV"

cat > "$BIN_DIR/gh-app-token" <<'EOF'
#!/usr/bin/env bash
# This script does NOT use a static long-lived GitHub token.
# It generates:
#   1) a JWT signed with the GitHub App private key
#   2) a short-lived installation access token
#
# Inputs:
#   APP_ID
#   INSTALLATION_ID
#   PRIVATE_KEY_PATH
#
# Usage:
#   gh-app-token APP_ID INSTALLATION_ID PRIVATE_KEY_PATH

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: gh-app-token APP_ID INSTALLATION_ID PRIVATE_KEY_PATH" >&2
  exit 1
fi

APP_ID="$1"
INSTALLATION_ID="$2"
PRIVATE_KEY_PATH="$3"

if [[ ! -f "$PRIVATE_KEY_PATH" ]]; then
  echo "private key not found: $PRIVATE_KEY_PATH" >&2
  exit 1
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

need_cmd openssl
need_cmd curl
need_cmd python3

b64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

NOW=$(date +%s)
IAT=$((NOW - 60))
EXP=$((NOW + 540))

HEADER='{"alg":"RS256","typ":"JWT"}'
PAYLOAD="{\"iat\":${IAT},\"exp\":${EXP},\"iss\":\"${APP_ID}\"}"

HEADER_B64=$(printf '%s' "$HEADER" | b64url)
PAYLOAD_B64=$(printf '%s' "$PAYLOAD" | b64url)
UNSIGNED="${HEADER_B64}.${PAYLOAD_B64}"

SIGNATURE_B64=$(
  printf '%s' "$UNSIGNED" \
    | openssl dgst -binary -sha256 -sign "$PRIVATE_KEY_PATH" \
    | b64url
)

JWT="${UNSIGNED}.${SIGNATURE_B64}"

TOKEN_JSON=$(
  curl -fsSL \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${JWT}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens"
)

python3 - <<'PY' "$TOKEN_JSON"
import json, sys
print(json.loads(sys.argv[1])["token"])
PY
EOF

cat > "$BIN_DIR/github-app-common.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

load_app_env() {
  local env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    echo "env file not found: $env_file" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$env_file"
}

refresh_app_token() {
  GH_TOKEN="$("$HOME/bin/gh-app-token" "$APP_ID" "$INSTALLATION_ID" "$PRIVATE_KEY_PATH")"
  export GH_TOKEN
  export GITHUB_TOKEN="$GH_TOKEN"
}

setup_git_askpass() {
  local askpass
  askpass="$(mktemp)"
  chmod 700 "$askpass"

  cat > "$askpass" <<'EOS'
#!/usr/bin/env bash
case "$1" in
  *Username*) echo "x-access-token" ;;
  *Password*) echo "${GITHUB_TOKEN}" ;;
  *) echo ;;
esac
EOS

  export GIT_ASKPASS="$askpass"
  export GIT_TERMINAL_PROMPT=0
  export GCM_INTERACTIVE=Never

  ASKPASS_FILE="$askpass"
}

cleanup_git_askpass() {
  if [[ -n "${ASKPASS_FILE:-}" && -f "${ASKPASS_FILE:-}" ]]; then
    rm -f "$ASKPASS_FILE"
  fi
}
EOF

cat > "$BIN_DIR/ghr" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
source "$HOME/bin/github-app-common.sh"
load_app_env "$HOME/.config/claude-bots/reviewer.env"
refresh_app_token
exec gh "$@"
EOF

cat > "$BIN_DIR/gitr" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
source "$HOME/bin/github-app-common.sh"
load_app_env "$HOME/.config/claude-bots/reviewer.env"
refresh_app_token
setup_git_askpass
trap cleanup_git_askpass EXIT
exec git "$@"
EOF

cat > "$BIN_DIR/ghi" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
source "$HOME/bin/github-app-common.sh"
load_app_env "$HOME/.config/claude-bots/implementer.env"
refresh_app_token
exec gh "$@"
EOF

cat > "$BIN_DIR/giti" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
source "$HOME/bin/github-app-common.sh"
load_app_env "$HOME/.config/claude-bots/implementer.env"
refresh_app_token
setup_git_askpass
trap cleanup_git_askpass EXIT
exec git "$@"
EOF

cat > "$BIN_DIR/cc-reviewer" <<EOF
#!/usr/bin/env bash
set -euo pipefail

source "$REVIEWER_ENV"

export PATH="\$HOME/bin:\$PATH"
export CLAUDE_GITHUB_ROLE=reviewer

cd "\$REPO_DIR"

DEFAULT_MODEL="\${CC_DEFAULT_REVIEWER_MODEL:-$DEFAULT_REVIEWER_MODEL}"

if [[ \$# -gt 0 && "\$1" != -* ]]; then
  MODEL="\$1"
  shift
else
  MODEL="\${CC_MODEL:-\$DEFAULT_MODEL}"
fi

echo "[cc-reviewer] role=reviewer model=\$MODEL repo=\$REPO_DIR" >&2

exec claude --model "\$MODEL" "\$@"
EOF

cat > "$BIN_DIR/cc-implementer" <<EOF
#!/usr/bin/env bash
set -euo pipefail

source "$IMPLEMENTER_ENV"

export PATH="\$HOME/bin:\$PATH"
export CLAUDE_GITHUB_ROLE=implementer

cd "\$REPO_DIR"

DEFAULT_MODEL="\${CC_DEFAULT_IMPLEMENTER_MODEL:-$DEFAULT_IMPLEMENTER_MODEL}"

if [[ \$# -gt 0 && "\$1" != -* ]]; then
  MODEL="\$1"
  shift
else
  MODEL="\${CC_MODEL:-\$DEFAULT_MODEL}"
fi

echo "[cc-implementer] role=implementer model=\$MODEL repo=\$REPO_DIR" >&2

exec claude --model "\$MODEL" "\$@"
EOF

cat > "$BIN_DIR/enforce-github-wrappers.py" <<'EOF'
#!/usr/bin/env python3
import json
import os
import shlex
import sys

def deny(message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(2)

def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if payload.get("tool_name") != "Bash":
        sys.exit(0)

    tool_input = payload.get("tool_input", {}) or {}
    command = tool_input.get("command", "") or ""
    role = os.environ.get("CLAUDE_GITHUB_ROLE", "").strip()

    if not command.strip():
        sys.exit(0)

    try:
        parts = shlex.split(command, posix=True)
    except Exception:
        stripped = command.lstrip()
        if stripped.startswith("gh "):
            deny("Direct gh is blocked. Use ghr in reviewer sessions or ghi in implementer sessions.")
        if stripped.startswith("git "):
            deny("Direct git is blocked. Use gitr in reviewer sessions or giti in implementer sessions.")
        sys.exit(0)

    if not parts:
        sys.exit(0)

    exe = parts[0]

    allowed_for_role = {
        "reviewer": {"ghr", "gitr"},
        "implementer": {"ghi", "giti"},
    }

    if exe == "gh":
        if role == "reviewer":
            deny("Direct gh is blocked in reviewer sessions. Use ghr instead.")
        elif role == "implementer":
            deny("Direct gh is blocked in implementer sessions. Use ghi instead.")
        else:
            deny("Direct gh is blocked. Use a role-specific wrapper.")

    if exe == "git":
        if role == "reviewer":
            deny("Direct git is blocked in reviewer sessions. Use gitr instead.")
        elif role == "implementer":
            deny("Direct git is blocked in implementer sessions. Use giti instead.")
        else:
            deny("Direct git is blocked. Use a role-specific wrapper.")

    if role in allowed_for_role:
        all_wrappers = {"ghr", "gitr", "ghi", "giti"}
        if exe in all_wrappers and exe not in allowed_for_role[role]:
            if role == "reviewer":
                deny("Wrong wrapper for reviewer session. Use only ghr and gitr.")
            else:
                deny("Wrong wrapper for implementer session. Use only ghi and giti.")

    sys.exit(0)

if __name__ == "__main__":
    main()
EOF

chmod 700 \
  "$BIN_DIR/gh-app-token" \
  "$BIN_DIR/github-app-common.sh" \
  "$BIN_DIR/ghr" \
  "$BIN_DIR/gitr" \
  "$BIN_DIR/ghi" \
  "$BIN_DIR/giti" \
  "$BIN_DIR/cc-reviewer" \
  "$BIN_DIR/cc-implementer" \
  "$BIN_DIR/enforce-github-wrappers.py"

cat > "$REPO_LOCAL_SETTINGS" <<EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 $BIN_DIR/enforce-github-wrappers.py"
          }
        ]
      }
    ]
  }
}
EOF

cat > "$REPO_CLAUDE_MD" <<'EOF'
- reviewer is responsible for PR review, inline comments, checking Actions status, and merging approved PRs.
- implementer is responsible for code changes, commit, push, opening PRs, checking Actions failures, and fixing workflows when needed.
- reviewer should not make code changes unless explicitly requested.
- implementer should not merge its own PR unless explicitly instructed.
- use role-specific wrappers for all GitHub-related commands.
EOF

cat > "$REPO_AGENTS_DIR/reviewer.md" <<'EOF'
---
name: reviewer
description: Review pull requests, inspect Actions results, leave comments, and merge clean PRs.
model: inherit
tools: Bash, Read, Grep, Glob
---

You are the reviewer agent.

Always use:
- ghr for GitHub CLI commands
- gitr for git commands

Never use bare gh or bare git.
If a command is blocked by a hook, retry using the correct wrapper.
EOF

cat > "$REPO_AGENTS_DIR/implementer.md" <<'EOF'
---
name: implementer
description: Implement changes, commit, push, open PRs, inspect failing Actions runs, and fix workflows when needed.
model: inherit
tools: Bash, Read, Edit, Write, Grep, Glob
---

You are the implementer agent.

Always use:
- ghi for GitHub CLI commands
- giti for git commands

Never use bare gh or bare git.
If a command is blocked by a hook, retry using the correct wrapper.
EOF

touch "$REPO_GITIGNORE"

append_if_missing() {
  local line="$1"
  if ! grep -Fxq "$line" "$REPO_GITIGNORE"; then
    echo "$line" >> "$REPO_GITIGNORE"
  fi
}

append_if_missing ""
append_if_missing "# Claude / GitHub App local sensitive files"
append_if_missing ".claude/settings.local.json"
append_if_missing "*.pem"
append_if_missing "*.key"
append_if_missing "*.p12"
append_if_missing "*.pfx"
append_if_missing "*.crt"
append_if_missing "*.cer"
append_if_missing "*.token"
append_if_missing "*.tokens"
append_if_missing "reviewer.env"
append_if_missing "implementer.env"
append_if_missing "reviewer.token"
append_if_missing "implementer.token"
append_if_missing "secrets/"
append_if_missing "private/"
append_if_missing "keys/"

SHELL_RC="$HOME/.zshrc"
if [[ -n "${BASH_VERSION:-}" ]]; then
  SHELL_RC="$HOME/.bashrc"
fi

touch "$SHELL_RC"
if ! grep -Fq 'export PATH="$HOME/bin:$PATH"' "$SHELL_RC"; then
  {
    echo ''
    echo '# Claude dual-bot tools'
    echo 'export PATH="$HOME/bin:$PATH"'
    echo "export CC_DEFAULT_REVIEWER_MODEL=\"$DEFAULT_REVIEWER_MODEL\""
    echo "export CC_DEFAULT_IMPLEMENTER_MODEL=\"$DEFAULT_IMPLEMENTER_MODEL\""
  } >> "$SHELL_RC"
fi

echo
echo "============================================================"
echo " Setup complete"
echo "============================================================"
echo
echo "What was created:"
echo "  Global:"
echo "    $REVIEWER_ENV"
echo "    $IMPLEMENTER_ENV"
echo "    $REVIEWER_PEM"
echo "    $IMPLEMENTER_PEM"
echo "    $BIN_DIR/gh-app-token"
echo "    $BIN_DIR/github-app-common.sh"
echo "    $BIN_DIR/ghr"
echo "    $BIN_DIR/gitr"
echo "    $BIN_DIR/ghi"
echo "    $BIN_DIR/giti"
echo "    $BIN_DIR/cc-reviewer"
echo "    $BIN_DIR/cc-implementer"
echo "    $BIN_DIR/enforce-github-wrappers.py"
echo
echo "  Project:"
echo "    $REPO_LOCAL_SETTINGS"
echo "    $REPO_CLAUDE_MD"
echo "    $REPO_AGENTS_DIR/reviewer.md"
echo "    $REPO_AGENTS_DIR/implementer.md"
echo "    $REPO_GITIGNORE"
echo
echo "Next:"
echo "  source \"$SHELL_RC\""
echo "  cd \"$REPO_DIR\""
echo "  cc-reviewer"
echo "  cc-implementer"
echo
echo "Manual model override examples:"
echo "  cc-reviewer opus"
echo "  cc-implementer sonnet"
echo
echo "Reminder:"
echo "  This setup does NOT store a long-lived GitHub token."
echo "  It dynamically generates short-lived installation tokens from:"
echo "    APP_ID + INSTALLATION_ID + .pem"
echo
echo "============================================================"
echo
