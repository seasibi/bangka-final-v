from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from api.sms_service import SMSService, SMSServiceError

class Command(BaseCommand):
    help = "Send a test SMS using the configured provider (default Vonage)."

    def add_arguments(self, parser):
        parser.add_argument('--to', required=True, help='Destination phone number (e.g., 09XXXXXXXXX or +639XXXXXXXXX)')
        parser.add_argument('--text', default='Bangka test SMS via Vonage', help='Message text')

    def handle(self, *args, **options):
        to = options['to']
        text = options['text']

        provider = getattr(settings, 'SMS_PROVIDER', 'unknown')
        self.stdout.write(self.style.NOTICE(f"Using provider: {provider}"))

        try:
            svc = SMSService()
            result = svc.send_sms(to, text)
            ok = result.get('success', False)
            if ok:
                self.stdout.write(self.style.SUCCESS(f"✓ SMS sent successfully via {result.get('provider')} (id={result.get('message_id')})"))
            else:
                self.stdout.write(self.style.ERROR(f"✗ SMS failed: {result}"))
        except SMSServiceError as e:
            raise CommandError(str(e))
        except Exception as e:
            raise CommandError(f"Unexpected error: {e}")
