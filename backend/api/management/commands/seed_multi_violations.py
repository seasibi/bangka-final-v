from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, time, datetime

from api.models import Boat, GpsData, BoundaryCrossing
from api.boundary_service import boundary_service, check_and_notify_boundary_crossing


class Command(BaseCommand):
    help = "Seed multiple boundary violations across different days for UI/testing"

    def add_arguments(self, parser):
        parser.add_argument("--mfbr", type=str, required=True, help="Target boat by MFBR number (required)")
        parser.add_argument("--days", type=int, default=3, help="How many distinct days to seed (default: 3)")
        parser.add_argument("--per-day", type=int, default=1, help="How many violations per day (default: 1)")
        parser.add_argument(
            "--start-days-ago", type=int, default=1,
            help="Start seeding from N days ago (default: 1). Example: 1 -> yesterday, 2 -> two days ago"
        )
        parser.add_argument(
            "--dwell-minutes", type=int, default=20,
            help="Backdate each pending crossing by this many minutes to exceed dwell threshold (default: 20)"
        )
        parser.add_argument(
            "--hour", type=int, default=8,
            help="Hour of day (0-23) to timestamp violations (default: 8)"
        )
        parser.add_argument("--dry-run", action="store_true", help="Print only; do not write to DB")

    def handle(self, *args, **opts):
        mfbr: str = str(opts["mfbr"]).strip()
        days: int = int(opts["days"])
        per_day: int = int(opts["per_day"]) or 1
        start_days_ago: int = int(opts["start_days_ago"]) or 1
        dwell_minutes: int = int(opts["dwell_minutes"]) or 20
        hour: int = max(0, min(23, int(opts["hour"]) or 8))
        dry_run: bool = bool(opts.get("dry_run"))

        self.stdout.write("=" * 80)
        self.stdout.write(f"SEEDING MULTI-DAY VIOLATIONS for {mfbr}")
        self.stdout.write("=" * 80)

        boat = Boat.objects.filter(mfbr_number=mfbr).select_related("fisherfolk_registration_number__address").first()
        if not boat:
            self.stdout.write(self.style.ERROR(f"✗ Boat with MFBR {mfbr} not found"))
            return

        # Resolve home municipality (prefer fisherfolk address)
        home_muni = None
        ff = getattr(boat, "fisherfolk_registration_number", None)
        if ff and getattr(ff, "address", None) and getattr(ff.address, "municipality", None):
            home_muni = ff.address.municipality
        if not home_muni:
            home_muni = getattr(boat, "registered_municipality", None)
        if not home_muni:
            self.stdout.write(self.style.ERROR("✗ Could not resolve home municipality for boat"))
            return
        self.stdout.write(f"Home municipality: {home_muni}")

        # Find a GPS point that maps to a foreign municipality (different from home)
        foreign_muni = None
        lat = None
        lng = None

        # Try recent GPS points
        recent_start = timezone.now() - timedelta(days=7)
        gps_points = GpsData.objects.filter(mfbr_number=mfbr, timestamp__gte=recent_start).order_by("timestamp").all()[:1000]
        norm_home = boundary_service._normalize_muni(home_muni)
        for g in gps_points:
            muni = boundary_service.get_municipality_at_point(g.latitude, g.longitude)
            if muni and boundary_service._normalize_muni(muni) != norm_home:
                foreign_muni = muni
                lat, lng = g.latitude, g.longitude
                break

        # Fallback: synthesize a foreign point (simple toggle between two known names)
        if not foreign_muni:
            foreign_muni = "San Juan" if norm_home == boundary_service._normalize_muni("City Of San Fernando") else "City Of San Fernando"
            # Example coords near San Juan
            lat, lng = (16.6730, 120.3447)
        self.stdout.write(f"Foreign municipality for test: {foreign_muni}")

        created_count = 0
        for d in range(start_days_ago, start_days_ago + days):
            # Target day = today - d days, at chosen hour
            day_dt_local = timezone.localtime().replace(hour=hour, minute=0, second=0, microsecond=0) - timedelta(days=d)
            # Backdate to ensure dwell met
            seed_ts = day_dt_local - timedelta(minutes=dwell_minutes)

            for i in range(per_day):
                at_ts = seed_ts + timedelta(minutes=i)  # vary a bit within the hour
                self.stdout.write(f"\nDay -{d} at {at_ts.isoformat()} -> {home_muni} → {foreign_muni}")

                if dry_run:
                    continue

                # Create pending crossing (boat_id=0 for MFBR-based path)
                pending = BoundaryCrossing.objects.create(
                    boat_id=0,
                    fisherfolk=None,
                    from_municipality=boundary_service._normalize_muni(home_muni),
                    to_municipality=boundary_service._normalize_muni(foreign_muni),
                    from_lat=lat,
                    from_lng=lng,
                    to_lat=lat,
                    to_lng=lng,
                    sms_sent=False,
                    sms_response=None,
                )
                # Backdate the crossing timestamp to the target day/time
                try:
                    BoundaryCrossing.objects.filter(pk=pending.pk).update(crossing_timestamp=at_ts)
                except Exception:
                    pass
                self.stdout.write(self.style.SUCCESS(f"✓ Pending crossing created (id={pending.id}) at {at_ts}"))

                # Evaluate dwell and trigger notification/websocket
                _ = check_and_notify_boundary_crossing(
                    0,
                    lat,
                    lng,
                    mfbr_number=mfbr,
                    home_municipality=home_muni,
                )
                created_count += 1

        self.stdout.write("\n" + "-" * 80)
        self.stdout.write(self.style.SUCCESS(f"Done. Seeded {created_count} pending crossings across {days} day(s)."))
        self.stdout.write("Use the UI Refresh and 'Show all (N)' in the MFBR group to verify multiple days.")
