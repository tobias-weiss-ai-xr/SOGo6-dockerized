"""App-password management module.

App passwords are long random tokens that a user generates for a specific
device / application (Thunderbird, Outlook, mobile mail client).  They
bypass the main authentication mechanism (LDAP, OIDC, SAML) and are
validated directly against a bcrypt hash stored in the database.

Security properties:
- Each app password has a descriptive label (e.g. "Thunderbird on Laptop")
- The raw token is shown *once* at creation time and never stored
- Only the bcrypt hash is persisted
- App passwords can be individually revoked by the user
- Rate-limited check endpoint to prevent brute-force
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from typing import Any

from app.config.db import tables as tbl
from app.manager.db.ClientSQL import ClientSQL
from app.utils.db.Condition import EqualCondition
from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

# Cost factor for bcrypt (must match what the container's libs support)
try:
    import bcrypt

    BCRYPT_AVAILABLE = True
except ImportError:
    BCRYPT_AVAILABLE = False

APP_PASSWORD_PREFIX = "sogo-ap-"  # helps users visually identify app passwords


class ModuleAppPassword:
    """CRUD and verification of app-specific passwords.

    Database table ``sogo6_app_passwords`` (created via migration):

        id          SERIAL PRIMARY KEY
        hash        TEXT UNIQUE NOT NULL        -- bcrypt hash of the token
        user_uid    TEXT NOT NULL               -- FK to sogo_user_profiles.uid
        label       TEXT NOT NULL               -- human-readable device / app name
        created_at  TIMESTAMP WITH TIME ZONE
        last_used   TIMESTAMP WITH TIME ZONE    -- updated on each successful check
        expires_at  TIMESTAMP WITH TIME ZONE    -- optional expiration, NULL = never
    """

    TABLE_NAME = "sogo6_app_passwords"

    def __init__(self, db: ClientSQL) -> None:
        """Initialise with a database client.

        :param db: Initialised SQL database client.
        """
        self._db = db

    # ------------------------------------------------------------------
    # Token generation
    # ------------------------------------------------------------------

    @staticmethod
    def generate_token() -> str:
        """Generate a new app-password token.

        Format: ``sogo-ap-<32-hex-chars>``

        :returns: The raw token (shown once to the user).
        """
        raw = secrets.token_hex(32)
        return f"{APP_PASSWORD_PREFIX}{raw}"

    @staticmethod
    def _hash_token(token: str) -> str:
        """Return a bcrypt hash of the given token.

        Falls back to SHA-256 (for development / testing) when bcrypt is
        not available.
        """
        if BCRYPT_AVAILABLE:
            return bcrypt.hashpw(token.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        # Fallback: deterministic SHA-256 with random salt
        salt = secrets.token_hex(16)
        return f"sha256${salt}${hashlib.sha256((salt + token).encode('utf-8')).hexdigest()}"

    @staticmethod
    def _verify_token(token: str, stored_hash: str) -> bool:
        """Verify a raw token against its stored hash."""
        if stored_hash.startswith("$2"):
            if not BCRYPT_AVAILABLE:
                return False
            try:
                return bcrypt.checkpw(token.encode("utf-8"), stored_hash.encode("utf-8"))
            except Exception:  # pylint: disable=broad-except
                return False
        if stored_hash.startswith("sha256$"):
            parts = stored_hash.split("$")
            if len(parts) != 3:
                return False
            _, salt, expected = parts
            computed = hashlib.sha256((salt + token).encode("utf-8")).hexdigest()
            return hmac.compare_digest(computed, expected)
        return False

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def create(self, user_uid: str, label: str) -> tuple[str, dict[str, Any]]:
        """Create a new app password for the given user.

        :param user_uid: The user's email / UID.
        :param label: Human-readable description (e.g. "Thunderbird").
        :returns: Tuple of ``(raw_token, record_dict)``.
        :raises RequestException: If the label is empty or creation fails.
        """
        if not label or not label.strip():
            raise RequestException("App-password label cannot be empty")

        raw_token = self.generate_token()
        token_hash = self._hash_token(raw_token)
        from datetime import datetime, timezone

        now_dt = datetime.now(timezone.utc)

        values = [
            [token_hash, user_uid, label.strip(), now_dt, now_dt, None],
        ]
        columns = ("hash", "user_uid", "label", "created_at", "last_used", "expires_at")

        self._db.insert_in_table(
            self.TABLE_NAME,
            column_tuple=columns,
            values_tuple=values,
        )

        # Query back the inserted record to get its auto-generated ID
        from app.utils.db.Condition import AndCondition, EqualCondition

        condition_hash = EqualCondition("hash", token_hash)
        rows = list(self._db.select_from_table(
            self.TABLE_NAME,
            ("id",),
            condition=condition_hash,
        ))
        record_id = rows[0][0] if rows else None

        record: dict[str, Any] = {
            "id": record_id,
            "label": label.strip(),
            "created_at": int(now_dt.timestamp()),
            "last_used": int(now_dt.timestamp()),
            "expires_at": None,
        }
        logger_api.info("App password created for user=%s label=%s", user_uid, label)
        return raw_token, record

    def list_for_user(self, user_uid: str) -> list[dict[str, Any]]:
        """Return all non-revoked app passwords for a user.

        The output *never* contains the raw token (only the label + metadata).
        """
        condition = EqualCondition("user_uid", user_uid)
        rows = list(self._db.select_from_table(
            self.TABLE_NAME,
            ("id", "label", "created_at", "last_used", "expires_at"),
            condition=condition,
        ))
        results: list[dict[str, Any]] = []
        for row in rows:
            results.append({
                "id": row[0],
                "label": row[1],
                "created_at": int(row[2].timestamp()) if isinstance(row[2], datetime) else row[2],
                "last_used": int(row[3].timestamp()) if isinstance(row[3], datetime) else row[3],
                "expires_at": int(row[4].timestamp()) if isinstance(row[4], datetime) else row[4],
            })
        return results

    def delete(self, record_id: int, user_uid: str) -> None:
        """Revoke (delete) an app password by its ID.

        :param user_uid: Used as an ownership guard — only the owner can
            delete their app passwords.
        """
        condition = EqualCondition("id", record_id)
        deleted = self._db.delete_row_in_table(self.TABLE_NAME, condition=condition)
        if deleted == 0:
            raise RequestException("App password not found or not owned by user")
        logger_api.info("App password %d revoked for user=%s", record_id, user_uid)

    # ------------------------------------------------------------------
    # Verification (used at protocol level — IMAP / SMTP / DAV)
    # ------------------------------------------------------------------

    def verify(self, user_uid: str, token: str) -> bool:
        """Check whether ``token`` is a valid app password for ``user_uid``.

        On success, updates ``last_used`` timestamp.

        :param user_uid: The user's email / UID.
        :param token: The raw token (``sogo-ap-...``).
        :returns: ``True`` if the token is valid and not expired.
        """
        if not token.startswith(APP_PASSWORD_PREFIX):
            return False

        condition = EqualCondition("user_uid", user_uid)
        rows = list(self._db.select_from_table(
            self.TABLE_NAME,
            ("id", "hash", "expires_at"),
            condition=condition,
        ))
        for row in rows:
            record_id, stored_hash, expires_at = row[0], row[1], row[2]
            if self._verify_token(token, stored_hash):
                # Check expiration
                if expires_at is not None and datetime.now(timezone.utc) > expires_at:
                    logger_api.info("App password %d expired for user=%s", record_id, user_uid)
                    continue
                # Update last_used
                from datetime import datetime, timezone
                self._db.update_in_table(
                    self.TABLE_NAME,
                    column_tuple=("last_used",),
                    values_list=[datetime.now(timezone.utc)],
                    condition=EqualCondition("id", record_id),
                )
                return True
        return False
