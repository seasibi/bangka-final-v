from django.core.management.base import BaseCommand
from api.models import BoundaryViolationNotification

class Command(BaseCommand):
    help = 'Show all violation notifications'

    def handle(self, *args, **options):
        violations = BoundaryViolationNotification.objects.all().order_by('-created_at')
        
        self.stdout.write(f"\n{'='*80}")
        self.stdout.write(f"VIOLATION NOTIFICATIONS ({violations.count()} total)")
        self.stdout.write(f"{'='*80}\n")
        
        if not violations.exists():
            self.stdout.write("No violations found")
            return
        
        for v in violations:
            self.stdout.write(f"\nViolation ID: {v.id}")
            self.stdout.write(f"  Boat: {v.boat_name} (MFBR: {v.mfbr_number})")
            self.stdout.write(f"  Route: {v.from_municipality} → {v.to_municipality}")
            self.stdout.write(f"  Status: {v.status}")
            self.stdout.write(f"  Created: {v.created_at}")
            self.stdout.write(f"  Dwell: {v.dwell_duration // 60} minutes")
            self.stdout.write(f"  Location: ({v.current_lat:.6f}, {v.current_lng:.6f})")
            if v.fisherfolk:
                self.stdout.write(f"  Fisherfolk: {v.fisherfolk.first_name} {v.fisherfolk.last_name}")
