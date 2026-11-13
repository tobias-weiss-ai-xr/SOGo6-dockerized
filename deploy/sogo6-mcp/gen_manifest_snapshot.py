#!/usr/bin/env python
"""Regenerate manifest_snapshot.json from the facade ACTIONS registry.

Run from sogo6-server (its venv has the app deps):
    cd sogo6-server && ../../deploy/sogo6-mcp/gen_manifest_snapshot.py
"""

import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SERVER = os.path.join(REPO, "sogo6-server")
SNAPSHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "manifest_snapshot.json")

sys.path.insert(0, SERVER)
os.chdir(SERVER)
os.environ.setdefault("SOGO_P_REDIS_URL", "redis://localhost:6379/0")

from app.api.v1.agent import ACTIONS  # noqa: E402
from app.api.v1.agent.ApiAgentManifest import MANIFEST_VERSION  # noqa: E402

with open(SNAPSHOT, "w") as fh:
    json.dump({"data": {"version": MANIFEST_VERSION, "actions": ACTIONS},
               "error_code": "S000000", "error_msg": ""}, fh, indent=1)
    fh.write("\n")
print(f"wrote {SNAPSHOT} ({len(ACTIONS)} actions)")
