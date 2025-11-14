import os
import sys
from shapely.geometry import Point

# Ensure project package is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
from django.core.wsgi import get_wsgi_application  # noqa: E402
get_wsgi_application()

from api.boundary_service import boundary_service  # noqa: E402


def probe(lat: float, lng: float) -> None:
    m = boundary_service.get_municipality_at_point(lat, lng)
    print(f"probe lat={lat}, lng={lng} -> {m}")
    p = Point(lng, lat)
    best_name = None
    best_dist = 1e9
    # Search municipal first then land
    for name, geom in boundary_service.municipal_polygons.items():
        try:
            d = geom.distance(p)
            if d < best_dist:
                best_name, best_dist = name, d
        except Exception:
            pass
    for name, geom in boundary_service.land_polygons.items():
        try:
            d = geom.distance(p)
            if d < best_dist:
                best_name, best_dist = name, d
        except Exception:
            pass
    meters = best_dist * 111_320.0
    print(f"nearest={best_name}, deg={best_dist:.6f}, ~meters={meters:.1f}")


if __name__ == "__main__":
    coords = [
        (16.671568, 120.402817),
        (16.671700, 120.405000),
        (16.671500, 120.399000),
    ]
    if len(sys.argv) >= 3:
        try:
            lat = float(sys.argv[1]); lng = float(sys.argv[2])
            coords = [(lat, lng)]
        except Exception:
            pass
    for lat, lng in coords:
        probe(lat, lng)
