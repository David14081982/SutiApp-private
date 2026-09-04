#!/usr/bin/env python3
"""Bundle or deploy data-exports through the official Management API."""
import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "supabase/functions/data-exports/index.ts"


def env():
    out = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def multipart(metadata, source):
    boundary = "sutiapp-" + uuid.uuid4().hex
    parts = []
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\n"
        "Content-Type: application/json\r\n\r\n".encode()
        + json.dumps(metadata, separators=(",", ":")).encode()
        + b"\r\n"
    )
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"index.ts\"\r\n"
        "Content-Type: application/typescript\r\n\r\n".encode()
        + source.read_bytes()
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    return boundary, b"".join(parts)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    values = env()
    ref = urllib.parse.urlsplit(values["SUPABASE_URL"]).hostname.split(".")[0]
    metadata = {"entrypoint_path": "index.ts", "name": "data-exports", "verify_jwt": True}
    boundary, body = multipart(metadata, SOURCE)
    suffix = "" if args.apply else "&bundleOnly=true"
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/functions/deploy?slug=data-exports{suffix}",
        data=body,
        headers={
            "Authorization": "Bearer " + values["SUPABASE_ACCESS_TOKEN"],
            "Content-Type": "multipart/form-data; boundary=" + boundary,
            "User-Agent": "SutiApp-DataExportsDeploy/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(f"FUNCTION_DEPLOY_{error.code}:{detail[:1000]}") from None
    print(json.dumps({
        "status": "PASS",
        "mode": "APPLY" if args.apply else "BUNDLE_ONLY",
        "slug": result.get("slug"),
        "version": result.get("version"),
        "verify_jwt": result.get("verify_jwt"),
        "credentials_exposed": False,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
