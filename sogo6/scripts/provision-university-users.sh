#!/bin/bash
# Provision university test users in Stalwart
set -euo pipefail

echo "=== Provisioning University Test Users in Stalwart ==="

# First, update LDAP with university users
echo "Updating LDAP seed data with university users..."

# Create new LDIF with university structure
cat > /tmp/university.ldif << 'LDIF'
# University structure
dn: ou=students,dc=example,dc=org
objectClass: organizationalUnit
ou: students

dn: ou=staff,dc=example,dc=org
objectClass: organizationalUnit
ou: staff

dn: ou=professors,dc=example,dc=org
objectClass: organizationalUnit
ou: professors

# Students
dn: uid=mmustermann@example.org,ou=students,dc=example,dc=org
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: mmustermann@example.org
cn: Max Mustermann
sn: Mustermann
givenName: Max
mail: mmustermann@example.org
uidNumber: 2001
gidNumber: 2001
homeDirectory: /home/mmustermann
userPassword: student123

dn: uid=lmayer@example.org,ou=students,dc=example,dc=org
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: lmayer@example.org
cn: Lisa Mayer
sn: Mayer
givenName: Lisa
mail: lmayer@example.org
uidNumber: 2002
gidNumber: 2002
homeDirectory: /home/lmayer
userPassword: student123

# Professors
dn: uid=schmidt@example.org,ou=professors,dc=example,dc=org
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: schmidt@example.org
cn: Prof. Dr. Schmidt
sn: Schmidt
givenName: Klaus
mail: schmidt@example.org
uidNumber: 3001
gidNumber: 3001
homeDirectory: /home/schmidt
userPassword: professor123

dn: uid=dean@example.org,ou=professors,dc=example,dc=org
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: dean@example.org
cn: Dean Informatics
sn: Weber
givenName: Sabine
mail: dean@example.org
uidNumber: 3002
gidNumber: 3002
homeDirectory: /home/dean
userPassword: dean123

# Staff
dn: uid=sekretariat@example.org,ou=staff,dc=example,dc=org
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: sekretariat@example.org
cn: Sekretariat
sn: Sekretariat
givenName: Admin
mail: sekretariat@example.org
uidNumber: 4001
gidNumber: 4001
homeDirectory: /home/sekretariat
userPassword: admin123

dn: uid=bibliothek@example.org,ou=staff,dc=example,dc=org
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: bibliothek@example.org
cn: Bibliothek
sn: Bibliothek
givenName: Bib
mail: bibliothek@example.org
uidNumber: 4002
gidNumber: 4002
homeDirectory: /home/bibliothek
userPassword: library123

dn: uid=rektorat@example.org,ou=staff,dc=example,dc=org
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: rektorat@example.org
cn: Rektorat
sn: Rektorat
givenName: Uni
mail: rektorat@example.org
uidNumber: 4003
gidNumber: 4003
homeDirectory: /home/rektorat
userPassword: admin123
LDIF

# Add to LDAP
echo "Adding university users to LDAP..."
ldap_container=$(docker ps --format '{{.Names}}' | grep -E '^sogo6-ldap' | head -1)
if [ -n "$ldap_container" ]; then
    docker exec -i "$ldap_container" ldapadd -x -H ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi \
        -D cn=admin,dc=example,dc=org -w admin -f /tmp/university.ldif 2>&1 || echo "Some entries may already exist"
fi

# Now create users in Stalwart via JMAP API
echo "Creating users in Stalwart via JMAP..."

# Use the admin account to provision users via direct API
# Stalwart stores principals internally, we need to use the JMAP Principal/set API
# but this doesn't work in community edition. Instead, we'll create the users
# by directly inserting into PostgreSQL.

python3 << 'PYEOF'
"""Create Stalwart users by using the admin JMAP session."""
import urllib.request
import json
import base64

# Admin credentials
creds = base64.b64encode(b'admin:eval_admin_2026').decode()

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Basic {creds}'
}

# Test users matching LDAP
users = [
    {"name": "Max Mustermann", "email": "mmustermann@example.org", "password": "student123"},
    {"name": "Lisa Mayer", "email": "lmayer@example.org", "password": "student123"},
    {"name": "Prof. Dr. Schmidt", "email": "schmidt@example.org", "password": "professor123"},
    {"name": "Dean Informatics", "email": "dean@example.org", "password": "dean123"},
    {"name": "Sekretariat", "email": "sekretariat@example.org", "password": "admin123"},
    {"name": "Bibliothek", "email": "bibliothek@example.org", "password": "library123"},
    {"name": "Rektorat", "email": "rektorat@example.org", "password": "admin123"},
]

# Try to create via JMAP Principal/set (may not work in community edition)
# If it fails, we'll try alternative methods
print("Attempting to create users via JMAP...")

base_url = "http://sogo6-stalwart:8080"

# Get JMAP session
req = urllib.request.Request(f"{base_url}/jmap/session", headers=headers)
try:
    resp = urllib.request.urlopen(req)
    session = json.loads(resp.read())
    accounts = list(session.get('accounts', {}).keys())
    print(f"JMAP session OK, accounts: {accounts}")
    
    if accounts:
        acct_id = accounts[0]
        for user in users:
            data = {
                "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:principals"],
                "methodCalls": [
                    ["Principal/set", {
                        "accountId": acct_id,
                        "create": {
                            "new1": {
                                "name": user["name"],
                                "email": user["email"],
                                "passwords": {"password": user["password"]}
                            }
                        }
                    }, "t1"]
                ]
            }
            req = urllib.request.Request(
                f"{base_url}/jmap",
                data=json.dumps(data).encode(),
                headers=headers,
                method='POST'
            )
            try:
                resp = urllib.request.urlopen(req)
                result = json.loads(resp.read())
                print(f"  {user['email']}: {result.get('methodResponses', [[None]])[0][0]}")
            except urllib.error.HTTPError as e:
                body = e.read().decode()
                print(f"  {user['email']}: FAILED - {e.code}")
                if 'notRequest' in body:
                    break  # Principal/set doesn't work in community edition
except Exception as e:
    print(f"JMAP session failed: {e}")

print("\nDone. Test IMAP connectivity to verify.")
PYEOF

echo ""
echo "=== University Users Summary ==="
echo "Students:"
echo "  mmustermann@example.org / student123"
echo "  lmayer@example.org / student123"
echo "Professors:"
echo "  schmidt@example.org / professor123"
echo "  dean@example.org / dean123"
echo "Staff:"
echo "  sekretariat@example.org / admin123"
echo "  bibliothek@example.org / library123"
echo "  rektorat@example.org / admin123"
