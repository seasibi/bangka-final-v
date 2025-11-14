#!/usr/bin/env python3
import os
import sys
import json
from pathlib import Path
import urllib.request
import urllib.error
import urllib.parse


def load_dotenv_if_present():
    """Load variables from a .env file without external dependencies.
    Looks in project root (parent of this file's directory), this file's
    directory, and current working directory. Does not override existing env.
    """
    candidates = []
    try:
        here = Path(__file__).resolve()
        candidates.append(here.parent.parent / ".env")  # project root if this is in tools/
        candidates.append(here.parent / ".env")          # alongside this file
    except Exception:
        pass
    candidates.append(Path.cwd() / ".env")               # current working directory

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
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key and key not in os.environ:
                        os.environ[key] = val
                break  # stop at the first .env we find
        except Exception:
            # ignore malformed .env silently
            continue


def get_api_key():
    return os.environ.get("SEMAPHORE_API_KEY") or os.environ.get("SEMAPHORE_TOKEN")


def fetch_message(message_id: str, api_key: str, timeout: int = 30):
    # Include apikey as a query param for compatibility; also send Bearer token header.
    base = f"https://api.semaphore.co/api/v4/messages/{message_id}"
    sep = "?" if "?" not in base else "&"
    url = f"{base}{sep}apikey={urllib.parse.quote(api_key)}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": "bangka-tools/1.0 get_message",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                data = {"raw": body}
            return 0, data
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        try:
            payload = json.loads(body)
        except Exception:
            payload = {"raw": body}
        return e.code or 1, {"error": True, "status": e.code, "reason": e.reason, "response": payload}
    except urllib.error.URLError as e:
        return 1, {"error": True, "reason": str(e)}


def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith("-") and len(sys.argv) < 3:
        print("Usage: python tools/get_message.py <MESSAGE_ID>", file=sys.stderr)
        sys.exit(2)

    message_id = sys.argv[-1]
    load_dotenv_if_present()
    api_key = get_api_key()
    if not api_key:
        print("SEMAPHORE_API_KEY not set. Add it to .env or environment.", file=sys.stderr)
        sys.exit(2)

    code, payload = fetch_message(message_id, api_key)
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    sys.exit(code)


if __name__ == "__main__":
    main()
