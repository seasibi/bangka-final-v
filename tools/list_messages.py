#!/usr/bin/env python3
import os
import sys
import json
from urllib.parse import urlencode
import urllib.request
import urllib.error
from pathlib import Path


def load_dotenv_if_present():
    candidates = []
    try:
        here = Path(__file__).resolve()
        candidates.append(here.parent.parent / ".env")
        candidates.append(here.parent / ".env")
    except Exception:
        pass
    candidates.append(Path.cwd() / ".env")
    for p in candidates:
        try:
            if p and p.is_file():
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if line.startswith("export "):
                        line = line[len("export "):].strip()
                    if "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k and k not in os.environ:
                        os.environ[k] = v
                break
        except Exception:
            continue


def get_api_key():
    return os.environ.get("SEMAPHORE_API_KEY") or os.environ.get("SEMAPHORE_TOKEN")


def parse_args(argv):
    # Very small manual parser to avoid argparse verbosity
    opts = {"status": None, "recipient": None, "sender": None, "limit": "20", "order": "desc"}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("-h", "--help"):
            print("Usage: python tools/list_messages.py [--status failed|sent|queued] [--recipient <msisdn>] [--sender <name>] [--limit N] [--order asc|desc]")
            sys.exit(0)
        if a == "--status" and i + 1 < len(argv):
            opts["status"] = argv[i+1]; i += 2; continue
        if a == "--recipient" and i + 1 < len(argv):
            opts["recipient"] = argv[i+1]; i += 2; continue
        if a == "--sender" and i + 1 < len(argv):
            opts["sender"] = argv[i+1]; i += 2; continue
        if a == "--limit" and i + 1 < len(argv):
            opts["limit"] = argv[i+1]; i += 2; continue
        if a == "--order" and i + 1 < len(argv):
            opts["order"] = argv[i+1]; i += 2; continue
        i += 1
    return opts


def http_get(url, api_key, timeout=30):
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": "bangka-tools/1.0 list_messages",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    try:
        return json.loads(body)
    except Exception:
        return {"raw": body}


def main():
    load_dotenv_if_present()
    api_key = get_api_key()
    if not api_key:
        print("SEMAPHORE_API_KEY not set.", file=sys.stderr)
        sys.exit(2)

    opts = parse_args(sys.argv[1:])
    params = {k: v for k, v in opts.items() if v}
    params["apikey"] = api_key  # fallback for endpoints requiring query apikey
    base = "https://api.semaphore.co/api/v4/messages"
    url = base + ("?" + urlencode(params) if params else "")

    try:
        data = http_get(url, api_key)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(json.dumps({"error": True, "status": e.code, "reason": e.reason, "response": body}, indent=2, ensure_ascii=False))
        sys.exit(e.code or 1)
    except urllib.error.URLError as e:
        print(json.dumps({"error": True, "reason": str(e)}, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Response can be a list or an object containing data
    records = None
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict):
        # Common envelope key
        records = data.get("data") or data.get("items")
        if records is None:
            # If unknown format, just print raw and exit
            print(json.dumps(data, indent=2, ensure_ascii=False))
            sys.exit(0)
    else:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        sys.exit(0)

    # Print a compact summary line per message
    def g(o, *keys, default=""):
        for k in keys:
            if isinstance(o, dict) and k in o:
                o = o[k]
            else:
                return default
        return o

    for m in records:
        mid = g(m, "id") or g(m, "message_id")
        status = g(m, "status")
        recipient = g(m, "recipient") or g(m, "number")
        sender = g(m, "sender") or g(m, "sender_name")
        code = g(m, "status_code") or g(m, "error_code")
        reason = g(m, "remarks") or g(m, "error_message") or g(m, "details")
        print(f"{mid}\t{status}\t{recipient}\t{sender}\t{code or ''}\t{(reason or '').replace('\n',' ')}")


if __name__ == "__main__":
    main()
