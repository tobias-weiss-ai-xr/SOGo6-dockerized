"""API endpoints for password recovery / self-service password reset.

All endpoints are **public** (no JWT required) because the user cannot
authenticate if they have forgotten their password.
"""

from __future__ import annotations

from typing import Any

from flask import g
from flask.views import MethodView
from flask.typing import ResponseReturnValue
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from app.interface.auth.InterfacePasswordReset import InterfacePasswordReset
from app.utils.api.ApiBaseResponse import create_api_base_response
from app.utils.exceptions import RequestException

blp = Blueprint("Password Reset", __name__, url_prefix="/auth/password-reset")


# ── Schemas ──────────────────────────────────────────────────────────────────


class ResetRequestSchema(Schema):
    """Request body for initiating a password reset."""

    username = fields.String(required=True)


class VerifyTokenQuerySchema(Schema):
    """Query parameters for token verification."""

    token = fields.String(required=True)


class ResetSchema(Schema):
    """Request body for completing a password reset."""

    token = fields.String(required=True)
    new_password = fields.String(required=True)


class TokenStatusResponseSchema(Schema):
    """Response for token verification."""

    user_uid = fields.String(dump_default="")
    valid = fields.Boolean(dump_default=False)


class ResetRequestResponseSchema(Schema):
    """Response for initiating a reset."""

    requested = fields.Boolean(dump_default=True)


class ResetResponseSchema(Schema):
    """Response for completing a reset."""

    reset = fields.Boolean(dump_default=True)


# ── Before request ───────────────────────────────────────────────────────────


@blp.before_request
def init_interface() -> None:
    """Initialise the password-reset interface on every request to this blueprint."""
    from app.config.settings.ProcessSetting import process_config

    if "pwd_reset_inter" not in g:
        g.pwd_reset_inter = InterfacePasswordReset(process_config)


# ── Endpoints ────────────────────────────────────────────────────────────────


@blp.route("/request")
class ApiPasswordResetRequest(MethodView):
    """(Public) Request a password-reset email."""

    public_access = True

    @blp.arguments(ResetRequestSchema, error_status_code=400)
    @blp.response(200, ResetRequestResponseSchema)
    def post(self, new_data: dict[str, Any]) -> dict[str, Any]:
        """Send a password-reset link to the user's email."""
        inter: InterfacePasswordReset = g.pwd_reset_inter
        response, status = inter.request_reset(new_data["username"])
        return response.get("data", {"requested": True})


@blp.route("/verify")
class ApiPasswordResetVerify(MethodView):
    """(Public) Verify a reset token."""

    public_access = True

    @blp.arguments(VerifyTokenQuerySchema, location="query", error_status_code=400)
    @blp.response(200, TokenStatusResponseSchema)
    def get(self, args: dict[str, Any]) -> dict[str, Any]:
        """Check whether a reset token is valid and not expired."""
        inter: InterfacePasswordReset = g.pwd_reset_inter
        response, status = inter.verify_token(args["token"])
        data = response.get("data")
        if data:
            return data
        return {"valid": False, "user_uid": ""}


@blp.route("/reset")
class ApiPasswordResetComplete(MethodView):
    """(Public) Complete the password reset with a new password."""

    public_access = True

    @blp.arguments(ResetSchema, error_status_code=400)
    @blp.response(200, ResetResponseSchema)
    def post(self, new_data: dict[str, Any]) -> dict[str, Any]:
        """Set a new password using a valid reset token."""
        inter: InterfacePasswordReset = g.pwd_reset_inter
        response, status = inter.reset_password(
            new_data["token"], new_data["new_password"]
        )
        data = response.get("data")
        if data:
            return data
        return {"reset": False}
