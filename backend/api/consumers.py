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
            from .models import Boat, BoundaryViolationNotification, BirukbilugTracker
            # Build dictionary keyed by display identifier (MFBR if available, else boat_id)
            latest_positions = {}
            threshold_seconds = 300  # 5 minutes
            now = timezone.now()

            # Recent GPS data ordered by timestamp (newest first)
            recent_gps = GpsData.objects.all().order_by('-timestamp')[:100]

            # Preload active violations as a set of MFBRs
            active_mfbrs = set(
                BoundaryViolationNotification.objects.filter(status='pending')
                .values_list('mfbr_number', flat=True)
            )

            # Municipality color palette must match frontend
            MUNICIPALITY_COLORS = {
                "San Fernando": "#22c55e",
                "City of San Fernando": "#22c55e",
                "Agoo": "#3b82f6",
                "Aringay": "#ef4444",
                "Bacnotan": "#f59e0b",
                "Bagulin": "#8b5cf6",
                "Balaoan": "#ec4899",
                "Bangar": "#14b8a6",
                "Bauang": "#f97316",
                "Burgos": "#a855f7",
                "Caba": "#06b6d4",
                "Luna": "#84cc16",
                "Naguilian": "#eab308",
                "Pugo": "#10b981",
                "Rosario": "#6366f1",
                "San Gabriel": "#d946ef",
                "San Juan": "#06b6d4",
                "Santol": "#f43f5e",
                "Santo Tomas": "#0ea5e9",
                "Sto. Tomas": "#0ea5e9",
                "Sudipen": "#64748b",
                "Tubao": "#737373",
            }

            for gps in recent_gps:
                display_id = gps.mfbr_number or gps.boat_id
                # Process only first (newest) per identifier
                if display_id in latest_positions:
                    continue

                # Enrich with boat info when MFBR known
                boat_name = None
                reg_muni = None
                marker_color = "#6b7280"  # default gray
                identifier_icon = "circle"  # default icon
                if gps.mfbr_number:
                    boat = Boat.objects.filter(mfbr_number=gps.mfbr_number).first()
                    if boat:
                        boat_name = boat.boat_name
                        reg_muni = boat.registered_municipality
                        marker_color = MUNICIPALITY_COLORS.get(reg_muni, marker_color)
                        # Get identifier_icon from municipality
                        try:
                            from api.models import Municipality
                            muni_obj = Municipality.objects.filter(name=reg_muni).first()
                            if muni_obj:
                                identifier_icon = muni_obj.identifier_icon or "circle"
                        except Exception:
                            pass
                # Fallback: use tracker municipality when boat not linked yet
                if not reg_muni and getattr(gps, 'tracker_id', None):
                    try:
                        tracker = BirukbilugTracker.objects.filter(BirukBilugID=gps.tracker_id).first()
                        if tracker and tracker.municipality:
                            reg_muni = tracker.municipality
                            marker_color = MUNICIPALITY_COLORS.get(reg_muni, marker_color)
                            # Get identifier_icon from tracker municipality
                            try:
                                from api.models import Municipality
                                muni_obj = Municipality.objects.filter(name=reg_muni).first()
                                if muni_obj:
                                    identifier_icon = muni_obj.identifier_icon or "circle"
                            except Exception:
                                pass
                    except Exception:
                        pass

                age_seconds = int((now - gps.timestamp).total_seconds())
                status = "online" if age_seconds <= threshold_seconds else "offline"
                in_violation = False
                if gps.mfbr_number and gps.mfbr_number in active_mfbrs:
                    in_violation = True

                latest_positions[display_id] = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [gps.longitude, gps.latitude]
                    },
                    "properties": {
                        # Keep boat_id for compatibility, but prefer MFBR visually
                        "boat_id": display_id,
                        "mfbr_number": gps.mfbr_number,
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
