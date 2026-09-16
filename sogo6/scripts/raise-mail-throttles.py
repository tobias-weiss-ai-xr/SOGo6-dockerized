#!/usr/bin/env python3
"""Raise stalwart's default sender throttles so automated test runs don't 452.

The stalwart-rewrite image auto-provisions two inbound throttles into its
settings DB on first boot (crates/common/src/manager/defaults.rs):

  * "Sender IP throttle"                    — 5/s per remote IP
  * "Sender address to recipient throttle"  — 25/hour per (sender-domain, rcpt)

Both are too tight for test suites:

  * The 5/s IP throttle fires on parallel bursts — a parity run drives the
    sogo5 container, sogo6-server and the testsuite host through the same
    traefik entry point (ONE remote IP), and concurrently running suites
    easily exceed 5 RCPTs/s. Symptom: `452 4.4.5 Rate limit exceeded` and
    connections dropped mid-burst — indistinguishable from a broken stack.
  * The 25/hour pair throttle dies after ~3 parity runs (~7 self-addressed
    mails per run).

This script raises them to 50/s and 300/hour (still runaway guards, roomy
for tests). Idempotent: patches only on drift. Values persist in the
settings DB, but the SMTP core reads throttle objects at BOOT — restart the
container after changing them (fresh stacks: seed, then restart once).

Usage (from the repo root, against a running stack; set STALWART_SECRET
if the vault value differs from the dev default):

    docker run --rm -i --network sogo6_sogo6-net -e STALWART_SECRET \
        python:3.12-alpine python - < sogo6/scripts/raise-mail-throttles.py
    docker restart sogo6-stalwart
"""
import json
import base64
import os
import urllib.request
import urllib.error
import sys

JMAP_URL = "http://sogo6-stalwart:8080/jmap"
# matches STALWART_RECOVERY_ADMIN in docker-compose.yaml: admin:${STALWART_SECRET:-eval_admin_2026}
ADMIN_USER = "admin"
ADMIN_PASS = os.environ.get("STALWART_SECRET", "eval_admin_2026")

THROTTLES = {
    "Sender IP throttle": {"count": 50, "period": 1000},  # 50/s
    "Sender address to recipient throttle": {"count": 300, "period": 3600000},  # 300/hour
}

USING = ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"]

auth = base64.b64encode(f"{ADMIN_USER}:{ADMIN_PASS}".encode()).decode()
headers = {"Content-Type": "application/json", "Authorization": f"Basic {auth}"}


def jmap(payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(JMAP_URL, data=data, headers=headers, method="POST")
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode()[:200]}")
        sys.exit(1)


def main() -> int:
    resp = jmap({"using": USING, "methodCalls": [
        ["x:MtaInboundThrottle/get", {"accountId": "0", "ids": None}, "c1"]]})
    throttles = {}
    for name, result, _ in resp.get("methodResponses", []):
        if "error" in result:
            print(f"❌ Registry/get failed: {result.get('description')}")
            return 1
        for t in result.get("list", []):
            throttles[t.get("description")] = t

    changed = []
    for desc, target in THROTTLES.items():
        obj = throttles.get(desc)
        if obj is None:
            print(f"⏩ '{desc}' not provisioned — skipping")
            continue
        if obj["rate"] == target:
            print(f"✅ '{desc}' already at {target['count']}/{target['period']}ms")
            continue
        jmap({"using": USING, "methodCalls": [["x:MtaInboundThrottle/set", {
            "accountId": "0",
            "update": {obj["id"]: {
                "rate/count": target["count"],
                "rate/period": target["period"],
            }}}, "c1"]]})
        changed.append(desc)
        print(f"✅ Raised '{desc}': "
              f"{obj['rate']['count']}/{obj['rate']['period']}ms → "
              f"{target['count']}/{target['period']}ms")

    if changed:
        print("\n⚠️  SMTP core reads throttles at boot — restart to apply:")
        print("   docker restart sogo6-stalwart")
    return 0


if __name__ == "__main__":
    sys.exit(main())
