"""Password-reset management module.

Provides token generation, validation, and LDAP password update for the
"forgot password" / self-service password recovery flow.

Flow
----
1. User requests a password reset (provides username).
2. Module generates a secure random token, stores its SHA-256 hash + expiry
   in the database, and sends an email with a reset link to the user's
   configured mail address.
3. User clicks the link (frontend presents a new-password form).
4. Frontend calls the verify endpoint to check token validity.
5. Frontend calls the reset endpoint with the token + new password.
6. Module hashes the token, looks it up, verifies expiry & usage state,
   updates the LDAP password, and marks the token as used.
"""

from __future__ import annotations

import secrets
import smtplib
import ssl
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from hashlib import sha256
from typing import Any

from app.config.db import tables as tbl
from app.manager.db.ClientSQL import ClientSQL
from app.utils.db.Condition import AndCondition, EqualCondition, OrCondition
from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

# Default token lifetime (seconds)
DEFAULT_TOKEN_TTL_SECONDS: int = 3600  # 1 hour

# Token byte-length before hex encoding → 64 hex chars
TOKEN_BYTES: int = 32


class ModulePasswordReset:
    """Core password-reset logic: token lifecycle & LDAP update."""

    def __init__(self, process_settings: Any) -> None:
        self.process_settings = process_settings
        sogo_db_type = f"Client{process_settings.SOGO_P_DB_TYPE}"
        from app.utils.module.importManager import import_and_instantiate_manager

        self.db: ClientSQL = import_and_instantiate_manager(
            module_path="app.manager.db",
            module_and_class_name=sogo_db_type,
            module_args=process_settings.get_db_settings(),
        )

    # ── Token lifecycle ────────────────────────────────────────────────────

    def _generate_token(self) -> tuple[str, str]:
        """Return ``(raw_token, sha256_hex)``."""
        raw = secrets.token_hex(TOKEN_BYTES)  # 64 hex chars
        hashed = sha256(raw.encode()).hexdigest()
        return raw, hashed

    def create_reset_token(self, user_uid: str, ttl: int = DEFAULT_TOKEN_TTL_SECONDS) -> str:
        """Generate a reset token, persist it, and return the *raw* token.

        The raw token is shown exactly once (in the email / API response).
        Only the SHA-256 hash is stored.
        """
        raw, hashed = self._generate_token()
        now = datetime.now(timezone.utc)
        expires = now + timedelta(seconds=ttl)

        self.db.connect()
        try:
            self.db.insert_in_table(
                table_name=tbl.TABLE_PWD_RESET_TOKENS.name,
                column_tuple=(
                    tbl.COL_PWD_RESET_TOKEN.name,
                    tbl.COL_PWD_RESET_USER_UID.name,
                    tbl.COL_PWD_RESET_EXPIRES.name,
                    tbl.COL_PWD_RESET_USED.name,
                    tbl.COL_PWD_RESET_CREATED.name,
                ),
                values_tuple=[[hashed, user_uid, expires, False, now]],
            )
        finally:
            self.db.close()

        logger_api.info("Password-reset token created for uid=%s", user_uid)
        return raw

    def _lookup_token(self, raw_token: str) -> dict | None:
        """Return the token row as a dict, or *None* if not found."""
        hashed = sha256(raw_token.encode()).hexdigest()
        self.db.connect()
        try:
            rows = list(
                self.db.select_from_table(
                    table_name=tbl.TABLE_PWD_RESET_TOKENS.name,
                    column_tuple=(
                        tbl.COL_ID.name,
                        tbl.COL_PWD_RESET_TOKEN.name,
                        tbl.COL_PWD_RESET_USER_UID.name,
                        tbl.COL_PWD_RESET_EXPIRES.name,
                        tbl.COL_PWD_RESET_USED.name,
                    ),
                    condition=EqualCondition(tbl.COL_PWD_RESET_TOKEN.name, hashed),
                )
            )
            if not rows:
                return None
            row = rows[0]
            return {
                "id": row[0],
                "user_uid": row[2],
                "expires_at": row[3],
                "used": row[4],
            }
        finally:
            self.db.close()

    def validate_token(self, raw_token: str) -> dict:
        """Validate a raw reset token.

        Returns a dict with ``user_uid`` and ``id`` on success.
        Raises ``RequestException`` with appropriate error codes on failure.
        """
        from app.utils import errors as err

        record = self._lookup_token(raw_token)
        if record is None:
            raise RequestException(
                err.ERROR_PWD_RESET_TOKEN_INVALID.m,
                err.ERROR_PWD_RESET_TOKEN_INVALID,
            )

        if record["used"]:
            raise RequestException(
                err.ERROR_PWD_RESET_TOKEN_USED.m,
                err.ERROR_PWD_RESET_TOKEN_USED,
            )

        expires = record["expires_at"]
        if isinstance(expires, datetime):
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if expires < datetime.now(timezone.utc):
                raise RequestException(
                    err.ERROR_PWD_RESET_TOKEN_EXPIRED.m,
                    err.ERROR_PWD_RESET_TOKEN_EXPIRED,
                )
        elif expires is not None:
            # If it's a numeric timestamp, compare as float
            if float(expires) < datetime.now(timezone.utc).timestamp():
                raise RequestException(
                    err.ERROR_PWD_RESET_TOKEN_EXPIRED.m,
                    err.ERROR_PWD_RESET_TOKEN_EXPIRED,
                )

        return {"user_uid": record["user_uid"], "id": record["id"]}

    def mark_token_used(self, token_id: int) -> None:
        """Mark a token row as used."""
        self.db.connect()
        try:
            self.db.update_in_table(
                table_name=tbl.TABLE_PWD_RESET_TOKENS.name,
                column_tuple=(tbl.COL_PWD_RESET_USED.name,),
                values_list=[True],
                condition=EqualCondition(tbl.COL_ID.name, token_id),
            )
        finally:
            self.db.close()

    def count_recent_tokens(self, user_uid: str, within_seconds: int = 300) -> int:
        """Count how many reset tokens were created for this user in the last N seconds."""
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=within_seconds)
        self.db.connect()
        try:
            rows = list(
                self.db.select_from_table(
                    table_name=tbl.TABLE_PWD_RESET_TOKENS.name,
                    column_tuple=(tbl.COL_ID.name,),
                    condition=AndCondition(
                        EqualCondition(tbl.COL_PWD_RESET_USER_UID.name, user_uid),
                        # created_at >= cutoff
                        # We'll use a simple check: assume datetime comparison works
                    ),
                )
            )
            # Filter by creation time (we can't do >= in Condition easily)
            # Re-fetch with timestamp comparison
            all_rows = list(
                self.db.select_from_table(
                    table_name=tbl.TABLE_PWD_RESET_TOKENS.name,
                    column_tuple=(
                        tbl.COL_ID.name,
                        tbl.COL_PWD_RESET_CREATED.name,
                    ),
                    condition=EqualCondition(tbl.COL_PWD_RESET_USER_UID.name, user_uid),
                )
            )
            count = 0
            for row in all_rows:
                created = row[1]
                if created is not None:
                    if isinstance(created, datetime):
                        if created.tzinfo is None:
                            created = created.replace(tzinfo=timezone.utc)
                        if created >= cutoff:
                            count += 1
                    elif float(created) >= cutoff.timestamp():
                        count += 1
            return count
        finally:
            self.db.close()

    # ── Password update in LDAP ────────────────────────────────────────────

    def reset_password(self, user_uid: str, new_password: str) -> None:
        """Update the user's LDAP password using the admin LDAP module.

        This reuses ``ModuleAdminUser.update_user()`` which performs the
        LDAP modify operation with the configured admin bind credentials.
        """
        from app.utils import errors as err

        try:
            from app.module.admin.ModuleAdminUser import ModuleAdminUser

            admin_module = ModuleAdminUser(process_settings=self.process_settings)
            admin_module.update_user(user_uid, {"password": new_password})
            logger_api.info("Password reset successful for uid=%s", user_uid)
        except RequestException:
            raise
        except Exception as exc:
            logger_api.error(
                "Password reset LDAP update failed for uid=%s: %s", user_uid, exc
            )
            raise RequestException(
                err.ERROR_PWD_RESET_UPDATE_FAILED.m,
                err.ERROR_PWD_RESET_UPDATE_FAILED,
            ) from exc

    # ── Email sending ──────────────────────────────────────────────────────

    def send_reset_email(
        self,
        recipient_email: str,
        recipient_name: str,
        reset_link: str,
        smtp_host: str = "sogo6-stalwart",
        smtp_port: int = 20025,
    ) -> None:
        """Send a password-reset email via the configured SMTP relay.

        Falls back silently on failure (the API will still return success to
        avoid leaking user information).
        """
        from app.utils import errors as err

        subject = "Password Reset — SOGo"
        body = (
            f"Hi {recipient_name},\n\n"
            f"You requested a password reset. Please click the link below "
            f"to set a new password:\n\n"
            f"{reset_link}\n\n"
            f"This link is valid for 1 hour.\n\n"
            f"If you did not request this reset, please ignore this email.\n\n"
            f"— SOGo Team"
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = "noreply@sogo6.local"
        msg["To"] = recipient_email
        msg.attach(MIMEText(body, "plain"))

        try:
            context = ssl.create_default_context()
            # Stalwart dev SMTP typically does not require TLS
            with smtplib.SMTP(host=smtp_host, port=smtp_port, timeout=10) as server:
                server.send_message(msg)
            logger_api.info(
                "Password-reset email sent to %s via %s:%s",
                recipient_email,
                smtp_host,
                smtp_port,
            )
        except Exception as exc:
            logger_api.warning(
                "Failed to send password-reset email to %s: %s",
                recipient_email,
                exc,
            )
            # Do not raise — we don't want to leak whether the email exists
