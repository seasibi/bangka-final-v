#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import User
from django.db.models import Q

admins = User.objects.filter(Q(is_superuser=True) | Q(user_role='admin')).order_by('-is_active', 'email')
for u in admins:
    print(f"{u.email}\tactive={u.is_active}\tsuperuser={u.is_superuser}\trole={u.user_role}")
