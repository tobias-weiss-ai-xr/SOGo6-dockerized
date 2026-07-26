from __future__ import annotations
from typing import TYPE_CHECKING

from app.auth.User import UserAnonymous
from app.config.settings.SystemSettings import SystemSettingsObj, SystemSettings
from app.config.settings.DomainSettings import AuthSettingsObj, AuthSettings, UserSourceSettings, UserSourceSettingsObj
from app.config.settings.UserSettings import UserGeneralSettings
from app.module.auth.ModuleAuth import ModuleAuth
from app.module.auth.ModuleUserSource import ModuleUserSource
from app.module.calendar.ModuleCalendar import ModuleCalendar
from app.module.contact.ModuleContact import ModuleContact
from app.module.user.ModuleUserProfile import ModuleUserProfile
from app.utils.api.ApiBaseResponse import create_api_base_response
from app.utils.exceptions import RequestException, BugException
from app.utils import errors as err
from app.utils.logger.logger import logger_api

if TYPE_CHECKING:
    from app.config.settings.ProcessSetting import ProcessSetting
    from app.auth.User import User


class InterfaceAuthUser:
    """
    Interface for user authentication
    """

    def __init__(self, process: ProcessSetting, system: dict, default_domain: dict):
        system_settings = SystemSettingsObj(system[SystemSettings.subparent])
        default_auth = AuthSettingsObj(default_domain[AuthSettings.subparent])

        default_us_source_raw: dict = default_domain[UserSourceSettings.subparent]
        default_us_source: dict = {}
        for source_uid, source_settings in default_us_source_raw.items():
            default_us_source[source_uid] = UserSourceSettingsObj(source_settings)

        self._process = process
        self.module_auth = ModuleAuth(process, system_settings, default_auth, default_us_source)
        self.module_user_profile = ModuleUserProfile(process, default_domain)
        self._module_calendar: ModuleCalendar = ModuleCalendar(process)
        self._module_contact: ModuleContact = ModuleContact(process)

        # Brute-force protection settings (from the default domain)
        self._auth_settings = default_auth
        # Login rate-limiter — initialised lazily when first needed
        self._rate_limiter = None


    def get_login_mech(self, user_uid:str, redirect:str) -> tuple[dict, int]:
        """
        Get the login mech from a uid

        :param user_uid: The user unique ID
        :type user_uid: str
        :param redirect: The redirect URL after authentication
        :type redirect: str
        :return: Tuple containing the API response dict and HTTP status code
        :rtype: tuple[dict, int]
        """
        try:
            ret = self.module_auth.get_login_mech(user_uid, redirect=redirect)
        except RequestException as e:
            return create_api_base_response(str(e), e.error)
        return create_api_base_response(ret)

    def _get_rate_limiter(self):
        """Lazy-initialise and return the login rate-limiter."""
        if self._rate_limiter is None:
            from app.utils.api.login_rate_limiter import LoginRateLimiter
            from app.service import sogo_cache

            redis_client = sogo_cache()
            self._rate_limiter = LoginRateLimiter(redis_client)
        return self._rate_limiter

    def _check_login(self, uid:str, password:str) -> tuple[bool, User, ModuleUserSource]:
        """
        Check credentials uid/password/token of a user

        :param uid: uid of the user
        :type username: str
        :param password: password or token or any equivalent
        :type password: str
        :return: True if success, instante of User, instande of Appropriate ModuleUserSource
        :rtype: tuple[bool, User, ModuleUserSource]
        """
        # Brute-force check (domain-level setting)
        max_attempt = self._auth_settings.SOGO_D_LOGIN_CHECK_MAX_ATTEMPT
        block_time = self._auth_settings.SOGO_D_LOGIN_CHECK_BLOCK_TIME
        time_span = self._auth_settings.SOGO_D_LOGIN_CHECK_TIME_SPAN

        if max_attempt > 0:
            limiter = self._get_rate_limiter()
            if limiter.is_blocked(uid, max_attempt, block_time):
                logger_api.warning("Login blocked (brute-force) for uid=%s", uid)
                return False, None, None  # Caller will map to ERROR_LOGIN_FAILED

        # Prepare the user object for authentication and get domain user sources
        user, domain_user_sources = self.module_auth.get_user_and_domain_user_sources(uid, password)

        # Check login using the user source module
        module_us = ModuleUserSource(domain_user_sources)
        success = module_us.check_login(user)

        # Record failure or reset counter on success
        if max_attempt > 0:
            limiter = self._get_rate_limiter()
            if success:
                limiter.reset_failures(uid)
            else:
                count = limiter.record_failure(uid, time_span)
                logger_api.info("Login failed for uid=%s (attempt %d/%d)", uid, count, max_attempt)
                if count >= max_attempt:
                    limiter.block(uid, block_time)

        return success, user, module_us

    def plain_login(self, data:dict) -> tuple[dict, int]:
        """
        Check a plain login uid/password.

        :param data: Dictionary containing 'username' and 'password' keys
        :type data: dict
        :return: Tuple containing the API response dict and HTTP status code
        :rtype: tuple[dict, int]
        """
        uid = data["username"]
        password = data["password"]
        mfa_code: str | None = data.get("mfa_code")

        success, user, module_us = self._check_login(uid, password)

        if not success or user is None:
            return create_api_base_response(None, err.ERROR_LOGIN_FAILED)

        # ── MFA checks ───────────────────────────────────────────────────
        mfa_methods_configured: list[str] = []

        try:
            from app.module.auth.ModuleTOTP import ModuleTOTP
            totp = ModuleTOTP()
            if totp.is_enabled(uid):
                mfa_methods_configured.append("totp")
        except Exception as exc:
            logger_api.warning("Failed to check TOTP status for %s: %s", uid, exc)

        try:
            from app.module.auth.ModuleWebAuthn import ModuleWebAuthn
            webauthn = ModuleWebAuthn()
            if webauthn.has_enabled_credentials(uid):
                mfa_methods_configured.append("webauthn")
        except Exception as exc:
            logger_api.warning("Failed to check WebAuthn status for %s: %s", uid, exc)

        if "totp" in mfa_methods_configured:
            if mfa_code:
                secret = totp.get_secret(uid)
                if not secret or not totp.verify_code(secret, mfa_code):
                    return create_api_base_response(None, err.ERROR_MFA_TOTP_INVALID_CODE)
                logger_api.info("MFA (TOTP) challenge succeeded for user=%s", uid)
            else:
                logger_api.info("Login with MFA (TOTP) required for user=%s", uid)
                return create_api_base_response({"mfa_required": True, "mfa_method": "totp"})

        if "webauthn" in mfa_methods_configured:
            if "webauthn_credential" in data:
                try:
                    from app.interface.auth.InterfaceWebAuthn import InterfaceWebAuthn
                    inter = InterfaceWebAuthn(self._process)
                    result = inter.authentication_complete(credential=data["webauthn_credential"])
                    if result.get("user_uid") != uid:
                        return create_api_base_response(None, err.ERROR_WEBAUTHN_AUTHENTICATION_FAILED)
                    logger_api.info("MFA (WebAuthn) challenge succeeded for user=%s", uid)
                except RequestException as exc:
                    return create_api_base_response(None, exc.error)
            else:
                logger_api.info("Login with MFA (WebAuthn) required for user=%s", uid)
                return create_api_base_response({"mfa_required": True, "mfa_method": "webauthn"})

        # Generate the voucher for the authenticated user
        ret = self.module_auth.generate_voucher_from_user(user)

        try:
            if not self.module_user_profile.is_user_profile_present(uid):
                self.module_user_profile.create_user_profile(user)
                raw_gen: dict = self.module_user_profile.get_partial_user_preferences(uid, UserGeneralSettings.subparent.lower())
                user_tz: str = raw_gen.get(UserGeneralSettings.subparent, {}).get("SOGO_U_TIMEZONE", "UTC")
                self._module_calendar.create_personal_calendar(uid, tz=user_tz)
                self._module_contact.create_personal_addressbook(uid)
        except RequestException as ex:
            logger_api.error("Request exception when onboarding user %s: %s", uid, str(ex))
            return create_api_base_response(None, ex.error)

        return create_api_base_response(ret)

    def check_user_and_fill_info(self, user:User) -> tuple[bool, User]:
        """
        Directly used by the before_request at init.
        Check that the user credentials is still relevant and fill the user instance with infos needed

        :param user: _description_
        :type user: User
        :return: True if the user credentials are ok
        :rtype: bool
        """
        success, user_found, module_us = self._check_login(user.uid, user.password)
        if success and user_found is not None:
            self.module_user_profile.get_user_profile(user_found)
            return True, user_found
        return False, UserAnonymous()

    def logout(self, voucher_data: str) -> tuple[dict, int]:
        """
        Revoke the session associated with the given voucher.

        :param voucher_data: The raw JWT token from the Authorization header
        :type voucher_data: str
        :return: Tuple containing the API response dict and HTTP status code
        :rtype: tuple[dict, int]
        """
        try:
            self.module_auth.logout_user(voucher_data)
        except RequestException as e:
            return create_api_base_response(None, e.error)
        return create_api_base_response(None)

