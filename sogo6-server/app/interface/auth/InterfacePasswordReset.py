"""Interface for password recovery / self-service password reset.

Wraps ``ModulePasswordReset`` with domain-setting checks and API-friendly
responses.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.module.auth.ModulePasswordReset import ModulePasswordReset
from app.utils.api.ApiBaseResponse import create_api_base_response
from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

if TYPE_CHECKING:
    from app.config.settings.ProcessSetting import ProcessSetting
    from app.auth.User import User

# Default SMTP configuration for Stalwart
SMTP_HOST = "sogo6-stalwart"
SMTP_PORT = 20025

# Rate-limit window (seconds)
RATE_LIMIT_WINDOW = 300  # 5 minutes

# Maximum requests per window
MAX_REQUESTS_PER_WINDOW = 3


class InterfacePasswordReset:
    """High-level password-reset interface for the API layer."""

    def __init__(self, process_settings: ProcessSetting) -> None:
        self.process_settings = process_settings
        self.module = ModulePasswordReset(process_settings)

    def request_reset(self, username: str) -> tuple[dict, int]:
        """Initiate a password-reset for the given username.

        Checks:
        1. Domain allows password recovery.
        2. User exists (via ModuleAdminUser list).
        3. Rate-limit: no more than N tokens per time window.
        4. Generate token, send email, return success.

        Returns an API response (always 200 OK to avoid user enumeration).
        """
        from app.utils import errors as err
        from app.config.init_config import init_get_user_domain_settings
        from app.config.settings.DomainSettings import AuthSettings, AuthSettingsObj

        # 1. Resolve user → domain
        from app.module.admin.ModuleAdminUser import ModuleAdminUser

        try:
            admin_module = ModuleAdminUser(process_settings=self.process_settings)
            total, user_list = admin_module.list_users(query=username, page=1, per_page=1)
        except Exception as exc:
            logger_api.warning("Password-reset user lookup failed for %s: %s", username, exc)
            return create_api_base_response({"requested": True})

        if not user_list:
            logger_api.info("Password-reset requested for unknown user=%s", username)
            return create_api_base_response({"requested": True})

        user_entry = user_list[0]
        user_uid = user_entry.get("uid") or user_entry.get("username", username)
        domain = user_entry.get("domain", "")
        user_email = user_entry.get("mail", "") or user_entry.get("email", "")
        user_name = user_entry.get("cn", "") or user_entry.get("displayName", username)

        # 2. Check domain allows password recovery
        try:
            domain_settings = init_get_user_domain_settings(
                # We need a User object with the right domain
                type("FakeUser", (), {"domain": domain, "uid": user_uid})()
            )
        except Exception:
            domain_settings = {}

        auth_raw = domain_settings.get(AuthSettings.subparent, {})
        auth_obj = AuthSettingsObj(auth_raw)
        if not auth_obj.SOGO_D_PWD_RECOVERY:
            logger_api.info("Password recovery disabled for domain=%s", domain)
            return create_api_base_response({"requested": True})

        # 3. Rate-limit check
        try:
            recent = self.module.count_recent_tokens(
                user_uid, within_seconds=RATE_LIMIT_WINDOW
            )
            if recent >= MAX_REQUESTS_PER_WINDOW:
                logger_api.warning(
                    "Password-reset rate-limited for uid=%s (%d requests in %ds)",
                    user_uid,
                    recent,
                    RATE_LIMIT_WINDOW,
                )
                return create_api_base_response({"requested": True})
        except Exception as exc:
            logger_api.warning("Rate-limit check failed for %s: %s", user_uid, exc)

        # 4. Generate token
        try:
            raw_token = self.module.create_reset_token(user_uid)
        except Exception as exc:
            logger_api.error("Token creation failed for uid=%s: %s", user_uid, exc)
            return create_api_base_response({"requested": True})

        # 5. Build reset link
        public_base_url = self.process_settings.SOGO_P_PUBLIC_BASE_URL or "http://localhost:3000"
        reset_link = f"{public_base_url.rstrip('/')}/auth/password-reset?token={raw_token}"

        # 6. Send email (best-effort)
        if user_email:
            try:
                self.module.send_reset_email(
                    recipient_email=user_email,
                    recipient_name=user_name,
                    reset_link=reset_link,
                    smtp_host=SMTP_HOST,
                    smtp_port=SMTP_PORT,
                )
            except Exception:
                pass  # Already logged in the module

        logger_api.info("Password-reset initiated for uid=%s", user_uid)
        return create_api_base_response({"requested": True})

    def verify_token(self, token: str) -> tuple[dict, int]:
        """Verify a reset token and return the associated user_uid.

        Returns the API response with ``user_uid`` on success or an error.
        """
        from app.utils import errors as err

        try:
            result = self.module.validate_token(token)
        except RequestException as exc:
            return create_api_base_response(None, exc.error)

        return create_api_base_response({"user_uid": result["user_uid"], "valid": True})

    def reset_password(self, token: str, new_password: str) -> tuple[dict, int]:
        """Complete the password reset: validate token + update LDAP password.

        Returns an API response.
        """
        from app.utils import errors as err

        # 1. Validate token
        try:
            info = self.module.validate_token(token)
        except RequestException as exc:
            return create_api_base_response(None, exc.error)

        user_uid = info["user_uid"]
        token_id = info["id"]

        # 2. Validate password strength (basic)
        if len(new_password) < 4:
            from app.utils import errors as error_utils
            return create_api_base_response(
                None,
                error_utils.ERROR_VALIDATION_ERROR,
            )

        # 3. Update LDAP password
        try:
            self.module.reset_password(user_uid, new_password)
        except RequestException as exc:
            return create_api_base_response(None, exc.error)

        # 4. Mark token as used
        try:
            self.module.mark_token_used(token_id)
        except Exception as exc:
            logger_api.warning(
                "Failed to mark token %s as used for uid=%s: %s",
                token_id,
                user_uid,
                exc,
            )

        logger_api.info("Password reset completed for uid=%s", user_uid)
        return create_api_base_response({"reset": True})
