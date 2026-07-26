from __future__ import annotations
from typing import TYPE_CHECKING, cast

from flask import g, request, Response
from flask.views import MethodView
from flask.typing import ResponseReturnValue
from flask_smorest import Blueprint

from app.config.settings.SystemSettings import SystemSettingsObj
from app.interface.auth.InterfaceAuthUser import InterfaceAuthUser
from app.utils.api.ApiBaseResponse import create_api_base_response
from app.utils import errors as err
from app.utils.logger.logger import logger_api

from .schema import authUser as sch

if TYPE_CHECKING:
    from app.config.settings.ProcessSetting import ProcessSetting


blp = Blueprint("Auth", __name__, url_prefix="/auth")


@blp.before_request
def init_admin_config() -> None:
    """
    Init the interface and others if needed 
    """
    logger_api.debug("Calling before_request for ApiAdminConfig")
    process: ProcessSetting = g.process_settings
    system_settings: dict = g.system_settings
    default_domain: dict = g.default_domain_settings
    interface_api = InterfaceAuthUser(process, system_settings, default_domain)
    g.inter = interface_api


@blp.route("/mode")
class ApiAuthUserMode(MethodView):
    """
    Action

    Return the authneticaiton mode for this user
    """
    @blp.arguments(sch.AuthUserGetMechSchema, location='query', as_kwargs=True, error_status_code=400)
    @blp.response(200)
    def get(self, username:str, redirect:str) -> ResponseReturnValue:
        """
        Action, return the url location of the login system for this username.
        redirect is only useful for SSO that needs callback.
        """
        interface_api: InterfaceAuthUser = g.inter
        return interface_api.get_login_mech(username, redirect)


@blp.route("/login")
class ApiAuthUserLogin(MethodView):
    """
    Action, plain login for user
    """

    @blp.arguments(sch.AuthUserBasicPostSchema, example=sch.AuthUserBasicPostSchema.example(), error_status_code=400)
    @blp.response(200)
    def post(self, new_data:dict) -> ResponseReturnValue:
        """
        Action, Authenticate the user for plain mode
        """
        # Per-IP rate limiting (20 requests per minute per IP)
        from app.service import sogo_cache
        from app.utils.api.login_rate_limiter import LoginRateLimiter

        client_ip = request.remote_addr or "unknown"
        limiter = LoginRateLimiter(sogo_cache())
        ip_key = f"login:ip:{client_ip}"
        r = limiter._r
        count = r.incr(ip_key)
        if count == 1:
            r.expire(ip_key, 60)  # 1-minute window
        if count > 20:  # Max 20 login attempts per minute per IP
            logger_api.warning("Rate-limited login from IP=%s (count=%d)", client_ip, count)
            return create_api_base_response(None, err.ERROR_LOGIN_FAILED)

        interface_api : InterfaceAuthUser = g.inter
        return interface_api.plain_login(new_data)


@blp.route("/callback/<string:domain>")
class ApiAuthUserCallback(MethodView):
    """
    Action, is the callback for SSO (OIDC / SAML2).
    """

    # Accept both GET (OIDC redirect) and POST (SAML HTTP-POST)
    accepted_content_types: set[str] = {"application/json",
                                        "application/x-www-form-urlencoded",
                                        "text/plain",
                                        "application/xml",
                                        "text/xml"}

    @blp.response(200)
    def get(self, domain: str) -> ResponseReturnValue:
        """
        Handle the OIDC authorization code callback (GET redirect).
        Query params:
          - code: the authorization code (OIDC)
          - state: CSRF token (OIDC)
          - SAMLResponse: base64-encoded SAML response (SAML HTTP-Redirect)
          - RelayState: opaque state (SAML)
        """
        from app.config.settings.DomainSettings import AuthSettingsObj
        from app.config.settings.ProcessSetting import process_config
        from app.interface.auth.InterfaceAuthSSO import InterfaceAuthSSO
        from app.config.init_config import init_get_system_and_default_domain_settings

        # Get the domain auth settings
        system_settings, default_domain_settings = init_get_system_and_default_domain_settings()
        default_auth = AuthSettingsObj(default_domain_settings.get("AUTH_SETTINGS", {}))

        # If domain is not empty, try to load per-domain settings
        domain_auth = default_auth
        if domain:
            try:
                from app.config.db import tables as tbl
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
                result = list(db.select_from_table(
                    tbl.TABLE_DOMAIN.name,
                    (tbl.COL_DOMAIN_SETTINGS.name,),
                    condition=condition,
                ))
                if result:
                    domain_settings = result[0][0]
                    domain_auth = AuthSettingsObj(domain_settings.get("AUTH_SETTINGS", {}))
            except Exception as exc:  # pylint: disable=broad-except
                from app.utils.logger.logger import logger_api
                logger_api.warning("Could not load domain settings for %s: %s", domain, exc)

        # Build query params dict
        params: dict[str, str] = dict(request.args)

        sso = InterfaceAuthSSO(process_config)
        body, status = sso.handle_callback(domain, domain_auth, params)

        # If the callback produced a JWT token, redirect the user to the
        # frontend with the token as a hash fragment (best practice).
        if isinstance(body, dict) and body.get("data", {}).get("jwt_token"):
            token = body["data"]["jwt_token"]
            frontend_url = process_config.SOGO_P_PUBLIC_BASE_URL or "http://localhost:3000"
            redirect_url = f"{frontend_url.rstrip('/')}/auth/callback#token={token}"
            from flask import redirect as flask_redirect
            return flask_redirect(redirect_url)

        # Otherwise return the API response directly
        from app.utils.api.ApiBaseResponse import create_api_base_response
        return create_api_base_response(body.get("data", body), error_code=body.get("error_code", ""))

    @blp.response(200)
    def post(self, domain: str) -> ResponseReturnValue:
        """
        Handle the SAML2 HTTP-POST callback.
        """
        # SAML POST can be form-encoded or raw XML
        params: dict[str, str] = {}
        if request.form:
            params = dict(request.form)
        elif request.data:
            data_str = request.get_data(as_text=True)
            if data_str.startswith("<"):
                params = {"SAMLResponse": data_str}
            else:
                # Assume URL-encoded
                from urllib.parse import parse_qs
                qs = parse_qs(data_str)
                for key, values in qs.items():
                    params[key] = values[0] if values else ""

        from app.config.settings.DomainSettings import AuthSettingsObj
        from app.config.settings.ProcessSetting import process_config
        from app.interface.auth.InterfaceAuthSSO import InterfaceAuthSSO
        from app.config.init_config import init_get_system_and_default_domain_settings

        system_settings, default_domain_settings = init_get_system_and_default_domain_settings()
        default_auth = AuthSettingsObj(default_domain_settings.get("AUTH_SETTINGS", {}))

        domain_auth = default_auth
        if domain:
            try:
                from app.config.db import tables as tbl
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
                result = list(db.select_from_table(
                    tbl.TABLE_DOMAIN.name,
                    (tbl.COL_DOMAIN_SETTINGS.name,),
                    condition=condition,
                ))
                if result:
                    domain_settings = result[0][0]
                    domain_auth = AuthSettingsObj(domain_settings.get("AUTH_SETTINGS", {}))
            except Exception as exc:  # pylint: disable=broad-except
                from app.utils.logger.logger import logger_api
                logger_api.warning("Could not load domain settings for %s: %s", domain, exc)

        sso = InterfaceAuthSSO(process_config)
        body, status = sso.handle_callback(domain, domain_auth, params)

        if isinstance(body, dict) and body.get("data", {}).get("jwt_token"):
            token = body["data"]["jwt_token"]
            frontend_url = process_config.SOGO_P_PUBLIC_BASE_URL or "http://localhost:3000"
            redirect_url = f"{frontend_url.rstrip('/')}/auth/callback#token={token}"
            from flask import redirect as flask_redirect
            return flask_redirect(redirect_url)

        from app.utils.api.ApiBaseResponse import create_api_base_response
        return create_api_base_response(body.get("data", body), error_code=body.get("error_code", ""))


@blp.route("/logout")
class ApiAuthUserLogout(MethodView):
    """
    Action, revoke the current user session
    """

    @blp.response(200)
    def post(self) -> ResponseReturnValue:
        """
        Action, logout the authenticated user by revoking the session associated
        with the JWT token present in the Authorization header.
        """
        auth_header = request.authorization
        voucher_data: str = ""
        if auth_header and auth_header.token:
            voucher_data = auth_header.token
        interface_api: InterfaceAuthUser = g.inter
        return interface_api.logout(voucher_data)
