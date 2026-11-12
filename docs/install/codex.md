# Install in Codex

GitHub Wrapped is a portable agent skill, not an MCP server. Install the complete checkout so scripts and dependencies remain available.

```sh
git clone https://github.com/IntoTheDerk/github-wrapped.git
cd github-wrapped
npm ci
npx playwright install chromium
# Also install Python 3.10+, Node 22+, gh and ffmpeg with your package manager.
gh auth login
mkdir -p ~/.agents/skills
ln -s "$PWD" ~/.agents/skills/github-wrapped
```

If the destination already exists, inspect it before replacing it. Keep the checkout at this path. Refresh/restart Codex, then invoke:

```text
$github-wrapped Make IntoTheDerk's 2026 recap, public and private separately, with AI insights, PNG, PDF, HTML and MP4. Keep private names anonymous and all private exports local.
```

The default period is January 1–December 31, 2026, capped at the actual collection date. Private access depends on this GitHub credential, including organization authorization. A restricted count without repository details is an access gap, not zero private activity. The skill does not install extra paid AI services.

To test discovery in a fresh terminal session:

```sh
codex exec 'Use $github-wrapped to generate a synthetic demo into output/codex-install-check. Read the installed skill, author example insights clearly labeled DEMO, render HTML/PNG/PDF/MP4, and report coverage. Do not publish or change credentials.'
```

Review the exports and terminal result. A passing script test alone does not prove skill discovery or agent orchestration.
