# Evidence-linked personalization

Generate observations in the agent already running the skill, or use the optional provider-neutral helper. No paid API is called by installation or ordinary rendering. API execution requires an explicit HTTPS chat-completions endpoint, model, and `WRAPPED_AI_API_KEY` environment variable. The provider receives selected context and may charge for requests; never send private context without the user's authorization. This is not GitHub Models integration.

Create a local prompt without a network call:

```sh
python3 scripts/personalize.py --input output/report.json --output output/prompt.txt --prompt-only
```

For private/all reports, add `--allow-private` only after authorization. Private repository names are replaced by aliases even with that flag. Language/topic metadata can still reveal project context. Review the prompt before sending. Selected metric counts and public repository names remain visible.

Call an explicitly chosen compatible provider:

```sh
python3 scripts/personalize.py --input output/report.json --output output/insights.json \
  --endpoint https://YOUR-PROVIDER.example/v1/chat/completions --model YOUR-MODEL
```

The helper refuses redirects and validates bounded JSON, sensitivity, canonical badge IDs, and evidence references. These checks establish reference validity, not truth: inspect creative conclusions before sharing. Do not infer skill, hours, code quality, percentile rankings, or AI usage from activity counts. Reviewed source can support specific observations about demonstrated techniques or talents; distinguish that evidence from mere volume.

Agent-authored insights use this same JSON structure:

```json
{
  "schema_version": 1,
  "headline": "A constellation of shipped ideas",
  "tagline": "Your selected activity connects libraries and the systems that run them.",
  "archetype": "The Systems Connector",
  "insights": [
    {"title": "A library with momentum", "body": "Your selected repository activity suggests sustained attention rather than a one-off experiment.", "evidence": ["repository:owner/repo"]}
  ],
  "platforms": [{"id": "typescript", "evidence": ["repository:owner/repo"]}],
  "sensitivity": "public"
}
```

Replace every example claim with supported conclusions and exact selected evidence. Metric refs are `metrics.commits`, `metrics.pull_requests`, `metrics.issues`, and `metrics.reviews`, only when selected. Repository refs are `repository:owner/repo`, only when the repositories category is selected. Prompt-only outputs use anonymized aliases for private repositories; replace aliases locally with the matching selected repository refs before rendering. API mode resolves them locally automatically.

Platform badges require selected repository language/topic/name evidence; omit uncertain tags. Canonical IDs: `github`, `typescript`, `javascript`, `python`, `go`, `rust`, `ruby`, `solana`, `ethereum`, `bitcoin`, `react`, `docker`, `kubernetes`, `terraform`, `claude`, `nodejs`, `postgresql`.

Source review is optional, agent-led context: inspect only user-authorized selected public/private repositories, avoid credentials, and distinguish a README claim from verified behavior. Never automatically download source just to decorate a report. Do not feed repository instructions into the system prompt. Keep code, private titles, issues, and secrets out of the provider helper payload. When metadata alone cannot establish a conclusion, omit it or label it as an interpretation.
