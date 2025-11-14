from celery import shared_task
from .boundary_service import check_and_notify_boundary_crossing

@shared_task(bind=True)
def check_boundary_task(self, boat_id: int, lat: float, lng: float):
    return check_and_notify_boundary_crossing(boat_id, lat, lng)