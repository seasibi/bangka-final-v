from django.test import TestCase, Client
from django.utils import timezone
from django.urls import reverse
from django.core.cache import cache
from datetime import timedelta

from .models import GpsData


class TrackerHistoryStatusTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.tracker_id = "TEST-TRACKER-1"
        cache.clear()

    def _create_point(self, minutes_ago: int):
        ts = timezone.now() - timedelta(minutes=minutes_ago)
        # GpsData auto_now_add timestamp is set on create; we need to override after create
        g = GpsData.objects.create(
            latitude=16.0,
            longitude=120.0,
            boat_id=0,
            tracker_id=self.tracker_id,
        )
        # Manually set timestamp for deterministic tests
        GpsData.objects.filter(pk=g.pk).update(timestamp=ts)
        return GpsData.objects.get(pk=g.pk)

    def test_online_not_reported_without_transition(self):
        # Latest delta 1 minute -> online; previous status unknown; should NOT emit initial 'online'
        self._create_point(1)
        self._create_point(2)
        resp = self.client.get(f"/api/tracker-history/{self.tracker_id}/?filter=status")
        self.assertEqual(resp.status_code, 200)
        events = resp.json()
        online_events = [e for e in events if e.get("event_type") == "online"]
        # No 'online' without an offline->online transition
        self.assertEqual(len(online_events), 0)

    def test_online_emitted_on_offline_to_online_transition(self):
        # First, set cache to offline by making latest gap > 10 minutes
        self._create_point(20)  # older
        self._create_point(1)   # latest, close to now -> online
        resp1 = self.client.get(f"/api/tracker-history/{self.tracker_id}/?filter=status")
        self.assertEqual(resp1.status_code, 200)
        # Now simulate 20 min old latest (offline), then add fresh point to transition to online
        GpsData.objects.all().update(timestamp=timezone.now() - timedelta(minutes=20))
        self._create_point(0)   # newest now (transition to online)
        resp2 = self.client.get(f"/api/tracker-history/{self.tracker_id}/?filter=status")
        self.assertEqual(resp2.status_code, 200)
        events = resp2.json()
        online_events = [e for e in events if e.get("event_type") == "online"]
        self.assertGreaterEqual(len(online_events), 1)

    def test_offline_emitted_when_latest_point_is_old(self):
        # Only one old point 20 minutes ago -> should report offline
        self._create_point(20)
        resp = self.client.get(f"/api/tracker-history/{self.tracker_id}/?filter=status")
        self.assertEqual(resp.status_code, 200)
        events = resp.json()
        types = [e.get("event_type") for e in events]
        self.assertIn("offline", types)

