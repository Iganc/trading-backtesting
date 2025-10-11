from django.test import TestCase
from django.urls import reverse
from .models import SP500
from datetime import date

class SP500ViewTests(TestCase):
    def setUp(self):
        SP500.objects.create(date=date(2025, 1, 1), open=100, high=110, low=90, close=105, volume=1000, adj_close = 105)
        SP500.objects.create(date=date(2025, 1, 2), open=106, high=112, low=101, close=110, volume=1200, adj_close = 110)

    def test_single_date(self):
        url = reverse('SP500', kwargs={'date': '2025-01-01'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '105') 

    def test_period(self):
        url = reverse('SP500', kwargs={'startdate': '2025-01-01', 'enddate': '2025-01-02'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '105')
        self.assertContains(response, '110')
