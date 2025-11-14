from django.core.management.base import BaseCommand, CommandError
from api.models import User, AdminProfile


class Command(BaseCommand):
    help = 'Create and link an AdminProfile to an existing user (by email). Interactive if --email not provided.'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Email of the user to link AdminProfile to')

    def handle(self, *args, **options):
        email = options.get('email')

        if not email:
            try:
                email = input('User email to attach AdminProfile to: ').strip()
            except (EOFError, KeyboardInterrupt):
                self.stdout.write(self.style.ERROR('No email provided; aborting.'))
                return

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f'No user found with email {email}')

        if user.admin_profile is not None:
            self.stdout.write(self.style.WARNING(f'User {email} already has an AdminProfile (id={user.admin_profile.admin_id}).'))
            try:
                overwrite = input('Overwrite existing AdminProfile? [y/N]: ').strip().lower()
            except (EOFError, KeyboardInterrupt):
                return
            if overwrite not in ['y', 'yes']:
                return

        # Prompt for AdminProfile fields
        try:
            first_name = input('Admin first name: ').strip()
            last_name = input('Admin last name: ').strip()
            middle_name = input('Admin middle name (optional): ').strip() or None
            sex = input('Sex (Male/Female) [optional]: ').strip() or ''
            contact_number = input('Contact number (optional): ').strip() or ''
            position = input('Position (optional): ').strip() or ''
        except (EOFError, KeyboardInterrupt):
            self.stdout.write(self.style.ERROR('Input interrupted; aborting.'))
            return

        if not first_name or not last_name:
            raise CommandError('First name and last name are required to create AdminProfile.')

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

        self.stdout.write(self.style.SUCCESS(f'AdminProfile (id={admin.admin_id}) created and linked to user {user.email}'))