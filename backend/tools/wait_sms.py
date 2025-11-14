import os
import sys
import time
import json
import requests
import django

# Django setup to access settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings  # noqa: E402

API_KEY = getattr(settings, 'SMS_API_KEY', None) or os.getenv('SEMAPHORE_API_KEY', '')
BASE = 'https://api.semaphore.co/api/v4'


def fetch_status(mid: str):
    # Try resource endpoint
    url = f"{BASE}/messages/{mid}"
    params = {'apikey': API_KEY}
    r = requests.get(url, params=params, timeout=20)
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list) and data:
            data = data[0]
        return data if isinstance(data, dict) else {'status': str(data)}
    # Fallback: list endpoint with filter (if supported)
    url = f"{BASE}/messages"
    r = requests.get(url, params={'apikey': API_KEY, 'message_id': mid}, timeout=20)
    try:
        data = r.json()
    except Exception:
        return None
    if isinstance(data, list) and data:
        d = data[0]
        return d if isinstance(d, dict) else {'status': str(d)}
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/wait_sms.py <message_id> [timeout_sec]")
        sys.exit(1)
    mid = sys.argv[1]
    timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    start = time.time()
    last = None
    while time.time() - start < timeout:
        data = fetch_status(mid)
        if data:
            print(json.dumps(data, indent=2))
            status = str(data.get('status', ''))
            last = status
            if status.lower() in ("sent", "delivered", "failed", "undelivered"):
                print(f"Final status: {status}")
                return
        time.sleep(3)
    if last:
        print(f"Final status after {timeout}s: {last}")
    else:
        print(f"No status after {timeout}s")


if __name__ == "__main__":
    main()
