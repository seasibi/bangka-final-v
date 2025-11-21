"""
Tracker Status Service
Handles offline detection, status transitions, and monitoring for ESP32 devices.
"""

from django.utils import timezone
from datetime import timedelta
from django.db.models import Q
from api.models import GpsData, TrackerStatusEvent, BirukbilugTracker
import logging

logger = logging.getLogger(__name__)

class TrackerStatusService:
    """Service for managing tracker status and offline detection."""
    
    # Configurable thresholds (in seconds)
    OFFLINE_THRESHOLD = 480  # 8 minutes - device is considered offline
    STATUS_CHECK_INTERVAL = 60  # 1 minute - how often to check statuses
    
    def __init__(self):
        self.logger = logger
        
    def get_tracker_status(self, tracker_id):
        """
        Get the current status of a tracker based on GPS data age and status events.
        
        Args:
            tracker_id: The BirukBilugID of the tracker
            
        Returns:
            dict: Status information including status, last_seen, age_seconds
        """
        try:
            # Get the latest GPS data for this tracker
            latest_gps = GpsData.objects.filter(
                Q(tracker_id=tracker_id) | Q(device_id=tracker_id)
            ).order_by('-timestamp').first()
            
            if not latest_gps:
                return {
                    'status': 'unknown',
                    'last_seen': None,
                    'age_seconds': None,
                    'tracker_id': tracker_id
                }
            
            now = timezone.now()
            age_seconds = int((now - latest_gps.timestamp).total_seconds())
            
            # Determine status based on age
            if age_seconds > self.OFFLINE_THRESHOLD:
                status = 'offline'
            else:
                status = 'online'
            
            # Check if there's a recent TrackerStatusEvent that might override
            recent_event = TrackerStatusEvent.objects.filter(
                tracker_id=tracker_id,
                timestamp__gte=now - timedelta(seconds=self.STATUS_CHECK_INTERVAL)
            ).order_by('-timestamp').first()
            
            # Only use the event status if it's offline
            if recent_event and recent_event.status == 'offline':
                status = recent_event.status
            
            return {
                'status': status,
                'last_seen': latest_gps.timestamp,
                'age_seconds': age_seconds,
                'tracker_id': tracker_id,
                'latitude': latest_gps.latitude,
                'longitude': latest_gps.longitude
            }
            
        except Exception as e:
            self.logger.error(f"Error getting tracker status for {tracker_id}: {e}")
            return {
                'status': 'error',
                'last_seen': None,
                'age_seconds': None,
                'tracker_id': tracker_id,
                'error': str(e)
            }
    
    def check_all_trackers(self):
        """
        Check the status of all active trackers and create status events as needed.
        
        Returns:
            dict: Summary of tracker statuses
        """
        try:
            # Get all active trackers
            active_trackers = BirukbilugTracker.objects.filter(
                status='active'
            ).values_list('BirukBilugID', flat=True)
            
            statuses = {
                'online': [],
                'offline': [],
                'unknown': []
            }
            
            for tracker_id in active_trackers:
                status_info = self.get_tracker_status(tracker_id)
                status = status_info['status']
                
                statuses[status if status in statuses else 'unknown'].append(tracker_id)
                
                # Create or update status event if status changed
                self._update_tracker_status_event(tracker_id, status_info)
            
            summary = {
                'timestamp': timezone.now(),
                'total_trackers': len(active_trackers),
                'online': len(statuses['online']),
                'offline': len(statuses['offline']),
                'unknown': len(statuses['unknown']),
                'details': statuses
            }
            
            self.logger.info(f"Tracker status check: {summary}")
            return summary
            
        except Exception as e:
            self.logger.error(f"Error checking all trackers: {e}")
            return {
                'error': str(e),
                'timestamp': timezone.now()
            }
    
    def _update_tracker_status_event(self, tracker_id, status_info):
        """
        Create or update TrackerStatusEvent if status has changed.
        
        Args:
            tracker_id: The tracker ID
            status_info: Current status information
        """
        try:
            # Get the last status event
            last_event = TrackerStatusEvent.objects.filter(
                tracker_id=tracker_id
            ).order_by('-timestamp').first()
            
            current_status = status_info['status']
            
            # Only create new event if status changed or no previous event
            if not last_event or last_event.status != current_status:
                TrackerStatusEvent.objects.create(
                    tracker_id=tracker_id,
                    status=current_status,
                    timestamp=timezone.now(),
                    session_start=last_event.session_start if last_event and current_status != 'online' else timezone.now()
                )
                
                self.logger.info(f"Status changed for {tracker_id}: {last_event.status if last_event else 'unknown'} -> {current_status}")
                
        except Exception as e:
            self.logger.error(f"Error updating status event for {tracker_id}: {e}")
    
    
    def get_offline_trackers(self, duration_minutes=None):
        """
        Get list of currently offline trackers.
        
        Args:
            duration_minutes: Only return trackers offline for at least this many minutes
            
        Returns:
            list: List of offline tracker information
        """
        try:
            offline_trackers = []
            
            # Get all active trackers
            active_trackers = BirukbilugTracker.objects.filter(
                status='active'
            )
            
            for tracker in active_trackers:
                status_info = self.get_tracker_status(tracker.BirukBilugID)
                
                if status_info['status'] == 'offline':
                    if duration_minutes is None or \
                       (status_info['age_seconds'] and status_info['age_seconds'] >= duration_minutes * 60):
                        
                        offline_info = {
                            'tracker_id': tracker.BirukBilugID,
                            'boat': tracker.boat.boat_name if tracker.boat else None,
                            'mfbr_number': tracker.boat.mfbr_number if tracker.boat else None,
                            'municipality': tracker.municipality,
                            'last_seen': status_info['last_seen'],
                            'offline_duration_minutes': status_info['age_seconds'] // 60 if status_info['age_seconds'] else None
                        }
                        offline_trackers.append(offline_info)
            
            return offline_trackers
            
        except Exception as e:
            self.logger.error(f"Error getting offline trackers: {e}")
            return []
    
    def get_status_summary(self):
        """
        Get a summary of all tracker statuses for dashboard display.
        
        Returns:
            dict: Summary statistics and details
        """
        try:
            summary = self.check_all_trackers()
            
            # Add percentage calculations
            total = summary.get('total_trackers', 0)
            if total > 0:
                summary['percentages'] = {
                    'online': round((summary['online'] / total) * 100, 1),
                    'offline': round((summary['offline'] / total) * 100, 1),
                    'unknown': round((summary['unknown'] / total) * 100, 1)
                }
            
            # Add offline tracker details
            summary['offline_trackers'] = self.get_offline_trackers()
            
            # Add trackers that have been offline for more than 30 minutes (critical)
            summary['critical_offline'] = self.get_offline_trackers(duration_minutes=30)
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Error getting status summary: {e}")
            return {
                'error': str(e),
                'timestamp': timezone.now()
            }


# Singleton instance
tracker_status_service = TrackerStatusService()
