#!/usr/bin/env python3
"""Collect value-minimal GitHub contribution evidence using authenticated gh."""
import argparse
from datetime import date
import fnmatch
import json
import os
from pathlib import Path
import re
import subprocess
import sys

CATEGORIES = {'commits': 'commitContributionsByRepository', 'pull_requests': 'pullRequestContributionsByRepository', 'issues': 'issueContributionsByRepository', 'reviews': 'pullRequestReviewContributionsByRepository'}
ALIASES = {'prs': 'pull_requests', 'repos': 'repositories'}

def matches(value, patterns):
    return any(fnmatch.fnmatchcase(value.lower(), p.lower()) for p in patterns)


def selected(repo, scope, include, exclude, include_org, exclude_org, exclude_forks):
    name = repo['nameWithOwner']
    owner = name.split('/')[0]
    return (scope == 'all' or repo['isPrivate'] == (scope == 'private')) and (not include or matches(name, include)) and not matches(name, exclude) and (not include_org or matches(owner, include_org)) and not matches(owner, exclude_org) and not (exclude_forks and repo.get('isFork', False))


def normalize(raw, username, year, as_of, scope='public', include=(), exclude=(), include_org=(), exclude_org=(), categories=None, exclude_forks=False, start_date=None, include_context=False):
    categories = set((*CATEGORIES, 'repositories') if categories is None else categories)
    filtered = bool(include or exclude or include_org or exclude_org or exclude_forks or categories != set((*CATEGORIES, 'repositories')))
    repository_limit_reached = False
    c = raw['data']['user']['contributionsCollection']
    repos = {}
    notes = ['Counts describe GitHub-recognized contributions, not features shipped or code quality.', 'Repository contribution lists are limited by GitHub to 100 repositories per category.']
    for metric, field in CATEGORIES.items():
        if metric not in categories and 'repositories' not in categories:
            continue
        rows = c.get(field, [])
        if len(rows) >= 100:
            repository_limit_reached = True
            notes.append(f'{metric}: repository limit reached; results may be incomplete.')
        for row in rows:
            repo = row['repository']
            if not selected(repo, scope, include, exclude, include_org, exclude_org, exclude_forks):
                continue
            name = repo['nameWithOwner']
            record = repos.setdefault(name, dict(name=name, private=repo['isPrivate'], **{k: 0 for k in CATEGORIES}))
            if include_context:
                record['languages'] = sorted(set(record.get('languages', [])) | {node['name'] for node in repo.get('languages', {}).get('nodes', [])})
                record['topics'] = sorted(set(record.get('topics', [])) | {node['topic']['name'] for node in repo.get('repositoryTopics', {}).get('nodes', [])})
            if metric in categories:
                record[metric] += row['contributions']['totalCount']
    metrics = {k: sum(r[k] for r in repos.values()) for k in CATEGORIES if k in categories}
    restricted = c.get('restrictedContributionsCount', 0)
    if restricted and scope != 'public':
        if filtered:
            notes.append('Some restricted contribution details are inaccessible to this credential and excluded from scoped metrics. Private access may be incomplete.')
        else:
            notes.append(f'GitHub reports {restricted} restricted contributions whose repository details this credential cannot read; they are excluded from scoped metrics. Private access may be incomplete.')
    monthly = {}
    # Global calendars include repository creations and inaccessible contributions.
    # They cannot safely be partitioned by repository or visibility.
    if scope == 'all' and not filtered:
        for week in c.get('contributionCalendar', {}).get('weeks', []):
            for day in week['contributionDays']:
                if (start_date or f'{year}-01-01') <= day['date'] <= as_of:
                    month = day['date'][:7]
                    monthly[month] = monthly.get(month, 0) + day['contributionCount']
        if monthly:
            notes.append('Monthly activity is the unfiltered GitHub calendar, including restricted contributions and categories outside the repository metrics; do not equate its sum with metric totals.')
    else:
        notes.append('Global contribution calendar omitted because it cannot honor visibility, repository, or category filters.')
    if scope in ('private', 'all'):
        notes.append('Private repository names are present when selected. Keep this report local; review before sharing. Access reflects this gh credential, not all repositories you may own.')
    return dict(username=username, year=year, as_of=as_of, scope=scope, categories=sorted(categories), coverage=dict(repository_limit_reached=repository_limit_reached, restricted_details_missing=bool(restricted and scope != 'public'), calendar_included=bool(monthly), filtered=filtered), metrics=metrics, repositories=sorted(repos.values(), key=lambda r: (-sum(r[k] for k in CATEGORIES), r['name'])), monthly=monthly, notes=notes)


def query_github(username, year, as_of, start_date=None, include_context=False):
    start = f'{start_date or str(year) + "-01-01"}T00:00:00Z'
    end = f'{as_of}T23:59:59Z'
    context = 'languages(first:5) { nodes { name } } repositoryTopics(first:10) { nodes { topic { name } } }' if include_context else ''
    fields = ' '.join(f'{field}(maxRepositories:100) {{ repository {{ nameWithOwner isPrivate isFork {context} }} contributions {{ totalCount }} }}' for field in CATEGORIES.values())
    query = '''query($login:String!,$from:DateTime!,$to:DateTime!) { user(login:$login) { contributionsCollection(from:$from,to:$to) { restrictedContributionsCount contributionCalendar { weeks { contributionDays { date contributionCount } } } ''' + fields + ' } } }'
    result = subprocess.run(['gh', 'api', 'graphql', '-f', 'query=' + query, '-f', 'login=' + username, '-f', 'from=' + start, '-f', 'to=' + end], capture_output=True, text=True)
    if result.returncode:
        raise ValueError('GitHub request failed. Check gh auth status, network connectivity, and account permissions. No report was written.')
    try:
        raw = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError('GitHub returned invalid JSON; no report was written.') from exc
    if raw.get('errors') or not raw.get('data', {}).get('user'):
        raise ValueError('GitHub returned an error or unknown user; no report was written.')
    return raw


def demo(username, year, as_of):
    names = [('example/constellation', False, 284, 38), ('example/orbit-sdk', False, 139, 24), ('example/mission-control', True, 361, 52)]
    c = {field: [] for field in CATEGORIES.values()}
    c['restrictedContributionsCount'] = 0
    c['contributionCalendar'] = {'weeks': []}
    for name, private, commits, prs in names:
        for metric, value in [('commits', commits), ('pull_requests', prs), ('issues', prs // 3), ('reviews', prs // 2)]:
            c[CATEGORIES[metric]].append({'repository': {'nameWithOwner': name, 'isPrivate': private, 'isFork': False}, 'contributions': {'totalCount': value}})
    return {'data': {'user': {'contributionsCollection': c}}}


def resolve_period(year=None, as_of=None, from_date=None, to_date=None, today=None):
    today = today or date.today()
    if bool(from_date) != bool(to_date):
        raise ValueError('--from and --to must be supplied together.')
    if from_date:
        if year is not None or as_of is not None:
            raise ValueError('--from/--to cannot be combined with --year or --as-of.')
        start, end = date.fromisoformat(from_date), date.fromisoformat(to_date)
    else:
        year = 2026 if year is None else year
        if not 2008 <= year <= 9999:
            raise ValueError('Year must be between 2008 and 9999.')
        start = date(year, 1, 1)
        end = date.fromisoformat(as_of) if as_of else date(year, 12, 31)
        if end.year != year:
            raise ValueError('--as-of must fall within the selected year.')
    if start.year < 2008 or start > end:
        raise ValueError('Period must start in 2008 or later, on or before its end.')
    if start > today:
        raise ValueError('Period is entirely in the future; no activity can be collected.')
    return start, end, min(end, today)


def year_windows(start, end):
    """Split inclusive dates into disjoint GitHub-supported calendar-year windows."""
    for year in range(start.year, end.year + 1):
        yield max(start, date(year, 1, 1)), min(end, date(year, 12, 31))


def merge_period(parts, start, end, actual_end):
    result = dict(parts[0])
    label = str(start.year) if start.year == end.year else f'{start.year}–{end.year}'
    result['year'] = start.year if start.year == end.year else label
    result['as_of'] = str(actual_end)
    result['period'] = dict(start=str(start), end=str(end), actual_end=str(actual_end), label=label)
    repos = {}
    monthly = {}
    metrics = {key: 0 for key in result['metrics']}
    notes = []
    for part in parts:
        for key, count in part['metrics'].items():
            metrics[key] += count
        for repo in part['repositories']:
            record = repos.setdefault(repo['name'], dict(repo, **{key: 0 for key in CATEGORIES}))
            for key in CATEGORIES:
                record[key] += repo[key]
        for month, count in part['monthly'].items():
            monthly[month] = monthly.get(month, 0) + count
        notes.extend(note for note in part['notes'] if note not in notes)
    result.update(metrics=metrics, repositories=sorted(repos.values(), key=lambda r: (-sum(r[k] for k in CATEGORIES), r['name'])), monthly=monthly, notes=notes)
    result['coverage'] = {key: any(part['coverage'][key] for part in parts) for key in result['coverage']}
    if actual_end < end:
        result['notes'].append('Requested period extends beyond today; activity stops at the actual_end date.')
    if len(parts) > 1:
        result['notes'].append('Range collected in disjoint calendar-year windows; repository limits apply separately to each window.')
    return result


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--username', help='GitHub login; defaults to octocat for --demo only')
    p.add_argument('--year', type=int, help='Calendar year (default: 2026)')
    p.add_argument('--from', dest='from_date', help='Inclusive YYYY-MM-DD; requires --to')
    p.add_argument('--to', dest='to_date', help='Inclusive YYYY-MM-DD; requires --from')
    p.add_argument('--as-of', help='Inclusive year cutoff YYYY-MM-DD; future dates clamp to today')
    p.add_argument('--scope', '--visibility', choices=['public', 'private', 'all'], default='public')
    for flag in ['include', 'exclude', 'include-org', 'exclude-org']:
        p.add_argument('--' + flag, action='append', default=[], help='Repeatable case-insensitive glob; exclude wins')
    p.add_argument('--categories', default=','.join((*CATEGORIES, 'repositories')), help='Comma-separated commits,prs,issues,reviews; repos accepted for repository listing')
    p.add_argument('--exclude-forks', action='store_true')
    p.add_argument('--include-context', action='store_true', help='Opt in to selected repository languages/topics for evidence-based platform personalization')
    p.add_argument('--exclude-bots', action='store_true', help='Reject bot account collection; no bot PR titles/bodies are fetched')
    p.add_argument('--demo', action='store_true', help='Use clearly marked synthetic offline evidence')
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--force', action='store_true')
    args = p.parse_args(argv)
    try:
        if args.demo and not args.username:
            args.username = 'octocat'
        if not args.username:
            raise ValueError('--username is required unless --demo is selected.')
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?', args.username):
            raise ValueError('Invalid GitHub username.')
        start, end, actual_end = resolve_period(args.year, args.as_of, args.from_date, args.to_date)
        categories = {ALIASES.get(x.strip(), x.strip()) for x in args.categories.split(',')}
        if not categories or not categories <= set(CATEGORIES) | {'repositories'}:
            raise ValueError('Unknown category. Choose commits,prs,issues,reviews,repos.')
        if args.exclude_bots and args.username.lower().endswith('[bot]'):
            raise ValueError('Bot account excluded.')
        parts = []
        for window_start, window_end in year_windows(start, actual_end):
            raw = demo(args.username, window_start.year, str(window_end)) if args.demo else query_github(args.username, window_start.year, str(window_end), str(window_start), **({'include_context': True} if args.include_context else {}))
            parts.append(normalize(raw, args.username, window_start.year, str(window_end), args.scope, args.include, args.exclude, args.include_org, args.exclude_org, categories, args.exclude_forks, str(window_start), args.include_context))
        result = merge_period(parts, start, end, actual_end)
        if args.demo:
            result['notes'].insert(0, 'DEMO: synthetic activity; not real GitHub statistics.')
            result['demo'] = True
        args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        flags = os.O_WRONLY | os.O_CREAT | (os.O_TRUNC if args.force else os.O_EXCL)
        descriptor = os.open(args.output, flags, 0o600)
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
            f.write('\n')
        print(f'Wrote {args.output} ({len(result["repositories"])} selected repositories; {args.scope})')
    except (ValueError, OSError, KeyError, TypeError) as exc:
        p.exit(1, f'Error: {exc}\n')


if __name__ == '__main__':
    main()
