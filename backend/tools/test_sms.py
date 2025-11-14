import os
import sys
import json
from pathlib import Path
import django

# Ensure import paths are correct whether run from repo root or backend/
HERE = Path(__file__).resolve()
BACKEND_DIR = HERE.parent            # .../backend
REPO_ROOT = BACKEND_DIR.parent       # .../

# Prefer adding both repo root and backend dir to sys.path
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(BACKEND_DIR))

# Setup Django with a robust fallback
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
try:
    django.setup()
except ModuleNotFoundError:
    os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.backend.settings'
    django.setup()

from api.sms_service import SMSService  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/test_sms.py <phone_number>")
        print("Example: python tools/test_sms.py +639171234567")
        sys.exit(1)

    phone = sys.argv[1]
    res = SMSService().send_sms(phone, "Bangka SMS: hello from the system")
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
