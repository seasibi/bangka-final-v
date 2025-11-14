"""
Additional models for enhanced notification system
Add these to api/models.py
"""
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

# Add these fields to BoundaryViolationNotification model:
"""
    # Report Status and Remarks
    REPORT_STATUS_CHOICES = [
        ('Not Reported', 'Not Reported'),
        ('Fisherfolk Reported', 'Fisherfolk Reported'),
        ('Under Investigation', 'Under Investigation'),
        ('Resolved', 'Resolved'),
    ]
    
    report_number = models.CharField(max_length=50, unique=True, blank=True, help_text='Format: RPT-YYYY-NNNN')
    report_status = models.CharField(max_length=50, choices=REPORT_STATUS_CHOICES, default='Not Reported')
    remarks = models.TextField(blank=True, help_text='Official remarks about the violation')
    status_updated_at = models.DateTimeField(null=True, blank=True)
    status_updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_violations')
    
    # Additional fields for report
    timestamp_start = models.DateTimeField(null=True, blank=True, help_text='When boat started being idle')
    timestamp_end = models.DateTimeField(null=True, blank=True, help_text='When violation was detected')
    idle_minutes = models.IntegerField(default=0, help_text='Duration boat was idle in minutes')
    contact_person_name = models.CharField(max_length=100, blank=True)
    contact_person_phone = models.CharField(max_length=20, blank=True)
"""


class ViolationStatusAuditLog(models.Model):
    """
    Audit log for violation status changes
    Tracks who changed what and when for compliance
    """
    violation = models.ForeignKey('BoundaryViolationNotification', on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='violation_audits')
    user_role = models.CharField(max_length=100, help_text='Role of user who made the change')
    
    # Change tracking
    old_status = models.CharField(max_length=50)
    new_status = models.CharField(max_length=50)
    old_remarks = models.TextField(blank=True)
    new_remarks = models.TextField(blank=True)
    remarks_changed = models.BooleanField(default=False)
    
    # Metadata
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['violation', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.user} changed {self.violation.boat_name} status: {self.old_status} → {self.new_status}"
    
    @property
    def user_name(self):
        if self.user:
            return f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username
        return "System"


# Helper function to generate report numbers
def generate_report_number():
    """Generate unique report number in format: RPT-2025-0001"""
    from datetime import datetime
    year = datetime.now().year
    
    # Get last report number for this year
    from .models import BoundaryViolationNotification
    last_report = BoundaryViolationNotification.objects.filter(
        report_number__startswith=f'RPT-{year}-'
    ).order_by('-report_number').first()
    
    if last_report:
        # Extract number and increment
        last_number = int(last_report.report_number.split('-')[-1])
        new_number = last_number + 1
    else:
        new_number = 1
    
    return f'RPT-{year}-{new_number:04d}'
