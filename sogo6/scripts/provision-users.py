#!/usr/bin/env python3
"""Provision university test users in Stalwart via JMAP x:Account/set API."""
import json
import base64
import urllib.request
import urllib.error
import sys

JMAP_URL = "http://sogo6-stalwart:8080/jmap"
ADMIN_USER = "admin"
ADMIN_PASS = "eval_admin_2026"

auth = base64.b64encode(f"{ADMIN_USER}:{ADMIN_PASS}".encode()).decode()
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Basic {auth}",
}

UNIVERSITY_USERS = [
    {"name": "Max Mustermann", "email": "mmustermann@example.org", "password": "UniMarburg2026!", "role": "student"},
    {"name": "Lisa Mayer", "email": "lmayer@example.org", "password": "UniMarburg2026!", "role": "student"},
    {"name": "Prof. Dr. Schmidt", "email": "schmidt@example.org", "password": "ProfessorUni2026!", "role": "professor"},
    {"name": "Dean Informatics", "email": "dean@example.org", "password": "DeanUni2026!Secure", "role": "professor"},
    {"name": "Sekretariat", "email": "sekretariat@example.org", "password": "Sekretariat2026!", "role": "staff"},
    {"name": "Bibliothek", "email": "bibliothek@example.org", "password": "LibraryUni2026!", "role": "staff"},
    {"name": "Rektorat", "email": "rektorat@example.org", "password": "Rektorat2026!Admin", "role": "admin"},
]


def jmap(payload: dict) -> dict:
    """Make a JMAP API call."""
    data = json.dumps(payload).encode()
    req = urllib.request.Request(JMAP_URL, data=data, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"HTTP Error {e.code}: {body[:200]}")
        sys.exit(1)


def get_domain_id(domain: str) -> str | None:
    """Find a domain by name and return its ID."""
    resp = jmap({
        "using": ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
        "methodCalls": [["x:Domain/get", {"accountId": "0", "ids": None}, "c1"]],
    })
    for name, result, _ in resp.get("methodResponses", []):
        if name == "x:Domain/get":
            for d in result.get("list", []):
                if d.get("name") == domain:
                    return d["id"]
    return None


def create_domain(domain: str) -> str:
    """Create a domain in Stalwart and return its ID."""
    print(f"  Creating domain '{domain}'...")
    resp = jmap({
        "using": ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
        "methodCalls": [[
            "x:Domain/set",
            {"accountId": "0", "create": {domain.replace(".", "_"): {"name": domain, "description": f"Domain {domain}"}}},
            "c1",
        ]],
    })
    for name, result, _ in resp.get("methodResponses", []):
        if name == "x:Domain/set":
            if "created" in result:
                return list(result["created"].values())[0]["id"]
            if "notCreated" in result:
                err = list(result["notCreated"].values())[0]
                if err.get("type") == "alreadyExists":
                    # Fetch existing domain ID
                    return get_domain_id(domain)
                print(f"    Error: {err}")
                sys.exit(1)
    print(f"    Unexpected response: {resp}")
    sys.exit(1)


def create_account(name: str, email: str, password: str, domain_id: str) -> bool:
    """Create a Stalwart account. Returns True if successful."""
    create_id = email.split("@")[0].replace(".", "_").replace("-", "_")
    resp = jmap({
        "using": ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
        "methodCalls": [[
            "x:Account/set",
            {
                "accountId": "0",
                "create": {
                    create_id: {
                        "@type": "User",
                        "name": name,
                        "domainId": domain_id,
                        "credentials": {"0": {"@type": "Password", "secret": password}},
                    }
                },
            },
            "c1",
        ]],
    })
    for _, result, _ in resp.get("methodResponses", []):
        if "created" in result:
            uid = list(result["created"].values())[0]["id"]
            print(f"    ✅ Created: {email} (ID: {uid})")
            return True
        if "notCreated" in result:
            err = list(result["notCreated"].values())[0]
            if "alreadyExists" in str(err):
                print(f"    ⏩ Already exists: {email}")
                return True
            print(f"    ❌ Error: {err.get('description', str(err))}")
            return False
    return False


def main():
    print("=== Provisioning University Users in Stalwart ===\n")

    # Step 1: Get or create domain
    domain_id = get_domain_id("example.org")
    if not domain_id:
        domain_id = create_domain("example.org")
    print(f"  Domain 'example.org' ID: {domain_id}\n")

    # Step 2: Create users
    success = 0
    for user in UNIVERSITY_USERS:
        ok = create_account(user["name"], user["email"], user["password"], domain_id)
        if ok:
            success += 1

    print(f"\n=== Results: {success}/{len(UNIVERSITY_USERS)} users created ===")
    print()
    print("Test credentials:")
    for user in UNIVERSITY_USERS:
        print(f"  {user['email']} / {user['password']} ({user['role']})")
    print()
    print("Log in via IMAP using the FULL email address and password.")
    return 0 if success == len(UNIVERSITY_USERS) else 1


if __name__ == "__main__":
    sys.exit(main())
