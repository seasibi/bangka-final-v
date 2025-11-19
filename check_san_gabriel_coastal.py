#!/usr/bin/env python
"""Check if San Gabriel is marked as coastal in the database"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Municipality

print("=" * 60)
print("CHECKING SAN GABRIEL COASTAL STATUS")
print("=" * 60)

try:
    san_gabriel = Municipality.objects.filter(name__icontains="Gabriel").first()
    
    if san_gabriel:
        print(f"\n✅ Found: {san_gabriel.name}")
        print(f"   ID: {san_gabriel.municipality_id}")
        print(f"   Prefix: {san_gabriel.prefix}")
        print(f"   Color: {san_gabriel.color}")
        print(f"   Is Coastal: {san_gabriel.is_coastal}")
        print(f"   Is Active: {san_gabriel.is_active}")
        
        if not san_gabriel.is_coastal:
            print(f"\n⚠️ PROBLEM FOUND: {san_gabriel.name} is NOT marked as coastal!")
            print(f"   This is why it doesn't appear in the tracker add form.")
            
            response = input(f"\nDo you want to mark {san_gabriel.name} as coastal? (yes/no): ")
            if response.lower() in ['yes', 'y']:
                san_gabriel.is_coastal = True
                san_gabriel.save()
                print(f"\n✅ {san_gabriel.name} has been marked as coastal!")
                print(f"   Refresh your frontend and it should now appear in the list.")
            else:
                print("\n❌ No changes made.")
        else:
            print(f"\n✅ {san_gabriel.name} is already marked as coastal.")
            print(f"   If it's still not showing, check:")
            print(f"   1. Frontend is fetching latest data (clear cache/reload)")
            print(f"   2. API endpoint is returning is_coastal field")
            print(f"   3. COASTAL_ONLY filter in AddTrackerModal.jsx (line 9)")
    else:
        print("\n❌ San Gabriel not found in database!")
        print("   Searching all municipalities...")
        
        all_munis = Municipality.objects.all().order_by('name')
        print(f"\n📋 All municipalities ({all_munis.count()}):")
        for m in all_munis:
            coastal_mark = "🌊" if m.is_coastal else "🏔️"
            print(f"   {coastal_mark} {m.name} (ID: {m.municipality_id}, Coastal: {m.is_coastal})")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
