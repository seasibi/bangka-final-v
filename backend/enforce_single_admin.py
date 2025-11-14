#!/usr/bin/env python
import os
import django
from django.db.models import Q

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import User

# Find all active admins
admins = list(User.objects.filter(is_active=True).filter(Q(is_superuser=True) | Q(user_role='admin')).order_by('-date_added'))

if not admins:
    print('No active admins')
    raise SystemExit(0)

# Keep the newest one active; deactivate the rest
keep = admins[0]
changed = []
for u in admins[1:]:
    if u.is_active:
        u.is_active = False
        u.save(update_fields=['is_active'])
        changed.append(u.email)

print(f"Keeping active: {keep.email}")
if changed:
    print("Deactivated:", ', '.join(changed))
else:
    print('No other admins to deactivate')
