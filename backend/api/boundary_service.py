"""
Boundary Crossing Detection Service
Detects when boats cross municipal boundaries and triggers SMS notifications
"""

import json
import logging
from typing import Optional, Tuple, Dict, Any
from shapely.geometry import Point, Polygon, shape
from shapely.prepared import prep
from django.utils import timezone
from datetime import timedelta
from django.conf import settings

from django.db.models import Q
from .models import GpsData, MunicipalityBoundary, LandBoundary, Fisherfolk, BirukbilugTracker, FisherfolkBoat, BoundaryCrossing, BoundaryViolationNotification, Boat, Contacts
from .sms_service import send_boundary_crossing_sms
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

# Global cache to prevent duplicate broadcasts within short time window
_LAST_NOTIFICATION_BROADCAST = {}

# Global cache to track which crossings have been broadcast in this process
# Prevents duplicate broadcasts across all code paths
_BROADCASTED_CROSSINGS = {}

class BoundaryService:
    """Service for detecting boundary crossings and sending notifications"""
    
    def __init__(self):
        # Separate stores so we can prefer MunicipalityBoundary over LandBoundary
        self.municipal_polygons = {}
        self.prepared_municipal = {}
        self.land_polygons = {}
        self.prepared_land = {}
        # Lazy-load boundaries to avoid ORM access during ASGI import time
        self._loaded = False

    @staticmethod
    def _normalize_muni(name: Optional[str]) -> Optional[str]:
        if not name:
            return name
        key = str(name).strip().lower()
        aliases = {
            'san fernando': 'City of San Fernando',
            'city of san fernando': 'City of San Fernando',
            'sto. tomas': 'Santo Tomas',
            'santo tomas': 'Santo Tomas',
        }
        return aliases.get(key, name)
    
    def _load_boundaries(self):
        """Load and prepare municipal and land boundary polygons for efficient point-in-polygon tests"""
        try:
            # Load water/ocean boundaries
            boundaries = MunicipalityBoundary.objects.all()
            
            for boundary in boundaries:
                try:
                    # Parse GeoJSON coordinates into Shapely geometry
                    if isinstance(boundary.coordinates, dict):
                        # Already a GeoJSON-like structure
                        geom = shape(boundary.coordinates)
                    else:
                        # Raw coordinate array, need to wrap in GeoJSON structure
                        if isinstance(boundary.coordinates, list) and boundary.coordinates:
                            # Check if it's a simple polygon or multipolygon
                            if isinstance(boundary.coordinates[0], list) and isinstance(boundary.coordinates[0][0], list):
                                # MultiPolygon or Polygon with holes
                                geom_dict = {
                                    "type": "Polygon", 
                                    "coordinates": boundary.coordinates
                                }
                            else:
                                # Simple coordinate array
                                geom_dict = {
                                    "type": "Polygon", 
                                    "coordinates": [boundary.coordinates]
                                }
                            geom = shape(geom_dict)
                        else:
                            logger.warning(f"Invalid coordinates for {boundary.name}")
                            continue
                    
                    if geom.is_valid:
                        self.municipal_polygons[boundary.name] = geom
                        # Prepare polygon for faster point-in-polygon tests
                        self.prepared_municipal[boundary.name] = prep(geom)
                        logger.info(f"Loaded boundary for {boundary.name}")
                    else:
                        logger.warning(f"Invalid geometry for {boundary.name}")
                        
                except Exception as e:
                    logger.error(f"Error processing boundary for {boundary.name}: {e}")
            
            # Load land boundaries
            land_boundaries = LandBoundary.objects.all()
            for land_boundary in land_boundaries:
                try:
                    if isinstance(land_boundary.coordinates, dict):
                        geom = shape(land_boundary.coordinates)
                    else:
                        if isinstance(land_boundary.coordinates, list) and land_boundary.coordinates:
                            if isinstance(land_boundary.coordinates[0], list) and isinstance(land_boundary.coordinates[0][0], list):
                                geom_dict = {"type": "Polygon", "coordinates": land_boundary.coordinates}
                            else:
                                geom_dict = {"type": "Polygon", "coordinates": [land_boundary.coordinates]}
                            geom = shape(geom_dict)
                        else:
                            logger.warning(f"Invalid coordinates for land boundary {land_boundary.name}")
                            continue
                    
                    if geom.is_valid:
                        self.land_polygons[land_boundary.name] = geom
                        self.prepared_land[land_boundary.name] = prep(geom)
                        logger.info(f"Loaded land boundary for {land_boundary.name}")
                    else:
                        logger.warning(f"Invalid geometry for land boundary {land_boundary.name}")
                except Exception as e:
                    logger.error(f"Error processing land boundary for {land_boundary.name}: {e}")
                    
            logger.info(f"Loaded {len(self.municipal_polygons) + len(self.land_polygons)} municipal and land boundaries")
            self._loaded = True
            
        except Exception as e:
            logger.error(f"Error loading boundaries: {e}")
    
    def _ensure_loaded(self):
        if not getattr(self, '_loaded', False):
            # Load boundaries the first time we are used (inside a sync context)
            self._load_boundaries()

    def is_coastal_muni(self, name: Optional[str]) -> bool:
        """Return True if the given municipality has a water polygon (MunicipalityBoundary).
        Alias-safe and case-insensitive (e.g., San Fernando == City of San Fernando).
        """
        if not name:
            return False
        try:
            self._ensure_loaded()
            norm = self._normalize_muni(name)
            # Check direct and common aliases
            candidates = {
                str(name).strip(),
                norm,
            }
            # Add reciprocal aliases explicitly
            if norm == 'City of San Fernando' or str(name).strip().lower() == 'san fernando':
                candidates.add('San Fernando')
                candidates.add('City of San Fernando')
            if norm == 'Santo Tomas' or str(name).strip().lower() in ('sto. tomas', 'santo tomas'):
                candidates.add('Santo Tomas')
                candidates.add('Sto. Tomas')
            return any(c in self.municipal_polygons for c in candidates)
        except Exception:
            return False

    def get_municipality_at_point(self, latitude: float, longitude: float) -> Optional[str]:
        """
        Determine which municipality a GPS point falls within
        
        Args:
            latitude (float): GPS latitude
            longitude (float): GPS longitude
            
        Returns:
            str: Municipality name or None if not within any boundary
        """
        try:
            # Ensure boundary cache is available
            self._ensure_loaded()
            point = Point(longitude, latitude)  # Shapely uses (lon, lat) order

            # 1) Prefer MunicipalityBoundary (prepared contains)
            for muni, prepared in self.prepared_municipal.items():
                if prepared.contains(point):
                    return muni

            # 1b) Municipality fallback: include boundary edges using covers()
            for muni, geom in self.municipal_polygons.items():
                try:
                    if geom.covers(point):  # includes boundary
                        return muni
                except Exception:
                    pass

            # 1c) Municipality tolerance: treat points within small epsilon of border as inside
            try:
                eps = float(getattr(settings, 'BOUNDARY_EDGE_TOLERANCE_DEG', 0.00020))  # ~22m
            except Exception:
                eps = 0.00020
            if eps > 0:
                for muni, geom in self.municipal_polygons.items():
                    try:
                        if geom.distance(point) <= eps:
                            logger.debug(f"Point within tolerance ({eps}) of municipal border: {muni}")
                            return muni
                    except Exception:
                        pass

            # 2) Fallback to LandBoundary (prepared contains)
            for muni, prepared in self.prepared_land.items():
                if prepared.contains(point):
                    return muni

            # 2b) Land fallback: include boundary edges using covers()
            for muni, geom in self.land_polygons.items():
                try:
                    if geom.covers(point):
                        return muni
                except Exception:
                    pass

            # 2c) Land tolerance: treat points within small epsilon of border as inside
            if eps > 0:
                for muni, geom in self.land_polygons.items():
                    try:
                        if geom.distance(point) <= eps:
                            logger.debug(f"Point within tolerance ({eps}) of land border: {muni}")
                            return muni
                    except Exception:
                        pass

            # 3) Final fallback: some datasets may be stored as (lat, lon). Try swapped order.
            point_swapped = Point(latitude, longitude)

            # Municipality swapped
            for muni, geom in self.municipal_polygons.items():
                try:
                    if geom.covers(point_swapped):
                        logger.warning("Boundary fallback used: lat/lng swapped for municipality polygon")
                        return muni
                except Exception:
                    pass
            # Municipality swapped tolerance
            if eps > 0:
                for muni, geom in self.municipal_polygons.items():
                    try:
                        if geom.distance(point_swapped) <= eps:
                            logger.warning("Fallback used: swapped coords within tolerance for municipal polygon")
                            return muni
                    except Exception:
                        pass

            # Land swapped
            for muni, geom in self.land_polygons.items():
                try:
                    if geom.covers(point_swapped):
                        logger.warning("Boundary fallback used: lat/lng swapped for land polygon")
                        return muni
                except Exception:
                    pass
            # Land swapped tolerance
            if eps > 0:
                for muni, geom in self.land_polygons.items():
                    try:
                        if geom.distance(point_swapped) <= eps:
                            logger.warning("Fallback used: swapped coords within tolerance for land polygon")
                            return muni
                    except Exception:
                        pass

            return None

        except Exception as e:
            logger.error(f"Error checking point ({latitude}, {longitude}): {e}")
            return None
    
    def check_boundary_crossing(self, boat_id: int, current_lat: float, current_lng: float, mfbr_number: str = None) -> Optional[Dict[str, Any]]:
        """
        Check if a boat has crossed a municipal boundary
        
        Args:
            boat_id (int): ID of the boat (can be 0 if using MFBR)
            current_lat (float): Current GPS latitude
            current_lng (float): Current GPS longitude
            mfbr_number (str): MFBR number for boat lookup (optional)
            
        Returns:
            Dict with crossing details if boundary was crossed, None otherwise
        """
        try:
            # Get current municipality
            current_municipality = self.get_municipality_at_point(current_lat, current_lng)
            
            # Get previous GPS position for this boat (within last hour to avoid old data)
            one_hour_ago = timezone.now() - timedelta(hours=1)
            
            # Query by MFBR if boat_id is 0 or MFBR is provided
            if boat_id == 0 or mfbr_number:
                # First, try to get MFBR from latest GPS if not provided
                if not mfbr_number:
                    latest_gps = GpsData.objects.filter(
                        latitude=current_lat,
                        longitude=current_lng
                    ).order_by('-timestamp').first()
                    if latest_gps and latest_gps.mfbr_number:
                        mfbr_number = latest_gps.mfbr_number
                
                if mfbr_number:
                    previous_gps = GpsData.objects.filter(
                        mfbr_number=mfbr_number,
                        timestamp__gte=one_hour_ago
                    ).exclude(
                        latitude=current_lat, 
                        longitude=current_lng
                    ).order_by('-timestamp').first()
                else:
                    previous_gps = None
            else:
                previous_gps = GpsData.objects.filter(
                    boat_id=boat_id,
                    timestamp__gte=one_hour_ago
                ).exclude(
                    latitude=current_lat, 
                    longitude=current_lng
                ).order_by('-timestamp').first()
            
            if not previous_gps:
                # No previous position to compare, store current municipality for future comparisons
                logger.debug(f"No previous GPS data for boat {boat_id}")
                return None
            
            # Get previous municipality
            previous_municipality = self.get_municipality_at_point(
                previous_gps.latitude, 
                previous_gps.longitude
            )
            
            # Check if municipality changed
            if (current_municipality and previous_municipality and 
                current_municipality != previous_municipality):
                
                # Check if we've already logged this crossing recently (within last 30 minutes)
                # to avoid duplicate notifications for minor GPS fluctuations
                recent_crossing_cutoff = timezone.now() - timedelta(minutes=30)
                recent_crossing = BoundaryCrossing.objects.filter(
                    boat_id=boat_id,
                    from_municipality=previous_municipality,
                    to_municipality=current_municipality,
                    crossing_timestamp__gte=recent_crossing_cutoff
                ).first()
                
                if recent_crossing:
                    logger.debug(f"Recent crossing already logged for boat {boat_id} from {previous_municipality} to {current_municipality}")
                    return None
                
                logger.info(f"Boat {boat_id} crossed from {previous_municipality} to {current_municipality}")
                
                return {
                    'boat_id': boat_id,
                    'from_municipality': previous_municipality,
                    'to_municipality': current_municipality,
                    'current_position': {'lat': current_lat, 'lng': current_lng},
                    'previous_position': {'lat': previous_gps.latitude, 'lng': previous_gps.longitude},
                    'timestamp': timezone.now(),
                    'time_since_last_position': timezone.now() - previous_gps.timestamp
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error checking boundary crossing for boat {boat_id}: {e}")
            return None
    
    def send_boundary_notification(self, crossing_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send SMS notification for boundary crossing
        
        Args:
            crossing_data (dict): Boundary crossing information
            
        Returns:
            Dict with notification result
        """
        try:
            boat_id = crossing_data['boat_id']
            
            # Try to get fisherfolk information through different possible relationships
            fisherfolk = None
            phone_number = None
            fisherfolk_name = "Fisher"
            boat = None
            
            # Method 1: Try through BirukbilugTracker -> Boat -> Fisherfolk
            try:
                tracker = BirukbilugTracker.objects.select_related('boat__fisherfolk_registration_number').get(
                    boat_id=boat_id
                )
                if tracker.boat:
                    boat = tracker.boat
                    if tracker.boat.fisherfolk_registration_number:
                        fisherfolk = tracker.boat.fisherfolk_registration_number
            except BirukbilugTracker.DoesNotExist:
                pass
            
            # Method 2: Try through FisherfolkBoat relationship
            if not fisherfolk:
                try:
                    # Get FisherfolkBoat where the boat matches our boat_id
                    # Note: This assumes boat_id corresponds to some boat identifier
                    fisherfolk_boat = FisherfolkBoat.objects.select_related(
                        'registration_number', 'mfbr_number'
                    ).filter(mfbr_number_id=str(boat_id)).first()
                    
                    if fisherfolk_boat:
                        if fisherfolk_boat.registration_number:
                            fisherfolk = fisherfolk_boat.registration_number
                        if fisherfolk_boat.mfbr_number:
                            boat = fisherfolk_boat.mfbr_number
                except Exception as e:
                    logger.warning(f"Could not find fisherfolk through FisherfolkBoat: {e}")
            
            # Method 3: Try direct lookup by MFBR
            if not fisherfolk and not boat:
                try:
                    boat = Boat.objects.filter(mfbr_number=str(boat_id)).first()
                    if boat and boat.fisherfolk_registration_number:
                        fisherfolk = boat.fisherfolk_registration_number
                except Exception:
                    pass
            
            if fisherfolk:
                fisherfolk_name = f"{fisherfolk.first_name} {fisherfolk.last_name}"
                
                # Try to get phone number from Contacts table first (emergency contact)
                try:
                    contacts = Contacts.objects.filter(fisherfolk=fisherfolk).first()
                    if contacts and contacts.contact_contactno:
                        phone_number = contacts.contact_contactno
                        logger.info(f"Using emergency contact number from Contacts table")
                except Exception as e:
                    logger.warning(f"Could not get contact from Contacts table: {e}")
                
                # Fallback to fisherfolk's own contact number
                if not phone_number and fisherfolk.contact_number:
                    phone_number = fisherfolk.contact_number
                
                logger.info(f"Found fisherfolk: {fisherfolk_name} ({phone_number})")
            else:
                logger.warning(f"Could not find fisherfolk information for boat {boat_id}")
                return {
                    'success': False,
                    'error': 'Fisherfolk information not found',
                    'boat_id': boat_id,
                    'fisherfolk': None
                }
            
            if not phone_number:
                logger.warning(f"No phone number available for boat {boat_id}")
                return {
                    'success': False,
                    'error': 'Phone number not available',
                    'boat_id': boat_id,
                    'fisherfolk': fisherfolk
                }
            
            # Send SMS notification
            boat_name_text = None
            try:
                boat_name_text = boat.boat_name if boat and getattr(boat, 'boat_name', None) else None
            except Exception:
                boat_name_text = None
            if not boat_name_text:
                boat_name_text = f"Boat {boat_id}" if boat_id else "Boat"

            sms_result = send_boundary_crossing_sms(
                phone_number=phone_number,
                fisherfolk_name=fisherfolk_name,
                from_municipality=crossing_data['from_municipality'],
                to_municipality=crossing_data['to_municipality'],
                boat_name=boat_name_text
            )
            
            # Log the boundary crossing to database
            # Note: boat_id field is IntegerField, so if boat_id is a string (MFBR), convert to 0
            try:
                # Convert boat_id to int, use 0 if it's a string (MFBR)
                int_boat_id = 0
                try:
                    int_boat_id = int(boat_id)
                except (ValueError, TypeError):
                    int_boat_id = 0
                    logger.info(f"Using boat_id=0 for MFBR: {boat_id}")
                
                boundary_crossing = BoundaryCrossing.objects.create(
                    boat_id=int_boat_id,
                    fisherfolk=fisherfolk,
                    from_municipality=crossing_data['from_municipality'],
                    to_municipality=crossing_data['to_municipality'],
                    from_lat=crossing_data['previous_position']['lat'],
                    from_lng=crossing_data['previous_position']['lng'],
                    to_lat=crossing_data['current_position']['lat'],
                    to_lng=crossing_data['current_position']['lng'],
                    sms_sent=sms_result.get('success', False),
                    sms_response=sms_result,
                    phone_number=phone_number
                )
                logger.info(f"Boundary crossing logged with ID: {boundary_crossing.id}")
            except Exception as log_error:
                logger.error(f"Failed to log boundary crossing: {log_error}")
            
            return {
                'success': sms_result.get('success', False),
                'sms_result': sms_result,
                'fisherfolk_name': fisherfolk_name,
                'phone_number': phone_number[-4:] + "****",  # Mask phone number in logs
                'crossing_data': crossing_data
            }
            
        except Exception as e:
            logger.error(f"Error sending boundary notification: {e}")
            return {
                'success': False,
                'error': str(e),
                'crossing_data': crossing_data
            }


# Global instance for easy access
boundary_service = BoundaryService()

# Dwell threshold (minutes) before alerting on a new municipality
_DWELL_MINUTES = getattr(settings, 'BOUNDARY_DWELL_MINUTES', 15)

# Cooldown window (hours) to prevent repeated violations per boat per boundary
_VIOLATION_COOLDOWN_HOURS = getattr(settings, 'BOUNDARY_VIOLATION_COOLDOWN_HOURS', 12)


def check_and_notify_boundary_crossing(boat_id: int, latitude: float, longitude: float, mfbr_number: Optional[str] = None, home_municipality: Optional[str] = None, tracker_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Check for municipality change and enforce dwell-before-alert policy.
    - When a change is detected, record a BoundaryCrossing with sms_sent=False (pending).
    - Only when the boat has stayed in the new municipality for >= _DWELL_MINUTES
      will the SMS be sent and the device instructed to beep.
    - If there is no Boat linked (no MFBR match), use home_municipality (e.g., tracker's municipality)
      as the registered municipality fallback so we can still detect violations without movement.
    
    Args:
        boat_id: Integer boat ID (can be 0 if not known)
        latitude: Current GPS latitude
        longitude: Current GPS longitude
        mfbr_number: Optional MFBR number for boat identification
        home_municipality: Optional fallback for boat's registered municipality (e.g., tracker.municipality)
        tracker_id: Optional tracker identifier for logging/debugging only
    
    Returns a dict that may include keys: crossing_detected, pending, dwell_alert_sent, beep
    """
    try:
        now_ts = timezone.now()
        current_municipality = boundary_service.get_municipality_at_point(latitude, longitude)
        
        # If MFBR not provided and boat_id is 0, try to get MFBR from latest GPS data
        if not mfbr_number and boat_id == 0:
            latest_gps = GpsData.objects.filter(
                latitude=latitude,
                longitude=longitude
            ).order_by('-timestamp').first()
            if latest_gps and latest_gps.mfbr_number:
                mfbr_number = latest_gps.mfbr_number
                logger.info(f"Found MFBR from GPS: {mfbr_number}")
        
        # Log the MFBR being used for tracking
        if mfbr_number:
            logger.info(f"Processing boundary check for MFBR: {mfbr_number} at ({latitude}, {longitude})")
        else:
            logger.info(f"Processing boundary check for boat_id={boat_id} at ({latitude}, {longitude})")

        # 1) Detect new crossing and record as pending (no SMS yet)
        # BUT: Skip detection only if we truly have a pending crossing for THIS boat context
        # For MFBR-based boats (boat_id=0), do not rely on global pending rows; duplicates are prevented later
        if mfbr_number:
            existing_pending = False  # allow detection; later logic filters/avoids duplicates per MFBR
        else:
            existing_pending = BoundaryCrossing.objects.filter(
                boat_id=boat_id,
                sms_sent=False
            ).exists()
        
        if existing_pending:
            logger.info(f"Skipping new crossing detection - already have pending crossing for boat {boat_id}")
            crossing_data = None
        else:
            crossing_data = boundary_service.check_boundary_crossing(boat_id, latitude, longitude, mfbr_number)
        
        result: Dict[str, Any] = {'crossing_detected': False, 'pending': False, 'dwell_alert_sent': False, 'beep': False}

        if crossing_data:
            result['crossing_detected'] = True
            result['pending'] = True
            try:
                # CRITICAL FIX: Always use boat_id=0 for MFBR-based boats (stable across restarts)
                # Store MFBR in a custom field or use GpsData relationship
                save_boat_id = 0 if mfbr_number else boat_id
                
                # Create a pending crossing record (avoid duplicates in short window)
                # Check by municipality transition, not boat_id (since MFBR-based all use 0)
                if mfbr_number:
                    # For MFBR boats, check recent GPS data to avoid duplicate crossings
                    recent_gps_same_route = GpsData.objects.filter(
                        mfbr_number=mfbr_number,
                        timestamp__gte=now_ts - timedelta(minutes=30)
                    ).exists()
                    from_norm = boundary_service._normalize_muni(crossing_data['from_municipality'])
                    to_norm = boundary_service._normalize_muni(crossing_data['to_municipality'])
                    existing_recent = BoundaryCrossing.objects.filter(
                        boat_id=0,
                        from_municipality=from_norm,
                        to_municipality=to_norm,
                        crossing_timestamp__gte=now_ts - timedelta(minutes=30)
                    ).first() if recent_gps_same_route else None
                else:
                    from_norm = boundary_service._normalize_muni(crossing_data['from_municipality'])
                    to_norm = boundary_service._normalize_muni(crossing_data['to_municipality'])
                    existing_recent = BoundaryCrossing.objects.filter(
                        boat_id=save_boat_id,
                        from_municipality=from_norm,
                        to_municipality=to_norm,
                        crossing_timestamp__gte=now_ts - timedelta(minutes=30)
                    ).first()
                if not existing_recent:
                    # Normalize municipality names before saving (alias-safe, case-insensitive)
                    from_norm = boundary_service._normalize_muni(crossing_data['from_municipality'])
                    to_norm = boundary_service._normalize_muni(crossing_data['to_municipality'])
                    BoundaryCrossing.objects.create(
                        boat_id=save_boat_id,
                        fisherfolk=None,  # linked later when sending SMS
                        from_municipality=from_norm,
                        to_municipality=to_norm,
                        from_lat=crossing_data['previous_position']['lat'],
                        from_lng=crossing_data['previous_position']['lng'],
                        to_lat=crossing_data['current_position']['lat'],
                        to_lng=crossing_data['current_position']['lng'],
                        sms_sent=False,
                        sms_response=None
                    )
            except Exception as log_err:
                logger.warning(f"Failed to log pending crossing: {log_err}")

        # 2) ALWAYS check for pending crossings that have exceeded dwell time,
        #    regardless of current municipality (boat may have moved)
        # This ensures notifications are sent even if boat is no longer in violated area
        
        # First, get boat info for MFBR-based queries
        boat = None
        registered_municipality = None
        if mfbr_number:
            boat = Boat.objects.filter(mfbr_number=mfbr_number).select_related('fisherfolk_registration_number__address').first()
        elif boat_id != 0:
            boat = Boat.objects.filter(mfbr_number=str(boat_id)).select_related('fisherfolk_registration_number__address').first()
        
        # Determine home municipality (HOME WATERS) with coastal-first preference
        tracker_muni = None
        if tracker_id:
            try:
                trk = BirukbilugTracker.objects.filter(BirukBilugID=tracker_id).first()
                if trk and trk.municipality:
                    tracker_muni = trk.municipality
            except Exception:
                tracker_muni = None

        ff_muni = None
        if boat:
            try:
                ff = boat.fisherfolk_registration_number
                if ff and getattr(ff, 'address', None) and getattr(ff.address, 'municipality', None):
                    ff_muni = ff.address.municipality
            except Exception:
                ff_muni = None

        # Candidate order: Boat registered -> Tracker municipality -> Fisherfolk address
        candidates = []
        if boat and getattr(boat, 'registered_municipality', None):
            candidates.append(boat.registered_municipality)
        if tracker_muni:
            candidates.append(tracker_muni)
        if ff_muni:
            candidates.append(ff_muni)

        # Choose the first that is coastal; else fall back to original behavior
        registered_municipality = None
        for cand in candidates:
            try:
                if boundary_service.is_coastal_muni(cand):
                    registered_municipality = cand
                    break
            except Exception:
                pass
        if not registered_municipality:
            if boat and getattr(boat, 'registered_municipality', None):
                registered_municipality = boat.registered_municipality
            elif home_municipality:
                registered_municipality = home_municipality
            elif tracker_muni:
                registered_municipality = tracker_muni
            elif ff_muni:
                registered_municipality = ff_muni
        
        # CRITICAL FIX: Query crossings by checking GPS data MFBR, not unstable hash
        # For MFBR-based boats, we need to find crossings by matching recent GPS data
        if mfbr_number:
            # Find all unsent crossings where this MFBR has recent GPS data
            # Get all pending crossings for boat_id=0 (MFBR boats)
            all_pending = BoundaryCrossing.objects.filter(
                boat_id=0,
                sms_sent=False
            ).order_by('-crossing_timestamp')
            
            # Filter to only those where we have GPS data for this MFBR
            pending_crossings = []
            for crossing in all_pending:
                # Check if this MFBR has GPS points in the destination municipality
                has_gps_in_dest = GpsData.objects.filter(
                    mfbr_number=mfbr_number,
                    timestamp__gte=crossing.crossing_timestamp
                ).exists()
                if has_gps_in_dest:
                    pending_crossings.append(crossing)
            
            logger.info(f"Found {len(pending_crossings)} pending crossing(s) for MFBR {mfbr_number}")
        else:
            # Traditional boat_id lookup
            pending_crossings_query = BoundaryCrossing.objects.filter(
                boat_id=boat_id,
                sms_sent=False
            ).order_by('-crossing_timestamp')
            pending_crossings = list(pending_crossings_query)
        
        # Deduplicate pending crossings by route (boat_id + from -> to), keep earliest
        try:
            original_list = list(pending_crossings)
            unique_map = {}
            for c in original_list:
                key = (c.boat_id, c.from_municipality, c.to_municipality)
                if key not in unique_map or c.crossing_timestamp < unique_map[key].crossing_timestamp:
                    unique_map[key] = c
            # Mark extras as deduplicated so they won't be processed on subsequent loops
            for c in original_list:
                key = (c.boat_id, c.from_municipality, c.to_municipality)
                if unique_map.get(key) is not c:
                    try:
                        c.sms_sent = True
                        c.sms_response = {'skipped': 'duplicate pending crossing suppressed'}
                        c.save(update_fields=['sms_sent', 'sms_response'])
                    except Exception:
                        pass
            pending_crossings = list(unique_map.values())
        except Exception:
            pass
        
        # Process each pending crossing (limit to 5 per GPS update to prevent excessive processing)
        processed_count = 0
        max_crossings_per_update = 5
        
        for pending in pending_crossings:
            if processed_count >= max_crossings_per_update:
                logger.info(f"Reached max crossings per update ({max_crossings_per_update}), skipping remaining")
                break
            dwell = now_ts - pending.crossing_timestamp

            # Check if boat has returned home (check CURRENT municipality, not pending destination)
            norm_current = boundary_service._normalize_muni(current_municipality)
            norm_home = boundary_service._normalize_muni(registered_municipality)

            if norm_home and norm_current == norm_home:
                # Boat returned home, clear this pending crossing immediately (regardless of dwell)
                logger.info(f"✅ Clearing pending crossing {pending.id} - boat returned to home municipality ({current_municipality})")
                pending.sms_sent = True
                pending.sms_response = {
                    'skipped': 'Boat returned to registered municipality',
                    'cleared_at': now_ts.isoformat()
                }
                pending.save(update_fields=['sms_sent', 'sms_response'])

                # Also clear/dismiss any UI notifications for this crossing
                try:
                    cleared_count = BoundaryViolationNotification.objects.filter(
                        boundary_crossing=pending,
                        status='pending'
                    ).update(status='dismissed')
                    if cleared_count > 0:
                        logger.info(f"✅ Dismissed {cleared_count} UI notification(s) for crossing {pending.id}")
                except Exception as clear_err:
                    logger.warning(f"Could not clear UI notification: {clear_err}")

                # Broadcast violation cleared via WebSocket
                try:
                    channel_layer = get_channel_layer()
                    if channel_layer:
                        async_to_sync(channel_layer.group_send)(
                            'gps_updates',
                            {
                                'type': 'violation_cleared',
                                'data': {
                                    'mfbr_number': mfbr_number,
                                    'boat_id': boat_id,
                                    'crossing_id': pending.id,
                                    'returned_to': current_municipality,
                                    'cleared_at': now_ts.isoformat()
                                }
                            }
                        )
                        logger.info(f"📡 Broadcasted violation_cleared event")
                except Exception as broadcast_err:
                    logger.warning(f"Could not broadcast violation cleared: {broadcast_err}")

                processed_count += 1  # Count cleared crossings too
                continue

            # Skip if not enough dwell time
            if dwell < timedelta(minutes=_DWELL_MINUTES):
                logger.info(f"Pending crossing {pending.id} needs {_DWELL_MINUTES - (dwell.total_seconds()/60):.1f} more minutes")
                continue

            # Dwell threshold exceeded - send notification!
            logger.info(f"⚠️ Processing pending crossing {pending.id}: {pending.from_municipality} → {pending.to_municipality}, dwell={int(dwell.total_seconds()/60)}min")
            
            # CRITICAL FIX: Mark crossing as processed IMMEDIATELY to prevent duplicate notifications
            # This prevents race conditions when multiple GPS updates arrive quickly
            try:
                pending.sms_sent = True
                pending.sms_response = {'status': 'processing', 'timestamp': now_ts.isoformat()}
                pending.save(update_fields=['sms_sent', 'sms_response'])
                logger.info(f"✅ Marked crossing {pending.id} as processing to prevent duplicates")
            except Exception as mark_err:
                logger.error(f"Failed to mark crossing as processing: {mark_err}")
                # If we can't mark it, skip to avoid duplicates
                continue

            # Enforce per-boat, per-boundary cooldown (per day by violation_timestamp, local TZ window)
            try:
                vt = getattr(pending, 'crossing_timestamp', None) or now_ts
                vt_local = timezone.localtime(vt)
                today_start = vt_local.replace(hour=0, minute=0, second=0, microsecond=0)
                tomorrow_start = today_start + timedelta(days=1)
                mfbr_local = (mfbr_number or (boat.mfbr_number if boat else ""))
                # Enforce cooldown per boundary pair (from -> to), not just destination
                cooldown_q = (
                    Q(to_municipality=pending.to_municipality)
                    & Q(from_municipality=pending.from_municipality)
                    & Q(violation_timestamp__gte=today_start)
                    & Q(violation_timestamp__lt=tomorrow_start)
                )
                if mfbr_local:
                    cooldown_q &= (Q(mfbr_number=mfbr_local) | Q(boat__mfbr_number=mfbr_local))
                elif boat:
                    cooldown_q &= Q(boat=boat)
                else:
                    cooldown_q &= Q(boundary_crossing__boat_id=pending.boat_id)
                has_recent_violation = BoundaryViolationNotification.objects.filter(cooldown_q).exists()
            except Exception as cooldown_err:
                logger.warning(f"Cooldown check failed, proceeding without cooldown: {cooldown_err}")
                has_recent_violation = False

            if has_recent_violation:
                # Skip sending notification/beep within cooldown window
                try:
                    pending.sms_response = {
                        'skipped': 'violation suppressed by cooldown',
                        'cooldown_hours': _VIOLATION_COOLDOWN_HOURS,
'cooldown_until': (now_ts + timedelta(hours=_VIOLATION_COOLDOWN_HOURS)).isoformat()
                    }
                    pending.save(update_fields=['sms_response'])
                except Exception:
                    pass
                result['dwell_alert_sent'] = False
                result['beep'] = False
                result['cooldown'] = True
                processed_count += 1
                continue
            
            effective_boat_id = mfbr_number if mfbr_number else boat_id
            crossing_payload = {
                'boat_id': effective_boat_id,
                'from_municipality': pending.from_municipality,
                'to_municipality': pending.to_municipality,
                'current_position': {'lat': latitude, 'lng': longitude},
                'previous_position': {'lat': pending.from_lat, 'lng': pending.from_lng},
                'timestamp': now_ts,
                'time_since_last_position': dwell,
            }
            
            # Send SMS notification
            try:
                notification_result = boundary_service.send_boundary_notification(crossing_payload)
            except Exception as send_err:
                logger.error(f"send_boundary_notification failed: {send_err}")
                notification_result = {'success': False, 'error': str(send_err)}
            
            # Update crossing record with final result
            try:
                from datetime import datetime as dt, date as d
                
                def serialize_value(obj):
                    if isinstance(obj, (dt, d)):
                        return obj.isoformat()
                    elif isinstance(obj, timedelta):
                        return str(obj)
                    elif isinstance(obj, dict):
                        return {k: serialize_value(v) for k, v in obj.items()}
                    elif isinstance(obj, (list, tuple)):
                        return [serialize_value(item) for item in obj]
                    else:
                        return obj
                
                # Keep sms_sent=True but update with final result
                safe_response = serialize_value(notification_result)
                pending.sms_response = safe_response
                pending.save(update_fields=['sms_response'])
            except Exception as upd_err:
                logger.warning(f"Failed to update BoundaryCrossing after SMS: {upd_err}")
            
            # Set result flags
            result['dwell_alert_sent'] = True
            result['beep'] = True
            result['notification_result'] = notification_result
            processed_count += 1  # Increment counter for processed crossings
            
            # Create UI notification (only if one doesn't exist for this crossing)
            try:
                # STRONG DUPLICATE PREVENTION: Check multiple conditions
                # 1. Check by boundary_crossing
                existing_by_crossing = BoundaryViolationNotification.objects.filter(
                    boundary_crossing=pending
                ).first()
                
                # 2. Check by MFBR + route + same day (per-day cooldown by violation_timestamp, local TZ window)
                vt = getattr(pending, 'crossing_timestamp', None) or now_ts
                vt_local = timezone.localtime(vt)
                today_start = vt_local.replace(hour=0, minute=0, second=0, microsecond=0)
                tomorrow_start = today_start + timedelta(days=1)
                existing_by_route = BoundaryViolationNotification.objects.filter(
                    Q(to_municipality=pending.to_municipality)
                    & Q(from_municipality=pending.from_municipality)
                    & Q(violation_timestamp__gte=today_start)
                    & Q(violation_timestamp__lt=tomorrow_start)
                )
                if boat:
                    existing_by_route = existing_by_route.filter(Q(boat=boat) | Q(boat__isnull=True))
                if mfbr_number or (boat and getattr(boat, 'mfbr_number', None)):
                    mf = (mfbr_number or boat.mfbr_number)
                    existing_by_route = existing_by_route.filter(Q(mfbr_number=mf) | Q(boat__mfbr_number=mf))
                if existing_by_crossing or existing_by_route:
                    logger.info(f"Notification already exists (same day) (crossing={existing_by_crossing is not None}, route={existing_by_route is not None}), skipping creation")
                    result['ui_notification_created'] = False
                    # Do not beep again within the cooldown window
                    result['beep'] = False
                else:
                    boat_name = boat.boat_name if boat else f"Boat {boat_id}"
                    mfbr_local = mfbr_number or (boat.mfbr_number if boat else "")
                    tracker_number = tracker_id or ""
                    fisherfolk = notification_result.get('fisherfolk', None) or pending.fisherfolk
                    
                    if not fisherfolk and boat:
                        fisherfolk = boat.fisherfolk_registration_number
                    
                    # Create a fresh pending notification when no same-day duplicate exists
                    created = True
                    try:
                        violation_ts = getattr(pending, 'crossing_timestamp', None) or now_ts
                        notification = BoundaryViolationNotification.objects.create(
                            boundary_crossing=pending,
                            boat=boat,
                            fisherfolk=fisherfolk,
                            boat_name=boat_name,
                            mfbr_number=mfbr_local or '',
                            tracker_number=tracker_number,
                            from_municipality=pending.from_municipality,
                            to_municipality=pending.to_municipality,
                            violation_timestamp=violation_ts,
                            current_lat=latitude,
                            current_lng=longitude,
                            dwell_duration=int(dwell.total_seconds()),
                            status='pending',
                        )
                    except Exception as create_err:
                        # If creation failed due to race, fall back to fetching the latest matching pending and update it
                        created = False
                        notification = BoundaryViolationNotification.objects.filter(
                            Q(mfbr_number=mfbr_local) | Q(boat__mfbr_number=mfbr_local) | Q(boundary_crossing=pending),
                            from_municipality=pending.from_municipality,
                            to_municipality=pending.to_municipality,
                            status='pending'
                        ).order_by('-created_at').first()

                    
                    # If not newly created, update a few live fields but DO NOT re-toast
                    if not created:
                        try:
                            notification.current_lat = latitude
                            notification.current_lng = longitude
                            notification.dwell_duration = int(dwell.total_seconds())
                            notification.save(update_fields=['current_lat', 'current_lng', 'dwell_duration'])
                        except Exception:
                            pass
                    
                    result['ui_notification_created'] = bool(created)
                    
                    # Broadcast via WebSocket
                    try:
                        channel_layer = get_channel_layer()
                    except Exception:
                        channel_layer = None
                    
                    if channel_layer:
                        # CRITICAL: Check if this crossing has already been broadcast
                        crossing_id = pending.id
                        if created:
                            if crossing_id in _BROADCASTED_CROSSINGS:
                                logger.info(f"⚠️ Crossing {crossing_id} already broadcast, skipping duplicate")
                            else:
                                # Extra guard: do not broadcast if a recent route-notification exists in cooldown window
                                try:
                                    if BoundaryViolationNotification.objects.filter(
                                        Q(mfbr_number=notification.mfbr_number) | Q(boat__mfbr_number=notification.mfbr_number),
                                        from_municipality=notification.from_municipality,
                                        to_municipality=notification.to_municipality,
                                        created_at__date=timezone.localdate()
                                    ).exclude(id=notification.id).exists():
                                        logger.info("Skipping broadcast due to per-day cooldown duplicate")
                                    else:
                                        notification_data = {
                                            'id': notification.id,
                                            'boat_name': notification.boat_name,
                                            'mfbr_number': notification.mfbr_number,
                                            'tracker_number': notification.tracker_number,
                                            'from_municipality': notification.from_municipality,
                                            'to_municipality': notification.to_municipality,
                                            'dwell_duration_minutes': notification.dwell_duration // 60,
                                            'violation_timestamp': notification.violation_timestamp.isoformat(),
                                            'current_lat': notification.current_lat,
                                            'current_lng': notification.current_lng,
                                            'fisherfolk_name': f"{fisherfolk.first_name} {fisherfolk.last_name}" if fisherfolk else None,
                                            'action': 'created',
                                        }
                                        async_to_sync(channel_layer.group_send)(
                                            'gps_updates',
                                            {
                                                'type': 'boundary_notification',
                                                'data': notification_data,
                                            }
                                        )
                                        _BROADCASTED_CROSSINGS[crossing_id] = now_ts.timestamp()
                                        _LAST_NOTIFICATION_BROADCAST[f"{mfbr_number}_{pending.from_municipality}_{pending.to_municipality}"] = now_ts.timestamp()
                                        logger.info(f"📡 Broadcasted notification for {mfbr_number}_{pending.from_municipality}_{pending.to_municipality} (crossing {crossing_id})")
                                except Exception:
                                    pass
                        else:
                            # For updates, emit a lightweight update event with no toast expectation
                            async_to_sync(channel_layer.group_send)(
                                'gps_updates',
                                {
                                    'type': 'notification_update',
                                    'data': {
                                        'notification_id': notification.id,
                                        'mfbr_number': notification.mfbr_number,
                                        'to_municipality': notification.to_municipality,
                                        'dwell_duration_minutes': notification.dwell_duration // 60,
                                        'current_lat': notification.current_lat,
                                        'current_lng': notification.current_lng,
                                        'action': 'update',
                                    }
                                }
                            )
            except Exception as notif_err:
                logger.error(f"Failed to create UI notification: {notif_err}")
                result['ui_notification_created'] = False
            
            # Continue processing remaining pending crossings (allow multiple crossings per update)
            # The duplicate prevention logic above prevents spam
        
        # OLD CODE BELOW - keep for backward compatibility if current_municipality is available
        if current_municipality:
            # Get boat's registered municipality to check if this is a violation
            registered_municipality = None
            boat = None
            try:
                # Resolve boat by MFBR or boat_id
                boat = None
                if mfbr_number:
                    boat = Boat.objects.filter(mfbr_number=mfbr_number).select_related('fisherfolk_registration_number__address').first()
                if not boat and boat_id != 0:
                    boat = Boat.objects.filter(mfbr_number=str(boat_id)).select_related('fisherfolk_registration_number__address').first()

                # Resolve tracker municipality if available
                tracker_muni = None
                if tracker_id:
                    try:
                        trk = BirukbilugTracker.objects.filter(BirukBilugID=tracker_id).first()
                        if trk and trk.municipality:
                            tracker_muni = trk.municipality
                    except Exception:
                        tracker_muni = None

                ff_muni = None
                if boat:
                    try:
                        ff = boat.fisherfolk_registration_number
                        if ff and getattr(ff, 'address', None) and getattr(ff.address, 'municipality', None):
                            ff_muni = ff.address.municipality
                    except Exception:
                        ff_muni = None

                # Candidate order: Boat registered -> Tracker municipality -> Fisherfolk address -> provided home
                candidates = []
                if boat and getattr(boat, 'registered_municipality', None):
                    candidates.append(boat.registered_municipality)
                if tracker_muni:
                    candidates.append(tracker_muni)
                if ff_muni:
                    candidates.append(ff_muni)
                if home_municipality:
                    candidates.append(home_municipality)

                # Prefer first coastal municipality
                registered_municipality = None
                for cand in candidates:
                    try:
                        if boundary_service.is_coastal_muni(cand):
                            registered_municipality = cand
                            logger.info(f"Home municipality (coastal) chosen: {registered_municipality}")
                            break
                    except Exception:
                        pass
                if not registered_municipality and candidates:
                    registered_municipality = candidates[0]
                    logger.info(f"Home municipality fallback: {registered_municipality}")
            except Exception as e:
                logger.warning(f"Could not get boat's registered municipality: {e}")
            logger.info(f"Current municipality: {current_municipality} | Home municipality: {registered_municipality}")
            
            # Normalize aliases for robust comparison
            norm_current = boundary_service._normalize_muni(current_municipality)
            norm_home = boundary_service._normalize_muni(registered_municipality)

            # Check if current municipality matches registered municipality
            # If they match, no need to alert (boat is in its home waters)
            if norm_home and norm_current == norm_home:
                logger.info(f"Boat {boat_id} is in its registered municipality ({current_municipality}). No alert needed.")
                # Clear ALL pending crossings since boat is home (regardless of destination)
                # Use stable convention: MFBR-based pending rows use boat_id=0
                clear_boat_id = 0 if mfbr_number else boat_id
                BoundaryCrossing.objects.filter(
                    boat_id=clear_boat_id,
                    sms_sent=False
                ).update(sms_sent=True, sms_response={'skipped': 'Boat returned to registered municipality', 'cleared_at': now_ts.isoformat()})

                # Also dismiss any active (pending) UI notifications so the front-end clears the red marker
                try:
                    notif_q = Q(status='pending')
                    if mfbr_number:
                        notif_q &= (Q(mfbr_number=mfbr_number) | Q(boat__mfbr_number=mfbr_number))
                    else:
                        notif_q &= Q(boundary_crossing__boat_id=clear_boat_id)
                    cleared_count = BoundaryViolationNotification.objects.filter(notif_q).update(status='dismissed')
                    if cleared_count > 0:
                        logger.info(f"✅ Dismissed {cleared_count} UI notification(s) for MFBR {mfbr_number or boat_id} on return to home")
                        # Broadcast violation_cleared event
                        try:
                            channel_layer = get_channel_layer()
                            if channel_layer:
                                async_to_sync(channel_layer.group_send)(
                                    'gps_updates',
                                    {
                                        'type': 'violation_cleared',
                                        'data': {
                                            'mfbr_number': mfbr_number,
                                            'boat_id': boat_id,
                                            'returned_to': current_municipality,
                                            'cleared_at': now_ts.isoformat()
                                        }
                                    }
                                )
                        except Exception as broadcast_err:
                            logger.warning(f"Could not broadcast violation cleared: {broadcast_err}")
                except Exception as clear_err:
                    logger.warning(f"Could not clear UI notifications on home return: {clear_err}")

                return result

            # Ensure a pending record exists even if the actual crossing moment wasn't captured
            # (e.g., device started after crossing). This seeds dwell timing from now.
            # CRITICAL FIX: Only seed if there are NO pending crossings at all (including already processed ones)
            # This prevents creating duplicate violations when boat is already in violation state
            try:
                # Check if ANY crossing exists for this boat to current municipality (pending OR processed)
                # Use stable convention: MFBR-based pending rows use boat_id=0
                check_exists_boat_id = 0 if mfbr_number else boat_id
                
                any_crossing_exists = BoundaryCrossing.objects.filter(
                    boat_id=check_exists_boat_id,
                    to_municipality=current_municipality,
                    sms_sent=False  # only consider pending rows; processed crossings should not block new seed
                ).exists()
                
                # Also check if there's an active UI notification for this boat in this municipality
                has_active_notification = False
                if mfbr_number:
                    has_active_notification = BoundaryViolationNotification.objects.filter(
                        mfbr_number=mfbr_number,
                        to_municipality=current_municipality,
                        status='pending'
                    ).exists()
                
                logger.info(
                    f"[SEED DEBUG] current={current_municipality}, home={registered_municipality}, "
                    f"pending_exists={any_crossing_exists}, active_notif={has_active_notification}, "
                    f"mfbr={mfbr_number}, boat_id={boat_id}"
                )
                if not any_crossing_exists and not has_active_notification and registered_municipality:
                    logger.info(f"No pending crossing for boat {boat_id} to {current_municipality}, seeding new pending crossing")
                    # Try to backdate the crossing timestamp to first time seen in current municipality (last few hours)
                    seed_ts = now_ts
                    try:
                        if mfbr_number:
                            window_start = now_ts - timedelta(hours=6)
                            qs = GpsData.objects.filter(mfbr_number=mfbr_number, timestamp__gte=window_start).order_by('timestamp')[:500]
                            for g in qs:
                                muni = boundary_service.get_municipality_at_point(g.latitude, g.longitude)
                                if muni == current_municipality:
                                    seed_ts = g.timestamp
                                    break
                    except Exception as seed_ex:
                        logger.warning(f"Could not backdate pending crossing: {seed_ex}")

                    # Use stable convention: MFBR-based pending rows use boat_id=0
                    seed_boat_id = 0 if mfbr_number else boat_id
                    
                    pending_row = BoundaryCrossing.objects.create(
                        boat_id=seed_boat_id,
                        fisherfolk=None,
                        from_municipality=registered_municipality,
                        to_municipality=current_municipality,
                        from_lat=latitude,
                        from_lng=longitude,
                        to_lat=latitude,
                        to_lng=longitude,
                        sms_sent=False,
                        sms_response=None,
                    )
                    # crossing_timestamp uses auto_now_add; update it explicitly to our backdated seed_ts
                    try:
                        BoundaryCrossing.objects.filter(pk=pending_row.pk).update(crossing_timestamp=seed_ts)
                    except Exception:
                        pass
                    logger.info(
                        f"Seeded pending crossing for boat {boat_id}: {registered_municipality} → {current_municipality} at {seed_ts}"
                    )
                else:
                    if any_crossing_exists:
                        logger.info(f"Crossing already exists for boat {boat_id} to {current_municipality}, skipping seed")
                    if has_active_notification:
                        logger.info(f"Active notification exists for MFBR {mfbr_number} to {current_municipality}, skipping seed")
            except Exception as seed_err:
                logger.warning(f"Could not seed pending crossing: {seed_err}")
            
            # CRITICAL FIX: Check if we already processed a crossing in the first section above
            # If dwell_alert_sent is True, skip this old code section to prevent duplicate beeps
            if result.get('dwell_alert_sent', False):
                logger.info(f"Crossing already processed in first section, skipping old code section")
                return result
            
            # Use stable convention: MFBR-based pending rows use boat_id=0
            query_boat_id = 0 if mfbr_number else boat_id
            
            pending = BoundaryCrossing.objects.filter(
                boat_id=query_boat_id,
                to_municipality=current_municipality,
                sms_sent=False
            ).order_by('-crossing_timestamp').first()

            if pending:
                dwell = now_ts - pending.crossing_timestamp
                logger.info(
                    f"⏱ Pending crossing found for boat_id={boat_id} → {current_municipality}: "
                    f"dwell={int(dwell.total_seconds())}s, threshold={_DWELL_MINUTES}m"
                )
                if dwell >= timedelta(minutes=_DWELL_MINUTES):
                    # Build crossing_data-like payload from the pending record
                    # Use MFBR as boat_id if we have it, otherwise use boat_id
                    effective_boat_id = mfbr_number if mfbr_number else boat_id
                    crossing_payload = {
                        'boat_id': effective_boat_id,
                        'from_municipality': pending.from_municipality,
                        'to_municipality': pending.to_municipality,
                        'current_position': {'lat': latitude, 'lng': longitude},
                        'previous_position': {'lat': pending.from_lat, 'lng': pending.from_lng},
                        'timestamp': now_ts,
                        'time_since_last_position': dwell,
                    }
                    logger.info(f"Sending notification for boat: {effective_boat_id}")
                    
                    # CRITICAL FIX: Mark crossing as processed IMMEDIATELY to prevent duplicate notifications
                    # This prevents race conditions when multiple GPS updates arrive quickly
                    try:
                        pending.sms_sent = True
                        pending.sms_response = {'status': 'processing', 'timestamp': now_ts.isoformat()}
                        pending.save(update_fields=['sms_sent', 'sms_response'])
                        logger.info(f"✅ Marked crossing {pending.id} as processing to prevent duplicates")
                    except Exception as mark_err:
                        logger.error(f"Failed to mark crossing as processing: {mark_err}")
                        # If we can't mark it, skip to avoid duplicates
                        return result
                    
                    # BEFORE sending, enforce the same cooldown as the main path (per-day per boundary pair by violation_timestamp, local TZ window)
                    try:
                        vt = getattr(pending, 'crossing_timestamp', None) or now_ts
                        vt_local = timezone.localtime(vt)
                        today_start = vt_local.replace(hour=0, minute=0, second=0, microsecond=0)
                        tomorrow_start = today_start + timedelta(days=1)
                        mfbr_local = (mfbr_number or (boat.mfbr_number if boat else ""))
                        cooldown_q = (
                            Q(to_municipality=pending.to_municipality)
                            & Q(from_municipality=pending.from_municipality)
                            & Q(violation_timestamp__gte=today_start)
                            & Q(violation_timestamp__lt=tomorrow_start)
                        )
                        if mfbr_local:
                            cooldown_q &= (Q(mfbr_number=mfbr_local) | Q(boat__mfbr_number=mfbr_local))
                        elif boat:
                            cooldown_q &= Q(boat=boat)
                        else:
                            cooldown_q &= Q(boundary_crossing__boat_id=pending.boat_id)
                        has_recent_violation = BoundaryViolationNotification.objects.filter(cooldown_q).exists()
                    except Exception as cooldown_err:
                        logger.warning(f"Cooldown check (old path) failed, proceeding without cooldown: {cooldown_err}")
                        has_recent_violation = False
                    
                    if has_recent_violation:
                        try:
                            pending.sms_response = {
                                'skipped': 'violation suppressed by cooldown',
                                'cooldown_hours': _VIOLATION_COOLDOWN_HOURS,
                                'cooldown_until': (now_ts + timedelta(hours=_VIOLATION_COOLDOWN_HOURS)).isoformat()
                            }
                            pending.save(update_fields=['sms_response'])
                        except Exception:
                            pass
                        result['dwell_alert_sent'] = False
                        result['beep'] = False
                        result['cooldown'] = True
                        return result
                    
                    # Try to send SMS, but do not block UI notification on failures
                    try:
                        notification_result = boundary_service.send_boundary_notification(crossing_payload)
                    except Exception as send_err:
                        logger.error(f"send_boundary_notification failed: {send_err}")
                        notification_result = {'success': False, 'error': str(send_err)}
                    
                    # Update record with final notification result
                    try:
                        from datetime import datetime as dt, date as d
                        
                        def serialize_value(obj):
                            """Recursively serialize datetime objects"""
                            if isinstance(obj, (dt, d)):
                                return obj.isoformat()
                            elif isinstance(obj, timedelta):
                                return str(obj)
                            elif isinstance(obj, dict):
                                return {k: serialize_value(v) for k, v in obj.items()}
                            elif isinstance(obj, (list, tuple)):
                                return [serialize_value(item) for item in obj]
                            else:
                                return obj
                        
                        # Keep sms_sent=True but update with final result
                        safe_response = serialize_value(notification_result)
                        pending.sms_response = safe_response
                        pending.save(update_fields=['sms_response'])
                    except Exception as upd_err:
                        logger.warning(f"Failed to update BoundaryCrossing after SMS: {upd_err}")

                    # Dwell threshold met regardless of SMS success
                    result['dwell_alert_sent'] = True
                    result['beep'] = True
                    result['notification_result'] = notification_result
                    
                    # Always create UI notification and broadcast, even if SMS failed
                    if True:
                        try:
                            # Check if notification already exists for this crossing
                            existing_notification = BoundaryViolationNotification.objects.filter(
                                boundary_crossing=pending
                            ).first()
                            
                            if existing_notification:
                                logger.info(f"Notification already exists for crossing {pending.id}, skipping duplicate")
                                result['ui_notification_created'] = False
                            else:
                                # Get boat and fisherfolk info
                                boat = None
                                boat_name = f"Boat {boat_id}"
                                mfbr_local = mfbr_number or ""
                                tracker_number = ""
                                fisherfolk = notification_result.get('fisherfolk', None) or pending.fisherfolk
                                
                                # Try to get boat details - prioritize mfbr from function param
                                try:
                                    # First try using the MFBR number passed to this function
                                    if mfbr_local:
                                        boat = Boat.objects.filter(mfbr_number=mfbr_local).first()
                                    
                                    # Fallback: Check if boat_id is actually an MFBR string
                                    if not boat and boat_id:
                                        boat = Boat.objects.filter(mfbr_number=str(boat_id)).first()
                                    
                                    # Fallback: Try to get boat through tracker
                                    if not boat and boat_id:
                                        tracker = BirukbilugTracker.objects.filter(boat_id=boat_id).first()
                                        if tracker and tracker.boat:
                                            boat = tracker.boat
                                            tracker_number = tracker.BirukBilugID
                                            
                                    if boat:
                                        boat_name = boat.boat_name or boat_name
                                        mfbr_local = boat.mfbr_number or mfbr_local or ""
                                        if not fisherfolk:
                                            fisherfolk = boat.fisherfolk_registration_number
                                            
                                except Exception as e:
                                    logger.warning(f"Could not get boat details for notification: {e}")
                                
                                # Create or fetch existing pending notification (idempotent)
                                notif_filters = {
                                    'status': 'pending',
                                    'from_municipality': pending.from_municipality,
                                    'to_municipality': pending.to_municipality,
                                }
                                if mfbr_local:
                                    notif_filters['mfbr_number'] = mfbr_local
                                else:
                                    notif_filters['boundary_crossing'] = pending
                                
                                notification, created = BoundaryViolationNotification.objects.get_or_create(
                                    **notif_filters,
                                    defaults={
                                        'boundary_crossing': pending,
                                        'boat': boat,
                                        'fisherfolk': fisherfolk,
                                        'boat_name': boat_name,
                                        'mfbr_number': mfbr_local or '',
                                        'tracker_number': tracker_number,
                                        'from_municipality': pending.from_municipality,
                                        'to_municipality': pending.to_municipality,
                                        'violation_timestamp': now_ts,
                                        'current_lat': latitude,
                                        'current_lng': longitude,
                                        'dwell_duration': int(dwell.total_seconds()),
                                    },
                                )
                                if not created:
                                    try:
                                        notification.current_lat = latitude
                                        notification.current_lng = longitude
                                        notification.dwell_duration = int(dwell.total_seconds())
                                        notification.save(update_fields=['current_lat', 'current_lng', 'dwell_duration'])
                                    except Exception:
                                        pass
                                result['ui_notification_created'] = bool(created)
                                logger.info(f"{'Created' if created else 'Updated'} UI notification #{notification.id} for crossing {pending.id}")
                                
                                # Broadcast notification via WebSocket
                                try:
                                    channel_layer = get_channel_layer()
                                except Exception as channel_err:
                                    logger.warning(f"Could not get channel layer: {channel_err}")
                                    channel_layer = None
                                    
                                if channel_layer:
                                    crossing_id = pending.id
                                    if created:
                                        try:
                                            # Per-day duplicate guard based on the violation day
                                            vt = notification.violation_timestamp or now_ts
                                            vt_local = timezone.localtime(vt)
                                            today_start = vt_local.replace(hour=0, minute=0, second=0, microsecond=0)
                                            tomorrow_start = today_start + timedelta(days=1)
                                            if BoundaryViolationNotification.objects.filter(
                                                Q(mfbr_number=notification.mfbr_number) | Q(boat__mfbr_number=notification.mfbr_number),
                                                from_municipality=notification.from_municipality,
                                                to_municipality=notification.to_municipality,
                                                violation_timestamp__gte=today_start,
                                                violation_timestamp__lt=tomorrow_start
                                            ).exclude(id=notification.id).exists():
                                                logger.info("Skipping broadcast due to per-day cooldown duplicate")
                                            else:
                                                notification_data = {
                                                    'id': notification.id,
                                                    'boat_name': notification.boat_name,
                                                    'mfbr_number': notification.mfbr_number,
                                                    'tracker_number': notification.tracker_number,
                                                    'from_municipality': notification.from_municipality,
                                                    'to_municipality': notification.to_municipality,
                                                    'dwell_duration_minutes': notification.dwell_duration // 60,
                                                    'violation_timestamp': notification.violation_timestamp.isoformat(),
                                                    'current_lat': notification.current_lat,
                                                    'current_lng': notification.current_lng,
                                                    'fisherfolk_name': f"{fisherfolk.first_name} {fisherfolk.last_name}" if fisherfolk else None,
                                                    'action': 'created',
                                                }
                                                async_to_sync(channel_layer.group_send)(
                                                    'gps_updates',
                                                    {
                                                        'type': 'boundary_notification',
                                                        'data': notification_data,
                                                    }
                                                )
                                                _BROADCASTED_CROSSINGS[crossing_id] = now_ts.timestamp()
                                                logger.info(f"📡 Broadcasted new notification #{notification.id} via WebSocket (crossing {crossing_id})")
                                        except Exception:
                                            pass
                                    else:
                                        # Only send a lightweight update event
                                        async_to_sync(channel_layer.group_send)(
                                            'gps_updates',
                                            {
                                                'type': 'notification_update',
                                                'data': {
                                                    'notification_id': notification.id,
                                                    'mfbr_number': notification.mfbr_number,
                                                    'to_municipality': notification.to_municipality,
                                                    'dwell_duration_minutes': notification.dwell_duration // 60,
                                                    'current_lat': notification.current_lat,
                                                    'current_lng': notification.current_lng,
                                                    'action': 'update',
                                                }
                                            }
                                        )
                            
                        except Exception as notif_err:
                            logger.error(f"Failed to create UI notification: {notif_err}")
                            result['ui_notification_created'] = False

        return result

    except Exception as e:
        logger.error(f"Error in boundary crossing check: {e}")
        return {
            'crossing_detected': False,
            'error': str(e)
        }
