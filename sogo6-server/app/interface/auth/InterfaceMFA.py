"""
Interface layer for MFA / TOTP operations.

Wraps ModuleTOTP with API-friendly methods and integrates with the JWT
voucher system for the login-challenge flow.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import TYPE_CHECKING, Any

from app.module.auth.ModuleTOTP import ModuleTOTP
from app.utils import errors as err
from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

if TYPE_CHECKING:
    from app.auth.User import User
    from app.config.settings.ProcessSetting import ProcessSetting


class InterfaceMFA:
    """High-level MFA operations used by the API layer."""

    def __init__(self, process: ProcessSetting) -> None:
        self._process = process
        self._module = ModuleTOTP()

    # ── Setup (step 1) ──────────────────────────────────────────────────────

    def setup(self, user: User) -> dict[str, Any]:
        """Generate a new TOTP secret and return provisioning details.

        The secret is stored immediately (disabled) so the user can
        scan the QR code / copy the URI before completing activation.

        :param user: Authenticated user
        :returns: Dict with 'provisioning_uri', 'secret_preview', and
                  'qr_svg' (base64-encoded SVG image)
        """
        secret = self._module.generate_secret()
        email = user.uid
        uri = self._module.get_provisioning_uri(secret, email)

        # Generate QR code as SVG (base64-encoded)
        qr_svg = self._generate_qr_svg(uri)

        # Persist the secret (disabled)
        self._module.create_or_update_secret(email, secret)

        return {
            "secret": secret,  # shown once
            "provisioning_uri": uri,
            "qr_svg": qr_svg,
        }

    # ── Enable (step 2) ─────────────────────────────────────────────────────

    def enable(self, user: User, code: str) -> None:
        """Verify the first TOTP code and enable MFA for the user.

        :param user: Authenticated user
        :param code: 6-digit code from authenticator app
        :raises RequestException: If the code is invalid or setup not started
        """
        secret = self._module.get_secret(user.uid)
        if not secret:
            raise RequestException(
                "TOTP setup not started — call setup() first",
                err.ERROR_MFA_TOTP_SETUP_REQUIRED,
            )
        if self._module.is_enabled(user.uid):
            raise RequestException(
                "TOTP is already enabled",
                err.ERROR_MFA_TOTP_ALREADY_ENABLED,
            )
        if not self._module.verify_code(secret, code):
            raise RequestException(
                "Invalid TOTP code — please try again",
                err.ERROR_MFA_TOTP_INVALID_CODE,
            )
        self._module.enable(user.uid)
        logger_api.info("TOTP enabled for user=%s", user.uid)

    # ── Disable ─────────────────────────────────────────────────────────────

    def disable(self, user: User) -> None:
        """Disable TOTP for the user.  Keeps the stored secret for reuse.

        :param user: Authenticated user
        :raises RequestException: If TOTP is not enabled
        """
        if not self._module.is_enabled(user.uid):
            raise RequestException(
                "TOTP is not enabled for this account",
                err.ERROR_MFA_TOTP_NOT_ENABLED,
            )
        self._module.disable(user.uid)
        logger_api.info("TOTP disabled for user=%s", user.uid)

    # ── Challenge (login second factor) ─────────────────────────────────────

    def verify_challenge(self, mfa_voucher: str, code: str) -> dict[str, str]:
        """Verify a TOTP code presented during the login MFA challenge.

        Validates the MFA voucher (short-lived JWT), extracts the user UID,
        verifies the code, and issues a full JWT.

        :param mfa_voucher: Short-lived JWT from the first login step
        :param code: 6-digit TOTP code
        :returns: Dict with the full 'jwt_token'
        :raises RequestException: If the voucher or code is invalid
        """
        # Validate the MFA voucher
        user_uid = self._validate_mfa_voucher(mfa_voucher)
        if not user_uid:
            raise RequestException(
                "MFA voucher is invalid or expired",
                err.ERROR_MFA_TOTP_VOUCHER_INVALID,
            )

        # Check TOTP is enabled
        if not self._module.is_enabled(user_uid):
            raise RequestException(
                "TOTP is not enabled for this account",
                err.ERROR_MFA_TOTP_NOT_ENABLED,
            )

        # Verify the code
        secret = self._module.get_secret(user_uid)
        if not secret or not self._module.verify_code(secret, code):
            raise RequestException(
                "Invalid TOTP code",
                err.ERROR_MFA_TOTP_INVALID_CODE,
            )

        # Generate the real JWT
        from app.auth.service.VoucherUserService import VoucherUserService

        voucher_service = VoucherUserService(self._process)
        # Re-create a minimal User object from the uid
        from app.auth.User import User as UserModel

        user = UserModel(user_uid, None, domain="")
        token_data = voucher_service.generate_voucher_from_user(user)
        logger_api.info("MFA challenge succeeded for user=%s", user_uid)
        return {"jwt_token": token_data}

    # ── MFA voucher generation (used by login flow) ─────────────────────────

    def generate_mfa_voucher(self, user_uid: str) -> str:
        """Generate a short-lived JWT (5 min) scoped to MFA challenge.

        :param user_uid: The user's email / uid
        :returns: Encoded JWT string
        """
        from app.auth.service.VoucherUserService import VoucherUserService

        voucher_service = VoucherUserService(self._process)
        return voucher_service.generate_mfa_voucher(user_uid)

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _validate_mfa_voucher(self, voucher: str) -> str | None:
        """Validate the MFA voucher JWT and return the embedded user UID.

        :param voucher: The MFA voucher JWT string
        :returns: User UID or None if invalid/expired
        """
        try:
            from app.auth.service.VoucherUserService import VoucherUserService

            voucher_service = VoucherUserService(self._process)
            payload = voucher_service.decode_mfa_voucher(voucher)
            if payload is None:
                return None
            return payload.get("sub") or payload.get("uid")
        except Exception as exc:
            logger_api.warning("Failed to validate MFA voucher: %s", exc)
            return None

    @staticmethod
    def _generate_qr_svg(uri: str) -> str:
        """Generate a base64-encoded SVG QR code for the provisioning URI.

        :param uri: otpauth:// URI
        :returns: Base64 string of the SVG image
        """
        try:
            import qrcode  # type: ignore[import-untyped]
            import io

            qr = qrcode.QRCode(box_size=4, border=2)
            qr.add_data(uri)
            qr.make(fit=True)
            img = qr.make_image(image_factory=qrcode.image.svg.SvgImage)
            buf = io.BytesIO()
            img.save(buf)
            svg_bytes = buf.getvalue()
            return base64.b64encode(svg_bytes).decode("ascii")
        except ImportError:
            logger_api.warning("qrcode package not available; returning empty QR")
            return ""
        except Exception as exc:
            logger_api.warning("Failed to generate QR code: %s", exc)
            return ""
