from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from api.models import Boat, GpsData, BoundaryCrossing, BirukbilugTracker
from api.boundary_service import boundary_service, check_and_notify_boundary_crossing


class Command(BaseCommand):
    help = "Seed boundary violations using existing boats and GPS data, then trigger UI notifications"

    def add_arguments(self, parser):
        parser.add_argument("--mfbr", type=str, default=None, help="Target a specific boat by MFBR number")
        parser.add_argument(
            "--backdate-minutes",
            type=int,
            default=16,
            help="Backdate pending crossing by N minutes (should exceed dwell threshold)",
        )
        parser.add_argument("--dry-run", action="store_true", help="Do not write to DB, just print actions")

    def handle(self, *args, **options):
        mfbr = options.get("mfbr")
        backdate_minutes = int(options.get("backdate_minutes") or 16)
        dry_run = bool(options.get("dry_run"))

        self.stdout.write("=" * 80)
        self.stdout.write("SEEDING BOUNDARY VIOLATION(S)")
        self.stdout.write("=" * 80)

        # 1) Choose a boat with GPS data
        boat_qs = Boat.objects.all()
        if mfbr:
            boat_qs = boat_qs.filter(mfbr_number=mfbr)
        boat = (
            boat_qs.select_related("fisherfolk_registration_number__address").first()
        )
        if not boat:
            self.stdout.write(self.style.ERROR("✗ No boat found"))
            return

        mfbr = boat.mfbr_number
        self.stdout.write(f"Boat: {boat.boat_name or ''} | MFBR: {mfbr}")

        # 2) Determine home municipality (prefer fisherfolk address)
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

        # 3) Find a GPS point in a foreign municipality (or synthesize if missing)
        latest_gps = (
            GpsData.objects.filter(mfbr_number=mfbr).order_by("-timestamp").first()
        )
        now_ts = timezone.now()
        if not latest_gps:
            self.stdout.write(self.style.WARNING("⚠ No GPS data for this boat — generating sample points"))
            norm_home = boundary_service._normalize_muni(home_muni)
            home_lat, home_lng = (16.6159, 120.3176)
            foreign_name = "San Juan" if norm_home == boundary_service._normalize_muni("City Of San Fernando") else "City Of San Fernando"
            foreign_lat, foreign_lng = (16.6730, 120.3447) if foreign_name == "San Juan" else (16.6159, 120.3176)
            home_ts = now_ts - timedelta(minutes=options.get("backdate_minutes", 16) + 10)
            foreign_ts = now_ts - timedelta(minutes=1)
            home_point = GpsData.objects.create(latitude=home_lat, longitude=home_lng, boat_id=0, mfbr_number=mfbr)
            GpsData.objects.filter(pk=home_point.pk).update(timestamp=home_ts)
            latest_gps = GpsData.objects.create(latitude=foreign_lat, longitude=foreign_lng, boat_id=0, mfbr_number=mfbr)
            GpsData.objects.filter(pk=latest_gps.pk).update(timestamp=foreign_ts)

        # Try recent window for a foreign municipality
        window_start = timezone.now() - timedelta(hours=12)
        gps_points = (
            GpsData.objects.filter(mfbr_number=mfbr, timestamp__gte=window_start)
            .order_by("timestamp")
            .all()[:1000]
        )
        foreign = None
        for g in gps_points or [latest_gps]:
            muni = boundary_service.get_municipality_at_point(g.latitude, g.longitude)
            if muni and boundary_service._normalize_muni(muni) != boundary_service._normalize_muni(home_muni):
                foreign = (g, muni)
                break

        if not foreign:
            self.stdout.write(self.style.WARNING("⚠ Could not find GPS point in a foreign municipality — generating one"))
            norm_home = boundary_service._normalize_muni(home_muni)
            foreign_name = "San Juan" if norm_home == boundary_service._normalize_muni("City Of San Fernando") else "City Of San Fernando"
            lat, lng = ((16.6730, 120.3447) if foreign_name == "San Juan" else (16.6159, 120.3176))
            g = GpsData.objects.create(latitude=lat, longitude=lng, boat_id=0, mfbr_number=mfbr)
            back_ts = now_ts - timedelta(minutes=1)
            GpsData.objects.filter(pk=g.pk).update(timestamp=back_ts)
            foreign = (g, foreign_name)

        g, current_muni = foreign
        self.stdout.write(f"Foreign municipality found from GPS at {g.timestamp}: {current_muni}")

        # 4) Ensure there's no active pending crossing/notification already
        has_pending = BoundaryCrossing.objects.filter(
            boat_id=0, to_municipality=boundary_service._normalize_muni(current_muni), sms_sent=False
        ).exists()

        from api.models import BoundaryViolationNotification as BVN
        # Allow one active per MFBR+municipality per DAY. Only block if there's already one today.
        today = timezone.localdate()
        has_active_notif = BVN.objects.filter(
            mfbr_number=mfbr,
            to_municipality=boundary_service._normalize_muni(current_muni),
            status="pending",
            created_at__date=today,
        ).exists()

        if has_pending or has_active_notif:
            self.stdout.write(
                self.style.WARNING(
                    f"⚠ Already has pending crossing ({has_pending}) or active notification ({has_active_notif}) for {current_muni}."
                )
            )
            # Continue anyway to attempt triggering processing if needed

        # 5) Seed pending crossing backdated beyond dwell threshold
        seed_ts = max(g.timestamp, timezone.now() - timedelta(minutes=backdate_minutes))
        self.stdout.write(
            f"Seeding pending crossing: {home_muni} -> {current_muni} backdated to {seed_ts.isoformat()}"
        )

        if not dry_run:
            pending = BoundaryCrossing.objects.create(
                boat_id=0,
                fisherfolk=None,
                from_municipality=boundary_service._normalize_muni(home_muni),
                to_municipality=boundary_service._normalize_muni(current_muni),
                from_lat=g.latitude,
                from_lng=g.longitude,
                to_lat=g.latitude,
                to_lng=g.longitude,
                sms_sent=False,
                sms_response=None,
            )
            try:
                BoundaryCrossing.objects.filter(pk=pending.pk).update(crossing_timestamp=seed_ts)
            except Exception:
                pass
            self.stdout.write(self.style.SUCCESS(f"✓ Pending crossing created (id={pending.id})"))
        else:
            pending = None

        # 6) Try to resolve tracker id for logs
        tracker_id = None
        trk = BirukbilugTracker.objects.filter(boat=boat).first()
        if trk:
            tracker_id = trk.BirukBilugID

        # 7) Trigger evaluation to create notification and broadcast
        self.stdout.write("Evaluating dwell to trigger notification …")
        result = check_and_notify_boundary_crossing(
            0,
            g.latitude,
            g.longitude,
            mfbr_number=mfbr,
            home_municipality=home_muni,
            tracker_id=tracker_id,
        )
        self.stdout.write(f"Result: {result}")

        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("Done. If dwell threshold was exceeded, a UI notification should now be visible.")
        self.stdout.write("=" * 80 + "\n")
