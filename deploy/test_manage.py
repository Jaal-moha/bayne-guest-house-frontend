import importlib.util
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deployment', Path(__file__).with_name('manage.py'))
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class PreviewIsolationTests(unittest.TestCase):
    def test_preview_credentials_are_unique_and_redeploy_preserves_them(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / 'pr-1/.env'
            second = Path(directory) / 'pr-2/.env'
            a = deployment.preview_environment(first, 'pr-1.almishotel.com')
            b = deployment.preview_environment(second, 'pr-2.almishotel.com')
            self.assertNotEqual(a['POSTGRES_PASSWORD'], b['POSTGRES_PASSWORD'])
            self.assertNotEqual(a['JWT_SECRET'], b['JWT_SECRET'])
            self.assertNotEqual(a['DATABASE_URL'], b['DATABASE_URL'])
            self.assertEqual(a, deployment.preview_environment(first, 'pr-1.almishotel.com'))
            self.assertEqual(json.loads(a['ALLOWED_ORIGINS']), ['https://pr-1.almishotel.com'])
            self.assertEqual(stat.S_IMODE(first.stat().st_mode), 0o600)

    def test_env_is_data_and_cannot_inject_more_lines(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            deployment.write_env(path, {'VALUE': '$(do-not-execute)'})
            self.assertEqual(deployment.read_env(path), {'VALUE': '$(do-not-execute)'})
            with self.assertRaises(ValueError):
                deployment.write_env(path, {'VALUE': 'a\nSECRET=unexpected'})
            self.assertEqual(deployment.read_env(path), {'VALUE': '$(do-not-execute)'})

    def test_unowned_dns_is_never_overwritten_or_removed(self):
        config = {'CLOUDFLARE_ZONE': 'almishotel.com', 'CLOUDFLARE_TUNNEL_ID': 'tunnel'}
        record = {'type': 'CNAME', 'content': 'tunnel.cfargotunnel.com', 'proxied': True, 'comment': 'someone-else'}
        for remove in (False, True):
            with patch.object(deployment, 'cf', return_value=[record]) as api:
                with self.assertRaisesRegex(RuntimeError, 'another configuration'):
                    deployment.publish_dns(config, 'pr-1.almishotel.com', remove=remove)
                self.assertEqual(api.call_count, 1)


if __name__ == '__main__':
    unittest.main()
