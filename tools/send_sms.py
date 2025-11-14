#!/usr/bin/env python3
import os
import sys
import json
from pathlib import Path
import urllib.parse
import urllib.request
import urllib.error


def load_dotenv_if_present():
    for p in [
        Path(__file__).resolve().parent.parent / ".env",  # project root
        Path.cwd() / ".env",
    ]:
        try:
            if p.is_file():
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if line.startswith("export "):
                        line = line[len("export "):].strip()
                    if "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip(); v = v.strip().strip("'\"")
                    if k and k not in os.environ:
                        os.environ[k] = v
        except Exception:
            pass


def main():
    if len(sys.argv) < 3:
        print("Usage: python tools/send_sms.py <MSISDN> <MESSAGE> [--sender NAME]")
        sys.exit(2)

    load_dotenv_if_present()
    apikey = os.getenv("SEMAPHORE_API_KEY")
    if not apikey:
        print("SEMAPHORE_API_KEY not set in environment or .env", file=sys.stderr)
        sys.exit(2)

    # Parse args (simple)
    args = sys.argv[1:]
    msisdn = args[0]
    # Look for --sender
    sender = None
    if "--sender" in args:
        idx = args.index("--sender")
        if idx + 1 < len(args):
            sender = args[idx + 1]
            del args[idx:idx+2]
    if not sender:
        sender = os.getenv("SEMAPHORE_SENDER_NAME") or None
    message = " ".join(a for a in args[1:] if a)

    url = "https://api.semaphore.co/api/v4/messages"
    payload = {
        "apikey": apikey,
        "number": msisdn,
        "message": message,
    }
    if sender:
        payload["sendername"] = sender
    data = urllib.parse.urlencode(payload).encode()

    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "bangka-tools/1.0 send_sms",
        "Accept": "application/json",
    })

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                print(json.dumps(json.loads(body), indent=2, ensure_ascii=False))
            except Exception:
                print(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(json.dumps({"error": True, "status": e.code, "reason": e.reason, "response": body}, indent=2, ensure_ascii=False))
        sys.exit(e.code or 1)
    except urllib.error.URLError as e:
        print(json.dumps({"error": True, "reason": str(e)}, indent=2, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
