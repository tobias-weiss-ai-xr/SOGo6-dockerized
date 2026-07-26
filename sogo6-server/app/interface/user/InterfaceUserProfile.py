from __future__ import annotations
from typing import TYPE_CHECKING, cast

from marshmallow import EXCLUDE, ValidationError

from app.config.db import tables as tbl
from app.config.settings.DomainSettings import (
    AuthSettings,
    AuthSettingsObj,
    get_all_domain_schemas,
    UserSourceSettings,
)
from app.module.user.ModuleUserProfile import ModuleUserProfile
from app.utils.api.ApiBaseResponse import create_api_base_response
from app.utils.exceptions import BugException, RequestException
from app.utils import errors as err
from app.utils.logger.logger import logger_api

if TYPE_CHECKING:
    from app.config.settings.ProcessSetting import ProcessSetting
    from app.auth.User import User


class InterfaceUserProfile:
    """
    Interface for user profile
    """

    def __init__(self, process_settings: ProcessSetting, user_domain: dict, user: User):
        self.process_settings = process_settings
        self.user = user
        self.user_domain = user_domain
        self.module_user_profile = ModuleUserProfile(process_settings, user_domain)

    def get_user_profile(self) -> tuple[dict, int]:
        """
        User profile is:
        - user accounts
        - user preferences
        - user Folder view (NOT IMPLEMENTED)
        - admin param for UI

        It is called by the UI to know how the UI must be handled

        :return:
        :rtype: tuple[dict, int]
        """
        data: dict = {}

        #User accounts
        try:
            data["mailboxes"] = self.module_user_profile.list_accounts(self.user)
        except RequestException as ex:
            return create_api_base_response(None, ex.error)

        #User preferences
        try:
            data["prefs"] = self.module_user_profile.get_user_preferences(self.user.uid)
        except RequestException as e:
            return create_api_base_response(error=e.error)

        #TODO User folders view (NOT IMPLEMENTED)

        #Admin param
        admin_param: dict = {}
        for domain_schema in get_all_domain_schemas():
            subparent = domain_schema.subparent
            domain_sub: dict = self.user_domain[subparent]
            if domain_schema == UserSourceSettings:
                domain_sub = domain_sub[self.user.source_id]
            for setting_needed in domain_schema.is_needed_by_ui:
                admin_param[setting_needed] = domain_sub.get(setting_needed, None)
        data["ui"] = admin_param

        return create_api_base_response(data)

    def change_password(self, current_password: str, new_password: str) -> tuple[dict, int]:
        """
        Change the password for the currently authenticated user.

        Steps:
        1. Check that password changes are enabled for the user's domain.
        2. Verify the current password by re-authenticating against the user source.
        3. Update the password in the user source (LDAP).

        :param current_password: The user's current password (for verification)
        :type current_password: str
        :param new_password: The desired new password
        :type new_password: str
        :return: API response dict and HTTP status code
        :rtype: tuple[dict, int]
        """
        # 1. Check that password change is enabled for this domain
        auth_settings_raw: dict = self.user_domain.get(AuthSettings.subparent, {})
        auth_settings = AuthSettingsObj(auth_settings_raw)
        if not auth_settings.SOGO_D_PWD_CHANGE_ENABLED:
            return create_api_base_response(
                error=err.ERROR_PWD_CHANGE_DISABLED,
            )

        # 2. Verify current password by re-authenticating
        from app.module.auth.ModuleUserSource import ModuleUserSource

        try:
            us_module = ModuleUserSource.init_from_domain_settings(self.user_domain)
            # Create a temporary User-like object for password verification
            from app.auth.User import User
            temp_user = User(self.user.uid, current_password, domain=self.user.domain)
            is_valid = us_module.check_login(temp_user)
            if not is_valid:
                return create_api_base_response(
                    error=err.ERROR_PWD_CHANGE_REAUTH_FAILED,
                )
        except Exception as ex:
            logger_api.error("Password re-authentication failed for uid=%s: %s", self.user.uid, ex)
            return create_api_base_response(
                error=err.ERROR_PWD_CHANGE_REAUTH_FAILED,
            )

        # 3. Update password using ModuleAdminUser (which has admin LDAP bind)
        try:
            from app.module.admin.ModuleAdminUser import ModuleAdminUser
            admin_module = ModuleAdminUser(process_settings=self.process_settings)
            admin_module.update_user(self.user.uid, {"password": new_password})
            logger_api.info("Password changed successfully for uid=%s", self.user.uid)
            return create_api_base_response({"changed": True})
        except RequestException as ex:
            logger_api.error("Password change failed for uid=%s: %s", self.user.uid, ex)
            return create_api_base_response(error=ex.error)
        except Exception as ex:
            logger_api.error("Password change failed for uid=%s: %s", self.user.uid, ex)
            return create_api_base_response(error=err.ERROR_PWD_CHANGE_FAILED)
