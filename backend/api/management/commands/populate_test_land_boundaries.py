"""
Django management command to populate LandBoundary table with test data for ESP32 boundary testing.
This allows testing boundary violation features (SMS, toast notifications, buzzer) on land before water deployment.

Usage:
    python manage.py populate_test_land_boundaries
    python manage.py populate_test_land_boundaries --clear  # Clear existing data first
"""

from django.core.management.base import BaseCommand
from api.models import LandBoundary


class Command(BaseCommand):
    help = 'Populate LandBoundary table with test data from municipal boundaries for ESP32 testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing land boundaries before loading new data',
        )

    def handle(self, *args, **options):
        if options['clear']:
            deleted_count = LandBoundary.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(f'Cleared {deleted_count} existing land boundaries'))

        # Test land boundary data - using real municipal boundaries for testing
        test_boundaries = [
            {
                'name': 'Bauang',
                'land_area': 175.8116,
                'boundary_length': 18.608,
                'coordinates': [[
                    [120.32583, 16.45633],
                    [120.20667, 16.43583],
                    [120.18650, 16.45317],
                    [120.17733, 16.45317],
                    [120.17400, 16.47267],
                    [120.16733, 16.48067],
                    [120.16417, 16.49067],
                    [120.15650, 16.49067],
                    [120.15017, 16.49400],
                    [120.14733, 16.50067],
                    [120.14733, 16.51733],
                    [120.15400, 16.52733],
                    [120.15817, 16.54067],
                    [120.15817, 16.55600],
                    [120.16017, 16.56833],
                    [120.15883, 16.57600],
                    [120.16217, 16.57367],
                    [120.17350, 16.57467],
                    [120.18483, 16.56567],
                    [120.19733, 16.56100],
                    [120.32583, 16.45633]
                ]]
            },
            {
                'name': 'City Of San Fernando',
                'land_area': 281.3117,
                'boundary_length': 24.303,
                'coordinates': [[
                    [120.31733, 16.57867],
                    [120.30500, 16.57000],
                    [120.30300, 16.57000],
                    [120.29217, 16.57867],
                    [120.28383, 16.58733],
                    [120.28383, 16.60000],
                    [120.29583, 16.60917],
                    [120.30833, 16.61367],
                    [120.32000, 16.61367],
                    [120.32833, 16.61367],
                    [120.33667, 16.61367],
                    [120.34500, 16.61367],
                    [120.35333, 16.61367],
                    [120.36167, 16.61367],
                    [120.37000, 16.61367],
                    [120.37833, 16.61367],
                    [120.38667, 16.61367],
                    [120.31733, 16.57867]
                ]]
            },
            {
                'name': 'San Gabriel',
                'land_area': 45.0,
                'boundary_length': 5.5,
                'coordinates': [[
                    [120.38667, 16.61367],
                    [120.31733, 16.61867],
                    [120.30833, 16.63000],
                    [120.30000, 16.64000],
                    [120.31000, 16.65000],
                    [120.33000, 16.65000],
                    [120.35000, 16.64000],
                    [120.37000, 16.63000],
                    [120.38667, 16.61367]
                ]]
            },
            {
                'name': 'San Juan',
                'land_area': 83.7586,
                'boundary_length': 6.442,
                'coordinates': [[
                    [120.31567, 16.65233],
                    [120.17833, 16.72167],
                    [120.18833, 16.73500],
                    [120.20167, 16.73500],
                    [120.31567, 16.65233]
                ]]
            },
            {
                'name': 'Santol',
                'land_area': 15.0,
                'boundary_length': 3.2,
                'coordinates': [[
                    [120.42000, 16.70000],
                    [120.38000, 16.70000],
                    [120.36000, 16.71500],
                    [120.36000, 16.74000],
                    [120.38000, 16.75000],
                    [120.40000, 16.75000],
                    [120.42000, 16.73000],
                    [120.42000, 16.70000]
                ]]
            },
            {
                'name': 'Bacnotan',
                'land_area': 122.4584,
                'boundary_length': 10.123,
                'coordinates': [[
                    [120.33467, 16.70133],
                    [120.18667, 16.75833],
                    [120.18167, 16.76833],
                    [120.18333, 16.78333],
                    [120.18167, 16.81667],
                    [120.19167, 16.82500],
                    [120.33467, 16.70133]
                ]]
            },
            {
                'name': 'Balaoan',
                'land_area': 64.2639,
                'boundary_length': 5.250,
                'coordinates': [[
                    [120.32583, 16.78333],
                    [120.19583, 16.85000],
                    [120.18333, 16.83333],
                    [120.18333, 16.81667],
                    [120.19583, 16.85000],
                    [120.32583, 16.78333]
                ]]
            },
            {
                'name': 'Bangar',
                'land_area': 80.0482,
                'boundary_length': 5.813,
                'coordinates': [[
                    [120.398333, 16.880833],
                    [120.25, 16.949167],
                    [120.282778, 16.977778],
                    [120.416111, 16.928889],
                    [120.398333, 16.880833]
                ]]
            },
            {
                'name': 'Burgos',
                'land_area': 52.0,
                'boundary_length': 6.8,
                'coordinates': [[
                    [120.36000, 16.52000],
                    [120.32000, 16.54000],
                    [120.30000, 16.56000],
                    [120.31000, 16.58000],
                    [120.33000, 16.59000],
                    [120.35000, 16.58500],
                    [120.37000, 16.57000],
                    [120.38000, 16.55000],
                    [120.38000, 16.53000],
                    [120.36000, 16.52000]
                ]]
            },
            {
                'name': 'Caba',
                'land_area': 35.0,
                'boundary_length': 4.5,
                'coordinates': [[
                    [120.333333, 16.416944],
                    [120.1825, 16.398889],
                    [120.188611, 16.435833],
                    [120.206667, 16.442778],
                    [120.330278, 16.460556],
                    [120.333333, 16.416944]
                ]]
            },
            {
                'name': 'Luna',
                'land_area': 172.8080,
                'boundary_length': 11.248,
                'coordinates': [[
                    [120.3325, 16.820556],
                    [120.19, 16.853889],
                    [120.198333, 16.878611],
                    [120.209444, 16.903611],
                    [120.226111, 16.9275],
                    [120.25, 16.949167],
                    [120.398333, 16.880833],
                    [120.3325, 16.820556]
                ]]
            },
            {
                'name': 'Santo Tomas',
                'land_area': 114.2694,
                'boundary_length': 30.090,
                'coordinates': [[
                    [120.4025, 16.240833],
                    [120.384167, 16.238889],
                    [120.237222, 16.208611],
                    [120.208333, 16.249167],
                    [120.2025, 16.266944],
                    [120.346111, 16.285834],
                    [120.4025, 16.240833]
                ]]
            },
            {
                'name': 'Rosario',
                'land_area': 80.8475,
                'boundary_length': 4.357,
                'coordinates': [[
                    [120.416389, 16.207222],
                    [120.396944, 16.201667],
                    [120.3475, 16.185],
                    [120.32, 16.177778],
                    [120.305, 16.176667],
                    [120.276944, 16.178333],
                    [120.249722, 16.183333],
                    [120.237222, 16.208611],
                    [120.384167, 16.238889],
                    [120.4025, 16.240833],
                    [120.416389, 16.207222]
                ]]
            },
        ]

        created_count = 0
        updated_count = 0

        for boundary_data in test_boundaries:
            obj, created = LandBoundary.objects.update_or_create(
                name=boundary_data['name'],
                defaults={
                    'land_area': boundary_data['land_area'],
                    'boundary_length': boundary_data['boundary_length'],
                    'coordinates': boundary_data['coordinates']
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created land boundary: {boundary_data["name"]}'))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'→ Updated land boundary: {boundary_data["name"]}'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS(f'Summary:'))
        self.stdout.write(self.style.SUCCESS(f'  Created: {created_count}'))
        self.stdout.write(self.style.SUCCESS(f'  Updated: {updated_count}'))
        self.stdout.write(self.style.SUCCESS(f'  Total:   {created_count + updated_count}'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Test land boundaries loaded successfully!'))
        self.stdout.write(self.style.SUCCESS('You can now test ESP32 boundary detection with:'))
        self.stdout.write('  - SMS notifications')
        self.stdout.write('  - Toast notifications in web app')
        self.stdout.write('  - Buzzer alerts on device')
        self.stdout.write('  - Boundary violation tracking')
