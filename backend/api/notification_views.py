from django.utils import timezone
from django.db.models import Q, Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import BoundaryViolationNotification, Boat, GpsData, BoundaryCrossing
from .serializers import BoundaryViolationNotificationSerializer
from datetime import timedelta
import pandas as pd
from django.http import HttpResponse
import json
from django.conf import settings as dj_settings
from .boundary_service import boundary_service, check_and_notify_boundary_crossing


class BoundaryViolationNotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing boundary violation notifications"""
    queryset = BoundaryViolationNotification.objects.all()
    serializer_class = BoundaryViolationNotificationSerializer
    permission_classes = [AllowAny]  # Allow public access for tracking page
    
    def get_queryset(self):
        """Filter notifications based on query params"""
        queryset = super().get_queryset()
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            queryset = queryset.filter(created_at__gte=from_date)
        if to_date:
            queryset = queryset.filter(created_at__lte=to_date)
            
        # Filter by municipality (alias-safe, case-insensitive)
        municipality = self.request.query_params.get('municipality')
        if municipality:
            try:
                from .boundary_service import boundary_service as _bs
                aliases = set([
                    municipality,
                    _bs._normalize_muni(municipality)
                ])
            except Exception:
                aliases = {municipality}
            cond = Q()
            for a in aliases:
                cond |= Q(from_municipality__iexact=a)
                cond |= Q(to_municipality__iexact=a)
            queryset = queryset.filter(cond)
            
        # Filter by boat
        boat_id = self.request.query_params.get('boat')
        if boat_id:
            queryset = queryset.filter(boat_id=boat_id)
            
        return queryset.order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications (pending and not yet read)"""
        count = self.get_queryset().filter(status='pending', read_at__isnull=True).count()
        return Response({'count': count})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a notification as read without clearing the violation state."""
        notification = self.get_object()
        # If it's still active (pending), do NOT change status; only set read metadata
        if notification.status == 'pending':
            notification.read_at = timezone.now()
            try:
                user = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
            except Exception:
                user = None
            notification.read_by = user
            notification.save(update_fields=['read_at', 'read_by'])
        else:
            # For non-active notifications, allow transitioning to read
            notification.status = 'read'
            notification.read_at = timezone.now()
            notification.read_by = request.user
            notification.save()
        
        # Broadcast update via WebSocket (no status change for pending)
        channel_layer = get_channel_layer()
        if channel_layer:
            payload = {
                'notification_id': notification.id,
                'status': notification.status,
            }
            if notification.read_at:
                payload['read_at'] = notification.read_at.isoformat()
            async_to_sync(channel_layer.group_send)(
                'gps_updates',
                {
                    'type': 'notification_update',
                    'data': payload
                }
            )
        
        return Response(self.get_serializer(notification).data)
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all pending notifications as read-at (keep status pending)."""
        try:
            user = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
        except Exception:
            user = None
        updated = self.get_queryset().filter(status='pending').update(
            read_at=timezone.now(),
            read_by=user
        )
        return Response({'updated': updated})
    
    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dismiss a notification"""
        notification = self.get_object()
        notification.status = 'dismissed'
        notification.save()
        return Response(self.get_serializer(notification).data)
    
    @action(detail=False, methods=['get'])
    def active_violations(self, request):
        """Get boats currently in violation (still in wrong municipality)"""
        # Get all pending notifications
        pending_notifications = self.get_queryset().filter(status='pending')
        
        active_violations = []
        for notification in pending_notifications:
            # Check if boat is still in the wrong municipality
            latest_gps = GpsData.objects.filter(
                Q(boat_id=notification.boat.boat_id) | Q(mfbr_number=notification.mfbr_number)
            ).order_by('-timestamp').first()
            
            if latest_gps:
                # You would need to check current municipality here
                # For now, we'll include all pending notifications
                violation_data = self.get_serializer(notification).data
                violation_data['current_location'] = {
                    'lat': latest_gps.latitude,
                    'lng': latest_gps.longitude,
                    'timestamp': latest_gps.timestamp
                }
                active_violations.append(violation_data)
        
        return Response(active_violations)
    
    @action(detail=False, methods=['get'])
    def download_report(self, request):
        """Download Excel report of boundary violations"""
        # Get filtered queryset
        queryset = self.get_queryset()
        
        # Convert to pandas DataFrame
        data = []
        for notification in queryset:
            data.append({
                'Boat Name': notification.boat_name,
                'MFBR Number': notification.mfbr_number,
                'Tracker Number': notification.tracker_number,
                'Fisherfolk': f"{notification.fisherfolk.first_name} {notification.fisherfolk.last_name}" if notification.fisherfolk else 'N/A',
'From Municipality': (getattr(boundary_service, '_normalize_muni', lambda x: x)(notification.from_municipality)),
                'To Municipality': (getattr(boundary_service, '_normalize_muni', lambda x: x)(notification.to_municipality)),
                'Violation Time': notification.violation_timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'Duration (minutes)': notification.dwell_duration // 60,
                'Status': notification.status,
                'Read By': notification.read_by.email if notification.read_by else 'N/A',
                'Read At': notification.read_at.strftime('%Y-%m-%d %H:%M:%S') if notification.read_at else 'N/A'
            })
        
        df = pd.DataFrame(data)
        
        # Create Excel file
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename=boundary_violations_report.xlsx'
        
        with pd.ExcelWriter(response, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Boundary Violations', index=False)
            
            # Get workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Boundary Violations']
            
            # Add formatting
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#D3D3D3',
                'border': 1
            })
            
            # Apply header formatting
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
                
            # Auto-fit columns
            for i, col in enumerate(df.columns):
                column_len = df[col].astype(str).map(len).max()
                column_len = max(column_len, len(col)) + 2
                worksheet.set_column(i, i, column_len)
        
        return response
    
    @action(detail=False, methods=['post'])
    def dev_force_violation(self, request):
        """
        DEBUG-only: Force a boundary violation for a given MFBR without physically moving.
        Steps:
          - Determine current municipality from latest GPS (or provided lat/lng)
          - Determine home municipality from Fisherfolk address (fallback to boat.registered_municipality)
          - Seed a pending crossing backdated beyond the dwell threshold
          - Invoke the standard dwell evaluation to send SMS + WebSocket toast
        """
        if not getattr(dj_settings, 'DEBUG', True):
            return Response({'error': 'Not allowed in production'}, status=403)
        try:
            mfbr = str(request.data.get('mfbr') or request.data.get('mfbr_number') or '').strip()
            if not mfbr:
                return Response({'error': 'mfbr is required'}, status=400)

            lat = request.data.get('lat')
            lng = request.data.get('lng')

            # Resolve boat and home municipality
            boat = Boat.objects.filter(mfbr_number=mfbr).select_related('fisherfolk_registration_number__address').first()
            if not boat:
                return Response({'error': f'Boat with MFBR {mfbr} not found'}, status=404)

            home_muni = None
            ff = boat.fisherfolk_registration_number
            if ff and getattr(ff, 'address', None) and getattr(ff.address, 'municipality', None):
                home_muni = ff.address.municipality
            else:
                home_muni = boat.registered_municipality

            # Resolve coordinates
            latest = None
            if not (lat and lng):
                latest = GpsData.objects.filter(mfbr_number=mfbr).order_by('-timestamp').first()
                if not latest:
                    return Response({'error': 'No GPS data and no lat/lng provided'}, status=400)
                lat, lng = latest.latitude, latest.longitude
            else:
                lat = float(lat)
                lng = float(lng)

            # Determine current municipality
            current_muni = boundary_service.get_municipality_at_point(lat, lng)
            if not current_muni:
                return Response({'error': 'Current municipality not detected for the provided point'}, status=400)
            if current_muni == home_muni:
                return Response({'error': 'Point is in home municipality; move to foreign muni or specify different lat/lng'}, status=400)

            # Backdate pending crossing
            backdate_min = int(request.data.get('backdate_minutes', getattr(dj_settings, 'BOUNDARY_DWELL_MINUTES', 1) + 1))
            seed_ts = timezone.now() - timedelta(minutes=backdate_min)
            pending = BoundaryCrossing.objects.create(
                boat_id=0,
                fisherfolk=None,
                from_municipality=home_muni or 'UNKNOWN',
                to_municipality=current_muni,
                from_lat=lat,
                from_lng=lng,
                to_lat=lat,
                to_lng=lng,
                sms_sent=False,
                sms_response=None,
            )
            try:
                BoundaryCrossing.objects.filter(pk=pending.pk).update(crossing_timestamp=seed_ts)
            except Exception:
                pass

            # Run evaluation (should send immediately since dwell exceeded)
            result = check_and_notify_boundary_crossing(
                0, lat, lng, mfbr_number=mfbr, home_municipality=home_muni
            )

            return Response({
                'ok': True,
                'home_municipality': home_muni,
                'current_municipality': current_muni,
                'backdated_to': seed_ts.isoformat(),
                'result': result,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get statistics about boundary violations"""
        queryset = self.get_queryset()
        
        # Get date range for statistics
        days = int(request.query_params.get('days', 7))
        start_date = timezone.now() - timedelta(days=days)
        
        stats = {
            'total_violations': queryset.count(),
            'pending_violations': queryset.filter(status='pending').count(),
            'read_violations': queryset.filter(status='read').count(),
            'dismissed_violations': queryset.filter(status='dismissed').count(),
            'violations_last_n_days': queryset.filter(created_at__gte=start_date).count(),
            'top_violating_municipalities': list(
                queryset.values('to_municipality')
                .annotate(count=Count('id'))
                .order_by('-count')[:5]
            ),
            'boats_with_violations': queryset.values('boat').distinct().count()
        }
        
        return Response(stats)

    @action(detail=False, methods=['post'])
    def dev_create_sample(self, request):
        """Create a sample pending notification (DEBUG only). Broadcasts toast via WebSocket."""
        from django.conf import settings as dj_settings
        if not getattr(dj_settings, 'DEBUG', True):
            return Response({'error': 'Not allowed in production'}, status=status.HTTP_403_FORBIDDEN)
        
        # Create a minimal BoundaryCrossing row
        from .models import BoundaryCrossing
        now = timezone.now()
        crossing = BoundaryCrossing.objects.create(
            boat_id=1,
            from_municipality='San Juan',
            to_municipality='Bauang',
            from_lat=16.66667,
            from_lng=120.33333,
            to_lat=16.67777,
            to_lng=120.34444,
            sms_sent=False,
        )
        
        notif = BoundaryViolationNotification.objects.create(
            boundary_crossing=crossing,
            boat=None,
            fisherfolk=None,
            boat_name='Boat 1',
            mfbr_number='Boat 1',
            tracker_number='04567',
            from_municipality=crossing.from_municipality,
            to_municipality=crossing.to_municipality,
            violation_timestamp=now,
            current_lat=crossing.to_lat,
            current_lng=crossing.to_lng,
            dwell_duration=15*60,
            status='pending',
        )
        data = self.get_serializer(notif).data
        
        # Broadcast boundary notification via WebSocket
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                'gps_updates',
                {
                    'type': 'boundary_notification',
                    'data': {**data, 'action': 'created'}
                }
            )
        return Response(data, status=201)

    # DEV helper: dismiss all pending notifications for a given MFBR (GET for convenience)
    @action(detail=False, methods=['get'], url_path=r'dev/dismiss_mfbr/(?P<mfbr>[^/]+)')
    def dev_dismiss_mfbr(self, request, mfbr=None):
        try:
            if not mfbr:
                return Response({'error': 'mfbr is required'}, status=400)
            # Dismiss all pending notifications for this MFBR
            qs = self.get_queryset().filter(mfbr_number=mfbr, status='pending')
            ids = list(qs.values_list('id', flat=True))
            count = qs.update(status='dismissed')
            # Broadcast dismissal so UI can clear toasts
            try:
                channel_layer = get_channel_layer()
                if channel_layer and ids:
                    for nid in ids:
                        async_to_sync(channel_layer.group_send)(
                            'gps_updates',
                            {
                                'type': 'notification_update',
                                'data': {'notification_id': nid, 'status': 'dismissed'}
                            }
                        )
            except Exception:
                pass
            return Response({'mfbr': mfbr, 'dismissed': count, 'ids': ids}, status=200)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
