"""Printed codes link to individual findings without making them public."""
import os
import re
import unittest
from unittest.mock import patch
import redtag
from test_server import AccountFlowTests
from test_http_memory import urlopen


class PrintedQrTests(unittest.TestCase):
    setUp=AccountFlowTests.setUp
    tearDown=AccountFlowTests.tearDown
    first_admin=AccountFlowTests.first_admin
    login=AccountFlowTests.login

    def request(self,*args,**kwargs):
        with patch('test_server.urlopen',urlopen):
            return AccountFlowTests.request(self,*args,**kwargs)

    def test_each_printed_card_has_its_own_qr_and_authenticated_destination(self):
        self.first_admin()
        cookie,csrf=self.login('admin','AdminPassword123!')
        photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
        for key in ('first-redtag-qr-key-001','second-redtag-qr-key-002'):
            status,_,_=self.request('/api/red-tags','POST',dict(finding_date='2026-10-21',section='FG Store',
                pic='Fareez',machine='Packing line',hazard='Guard damaged',type_of_stop='STOP 1',rank='A',
                recommendation='Replace guard',status='Open',photo=photo,settings_revision=1,request_key=key),cookie,csrf)
            self.assertEqual(status,201)
        self.assertEqual(self.request('/api/red-tags/print?date=2026-10-21')[0],401)
        with patch.dict(os.environ,{'SHE_PUBLIC_URL':'https://she.example'}):
            status,printed,_=self.request('/api/red-tags/print?date=2026-10-21',cookie=cookie)
        self.assertEqual(status,200)
        codes=re.findall(r'<svg.*?</svg>',printed)
        self.assertEqual(len(codes),2)
        self.assertNotEqual(codes[0],codes[1])
        for finding_id in (1,2):
            self.assertIn(f'https://she.example/#/red-tag/{finding_id}',printed)
            self.assertEqual(self.request(f'/api/red-tags/{finding_id}')[0],401)
            self.assertEqual(self.request(f'/api/red-tags/{finding_id}',cookie=cookie)[0],200)
        status,_,_=self.request('/api/users','POST',dict(username='reader',display_name='Another User',
            password='AnotherPassword123!',role='user'),cookie,csrf)
        self.assertEqual(status,201)
        reader,_=self.login('reader','AnotherPassword123!')
        self.assertEqual(self.request('/api/red-tags/1',cookie=reader)[0],200)
        self.assertNotIn('api.qrserver',printed)

    def test_print_url_configuration(self):
        with patch.dict(os.environ,{'SHE_PUBLIC_URL':'https://she.example/'}):
            self.assertEqual(redtag.finding_link(42),'https://she.example/#/red-tag/42')
        for address in ('javascript:alert(1)','https://user:password@she.example','https://she.example?login=1'):
            with patch.dict(os.environ,{'SHE_PUBLIC_URL':address}),self.assertRaises(ValueError):
                redtag.finding_link(42)
