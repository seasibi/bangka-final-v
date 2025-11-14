import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Municipality

print("Current Municipality Identifier Icons:")
print("=" * 50)

munis = Municipality.objects.all().order_by('name')
for m in munis:
    icon = m.identifier_icon if m.identifier_icon else 'NULL'
    print(f"{m.name:20s} -> {icon}")

print("=" * 50)
print(f"Total: {munis.count()} municipalities")
circle_count = Municipality.objects.filter(identifier_icon='circle').count()
triangle_count = Municipality.objects.filter(identifier_icon='triangle').count()
null_count = Municipality.objects.filter(identifier_icon__isnull=True).count() + Municipality.objects.filter(identifier_icon='').count()
print(f"Circle: {circle_count}, Triangle: {triangle_count}, Null/Empty: {null_count}")
