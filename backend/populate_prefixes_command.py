# Run this with: python manage.py shell < populate_prefixes_command.py

from api.models import Municipality

# Default prefixes based on existing municipalities
default_prefixes = {
    "Agoo": "AGO",
    "Aringay": "ARI",
    "Bacnotan": "BAC",
    "Bagulin": "BAG",
    "Balaoan": "BAL",
    "Bangar": "BNG",
    "Bauang": "BAU",
    "Burgos": "BRG",
    "Caba": "CAB",
    "San Fernando": "SFN",
    "City of San Fernando": "CSF",
    "Luna": "LUN",
    "Naguilian": "NAG",
    "Pugo": "PUG",
    "Rosario": "ROS",
    "San Gabriel": "SGB",
    "San Juan": "SJN",
    "Santo Tomas": "STO",
    "Santol": "SNL",
    "Sudipen": "SUD",
    "Tubao": "TUB",
    "San Mateo": "SAM",
}

used_prefixes = set()
updated_count = 0

for municipality in Municipality.objects.all():
    # Skip if already has a valid prefix
    if municipality.prefix and len(municipality.prefix) == 3 and municipality.prefix != 'XXX':
        used_prefixes.add(municipality.prefix)
        print(f"✓ {municipality.name}: {municipality.prefix} (already set)")
        continue
        
    if municipality.name in default_prefixes:
        prefix = default_prefixes[municipality.name]
    else:
        # Generate prefix from first 3 letters of municipality name (uppercase)
        prefix = municipality.name[:3].upper()
        
        # If prefix already used, append numbers to make it unique
        counter = 1
        original_prefix = prefix
        while prefix in used_prefixes:
            if counter < 10:
                prefix = original_prefix[:2] + str(counter)
            else:
                prefix = original_prefix[0] + str(counter)
            counter += 1
    
    used_prefixes.add(prefix)
    municipality.prefix = prefix
    municipality.save()
    updated_count += 1
    print(f"✓ {municipality.name}: {prefix} (updated)")

print(f"\n✅ Done! Updated {updated_count} municipalities.")
