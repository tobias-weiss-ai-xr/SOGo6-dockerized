"""
Module for TOTP (Time-based One-Time Password) multi-factor authentication.

Provides secret generation, provisioning URI building, code verification,
and database persistence for per-user TOTP configurations.
"""

from __future__ import annotations

import base64
from typing import TYPE_CHECKING, Any

import pyotp

from app.config.db import tables as tbl
from app.config.settings.ProcessSetting import process_config
from app.utils.db.Condition import EqualCondition
from app.utils.exceptions import RequestException
from app.utils import errors as err
from app.utils.logger.logger import logger_api
from app.utils.module.importManager import import_and_instantiate_manager

if TYPE_CHECKING:
    from app.manager.db.ClientSQL import ClientSQL


class ModuleTOTP:
    """TOTP authentication provider — per-user secret management + verification."""

    TABLE_NAME: str = process_config.SOGO_P_TABLE_MFA_TOTP

    def __init__(self) -> None:
        db_type = f"Client{process_config.SOGO_P_DB_TYPE}"
        self._db: ClientSQL = import_and_instantiate_manager(
            module_path="app.manager.db",
            module_and_class_name=db_type,
            module_args=process_config.get_db_settings(),
        )
        self._db.connect()

    # ------------------------------------------------------------------
    # TOTP crypto
    # ------------------------------------------------------------------

    @staticmethod
    def generate_secret() -> str:
        """Generate a new random base32-encoded TOTP secret."""
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(secret: str, email: str, issuer: str = "SOGo 6") -> str:
        """Build an otpauth:// URI for QR code provisioning.

        :param secret: Base32-encoded TOTP secret
        :param email: User email (serves as the account name)
        :param issuer: Issuer label shown in authenticator apps
        :returns: OTP auth URI string
        """
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name=issuer)

    @staticmethod
    def verify_code(secret: str, code: str, valid_window: int = 1) -> bool:
        """Verify a TOTP code against the given secret.

        :param secret: Base32-encoded TOTP secret
        :param code: 6-digit code entered by the user
        :param valid_window: Allowed clock-drift tolerance (number of 30s steps)
        :returns: True if the code is valid
        """
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=valid_window)

    # ------------------------------------------------------------------
    # DB queries
    # ------------------------------------------------------------------

    def _row_to_dict(self, row: tuple[Any, ...]) -> dict[str, Any] | None:
        """Convert a DB result row to a dict (None if no row)."""
        if not row:
            return None
        return {
            "id": row[0],
            "user_uid": row[1],
            "secret": row[2],
            "enabled": row[3],
            "created_at": row[4],
        }

    def get_config(self, user_uid: str) -> dict[str, Any] | None:
        """Return the full TOTP config row for a user, or None."""
        try:
            rows = list(self._db.select_from_table(
                self.TABLE_NAME,
                column_tuple=("id", "user_uid", "secret", "enabled", "created_at"),
                condition=EqualCondition("user_uid", user_uid),
            ))
            if rows:
                return self._row_to_dict(rows[0])
            return None
        except Exception as exc:
            logger_api.error("Failed to get TOTP config for %s: %s", user_uid, exc)
            return None

    def is_enabled(self, user_uid: str) -> bool:
        """Check whether TOTP is currently enabled for the given user."""
        config = self.get_config(user_uid)
        return bool(config and config.get("enabled"))

    def create_or_update_secret(self, user_uid: str, secret: str) -> None:
        """Insert (or update) the TOTP secret for a user.  Does *not* enable.

        :param user_uid: User email / uid
        :param secret: Base32-encoded TOTP secret
        """
        existing = self.get_config(user_uid)
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        if existing:
            # Update secret and reset enabled to False
            self._db.update_in_table(
                self.TABLE_NAME,
                column_tuple=("secret", "enabled", "created_at"),
                values_list=[secret, False, now],
                condition=EqualCondition("user_uid", user_uid),
            )
        else:
            self._db.insert_in_table(
                self.TABLE_NAME,
                column_tuple=("user_uid", "secret", "enabled", "created_at"),
                values_tuple=[[user_uid, secret, False, now]],
            )

    def enable(self, user_uid: str) -> None:
        """Mark TOTP as enabled for the given user.  Secret must exist."""
        config = self.get_config(user_uid)
        if not config:
            raise RequestException(
                "TOTP setup required before enabling",
                err.ERROR_MFA_TOTP_SETUP_REQUIRED,
            )
        if config["enabled"]:
            raise RequestException(
                "TOTP is already enabled",
                err.ERROR_MFA_TOTP_ALREADY_ENABLED,
            )
        self._db.update_in_table(
            self.TABLE_NAME,
            column_tuple=("enabled",),
            values_list=[True],
            condition=EqualCondition("user_uid", user_uid),
        )

    def disable(self, user_uid: str) -> None:
        """Disable TOTP for the given user (keeps the secret)."""
        config = self.get_config(user_uid)
        if not config or not config["enabled"]:
            raise RequestException(
                "TOTP is not enabled for this account",
                err.ERROR_MFA_TOTP_NOT_ENABLED,
            )
        self._db.update_in_table(
            self.TABLE_NAME,
            column_tuple=("enabled",),
            values_list=[False],
            condition=EqualCondition("user_uid", user_uid),
        )

    def get_secret(self, user_uid: str) -> str | None:
        """Return the stored secret for a user, or None."""
        config = self.get_config(user_uid)
        if config:
            return config["secret"]
        return None
