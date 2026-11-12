# GitHub Wrapped

Your year in code, told in color.

A portable **Codex + Claude Code skill** and standalone CLI that turns GitHub activity into portrait story cards, a PDF, a self-contained HTML recap, and a silent MP4. Runs locally or from a manually triggered GitHub Action. No extra AI API key is needed when your Codex or Claude Code agent writes the narrative. Standalone AI generation supports an explicitly configured provider.

**Public, private, or both. Your filters come first.** Choose repositories, owners, and metrics; excluded data stays out of the recap. Private repository names are anonymized by default.

## Quick start

Requires GitHub CLI, Python 3.10+, Node.js 22+, and FFmpeg (for video).

```sh
git clone https://github.com/IntoTheDerk/github-wrapped.git
cd github-wrapped
npm ci
npx playwright install chromium
gh auth login
python3 scripts/collect.py --username YOUR_USERNAME --year 2026 --scope public --output output/data.json
node scripts/render.mjs --input output/data.json --output output/recap --formats html,png,pdf,mp4
```

Install FFmpeg through your system package manager (`brew install ffmpeg` on macOS; `sudo apt-get install ffmpeg` on Ubuntu). On Linux, use `npx playwright install --with-deps chromium` to install browser system dependencies too.

For a synthetic preview without GitHub credentials:

```sh
python3 scripts/collect.py --demo --output output/demo.json
node scripts/render.mjs --input output/demo.json --output output/demo --formats html,png,pdf,mp4
```

## Use as an agent skill

Keep this checkout in a permanent location. Link the **whole checkout**, so the skill can find its scripts and installed dependencies:

```sh
# Codex
mkdir -p ~/.agents/skills
ln -s "$PWD" ~/.agents/skills/github-wrapped

# Claude Code
mkdir -p ~/.claude/skills
ln -s "$PWD" ~/.claude/skills/github-wrapped
```

Restart or refresh your agent's skill discovery if needed. In Codex invoke **`$github-wrapped`**; in Claude Code invoke **`/github-wrapped`**. You can also ask in plain language:

> Make my 2026 GitHub Wrapped with public and private activity. Exclude my employer's organization and forked repositories. Include commits and PRs, keep private project names anonymous, and export images, a PDF, and a video.

The agent uses your existing authorized `gh` session. Private access depends on the token's repository permissions and organization SSO authorization; missing access cannot be reconstructed from the public graph.

Installation conventions: [Codex skills](https://developers.openai.com/codex/skills), [Claude Code skills](https://code.claude.com/docs/en/skills).

## Dates and filters

The default is the **2026 calendar year**, January 1 through December 31. Future dates are capped at the collection day and labeled with the actual cutoff. Choose another year with `--year 2025`, or an inclusive custom range (including ranges spanning years):

```sh
python3 scripts/collect.py --username YOUR_USERNAME --from 2025-07-01 --to 2026-06-30 --scope all --exclude-org employer --categories commits,prs,repos --output output/custom.json
```

Supply both range bounds. Do not combine a custom range with `--year` or `--as-of`.

## Filters and exports

Use `python3 scripts/collect.py --help` for collection switches and `node scripts/render.mjs --help` for rendering switches.

- **Scope:** `public` (default), `private`, or `all`.
- **Repository filters:** include/exclude `owner/name` globs; exclusions win.
- **Owner filters:** include/exclude organizations or account owners.
- **Metrics:** commits, pull requests, issues, reviews, and repository rankings can be selected.
- **Platform evidence:** add `--include-context` to collect selected repository languages and topics for personalization.
- **Outputs:** HTML, 1080 × 1920 PNG cards, PDF, and H.264 MP4.
- **Private labels:** anonymized unless you explicitly use `--show-private-names`.

Quote globs so your shell does not expand them. Collection is read-only. Rendering requires no GitHub credentials and uses local assets.

## Run on GitHub

Fork this repository, then open **Actions → GitHub Wrapped → Run workflow**. Enter a username, year (default 2026), or both custom date bounds, and optional repository include/exclude globs. Download the `github-wrapped` artifact after the run completes.

The bundled workflow collects **public data only**, uses read-only repository permission, and expires artifacts after seven days. It never runs on a schedule or on pull requests. Actions may consume your account's runner allowance; local generation avoids hosted runner use.

For private/all recaps, run locally with an authorized account. A public repository's workflow artifacts must not be treated as private storage. Nothing is automatically committed, posted, published to Pages, or uploaded by the local CLI.

## AI that sees your engineering signature

The agent-led flow goes beyond counters: a memorable builder archetype, evidence-backed observations about your engineering habits, standout projects, and the platforms you work across. The agent can inspect selected READMEs, manifests, PRs, and representative source files to explain **why** the work is distinctive. It must separate your contributions from team, generated, and inherited code.

Personalization is interpretation, visibly labeled as such. Every conclusion cites selected evidence; no invented rankings, personality diagnoses, or claims of audited code quality. Real platform marks appear only for evidenced technologies, using a bundled allowlist. Private narratives require an explicit rendering opt-in; hiding project names alone does not sanitize prose.

See [personalization instructions and schema](references/personalization.md) for agent-written insights and optional standalone AI generation. To use AI from Actions, configure repository secret `WRAPPED_AI_API_KEY` and variables `WRAPPED_AI_ENDPOINT` (HTTPS chat-completions URL) and `WRAPPED_AI_MODEL`, then enable the personalization input. This sends the selected public evidence to your chosen provider and may incur provider charges. The default workflow makes no AI calls.

The GitHub Models API has been [retired](https://docs.github.com/en/github-models); the workflow uses your configured provider instead. No paid provider was invoked during project validation.

## What the numbers mean

GitHub contribution accounting has attribution and default-branch rules. Commit counts are contribution counts, not every commit on every branch. PRs, issues, and reviews are separate activity categories. A release PR and its integration PR can describe the same feature.

Repository-filtered totals must not be paired with an unfiltered calendar. If GitHub cannot supply a calendar for the chosen scope, the recap omits it and explains the coverage gap. Restricted private activity is not a repository-level breakdown and is never silently added to filtered totals. Large accounts and insufficient permissions can produce incomplete results; inspect the collection notes.

The recap does not invent global percentiles, hours worked, code quality scores, or features shipped. No source code, issue/PR bodies, email addresses, or credentials are needed.

## Privacy

Raw collection JSON can contain private repository names even when rendered cards anonymize them. Keep it local and out of Git. Anonymization hides labels; counts, dates, and project ordering may still reveal information. Review **every file you plan to share**. Output directories and credentials are ignored by Git.

GitHub strings are treated as untrusted text. Exclusions are applied before output, and rendering escapes text rather than interpreting it as HTML. The project requests no write access to your activity repositories.

## Development

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.mjs
```

MIT licensed. Independent community project; not affiliated with GitHub or Spotify. Original visuals, no Spotify logos, no bundled music.
