"""
Management command to set default identifier_icon for all existing municipalities
"""
from django.core.management.base import BaseCommand
from api.models import Municipality


class Command(BaseCommand):
    help = 'Set default identifier_icon (circle) for all existing municipalities'

    def handle(self, *args, **options):
        self.stdout.write('Setting default identifier icons for municipalities...')
        
        # Update all municipalities that don't have an identifier_icon set
        municipalities_without_icon = Municipality.objects.filter(identifier_icon__isnull=True) | Municipality.objects.filter(identifier_icon='')
        count_null = municipalities_without_icon.count()
        
        if count_null > 0:
            municipalities_without_icon.update(identifier_icon='circle')
            self.stdout.write(self.style.SUCCESS(
                f'✓ Set identifier_icon to "circle" for {count_null} municipalities with null/empty values'
            ))
        else:
            self.stdout.write(self.style.SUCCESS('✓ All municipalities already have identifier_icon set'))
        
        # Also update any municipalities with invalid values to 'circle'
        invalid_munis = Municipality.objects.exclude(identifier_icon__in=['circle', 'triangle'])
        count_invalid = invalid_munis.count()
        
        if count_invalid > 0:
            invalid_munis.update(identifier_icon='circle')
            self.stdout.write(self.style.SUCCESS(
                f'✓ Fixed {count_invalid} municipalities with invalid identifier_icon values'
            ))
        
        # Show summary
        total_munis = Municipality.objects.count()
        circle_count = Municipality.objects.filter(identifier_icon='circle').count()
        triangle_count = Municipality.objects.filter(identifier_icon='triangle').count()
        
        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS('SUMMARY:'))
        self.stdout.write(f'Total municipalities: {total_munis}')
        self.stdout.write(f'Circle icons: {circle_count}')
        self.stdout.write(f'Triangle icons: {triangle_count}')
        self.stdout.write('='*50)
        
        self.stdout.write(self.style.SUCCESS('\n✓ Default municipality icons set successfully!'))
