from django.contrib.auth.management.commands import createsuperuser as django_createsuperuser
from django.core.management.base import CommandError
from django.core.management import CommandParser

from api.models import AdminProfile, User
from django.utils import timezone
from datetime import timedelta
from django.db import transaction


class Command(django_createsuperuser.Command):
    help = (
        django_createsuperuser.Command.help
        + "\n\nIf the created user has user_role='admin', this command will prompt to create an AdminProfile and link it to the user."
    )

    def add_arguments(self, parser: CommandParser):
        super().add_arguments(parser)

    def handle(self, *args, **options):
        # Run base command which handles interactive creation of superuser.
        try:
            super().handle(*args, **options)
        except SystemExit:
            # Django's parent may call sys.exit(). For non-interactive (--noinput) preserve behavior.
            if options.get('noinput'):
                raise
            # Otherwise swallow SystemExit to continue with post-create logic.

        # If non-interactive, skip AdminProfile prompting.
        if options.get('noinput'):
            return

        # Find the most recently created superuser WITHOUT an AdminProfile.
        user = (
            User.objects.filter(is_superuser=True, admin_profile__isnull=True)
            .order_by('-date_added')
            .first()
        )

        if not user:
            self.stdout.write(self.style.WARNING('No recent superuser without AdminProfile found. Skipping AdminProfile creation.'))
            return

        # Only proceed if user's role is 'admin'
        if getattr(user, 'user_role', None) != 'admin':
            self.stdout.write(self.style.WARNING(
                f"Most recent superuser {user.email!s} has role={getattr(user, 'user_role', None)}. Skipping AdminProfile creation."
            ))
            return

        # Confirm with operator and collect AdminProfile info
        self.stdout.write(self.style.SUCCESS(f'\nSuperuser "{user.email}" created with role "admin". Proceeding to create AdminProfile.'))

        try:
            first_name = input('Admin first name: ').strip()
            last_name = input('Admin last name: ').strip()
            middle_name = input('Admin middle name (optional): ').strip() or None
            sex = input('Sex (Male/Female) [leave blank if unknown]: ').strip() or ''
            contact_number = input('Contact number (optional): ').strip() or ''
            position = input('Position (optional): ').strip() or ''
        except (EOFError, KeyboardInterrupt):
            self.stdout.write(self.style.WARNING('\nInput interrupted — skipping AdminProfile creation.'))
            return

        if not first_name or not last_name:
            self.stdout.write(self.style.WARNING('First name and last name are required to create AdminProfile. Skipping AdminProfile creation.'))
            return

        try:
            with transaction.atomic():
                admin = AdminProfile.objects.create(
                    first_name=first_name.title(),
                    middle_name=middle_name.title() if middle_name else None,
                    last_name=last_name.title(),
                    sex=sex.title() if sex else '',
                    contact_number=contact_number,
                    position=position,
                )
                user.admin_profile = admin
                user.save()
        except Exception as e:
            raise CommandError(f'Error while creating AdminProfile: {e}')

        self.stdout.write(self.style.SUCCESS(f'AdminProfile created and linked to user {user.email} (admin_id={admin.admin_id}).'))