#!/usr/bin/env python3
"""Seed/clean/list a Stalwart mailbox from INSIDE its network namespace.

Stalwart refuses foreign TLS connections (empty banner), so test mail must be
injected from its own network namespace. The e2e helper wraps this script as:

    docker run --rm -v <repo>/tests/e2e/scripts/mail-seed.py:/s.py \
        --network container:sogo6-stalwart python:3.12-slim python /s.py <cmd> ...

Commands:
  append --subject S [--seen] [--flagged] [--folder INBOX] [--marker PREFIX]
      Appends one RFC822 message; subject is PREFIX + S so cleanup can find it.
  cleanup --marker PREFIX [--folder INBOX]
      Deletes + expunges every message whose subject starts with PREFIX.
  list   [--folder INBOX]
      Prints "UID \\Seen \\Flagged subject" per message.
"""
import argparse
import imaplib
import ssl
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

HOST = "localhost"
PORT = 993
USER = "testuser@example.org"
PASSWD = "password123"
MARKER = "[local-e2e] "


def connect() -> imaplib.IMAP4_SSL:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    m = imaplib.IMAP4_SSL(HOST, PORT, ssl_context=ctx)
    m.login(USER, PASSWD)
    return m


def quotef(folder: str) -> str:
    """Quote an IMAP mailbox name so imaplib tolerates spaces/UTF-8."""
    return '"' + folder.replace("\\", "\\\\").replace('"', '\\"') + '"'


def append(m: imaplib.IMAP4_SSL, folder: str, subject: str, seen: bool, flagged: bool) -> str:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = USER
    msg["To"] = USER
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid()
    msg.set_content(
        f"This is a local-e2e seeded message ({subject}).\n"
        f"Body marker: {subject}\n"
        "Sent from the stalwart network namespace seed tool.\n"
    )
    flags = []
    if seen:
        flags.append("\\Seen")
    if flagged:
        flags.append("\\Flagged")
    result = m.append(quotef(folder), ",".join(flags), None, msg.as_bytes())
    return str(result)


def cleanup(m: imaplib.IMAP4_SSL, folder: str, marker: str) -> int:
    try:
        m.select(quotef(folder))
    except Exception:
        return 0
    typ, data = m.search(None, "ALL")
    uids = data[0].split()
    deleted = 0
    for uid in uids:
        typ, hdr = m.fetch(uid, "(BODY.PEEK[HEADER.FIELDS (SUBJECT)])")
        head = hdr[0][1].decode("utf-8", "ignore")
        if head and marker.lower() in head.lower():
            m.store(uid, "+FLAGS", "(\\Deleted \\Seen)")
            deleted += 1
    m.expunge()
    m.close()
    return deleted


def cleanup_all(m: imaplib.IMAP4_SSL, marker: str) -> int:
    total = 0
    for folder in ("INBOX", "Deleted Items", "Junk Mail"):
        try:
            total += cleanup(m, folder, marker)
        except Exception as e:
            print(f"cleanup skip {folder}: {e}")
    return total


def list_mails(m: imaplib.IMAP4_SSL, folder: str) -> None:
    m.select(quotef(folder))
    typ, data = m.search(None, "ALL")
    for uid in data[0].split():
        typ, sdata = m.fetch(uid, "(FLAGS BODY.PEEK[HEADER.FIELDS (SUBJECT)])")
        flags = sdata[0][0].decode("utf-8", "ignore")
        head = sdata[0][1].decode("utf-8", "ignore")
        subject = ""
        for line in head.splitlines():
            if line.lower().startswith("subject:"):
                subject = line.split(":", 1)[1].strip()
        print(f"{uid.decode()} {flags} {subject}")
    print("END")


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("append")
    a.add_argument("--subject", required=True)
    a.add_argument("--seen", action="store_true")
    a.add_argument("--flagged", action="store_true")
    a.add_argument("--folder", default="INBOX")
    a.add_argument("--marker", default=MARKER)
    b = sub.add_parser("batch")
    b.add_argument("--subjects", required=True, help='comma list like a:seen,b:flagged,c')
    b.add_argument("--folder", default="INBOX")
    b.add_argument("--marker", default=MARKER)
    c = sub.add_parser("cleanup")
    c.add_argument("--marker", default=MARKER)
    c.add_argument("--folder", default="INBOX")
    l = sub.add_parser("list")
    l.add_argument("--folder", default="INBOX")
    args = p.parse_args()

    m = connect()
    try:
        if args.cmd == "append":
            print(append(m, args.folder, args.marker + args.subject, args.seen, args.flagged))
        elif args.cmd == "batch":
            # Seed all messages over a SINGLE IMAP session to minimise session
            # churn: Stalwart can serve stale SELECT counts to fresh connections
            # right after external appends under heavy reconnect/re-expunge load.
            results = []
            for item in [x for x in args.subjects.split(",") if x]:
                parts = item.split(":")
                name = parts[0]
                seen = "seen" in parts[1:]
                flagged = "flagged" in parts[1:]
                results.append(append(m, args.folder, args.marker + name, seen, flagged))
            print("; ".join(results))
        elif args.cmd == "cleanup":
            print(f"deleted {cleanup_all(m, args.marker)}")
        elif args.cmd == "list":
            list_mails(m, args.folder)
    finally:
        try:
            m.logout()
        except Exception:
            pass


if __name__ == "__main__":
    main()
