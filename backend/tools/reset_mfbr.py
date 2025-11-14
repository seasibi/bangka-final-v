import os, sys
# Ensure project root on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
from django.core.wsgi import get_wsgi_application
get_wsgi_application()

from api.models import BoundaryCrossing, BoundaryViolationNotification

MFBR = os.environ.get('RESET_MFBR', '4567889')

# Clear only rows that block re-triggering while preserving history as much as possible.
# 1) Mark all UI notifs for this MFBR as dismissed (removes 'pending' state that blocks duplicates)
notif_qs = BoundaryViolationNotification.objects.filter(mfbr_number=MFBR, status='pending')
count_notif = notif_qs.update(status='dismissed')
print(f"Dismissed pending notifications for MFBR {MFBR}: {count_notif}")

# 2) Delete only pending crossings (sms_sent=False) for MFBR context (boat_id=0)
cross_qs = BoundaryCrossing.objects.filter(boat_id=0, sms_sent=False)
count_cross = cross_qs.count()
cross_qs.delete()
print(f"Deleted pending crossings (boat_id=0): {count_cross}")

print("Reset complete.")
