# End-to-end verification

On November 12, 2026, fresh local sessions tested the installed skill against real 2026 GitHub activity.

| Runtime | Discovery and public recap | CLI private collection |
| --- | --- | --- |
| Codex 0.163.0, GPT-6.1 Sol, low effort | Passed; agent-authored narrative, HTML, PNG, PDF and MP4 | Exports succeeded; credential restricted repository-level private details |
| Claude Code, Claude Opus 5.5, configured effort | Passed; agent-authored narrative, HTML, PNG, PDF and MP4 | Exports succeeded; same credential restriction accurately reported |

These tests exercised native skill installation, not just the standalone scripts. The sessions used the installed `~/.agents/skills/github-wrapped` and `~/.claude/skills/github-wrapped` links. Private collection with insufficient permissions is **not full private-data qualification**.

The parent Codex session separately collected the user's authorized private authored-PR history through the connected GitHub account. It paginated date-bounded searches, deduplicated PR URLs, and generated an anonymized PR-only recap. Unavailable private commits, issues and reviews were omitted and disclosed. Personal reports and execution logs remain local, ignored, and outside this repository's tracked files.

Claude Code's independent test found two bugs: the renderer's CLI guard did not resolve installed symlinks, and Chromium/FFmpeg outputs inherited broader file permissions. Both are fixed with regression checks. The renderer now resolves the CLI path and sets successful PDF/MP4 exports to owner-only mode. Tests also cover a visible PR-only coverage disclosure.

No extra provider API was used for narration. Agent usage remains subject to the user's Codex/Claude plan. Re-run these checks on your own account; results depend on permissions, available runtimes and dependencies.
