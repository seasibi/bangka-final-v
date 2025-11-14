from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import ActivityLog, User, Fisherfolk
from django.utils.timezone import now

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    ActivityLog.objects.create(
        user=user,
        action=f"{user.email} logged in",
        timestamp=now()
    )

# Centralized logging moved to viewsets; avoid duplicate create logs here
# @receiver(post_save, sender=Fisherfolk)
# def log_fisherfolk_created(sender, instance, created, **kwargs):
#     if created:
#         ActivityLog.objects.create(
#             user=instance.created_by,
#             action=f"Fisherfolk {instance} was created",
#         )

@receiver(pre_save, sender=Fisherfolk)
def cascade_boat_status_on_fisherfolk_change(sender, instance: Fisherfolk, **kwargs):
    """Keep Boat.is_active in sync with Fisherfolk.is_active.
    Use on_commit to avoid races with other writes.
    """
    try:
        if not instance.pk:
            return
        prev = Fisherfolk.objects.get(pk=instance.pk)
        if bool(prev.is_active) != bool(instance.is_active):
            from django.db import transaction as _tx
            from .models import Boat
            def _cascade():
                try:
                    Boat.objects.filter(fisherfolk_registration_number=instance).update(is_active=bool(instance.is_active))
                except Exception:
                    pass
            _tx.on_commit(_cascade)
    except Exception:
        # Never block a save due to sync errors
        pass
