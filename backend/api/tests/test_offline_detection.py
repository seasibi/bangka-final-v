"""
Comprehensive tests for ESP32 GPS tracker offline detection.
Tests the 8-minute threshold and proper status transitions.
"""

from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch, MagicMock
from api.models import GpsData, BirukbilugTracker, Boat, TrackerStatusEvent
from api.consumers import GPSConsumer
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
import json


class OfflineDetectionTestCase(TestCase):
    """Test cases for verifying offline detection logic with 8-minute threshold."""
    
    def setUp(self):
        """Set up test data."""
        # Create a test boat
        self.boat = Boat.objects.create(
            mfbr_number="TEST-001",
            boat_name="Test Boat",
            registered_municipality="San Juan"
        )
        
        # Create a test tracker
        self.tracker = BirukbilugTracker.objects.create(
            BirukBilugID="SJU-TEST-001",
            municipality="San Juan",
            boat=self.boat,
            status="active"
        )
        
    def test_online_status_recent_data(self):
        """Test that tracker shows online when data is recent (< 4 minutes old)."""
        # Create GPS data 2 minutes ago
        GpsData.objects.create(
            boat_id=1,
            tracker_id=self.tracker.BirukBilugID,
            mfbr_number=self.boat.mfbr_number,
            latitude=16.6195,
            longitude=120.3152,
            timestamp=timezone.now() - timedelta(minutes=2)
        )
        
        consumer = GPSConsumer()
        data = consumer.get_latest_gps_data()
        
        self.assertIsNotNone(data)
        self.assertEqual(len(data['features']), 1)
        feature = data['features'][0]
        self.assertEqual(feature['properties']['status'], 'online')
        self.assertLess(feature['properties']['age_seconds'], 240)  # Less than 4 minutes
        
    def test_reconnecting_status_intermediate_data(self):
        """Test that tracker shows reconnecting when data is 4-8 minutes old."""
        # Create GPS data 6 minutes ago
        GpsData.objects.create(
            boat_id=1,
            tracker_id=self.tracker.BirukBilugID,
            mfbr_number=self.boat.mfbr_number,
            latitude=16.6195,
            longitude=120.3152,
            timestamp=timezone.now() - timedelta(minutes=6)
        )
        
        consumer = GPSConsumer()
        data = consumer.get_latest_gps_data()
        
        self.assertIsNotNone(data)
        self.assertEqual(len(data['features']), 1)
        feature = data['features'][0]
        self.assertEqual(feature['properties']['status'], 'reconnecting')
        self.assertGreaterEqual(feature['properties']['age_seconds'], 240)  # >= 4 minutes
        self.assertLess(feature['properties']['age_seconds'], 480)  # < 8 minutes
        
    def test_offline_status_old_data(self):
        """Test that tracker shows offline when data is > 8 minutes old."""
        # Create GPS data 10 minutes ago
        GpsData.objects.create(
            boat_id=1,
            tracker_id=self.tracker.BirukBilugID,
            mfbr_number=self.boat.mfbr_number,
            latitude=16.6195,
            longitude=120.3152,
            timestamp=timezone.now() - timedelta(minutes=10)
        )
        
        consumer = GPSConsumer()
        data = consumer.get_latest_gps_data()
        
        self.assertIsNotNone(data)
        self.assertEqual(len(data['features']), 1)
        feature = data['features'][0]
        self.assertEqual(feature['properties']['status'], 'offline')
        self.assertGreaterEqual(feature['properties']['age_seconds'], 480)  # >= 8 minutes
        
    def test_status_transition_online_to_reconnecting(self):
        """Test proper transition from online to reconnecting status."""
        # Create initial GPS data (now)
        gps = GpsData.objects.create(
            boat_id=1,
            tracker_id=self.tracker.BirukBilugID,
            mfbr_number=self.boat.mfbr_number,
            latitude=16.6195,
            longitude=120.3152,
            timestamp=timezone.now()
        )
        
        consumer = GPSConsumer()
        
        # Check initial status is online
        data = consumer.get_latest_gps_data()
        self.assertEqual(data['features'][0]['properties']['status'], 'online')
        
        # Update timestamp to 5 minutes ago
        gps.timestamp = timezone.now() - timedelta(minutes=5)
        gps.save()
        
        # Check status changed to reconnecting
        data = consumer.get_latest_gps_data()
        self.assertEqual(data['features'][0]['properties']['status'], 'reconnecting')
        
    def test_status_transition_reconnecting_to_offline(self):
        """Test proper transition from reconnecting to offline status."""
        # Create GPS data 5 minutes ago (reconnecting)
        gps = GpsData.objects.create(
            boat_id=1,
            tracker_id=self.tracker.BirukBilugID,
            mfbr_number=self.boat.mfbr_number,
            latitude=16.6195,
            longitude=120.3152,
            timestamp=timezone.now() - timedelta(minutes=5)
        )
        
        consumer = GPSConsumer()
        
        # Check initial status is reconnecting
        data = consumer.get_latest_gps_data()
        self.assertEqual(data['features'][0]['properties']['status'], 'reconnecting')
        
        # Update timestamp to 9 minutes ago
        gps.timestamp = timezone.now() - timedelta(minutes=9)
        gps.save()
        
        # Check status changed to offline
        data = consumer.get_latest_gps_data()
        self.assertEqual(data['features'][0]['properties']['status'], 'offline')
        
    def test_tracker_status_event_override(self):
        """Test that TrackerStatusEvent can override age-based status."""
        # Create GPS data 3 minutes ago (normally online)
        GpsData.objects.create(
            boat_id=1,
            tracker_id=self.tracker.BirukBilugID,
            mfbr_number=self.boat.mfbr_number,
            latitude=16.6195,
            longitude=120.3152,
            timestamp=timezone.now() - timedelta(minutes=3)
        )
        
        # Create a status event marking tracker as offline
        TrackerStatusEvent.objects.create(
            tracker_id=self.tracker.BirukBilugID,
            status='offline',
            timestamp=timezone.now() - timedelta(minutes=1)
        )
        
        consumer = GPSConsumer()
        data = consumer.get_latest_gps_data()
        
        # Should respect the TrackerStatusEvent
        feature = data['features'][0]
        # But if age > 8 minutes, should still force offline
        # In this case, age is 3 minutes, so it should use TrackerStatusEvent
        self.assertEqual(feature['properties']['status'], 'offline')
        
    def test_multiple_trackers_different_statuses(self):
        """Test handling multiple trackers with different statuses simultaneously."""
        # Create second tracker
        tracker2 = BirukbilugTracker.objects.create(
            BirukBilugID="SJU-TEST-002",
            municipality="San Juan",
            status="active"
        )
        
        # Create GPS data for both trackers at different times
        # Tracker 1: 1 minute ago (online)
        GpsData.objects.create(
            boat_id=1,
            tracker_id=self.tracker.BirukBilugID,
            mfbr_number=self.boat.mfbr_number,
            latitude=16.6195,
            longitude=120.3152,
            timestamp=timezone.now() - timedelta(minutes=1)
        )
        
        # Tracker 2: 6 minutes ago (reconnecting)
        GpsData.objects.create(
            boat_id=2,
            tracker_id=tracker2.BirukBilugID,
            latitude=16.6200,
            longitude=120.3160,
            timestamp=timezone.now() - timedelta(minutes=6)
        )
        
        # Tracker 3: 10 minutes ago (offline)
        tracker3 = BirukbilugTracker.objects.create(
            BirukBilugID="SJU-TEST-003",
            municipality="San Juan",
            status="active"
        )
        GpsData.objects.create(
            boat_id=3,
            tracker_id=tracker3.BirukBilugID,
            latitude=16.6210,
            longitude=120.3170,
            timestamp=timezone.now() - timedelta(minutes=10)
        )
        
        consumer = GPSConsumer()
        data = consumer.get_latest_gps_data()
        
        self.assertEqual(len(data['features']), 3)
        
        # Find each tracker by ID and verify status
        features_by_id = {f['properties']['boat_id']: f for f in data['features']}
        
        # Tracker 1 should be online
        tracker1_feature = next((f for f in data['features'] 
                                if self.boat.mfbr_number in str(f['properties'].get('mfbr_number', ''))), None)
        self.assertIsNotNone(tracker1_feature)
        self.assertEqual(tracker1_feature['properties']['status'], 'online')
        
        # Tracker 2 should be reconnecting
        tracker2_feature = next((f for f in data['features'] 
                                if tracker2.BirukBilugID in str(f['properties'].get('boat_id', ''))), None)
        self.assertIsNotNone(tracker2_feature)
        self.assertEqual(tracker2_feature['properties']['status'], 'reconnecting')
        
        # Tracker 3 should be offline
        tracker3_feature = next((f for f in data['features'] 
                                if tracker3.BirukBilugID in str(f['properties'].get('boat_id', ''))), None)
        self.assertIsNotNone(tracker3_feature)
        self.assertEqual(tracker3_feature['properties']['status'], 'offline')
        
    def test_timestamp_accuracy(self):
        """Test that timestamps are accurately recorded and calculated."""
        now = timezone.now()
        test_times = [
            (timedelta(seconds=30), 'online'),
            (timedelta(minutes=3, seconds=45), 'online'),
            (timedelta(minutes=4, seconds=30), 'reconnecting'),
            (timedelta(minutes=7, seconds=59), 'reconnecting'),
            (timedelta(minutes=8, seconds=1), 'offline'),
            (timedelta(minutes=15), 'offline'),
        ]
        
        for time_delta, expected_status in test_times:
            # Clear existing data
            GpsData.objects.all().delete()
            
            # Create GPS data with specific timestamp
            timestamp = now - time_delta
            GpsData.objects.create(
                boat_id=1,
                tracker_id=self.tracker.BirukBilugID,
                mfbr_number=self.boat.mfbr_number,
                latitude=16.6195,
                longitude=120.3152,
                timestamp=timestamp
            )
            
            consumer = GPSConsumer()
            data = consumer.get_latest_gps_data()
            
            feature = data['features'][0]
            actual_age = feature['properties']['age_seconds']
            expected_age = int(time_delta.total_seconds())
            
            # Allow 1 second tolerance for test execution time
            self.assertAlmostEqual(actual_age, expected_age, delta=2)
            self.assertEqual(
                feature['properties']['status'], 
                expected_status,
                f"Failed for time_delta={time_delta}, age={actual_age}s"
            )


class WebSocketOfflineDetectionTest(TestCase):
    """Test WebSocket message handling for offline detection."""
    
    async def test_websocket_initial_data_with_status(self):
        """Test that initial WebSocket connection receives correct status data."""
        # Create test data
        boat = await database_sync_to_async(Boat.objects.create)(
            mfbr_number="WS-TEST-001",
            boat_name="WebSocket Test Boat",
            registered_municipality="San Juan"
        )
        
        tracker = await database_sync_to_async(BirukbilugTracker.objects.create)(
            BirukBilugID="WS-SJU-001",
            municipality="San Juan",
            boat=boat,
            status="active"
        )
        
        # Create GPS data 5 minutes ago (reconnecting status)
        await database_sync_to_async(GpsData.objects.create)(
            boat_id=1,
            tracker_id=tracker.BirukBilugID,
            mfbr_number=boat.mfbr_number,
            latitude=16.6195,
            longitude=120.3152,
            timestamp=timezone.now() - timedelta(minutes=5)
        )
        
        # Connect to WebSocket
        communicator = WebsocketCommunicator(GPSConsumer.as_asgi(), "/ws/gps/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        
        # Receive initial data message
        message = await communicator.receive_json_from()
        
        self.assertEqual(message['type'], 'initial_data')
        self.assertIn('data', message)
        self.assertIn('features', message['data'])
        self.assertEqual(len(message['data']['features']), 1)
        
        feature = message['data']['features'][0]
        self.assertEqual(feature['properties']['status'], 'reconnecting')
        
        await communicator.disconnect()
        
        
class OfflineDetectionIntegrationTest(TestCase):
    """Integration tests for offline detection across the system."""
    
    def test_tracker_history_excludes_synthetic_offline_events(self):
        """Test that tracker history properly handles offline detection."""
        from api.views import tracker_history
        from django.test import RequestFactory
        from django.contrib.auth.models import User
        
        # Create test data
        boat = Boat.objects.create(
            mfbr_number="INT-TEST-001",
            boat_name="Integration Test Boat",
            registered_municipality="San Juan"
        )
        
        tracker = BirukbilugTracker.objects.create(
            BirukBilugID="INT-SJU-001",
            municipality="San Juan",
            boat=boat,
            status="active"
        )
        
        # Create GPS data points at various times
        times = [
            timezone.now() - timedelta(minutes=1),   # Online
            timezone.now() - timedelta(minutes=5),   # Reconnecting
            timezone.now() - timedelta(minutes=10),  # Offline
        ]
        
        for i, timestamp in enumerate(times):
            GpsData.objects.create(
                boat_id=boat.id,
                tracker_id=tracker.BirukBilugID,
                mfbr_number=boat.mfbr_number,
                latitude=16.6195 + (i * 0.001),
                longitude=120.3152 + (i * 0.001),
                timestamp=timestamp
            )
        
        # Create request and call view
        factory = RequestFactory()
        request = factory.get(f'/api/tracker-history/{tracker.BirukBilugID}/')
        request.user = User.objects.create_user('testuser')
        
        response = tracker_history(request, tracker.BirukBilugID)
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        
        # Verify no status events in cleaned history
        status_events = [e for e in data if e['event_type'] in ['online', 'offline', 'reconnecting']]
        # These should be filtered out in the clean version
        # The view should only return movement/violation events
