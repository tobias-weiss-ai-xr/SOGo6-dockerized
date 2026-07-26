from __future__ import annotations
from typing import TYPE_CHECKING

from flask import g, Response
from flask.views import MethodView
from flask.typing import ResponseReturnValue
from flask_smorest import Blueprint

from app.interface.user.InterfaceUserProfile import InterfaceUserProfile
from app.utils.logger.logger import logger_api

from .schema import userPreferences as sch

if TYPE_CHECKING:
    from app.config.settings.ProcessSetting import ProcessSetting
    from app.utils.api.paginate_sort_filter import FakePaginationParameters
    from app.auth.User import User



blp = Blueprint("Profile", __name__, url_prefix="/profile")


@blp.before_request
def init_user_profile() -> None:
    """
    Init the interface and others if needed
    """
    logger_api.debug("Calling before_request for ApiUserPreferences")
    process: ProcessSetting = g.process_settings
    system_settings: dict = g.system_settings
    user_domain: dict = g.user_domain_settings
    user: User = g.user
    interface_api = InterfaceUserProfile(process_settings=process, user_domain=user_domain, user=user)
    g.inter = interface_api

@blp.route("")
class ApiUserProfile(MethodView):
    """
    Return all the info of the user after a successfull login
    """
    @blp.response(200)
    def get(self) -> ResponseReturnValue:
        """
        Collection, return all user preferences
        """
        interface_api : InterfaceUserProfile = g.inter
        return interface_api.get_user_profile()


@blp.route("/password")
class ApiUserPasswordChange(MethodView):
    """
    Allow a user to change their own password.
    """

    @blp.arguments(sch.UserPasswordChangeSchema, example=sch.UserPasswordChangeSchema.example(), error_status_code=400)
    @blp.response(200, sch.UserPasswordChangeResponseSchema, example=sch.UserPasswordChangeResponseSchema.example())
    def post(self, body: dict) -> ResponseReturnValue:
        """
        Change the password for the currently authenticated user.

        The request must include the current password (for verification) and
        the desired new password.  The backend verifies the current password,
        checks that password changes are enabled for the domain, and updates
        the password in the user source (LDAP).

        :param body: Request body with current_password and new_password
        :type body: dict
        :return: API response dict
        :rtype: ResponseReturnValue
        """
        logger_api.debug("Calling ApiUserPasswordChange.post for user")
        interface_api: InterfaceUserProfile = g.inter

        response, status_code = interface_api.change_password(
            current_password=body["current_password"],
            new_password=body["new_password"],
        )

        return response, status_code
