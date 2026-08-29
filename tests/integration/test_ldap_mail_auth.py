"""
TDD acceptance test for the Stalwart LDAP-directory fork (openspec change
`stalwart-ldap-fork`).

These tests are the acceptance tests for Stalwart LDAP-directory authentication
(openspec change `stalwart-ldap-fork`). They assert that Stalwart authenticates
the demo LDAP users (testuser@example.org etc.) via the configured LDAP
directory (the local OpenLDAP tree `dc=example,dc=org`) and that SOGo mail
(folders/messages) becomes available.

Key finding (2026-08-29): the Stalwart community build is NOT gated for the LDAP
directory backend — `Directory::Ldap` is always compiled and `x:Directory/set`
works. The mail-auth blocker was simply that the LDAP directory was never
*activated* (no `filterLogin` placeholder + not set as the default auth
directory via `x:Authentication/set directoryId`). Once configured, IMAP auth
against LDAP works with no fork.

Run standalone:
  cd tests/integration && PYTHONPATH=. pytest test_ldap_mail_auth.py -v
"""
import base64
import subprocess

import pytest
import requests

from test_stack import API_URL, user_token

TEST_USER = "testuser@example.org"
TEST_PASS = "password123"
STALWART_CONTAINER = "sogo6-server"   # exec here so we use internal docker DNS
STALWART_HOST = "sogo6-stalwart"      # reachable from sogo6-server via sogo6-net
IMAP_PORT = 143


def _imap_plain_auth(username: str, password: str) -> str:
    """Open IMAP to Stalwart (via sogo6-server exec) and AUTHENTICATE PLAIN.

    Uses distinct command tags (a1 CAPABILITY, a2 AUTHENTICATE, a3 LIST) so the
    AUTHENTICATE result (`a2 OK` vs `a2 NO`) is unambiguous.
    """
    token = base64.b64encode(
        b"\x00" + username.encode() + b"\x00" + password.encode()
    ).decode()
    # printf interprets \r\n in the (double-quoted) format string as real CRLF,
    # which IMAP requires. Distinct tags keep the AUTHENTICATE result unambiguous.
    script = (
        f"exec 3<>/dev/tcp/{STALWART_HOST}/{IMAP_PORT}; "
        f'printf "a1 CAPABILITY\r\n'
        f'a2 AUTHENTICATE PLAIN {token}\r\n'
        f'a3 LIST \"\" \"*\"\r\n'
        f'a4 LOGOUT\r\n" >&3; '
        f"timeout 6 cat <&3"
    )
    cp = subprocess.run(
        ["docker", "exec", STALWART_CONTAINER, "bash", "-c", script],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return cp.stdout + cp.stderr


def test_imap_plain_auth_via_ldap_directory():
    """IMAP AUTHENTICATE PLAIN for an LDAP user must succeed against Stalwart."""
    out = _imap_plain_auth(TEST_USER, TEST_PASS)
    # a2 is the AUTHENTICATE command; success returns "a2 OK", failure "a2 NO".
    assert "a2 OK" in out, f"IMAP AUTHENTICATE did not succeed; response:\n{out}"
    # A successful AUTHENTICATE is followed by the a3 LIST result.
    assert "a3" in out, f"Post-auth LIST not reached; response:\n{out}"


def test_mailboxes_folders_available_after_ldap_login():
    """After LDAP login, SOGo mail folders must be reachable (no S000310)."""
    token = user_token(TEST_USER, TEST_PASS)
    assert token, "SOGo LDAP login returned no token"
    resp = requests.get(
        f"{API_URL}/api/user/v1/mailboxes/0/folders",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert resp.status_code == 200, (
        f"Expected 200 with folders, got {resp.status_code}: {resp.text[:200]}"
    )
    data = resp.json().get("data", [])
    names = {f.get("name") for f in data if isinstance(f, dict)}
    assert names, f"Expected at least one folder (e.g. INBOX), got: {data}"
