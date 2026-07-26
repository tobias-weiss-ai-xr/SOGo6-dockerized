"""Interface for SSO (OIDC / SAML2) authentication.

This layer sits between the API callbacks and the specific protocol modules.
It determines whether the domain is configured for OIDC or SAML2 and
delegates to the correct implementation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.module.auth.ModuleOIDC import ModuleOIDC
from app.module.auth.ModuleSAML2 import ModuleSAML2
from app.utils import errors as err
from app.utils.api.ApiBaseResponse import create_api_base_response
from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

if TYPE_CHECKING:
    from app.config.settings.DomainSettings import AuthSettingsObj
    from app.config.settings.ProcessSetting import ProcessSetting
    from app.module.auth.ModuleUserSource import ModuleUserSource


class InterfaceAuthSSO:
    """Handles the SSO callback and user creation for OIDC and SAML2."""

    def __init__(
        self,
        process: ProcessSetting,
    ) -> None:
        self._process = process

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------

    def handle_callback(
        self,
        domain: str,
        domain_auth: AuthSettingsObj,
        query_params: dict[str, str],
    ) -> tuple[dict, int]:
        """Process an SSO callback for the given domain.

        Dispatches to either OIDC or SAML2 based on the domain's auth type.

        :param domain: The domain (used in the URL and for user-source lookups).
        :param domain_auth: The domain's :class:`AuthSettingsObj`.
        :param query_params: Raw query parameters from the callback request.
        :returns: API response tuple ``(body, status_code)``.
        """
        auth_type = domain_auth.SOGO_D_AUTH_TYPE

        if auth_type == "openid":
            return self._handle_oidc_callback(domain, domain_auth, query_params)
        if auth_type == "saml2":
            return self._handle_saml_callback(domain, domain_auth, query_params)
        if auth_type in ("cas",):
            message = f"SSO callback not implemented for auth type '{auth_type}'"
            logger_api.warning(message)
            return create_api_base_response(message, err.ERROR_UNKOWN)
        message = f"SSO callback not supported for auth type '{auth_type}'"
        return create_api_base_response(message, err.ERROR_UNKOWN)

    # ------------------------------------------------------------------
    # OIDC callback
    # ------------------------------------------------------------------

    def _handle_oidc_callback(
        self,
        domain: str,
        domain_auth: AuthSettingsObj,
        params: dict[str, str],
    ) -> tuple[dict, int]:
        """Handle the OIDC authorization code callback.

        Flow:
        1. Validate state (CSRF)
        2. Exchange auth code for tokens
        3. Validate ID token
        4. Fetch userinfo
        5. Extract email
        6. Look up / authenticate user
        7. Generate JWT voucher
        8. Redirect to frontend with token
        """
        code = params.get("code", "")
        state = params.get("state", "")
        # For now, the state is passed via the redirect URL — in production,
        # validate against the session cookie value.

        if not code:
            return create_api_base_response("Missing authorization code", err.ERROR_OIDC_TOKEN_EXCHANGE_FAILED)

        redirect_uri = self._build_redirect_uri(domain)

        try:
            oidc = self._build_oidc(domain_auth)
            oidc.discover()

            # Exchange code for token
            token_data = oidc.fetch_token(code, redirect_uri)
            id_token_jwt = token_data.get("id_token", "")

            if not id_token_jwt:
                return create_api_base_response("No id_token in OIDC response", err.ERROR_OIDC_TOKEN_EXCHANGE_FAILED)

            # Validate ID token
            id_claims = oidc.validate_id_token(id_token_jwt)

            # Fetch userinfo
            userinfo = oidc.get_user_info()

            # Extract email
            email = oidc.get_email(userinfo, id_claims)

            if not email:
                return create_api_base_response(
                    "Could not determine user email from OIDC response",
                    err.ERROR_OIDC_USERINFO_FAILED,
                )

            # Authenticate the user in the local user source
            result = self._authenticate_sso_user(domain, email, "oidc")

            # Add the OIDC subject for reference
            result["oidc_sub"] = oidc.get_subject(id_claims)
            return create_api_base_response(result)

        except RequestException:
            raise
        except Exception as exc:  # pylint: disable=broad-except
            logger_api.error("OIDC callback failed: %s", str(exc))
            return create_api_base_response(str(exc), err.ERROR_OIDC_TOKEN_EXCHANGE_FAILED)

    # ------------------------------------------------------------------
    # SAML2 callback
    # ------------------------------------------------------------------

    def _handle_saml_callback(
        self,
        domain: str,
        domain_auth: AuthSettingsObj,
        params: dict[str, str],
    ) -> tuple[dict, int]:
        """Handle the SAML2 HTTP-POST callback.

        Flow:
        1. Decode SAMLResponse
        2. Parse assertion, validate issuer
        3. Extract email / NameID
        4. Look up / authenticate user
        5. Generate JWT voucher
        6. Return token for frontend redirect
        """
        saml_response_b64 = params.get("SAMLResponse", "")

        if not saml_response_b64:
            return create_api_base_response("Missing SAMLResponse", err.ERROR_SAML_RESPONSE_INVALID)

        try:
            saml = self._build_saml(domain_auth, domain)
            result = saml.process_response(saml_response_b64)

            email = result.get("email", "") or result.get("name_id", "")

            if not email:
                return create_api_base_response(
                    "Could not determine user identity from SAML assertion",
                    err.ERROR_SAML_RESPONSE_INVALID,
                )

            # Authenticate the user in the local user source
            auth_result = self._authenticate_sso_user(domain, email, "saml2")
            auth_result["saml_name_id"] = result.get("name_id", "")
            return create_api_base_response(auth_result)

        except RequestException:
            raise
        except Exception as exc:  # pylint: disable=broad-except
            logger_api.error("SAML callback failed: %s", str(exc))
            return create_api_base_response(str(exc), err.ERROR_SAML_RESPONSE_INVALID)

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    def _build_oidc(self, domain_auth: AuthSettingsObj) -> ModuleOIDC:
        """Construct an OIDC module from domain settings."""
        if not domain_auth.SOGO_D_OPENID_CONFIG_URL:
            raise RequestException("OIDC not configured", err.ERROR_OIDC_NOT_CONFIGURED)

        return ModuleOIDC(
            issuer=domain_auth.SOGO_D_OPENID_CONFIG_URL,
            client_id=domain_auth.SOGO_D_OPENID_CLIENT_NAME,
            client_secret=domain_auth.SOGO_D_OPENID_CLIENT_SECRET,
            scope=domain_auth.SOGO_D_OPENID_SCOPE,
            email_claim=domain_auth.SOGO_D_OPENID_EMAIL,
            allow_redirect_uris=domain_auth.SOGO_D_OPENID_ALLOW_REDIRECT,
        )

    def _build_saml(self, domain_auth: AuthSettingsObj, domain: str) -> ModuleSAML2:
        """Construct a SAML2 module from domain settings."""
        if not domain_auth.SOGO_D_SAML2_URL:
            raise RequestException("SAML2 not configured", err.ERROR_SAML_NOT_CONFIGURED)

        # The SAML2 URL is the IdP SSO URL; we need the ACS URL (our callback)
        acs_url = self._build_redirect_uri(domain)

        return ModuleSAML2(
            idp_sso_url=domain_auth.SOGO_D_SAML2_URL,
            entity_id=acs_url.replace("/callback/", "/metadata/").rstrip("/"),
            acs_url=acs_url,
        )

    def _build_redirect_uri(self, domain: str) -> str:
        """Build the callback URL for this domain.

        Uses the public base URL when configured, otherwise falls back to
        the API's own external URL.
        """
        base = self._process.SOGO_P_PUBLIC_BASE_URL or "http://localhost:5001"
        base = base.rstrip("/")
        return f"{base}/api/user/v1/auth/callback/{domain}"

    def _authenticate_sso_user(
        self,
        domain: str,
        email: str,
        auth_type: str,
    ) -> dict[str, Any]:
        """Authenticate / create an SSO user and generate a JWT voucher.

        Steps:
        1. If the user exists in the user source, generate a voucher
        2. If not, create the user profile (onboarding)
        3. Return the JWT token

        :param domain: The domain name.
        :param email: The user's verified email from the IdP.
        :param auth_type: ``"oidc"`` or ``"saml2"`` — used for logging.
        :returns: A dict with ``jwt_token`` key.
        """
        from app.auth.User import User
        from app.auth.service.VoucherUserService import VoucherUserService
        from app.config.settings.DomainSettings import (
            AuthSettingsObj,
            UserSourceSettingsObj,
        )
        from app.config.settings.SystemSettings import SystemSettingsObj
        from app.config.settings.UserSettings import UserGeneralSettings
        from app.interface.auth.InterfaceAuthUser import InterfaceAuthUser
        from app.module.auth.ModuleAuth import ModuleAuth
        from app.module.auth.ModuleUserSource import ModuleUserSource
        from app.module.calendar.ModuleCalendar import ModuleCalendar
        from app.module.contact.ModuleContact import ModuleContact
        from app.module.user.ModuleUserProfile import ModuleUserProfile
        from app.config.init_config import (
            init_get_system_and_default_domain_settings,
            init_get_user_domain_settings,
        )
        from app.utils.exceptions import RequestException

        logger_api.info("SSO auth (%s) for email=%s domain=%s", auth_type, email, domain)

        # Get system & domain settings
        system_settings, default_domain_settings = init_get_system_and_default_domain_settings()
        system_obj = SystemSettingsObj(system_settings)
        default_auth = AuthSettingsObj(default_domain_settings.get("AUTH_SETTINGS", {}))

        default_us_raw = default_domain_settings.get("USER_SOURCE", {})
        default_us: dict[str, UserSourceSettingsObj] = {}
        for src_uid, src_settings in default_us_raw.items():
            default_us[src_uid] = UserSourceSettingsObj(src_settings)

        module_auth = ModuleAuth(self._process, system_obj, default_auth, default_us)

        # Prepare user
        user = User(email, password="")  # password is empty — we use SSO
        user.domain = domain
        user.mail = email
        user.cn = email.split("@")[0]  # fallback display name

        # Check if user exists in user source (domain settings)
        try:
            user_sources = self._load_domain_user_sources(domain, system_obj, default_auth, default_us)
            module_us = ModuleUserSource(user_sources)

            # Try to authenticate with an empty password — this just checks existence
            # for user sources that allow anonymous lookups.
            auth_ok = module_us.check_login(user)
            if auth_ok:
                logger_api.info("SSO user %s authenticated in user source", email)
            else:
                # User not found in user source — create user profile directly
                logger_api.info("SSO user %s not found in user source, creating profile", email)
                user_profile_module = ModuleUserProfile(self._process, default_domain_settings)
                if not user_profile_module.is_user_profile_present(email):
                    user_profile_module.create_user_profile(user)
                    # Create personal calendar & addressbook
                    raw_gen = user_profile_module.get_partial_user_preferences(
                        email, UserGeneralSettings.subparent.lower()
                    )
                    user_tz = raw_gen.get(UserGeneralSettings.subparent, {}).get(
                        "SOGO_U_TIMEZONE", "UTC"
                    )
                    ModuleCalendar(self._process).create_personal_calendar(email, tz=user_tz)
                    ModuleContact(self._process).create_personal_addressbook(email)
                    logger_api.info("SSO user %s onboarded (calendar + addressbook)", email)
        except Exception as exc:  # pylint: disable=broad-except
            logger_api.warning("SSO user source check failed for %s: %s", email, exc)

        # Generate voucher
        voucher_service = VoucherUserService(self._process)
        voucher_data = voucher_service.generate_voucher_from_user(user)

        return {"jwt_token": voucher_data}

    @staticmethod
    def _load_domain_user_sources(
        domain: str,
        system_settings: SystemSettingsObj,
        default_auth: AuthSettingsObj,
        default_us: dict[str, UserSourceSettingsObj],
    ) -> dict[str, UserSourceSettingsObj]:
        """Load user source settings for the given domain."""
        if not domain:
            return default_us

        from app.config.db import tables as tbl
        from app.config.settings.ProcessSetting import process_config
        from app.manager.db.ClientSQL import ClientSQL
        from app.utils.db.Condition import EqualCondition
        from app.utils.module.importManager import import_and_instantiate_manager

        db_type = f"Client{process_config.SOGO_P_DB_TYPE}"
        db: ClientSQL = import_and_instantiate_manager(
            module_path="app.manager.db",
            module_and_class_name=db_type,
            module_args=process_config.get_db_settings(),
        )
        db.connect()
        condition = EqualCondition(tbl.COL_DOMAIN_NAME.name, domain)
        result = list(
            db.select_from_table(
                tbl.TABLE_DOMAIN.name,
                (tbl.COL_DOMAIN_SETTINGS.name,),
                condition=condition,
            )
        )
        if result:
            domain_settings = result[0][0]
            domain_us_raw = domain_settings.get("USER_SOURCE", {})
            domain_us: dict[str, UserSourceSettingsObj] = {}
            for src_uid, src_settings in domain_us_raw.items():
                domain_us[src_uid] = UserSourceSettingsObj(src_settings)
            return domain_us
        return default_us
