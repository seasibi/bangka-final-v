import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import GpsData

class GPSConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Join GPS updates group
        self.gps_group_name = 'gps_updates'
        
        await self.channel_layer.group_add(
            self.gps_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send initial GPS data to newly connected client
        initial_data = await self.get_latest_gps_data()
        if initial_data:
            await self.send(text_data=json.dumps({
                'type': 'initial_data',
                'data': initial_data
            }))

    async def disconnect(self, close_code):
        # Leave GPS updates group
        await self.channel_layer.group_discard(
            self.gps_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        # Handle messages from client if needed
        pass

    # Receive message from room group
    async def gps_update(self, event):
        # Send GPS update to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'gps_update',
            'data': event['data']
        }))
    
    async def boundary_notification(self, event):
        # Send boundary notification to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'boundary_notification',
            'data': event['data']
        }))
    
    async def notification_update(self, event):
        # Send notification status update to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'notification_update',
            'data': event['data']
        }))
    
    async def violation_cleared(self, event):
        # Send violation cleared event to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'violation_cleared',
            'data': event['data']
        }))

    @database_sync_to_async
    def get_latest_gps_data(self):
        """Get latest GPS positions for all boats, enriched with MFBR and municipality color.
        Falls back to boat_id when MFBR is not known.
        """
        try:
            from django.db.models import Q
            from .models import Boat, BoundaryViolationNotification, BirukbilugTracker, TrackerStatusEvent
            # Build dictionary keyed by consistent identifier:
            # prefer MFBR; else tracker_id; else namespaced boat_id
            latest_positions = {}
            threshold_seconds = 480  # 8 minutes as per requirement
            now = timezone.now()
            
            # Cache for TrackerStatusEvent lookups to avoid duplicate queries
            status_cache = {}

            # Recent GPS data ordered by timestamp (newest first)
            recent_gps = GpsData.objects.all().order_by('-timestamp')[:100]

            # Preload active violations as a set of MFBRs
            active_mfbrs = set(
                BoundaryViolationNotification.objects.filter(status='pending')
                .values_list('mfbr_number', flat=True)
            )

            # Helper to get Municipality color/icon from DB with sensible fallbacks
            from .models import Municipality
            def _get_muni(record_name: str):
                if not record_name:
                    return None
                name = str(record_name).strip()
                muni = Municipality.objects.filter(name__iexact=name).first()
                if not muni and name.lower() == "san fernando":
                    muni = Municipality.objects.filter(name__iexact="City Of San Fernando").first()
                if not muni and name.lower() in ("sto. tomas", "santo tomas"):
                    muni = Municipality.objects.filter(name__iexact="Santo Tomas").first()
                return muni

            for gps in recent_gps:
                # Resolve MFBR using tracker->boat link if gps.mfbr_number is missing
                resolved_mfbr = gps.mfbr_number
                tracker_obj = None
                if not resolved_mfbr and getattr(gps, 'tracker_id', None):
                    try:
                        tracker_obj = BirukbilugTracker.objects.filter(BirukBilugID=gps.tracker_id).first()
                        if tracker_obj and getattr(tracker_obj, 'boat', None) and getattr(tracker_obj.boat, 'mfbr_number', None):
                            resolved_mfbr = tracker_obj.boat.mfbr_number
                    except Exception:
                        pass
                # Consistent unique ID across HTTP and WebSocket (prefer MFBR)
                display_id = resolved_mfbr or (getattr(gps, 'tracker_id', None) or f"boat_{gps.boat_id}")
                # Process only first (newest) per identifier
                if display_id in latest_positions:
                    continue

                # Enrich with boat info when MFBR known
                boat_name = None
                reg_muni = None
                marker_color = "#6b7280"  # default gray
                identifier_icon = "circle"  # default icon
                if resolved_mfbr:
                    boat = Boat.objects.filter(mfbr_number=resolved_mfbr).first()
                    if boat:
                        boat_name = boat.boat_name
                        reg_muni = boat.registered_municipality
                        try:
                            muni_obj = _get_muni(reg_muni)
                            if muni_obj:
                                if getattr(muni_obj, "color", None):
                                    marker_color = muni_obj.color
                                if getattr(muni_obj, "identifier_icon", None):
                                    identifier_icon = muni_obj.identifier_icon or "circle"
                        except Exception:
                            pass
                # Fallback: use tracker municipality when boat not linked yet
                if not reg_muni and getattr(gps, 'tracker_id', None):
                    try:
                        tracker = tracker_obj or BirukbilugTracker.objects.filter(BirukBilugID=gps.tracker_id).first()
                        if tracker and tracker.municipality:
                            reg_muni = tracker.municipality
                            # If tracker is linked to a Boat, use its name when missing
                            try:
                                if (not boat_name or str(boat_name).strip() == "") and getattr(tracker, "boat", None):
                                    boat_name = getattr(tracker.boat, "boat_name", None) or boat_name
                                    if not reg_muni and getattr(tracker.boat, "registered_municipality", None):
                                        reg_muni = tracker.boat.registered_municipality
                            except Exception:
                                pass
                            try:
                                muni_obj = _get_muni(reg_muni)
                                if muni_obj:
                                    if getattr(muni_obj, "color", None):
                                        marker_color = muni_obj.color
                                    if getattr(muni_obj, "identifier_icon", None):
                                        identifier_icon = muni_obj.identifier_icon or "circle"
                            except Exception:
                                pass
                    except Exception:
                        pass

                age_seconds = int((now - gps.timestamp).total_seconds())
                
                # CRITICAL FIX: Use TrackerStatusEvent for status (matches gps_geojson and tracker_history)
                status = "online"  # Default fallback
                tracker_id = getattr(gps, 'tracker_id', None)
                if tracker_id and tracker_id not in status_cache:
                    # Get the most recent status event for this tracker
                    last_status_event = TrackerStatusEvent.objects.filter(tracker_id=tracker_id).order_by('-timestamp').first()
                    if last_status_event:
                        # Only use online/offline status, skip reconnecting/reconnected
                        if last_status_event.status in ['online', 'offline']:
                            status_cache[tracker_id] = last_status_event.status
                        else:
                            status_cache[tracker_id] = None
                    else:
                        status_cache[tracker_id] = None
                
                if tracker_id and status_cache.get(tracker_id):
                    status = status_cache[tracker_id]
                else:
                    # Fallback to age-based status if no TrackerStatusEvent exists
                    status = "online" if age_seconds <= threshold_seconds else "offline"
                
                in_violation = False
                if resolved_mfbr and resolved_mfbr in active_mfbrs:
                    in_violation = True
                
                # Robust fallback: avoid "Unknown Boat" when MFBR is present
                if (not boat_name or str(boat_name).strip() == "") and resolved_mfbr:
                    boat_name = f"Boat {resolved_mfbr}"

                latest_positions[display_id] = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [gps.longitude, gps.latitude]
                    },
                    "properties": {
                        # Keep boat_id for compatibility, but prefer MFBR visually
                        "boat_id": display_id,
                        "mfbr_number": resolved_mfbr,
                        "boat_name": boat_name,
                        "registered_municipality": reg_muni,
                        "marker_color": marker_color,
                        "identifier_icon": identifier_icon,
                        "timestamp": gps.timestamp.isoformat(),
                        "status": status,
                        "age_seconds": age_seconds,
                        "in_violation": in_violation,
                    }
                }

            return {
                "type": "FeatureCollection",
                "features": list(latest_positions.values())
            }
        except Exception as e:
            print(f"Error getting latest GPS data: {e}")
            return None
