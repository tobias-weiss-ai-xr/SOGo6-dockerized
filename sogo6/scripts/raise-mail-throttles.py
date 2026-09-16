#!/usr/bin/env python3
"""Raise stalwart's default sender throttles so automated test runs don't 452.

The stalwart-rewrite image auto-provisions two inbound throttles into its
settings DB on first boot (crates/common/src/manager/defaults.rs):

  * "Sender IP throttle"                    — 5/s per remote IP  (keep as-is)
  * "Sender address to recipient throttle"  — 25/hour per (sender-domain, rcpt)

The 25/hour pair throttle is far too tight for test suites: a single parity
run delivers ~7 self-addressed mails (api send/search/attachments, mail, sieve
fileinto), so the budget is exhausted after ~3 runs and RCPT starts answering
`452 4.4.5 Rate limit exceeded` — which looks exactly like a broken stack.

This script raises that throttle to 300/hour (≈1 mail per 12s sustained —
still a runaway guard, but roomy for tests). Idempotent: safe to re-run; it
only patches when the current rate differs. Applies to the RUNNING stack and
persists in the settings DB (survives restarts; a FRESH volume re-seeds the
defaults, so run this once after (re)provisioning).

Usage (from the repo root, against a running stack; set STALWART_SECRET
if the vault value differs from the dev default):
    docker run --rm -i --network sogo6_sogo6-net -e STALWART_SECRET \
        python:3.12-alpine python - < sogo6/scripts/raise-mail-throttles.py
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

THROTTLE_DESCRIPTION = "Sender address to recipient throttle"
TARGET = {"count": 300, "period": 3600000}  # 300/hour, millis

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


USING = ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"]


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

    target = throttles.get(THROTTLE_DESCRIPTION)
    if target is None:
        print(f"⏩ '{THROTTLE_DESCRIPTION}' not provisioned — nothing to do")
        return 0

    if target["rate"] == TARGET:
        print(f"✅ Already at {TARGET['count']}/{TARGET['period'] // 60000}min — nothing to do")
        return 0

    tid = target["id"]
    jmap({"using": USING, "methodCalls": [["x:MtaInboundThrottle/set", {
        "accountId": "0",
        "update": {tid: {
            "rate/count": TARGET["count"],
            "rate/period": TARGET["period"],
        }}}, "c1"]]})
    print(f"✅ Raised '{THROTTLE_DESCRIPTION}': "
          f"{target['rate']['count']}/{target['rate']['period'] // 60000}min → "
          f"{TARGET['count']}/{TARGET['period'] // 60000}min")
    return 0


if __name__ == "__main__":
    sys.exit(main())
