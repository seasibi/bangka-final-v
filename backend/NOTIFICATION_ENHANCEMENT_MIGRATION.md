# 🔧 Notification Enhancement Migration Guide

## Database Schema Changes

### 1. Add fields to BoundaryViolationNotification model

Add these fields to `api/models.py` in the `BoundaryViolationNotification` class:

```python
class BoundaryViolationNotification(models.Model):
    # ... existing fields ...
    
    # NEW FIELDS - Add these:
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
    
    # Additional tracking fields
    timestamp_start = models.DateTimeField(null=True, blank=True, help_text='When boat started being idle')
    timestamp_end = models.DateTimeField(null=True, blank=True, help_text='When violation was detected')
    idle_minutes = models.IntegerField(default=0, help_text='Duration boat was idle in minutes')
    contact_person_name = models.CharField(max_length=100, blank=True)
    contact_person_phone = models.CharField(max_length=20, blank=True)
    owner_name = models.CharField(max_length=100, blank=True)  # Cache owner name
    registration_number = models.CharField(max_length=50, blank=True)  # MFBR or registration
    
    def save(self, *args, **kwargs):
        # Auto-generate report number if not set
        if not self.report_number:
            from .models_notification_enhancements import generate_report_number
            self.report_number = generate_report_number()
        super().save(*args, **kwargs)
```

### 2. Create ViolationStatusAuditLog model

Copy `ViolationStatusAuditLog` class from `models_notification_enhancements.py` to `api/models.py`:

```python
class ViolationStatusAuditLog(models.Model):
    """Audit log for violation status changes"""
    violation = models.ForeignKey(BoundaryViolationNotification, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='violation_audits')
    user_role = models.CharField(max_length=100)
    
    old_status = models.CharField(max_length=50)
    new_status = models.CharField(max_length=50)
    old_remarks = models.TextField(blank=True)
    new_remarks = models.TextField(blank=True)
    remarks_changed = models.BooleanField(default=False)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['violation', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.user} changed status: {self.old_status} → {self.new_status}"
    
    @property
    def user_name(self):
        if self.user:
            return f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username
        return "System"
```

### 3. Create and Run Migrations

```bash
# In backend directory
python manage.py makemigrations api
python manage.py migrate
```

## API Endpoints

### Add to `api/urls.py`:

```python
from . import views_notification_enhancements as notif_views

urlpatterns = [
    # ... existing patterns ...
    
    # Notification enhancements
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
```

## Frontend Integration

### 1. Add ViolationToast to MapView

In `frontend/src/maps/MapView.jsx`:

```javascript
import ViolationToast from '../components/Notifications/ViolationToast';

function MapView() {
  const [activeViolation, setActiveViolation] = useState(null);
  
  // Listen for violation events from WebSocket
  const handleViolationDetected = (violationData) => {
    setActiveViolation(violationData);
  };
  
  return (
    <>
      {/* Existing map code */}
      
      {/* Add toast notification */}
      <ViolationToast 
        notification={activeViolation}
        onDismiss={() => setActiveViolation(null)}
      />
    </>
  );
}
```

### 2. Update WebSocket Consumer (Backend)

In `backend/api/consumers.py` or similar:

```python
async def send_violation_notification(self, event):
    """Send violation notification to connected clients"""
    await self.send(text_data=json.dumps({
        'type': 'violation_detected',
        'data': event['data']
    }))
```

### 3. Add Route for Enhanced Notification Page

In `frontend/src/App.jsx`:

```javascript
import EnhancedNotificationPage from './components/Notifications/EnhancedNotificationPage';

// Add route
<Route 
  path="/notifications/:violationId" 
  element={<EnhancedNotificationPage userRole={currentUser.role} />} 
/>
```

## Dependencies

### Backend (Python):

```bash
pip install reportlab  # For PDF generation
```

### Frontend (npm):

```bash
npm install lucide-react  # Icons (if not already installed)
```

## User Roles Configuration

Ensure these roles are defined in your User model:

- `municipal_fishery_coordinator` - Can edit status
- `municipal_agriculturist` - Can edit status  
- `provincial_agriculturist` - Read-only
- `admin` - Read-only

## Testing Checklist

- [ ] Migrations applied successfully
- [ ] API endpoints accessible
- [ ] Toast notification appears on violation
- [ ] Status can be updated by municipal users
- [ ] Status is read-only for provincial/admin
- [ ] Audit log records all changes
- [ ] PDF generation works
- [ ] Tracker history displays correctly
- [ ] Role-based permissions enforced

## Rollback Plan

If issues occur:

```bash
# Rollback migration
python manage.py migrate api <previous_migration_number>

# Remove new routes from urls.py
# Comment out new imports in components
```

## Performance Considerations

- Audit logs are indexed on `violation` and `timestamp`
- PDF generation is synchronous - consider celery for async
- WebSocket may need scaling for high traffic

## Security

- ✅ CSRF protection on update endpoints
- ✅ Authentication required for all endpoints
- ✅ Role-based authorization enforced
- ✅ Audit log tracks IP addresses
- ✅ Input validation on status updates
