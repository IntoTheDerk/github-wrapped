# Install in Claude Code

GitHub Wrapped uses Claude Code's native skills system. No MCP server or paid provider API is required: Claude writes the personalized observations itself.

```sh
git clone https://github.com/IntoTheDerk/github-wrapped.git
cd github-wrapped
npm ci
npx playwright install chromium
# Also install Python 3.10+, Node 22+, gh and ffmpeg with your package manager.
gh auth login
mkdir -p ~/.claude/skills
ln -s "$PWD" ~/.claude/skills/github-wrapped
```

Inspect an existing destination before changing it. Keep the checkout in place. Start a fresh Claude Code session and invoke:

```text
/github-wrapped Make IntoTheDerk's 2026 recap, public and private separately, with AI insights, PNG, PDF, HTML and MP4. Keep private names anonymous and private exports local.
```

Allow the read-only GitHub queries and local writes when prompted. Do not paste credentials into the chat. Missing repository access must be reported rather than filled in from guesses. Private narrative rendering requires the explicit `--include-private-insights` flag; anonymized names do not guarantee confidential prose is safe to share.

For a noninteractive discovery test, run `claude -p` with the same request and grant only the required local command/file permissions. Inspect its actual outputs and result; installing a symlink alone is not an end-to-end test.

The default is the 2026 calendar year; use inclusive `--from` / `--to` for other periods. See [the project README](../../README.md) for filters, prerequisites and exports.
