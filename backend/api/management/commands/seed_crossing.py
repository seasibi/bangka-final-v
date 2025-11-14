from django.core.management.base import BaseCommand
from api.models import BirukbilugTracker, Boat, BoundaryCrossing, GpsData
from django.utils import timezone
from datetime import timedelta

class Command(BaseCommand):
    help = 'Manually seed a boundary crossing for testing'

    def handle(self, *args, **options):
        self.stdout.write("=" * 80)
        self.stdout.write("SEEDING BOUNDARY CROSSING")
        self.stdout.write("=" * 80)
        
        try:
            tracker = BirukbilugTracker.objects.get(BirukBilugID="SJU-0001")
            boat = tracker.boat
            
            if not boat:
                self.stdout.write(self.style.ERROR("✗ No boat linked to tracker"))
                return
            
            # Get the oldest GPS point in San Gabriel (to backdate the crossing)
            oldest_gps = GpsData.objects.filter(
                mfbr_number=boat.mfbr_number
            ).order_by('timestamp').first()
            
            if not oldest_gps:
                self.stdout.write(self.style.ERROR("✗ No GPS data found"))
                return
            
            # For MFBR boats, always use boat_id=0 (stable across restarts)
            mfbr = boat.mfbr_number
            stable_boat_id = 0  # MFBR boats use 0
            
            self.stdout.write(f"Boat MFBR: {mfbr}")
            self.stdout.write(f"Using boat_id: {stable_boat_id} (MFBR-based)")
            self.stdout.write(f"Oldest GPS: {oldest_gps.timestamp}")
            
            # Check if crossing already exists
            existing = BoundaryCrossing.objects.filter(
                boat_id=stable_boat_id,
                from_municipality="San Juan",
                to_municipality="San Gabriel"
            ).first()
            
            if existing:
                self.stdout.write(self.style.WARNING(f"\n⚠ Crossing already exists (ID: {existing.id})"))
                self.stdout.write(f"  Created: {existing.crossing_timestamp}")
                self.stdout.write(f"  SMS Sent: {existing.sms_sent}")
                
                # Check age
                age = timezone.now() - existing.crossing_timestamp
                age_min = int(age.total_seconds() / 60)
                self.stdout.write(f"  Age: {age_min} minutes")
                
                if age_min >= 15 and not existing.sms_sent:
                    self.stdout.write(self.style.ERROR(f"\n✗ Crossing is {age_min} minutes old but notification NOT sent!"))
                    self.stdout.write("  This indicates a problem with the notification logic.")
                return
            
            # Create the crossing backdated to the oldest GPS point
            crossing = BoundaryCrossing.objects.create(
                boat_id=stable_boat_id,
                fisherfolk=boat.fisherfolk_registration_number,
                from_municipality="San Juan",
                to_municipality="San Gabriel",
                from_lat=oldest_gps.latitude,
                from_lng=oldest_gps.longitude,
                to_lat=oldest_gps.latitude,
                to_lng=oldest_gps.longitude,
                sms_sent=False,
                sms_response=None
            )
            
            # Backdate the timestamp
            backdate_time = oldest_gps.timestamp
            BoundaryCrossing.objects.filter(pk=crossing.pk).update(
                crossing_timestamp=backdate_time
            )
            
            crossing.refresh_from_db()
            age = timezone.now() - crossing.crossing_timestamp
            age_min = int(age.total_seconds() / 60)
            
            self.stdout.write(self.style.SUCCESS(f"\n✓ CROSSING CREATED!"))
            self.stdout.write(f"  ID: {crossing.id}")
            self.stdout.write(f"  Route: {crossing.from_municipality} → {crossing.to_municipality}")
            self.stdout.write(f"  Timestamp: {crossing.crossing_timestamp}")
            self.stdout.write(f"  Age: {age_min} minutes")
            
            if age_min >= 15:
                self.stdout.write(self.style.SUCCESS(f"\n✓ Age > 15 minutes - Notification SHOULD trigger on next GPS update!"))
            else:
                remaining = 15 - age_min
                self.stdout.write(f"\n⏱ Wait {remaining} more minutes for notification")
            
            self.stdout.write("\n" + "=" * 80)
            self.stdout.write("Next GPS update should trigger the violation notification!")
            self.stdout.write("=" * 80 + "\n")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ Error: {e}"))
            import traceback
            traceback.print_exc()
