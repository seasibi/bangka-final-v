"""
Enhanced Notification API Endpoints
Add these to api/views.py or create new URL patterns
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from datetime import datetime

from .models import BoundaryViolationNotification, ViolationStatusAuditLog
# Serializer not needed - we manually construct response data


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_violation_status(request, violation_id):
    """
    Update violation status and remarks
    Only municipal users can edit
    """
    violation = get_object_or_404(BoundaryViolationNotification, pk=violation_id)
    
    # Check permissions - only municipal users can edit
    # Accept either custom user_role or role fields; match case-insensitively
    raw_role = (
        getattr(request.user, 'user_role', None)
        or getattr(request.user, 'role', None)
        or ''
    )
    user_role = str(raw_role).strip().lower()
    if 'municipal' not in user_role:
        return Response(
            {'error': 'Only municipal users can update violation status'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get new values
    new_status = request.data.get('report_status')
    new_remarks = request.data.get('remarks', '')
    
    # Store old values for audit
    old_status = violation.report_status
    old_remarks = violation.remarks or ''
    
    # Check if anything changed
    if new_status == old_status and new_remarks == old_remarks:
        return Response({'message': 'No changes detected'})
    
    # Update violation with transaction
    with transaction.atomic():
        # Update violation
        if new_status:
            violation.report_status = new_status
        violation.remarks = new_remarks
        violation.status_updated_at = timezone.now()
        violation.status_updated_by = request.user
        violation.save()
        
        # Create audit log entry
        ViolationStatusAuditLog.objects.create(
            violation=violation,
            user=request.user,
            user_role=raw_role or 'Unknown',
            old_status=old_status,
            new_status=new_status or old_status,
            old_remarks=old_remarks,
            new_remarks=new_remarks,
            remarks_changed=(new_remarks != old_remarks),
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
    
    return Response({
        'message': 'Status updated successfully',
        'violation': {
            'id': violation.id,
            'report_status': violation.report_status,
            'remarks': violation.remarks,
            'status_updated_at': violation.status_updated_at,
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_violation_audit_log(request, violation_id):
    """
    Get audit log for a specific violation
    Shows history of all status changes
    """
    violation = get_object_or_404(BoundaryViolationNotification, pk=violation_id)
    
    audit_logs = ViolationStatusAuditLog.objects.filter(
        violation=violation
    ).select_related('user').order_by('-timestamp')
    
    logs_data = []
    for log in audit_logs:
        logs_data.append({
            'id': log.id,
            'user_name': log.user_name,
            'user_role': log.user_role,
            'old_status': log.old_status,
            'new_status': log.new_status,
            'old_remarks': log.old_remarks,
            'new_remarks': log.new_remarks,
            'remarks_changed': log.remarks_changed,
            'timestamp': log.timestamp.isoformat(),
            'ip_address': log.ip_address,
        })
    
    return Response(logs_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_violation_pdf(request, violation_id):
    """
    Generate PDF report with map screenshot
    Returns PDF file
    """
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
    from io import BytesIO
    
    violation = get_object_or_404(BoundaryViolationNotification, pk=violation_id)
    
    # Create PDF buffer
    buffer = BytesIO()
    
    # Create PDF document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18,
    )
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Define styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#374151'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=11,
        textColor=colors.HexColor('#4b5563'),
        spaceAfter=12,
        alignment=TA_JUSTIFY,
        fontName='Helvetica'
    )
    
    # Header
    header_text = """
    <para align=center>
        <b>Office of the Provincial Agriculturist - Fisheries Section</b><br/>
        Provincial Agriculturist Office, Aguila Road, Brgy. II<br/>
        City of San Fernando, La Union 2500<br/>
        Phone: (072) 888-3184 / 607-4492 / 607-4488<br/>
        Email: cpaglaun@yahoo.com
    </para>
    """
    elements.append(Paragraph(header_text, body_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Title
    elements.append(Paragraph("Boundary Violation Report", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Boat Information Table
    boat_data = [
        ['MFBR Number:', violation.mfbr_number or 'N/A'],
        ['Tracker Number:', violation.tracker_number or 'N/A'],
        ['Report Number:', violation.report_number or 'N/A'],
    ]
    
    boat_table = Table(boat_data, colWidths=[2*inch, 4*inch])
    boat_table.setStyle(TableStyle([
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6b7280')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1f2937')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    elements.append(boat_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Violation Description (exact format)
    # Get owner name from fisherfolk
    owner_name = 'N/A'
    if violation.fisherfolk:
        try:
            owner_name = f"{violation.fisherfolk.first_name} {violation.fisherfolk.last_name}".strip() or violation.owner_name or 'N/A'
        except:
            owner_name = violation.owner_name or 'N/A'
    elif violation.owner_name:
        owner_name = violation.owner_name
    
    # Get registration number (prefer MFBR, fallback to fisherfolk registration)
    registration_number = violation.mfbr_number or violation.registration_number or 'N/A'
    
    # Format timestamps
    timestamp_start_str = violation.timestamp_start.strftime('%Y-%m-%d %I:%M %p') if violation.timestamp_start else 'N/A'
    timestamp_end_str = violation.timestamp_end.strftime('%Y-%m-%d %I:%M %p') if violation.timestamp_end else 'N/A'
    
    # Get boat name (prefer boat_name, fallback to boat_id)
    boat_display = violation.boat_name if violation.boat_name else f"Boat {violation.boat_id or 'Unknown'}"
    
    violation_text = f"""
    <b>{boat_display}</b>, owned by <b>{owner_name}</b>, <b>({registration_number})</b>, is now subject to questioning 
    after the boat was observed idle for <b>{violation.idle_minutes} minutes</b> at <b>{timestamp_start_str}</b> to 
    <b>{timestamp_end_str}</b> at location <b>({violation.current_lat:.6f}, {violation.current_lng:.6f})</b>, 
    <b>{violation.to_municipality}</b>, away from registered municipality <b>{violation.from_municipality}</b>. 
    An SMS notification has been sent immediately to the fisherfolk's contact person, 
    <b>{violation.contact_person_name or 'N/A'}</b>, now being subject to questioning. 
    Monitoring continues for any movement or activity.
    """
    
    elements.append(Paragraph(violation_text, body_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Map Screenshot Placeholder
    elements.append(Paragraph("Map Location Screenshot", heading_style))
    # Note: In production, generate actual map screenshot
    elements.append(Paragraph("<i>[Map screenshot would appear here]</i>", body_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Status Information
    elements.append(Paragraph("Report Status", heading_style))
    status_data = [
        ['Status:', violation.report_status],
        ['Remarks:', violation.remarks or 'No remarks'],
    ]
    
    status_table = Table(status_data, colWidths=[2*inch, 4*inch])
    status_table.setStyle(TableStyle([
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6b7280')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1f2937')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    elements.append(status_table)
    elements.append(Spacer(1, 0.4*inch))
    
    # Signature Section
    signature_data = [
        ['Prepared by:', 'Noted by:'],
        ['', ''],
        ['_' * 30, '_' * 30],
        ['Municipal Agriculturist or Provincial Agriculturist', 'Provincial Agriculturist'],
    ]
    
    signature_table = Table(signature_data, colWidths=[3*inch, 3*inch])
    signature_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, 2), 10),
        ('FONTSIZE', (0, 3), (-1, 3), 9),
        ('TEXTCOLOR', (0, 3), (-1, 3), colors.HexColor('#6b7280')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    
    elements.append(signature_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Footer
    footer_text = f"""
    <para align=center fontSize=9 textColor=#9ca3af>
        © {datetime.now().year} Office of the Provincial Agriculturist - Fisheries Section<br/>
        Date Generated: {datetime.now().strftime('%B %d, %Y %I:%M %p')}
    </para>
    """
    elements.append(Paragraph(footer_text, body_style))
    
    # Build PDF
    doc.build(elements)
    
    # Get PDF value
    pdf = buffer.getvalue()
    buffer.close()
    
    # Return PDF response
    from django.http import HttpResponse
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="violation-report-{violation.report_number}.pdf"'
    response.write(pdf)
    
    return response


# URL patterns to add:
"""
from django.urls import path
from . import views_notification_enhancements as notif_views

urlpatterns = [
    path('boundary-notifications/<int:violation_id>/update-status/', 
         notif_views.update_violation_status, 
         name='update-violation-status'),
    
    path('boundary-notifications/<int:violation_id>/audit-log/', 
         notif_views.get_violation_audit_log, 
         name='violation-audit-log'),
    
    path('boundary-notifications/<int:violation_id>/generate-pdf/', 
         notif_views.generate_violation_pdf, 
         name='generate-violation-pdf'),
]
"""
