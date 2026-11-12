import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('collect', Path(__file__).parents[1] / 'scripts' / 'collect.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class CollectorTests(unittest.TestCase):
    def fixture(self):
        return c.demo('tester', 2025, '2025-12-31')

    def test_public_never_leaks_private_repository(self):
        result = c.normalize(self.fixture(), 'tester', 2025, '2025-12-31')
        self.assertEqual(result['metrics']['commits'], 423)
        self.assertTrue(all(not r['private'] for r in result['repositories']))
        self.assertNotIn('mission-control', str(result))
        self.assertEqual(result['monthly'], {})

    def test_private_scope(self):
        result = c.normalize(self.fixture(), 'tester', 2025, '2025-12-31', scope='private')
        self.assertEqual(result['metrics']['commits'], 361)
        self.assertEqual(len(result['repositories']), 1)

    def test_exclude_wins_and_globs_case_insensitive(self):
        result = c.normalize(self.fixture(), 'tester', 2025, '2025-12-31', scope='all', include=['EXAMPLE/*'], exclude=['*/orbit*'], exclude_org=['unrelated'])
        self.assertEqual(result['metrics']['commits'], 645)
        self.assertEqual(result['monthly'], {})

    def test_org_filter_and_forks(self):
        raw = self.fixture()
        raw['data']['user']['contributionsCollection'][c.CATEGORIES['commits']][0]['repository']['isFork'] = True
        result = c.normalize(raw, 'tester', 2025, '2025-12-31', include_org=['example'], exclude_forks=True, categories={'commits'})
        self.assertEqual(result['metrics'], {'commits': 139})

    def test_repository_only_excludes_metric_counts(self):
        result = c.normalize(self.fixture(), 'tester', 2025, '2025-12-31', categories={'repositories'})
        self.assertEqual(result['metrics'], {})
        self.assertEqual(len(result['repositories']), 2)
        self.assertTrue(all(r['commits'] == 0 for r in result['repositories']))

    def test_filtered_restricted_counts_are_not_exported(self):
        raw = self.fixture()
        raw['data']['user']['contributionsCollection']['restrictedContributionsCount'] = 987654
        result = c.normalize(raw, 'tester', 2025, '2025-12-31', scope='all', exclude=['*/orbit*'])
        self.assertNotIn('987654', str(result))
        self.assertTrue(result['coverage']['restricted_details_missing'])
        self.assertTrue(result['coverage']['filtered'])
        self.assertFalse(result['coverage']['calendar_included'])
        self.assertIn('repositories', result['categories'])

    def test_public_coverage_does_not_disclose_restricted_activity(self):
        raw = self.fixture()
        raw['data']['user']['contributionsCollection']['restrictedContributionsCount'] = 987654
        result = c.normalize(raw, 'tester', 2025, '2025-12-31')
        self.assertFalse(result['coverage']['restricted_details_missing'])
        self.assertNotIn('987654', str(result))

    def test_demo_without_username_and_default_categories(self):
        import json
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'demo.json'
            c.main(['--demo', '--year', '2025', '--output', str(path)])
            result = json.loads(path.read_text())
            self.assertEqual(result['username'], 'octocat')
            self.assertTrue(result['demo'])
            self.assertIn('repositories', result['categories'])
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_default_period_is_2026_and_future_end_clamps(self):
        from datetime import date
        start, end, actual = c.resolve_period(today=date(2027, 4, 1))
        self.assertEqual((str(start), str(end), str(actual)), ('2026-01-01', '2026-12-31', '2026-12-31'))
        start, end, actual = c.resolve_period(from_date='2025-10-01', to_date='2027-01-01', today=date(2026, 11, 12))
        self.assertEqual(str(actual), '2026-11-12')
        self.assertEqual(str(end), '2027-01-01')

    def test_invalid_date_periods_fail(self):
        for kwargs in [dict(from_date='2025-01-01'), dict(to_date='2025-01-01'), dict(from_date='2025-12-31', to_date='2025-01-01'), dict(year=2025, from_date='2025-01-01', to_date='2025-02-01'), dict(as_of='2025-01-02', from_date='2025-01-01', to_date='2025-02-01'), dict(from_date='9999-01-01', to_date='9999-12-31')]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                c.resolve_period(**kwargs)

    def test_cross_year_collection_windows_and_merge(self):
        import json
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'range.json'
            with patch.object(c, 'query_github', side_effect=lambda *args: self.fixture()) as query:
                c.main(['--username', 'tester', '--from', '2024-12-30', '--to', '2025-01-02', '--output', str(path)])
            self.assertEqual(query.call_args_list[0].args, ('tester', 2024, '2024-12-31', '2024-12-30'))
            self.assertEqual(query.call_args_list[1].args, ('tester', 2025, '2025-01-02', '2025-01-01'))
            result = json.loads(path.read_text())
            self.assertEqual(result['metrics']['commits'], 846)
            self.assertEqual(len(result['repositories']), 2)
            self.assertEqual(result['period'], dict(start='2024-12-30', end='2025-01-02', actual_end='2025-01-02', label='2024–2025'))

    def test_api_query_uses_inclusive_custom_window(self):
        import json
        reply = subprocess.CompletedProcess([], 0, json.dumps(self.fixture()), '')
        with patch.object(c.subprocess, 'run', return_value=reply) as run:
            c.query_github('tester', 2024, '2024-12-31', '2024-12-30')
        command = run.call_args.args[0]
        self.assertIn('from=2024-12-30T00:00:00Z', command)
        self.assertIn('to=2024-12-31T23:59:59Z', command)

    def test_context_is_opt_in_and_stays_selected(self):
        raw = self.fixture()
        row = raw['data']['user']['contributionsCollection'][c.CATEGORIES['commits']][0]
        row['repository']['languages'] = {'nodes': [{'name': 'TypeScript'}]}
        row['repository']['repositoryTopics'] = {'nodes': [{'topic': {'name': 'sdk'}}]}
        absent = c.normalize(raw, 'tester', 2025, '2025-12-31')
        included = c.normalize(raw, 'tester', 2025, '2025-12-31', include_context=True)
        self.assertNotIn('languages', absent['repositories'][0])
        repo = next(repo for repo in included['repositories'] if repo['name'] == 'example/constellation')
        self.assertEqual(repo['languages'], ['TypeScript'])
        self.assertEqual(repo['topics'], ['sdk'])

    def test_api_errors_fail_closed(self):
        with patch.object(c.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '{"errors":[{"message":"bad"}]}', '')):
            with self.assertRaises(ValueError):
                c.query_github('tester', 2025, '2025-12-31')

    def test_output_not_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'report.json'
            path.write_text('preserve')
            with self.assertRaises(SystemExit):
                c.main(['--username', 'tester', '--year', '2025', '--demo', '--output', str(path)])
            self.assertEqual(path.read_text(), 'preserve')

if __name__ == '__main__':
    unittest.main()
