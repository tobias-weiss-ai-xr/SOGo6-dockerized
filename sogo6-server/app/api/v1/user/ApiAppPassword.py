"""App Password API endpoints.

Allows authenticated users to manage app-specific passwords for local
clients (Thunderbird, Outlook, mobile mail clients).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from flask import g, request
from flask.views import MethodView
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from app.interface.user.InterfaceAppPassword import InterfaceAppPassword

if TYPE_CHECKING:
    from app.auth.User import User

blp = Blueprint("AppPasswords", __name__, url_prefix="/app-passwords")


# ── Schemas ──────────────────────────────────────────────────────────────────

class AppPasswordCreateSchema(Schema):
    """Request body for creating a new app password."""
    label = fields.String(required=True)

class AppPasswordCreateResponseSchema(Schema):
    """Response with the newly created app password (token shown once)."""
    id = fields.Integer()
    label = fields.String()
    token = fields.String()
    created_at = fields.Integer()

class AppPasswordListResponseSchema(Schema):
    """List of app passwords (no tokens)."""
    app_passwords = fields.List(fields.Nested(lambda: AppPasswordItemSchema()))

class AppPasswordItemSchema(Schema):
    """Single app password item (without the raw token)."""
    id = fields.Integer()
    label = fields.String()
    created_at = fields.Integer()
    last_used = fields.Integer()
    expires_at = fields.Integer(allow_none=True)

class AppPasswordDeleteSchema(Schema):
    """Request schema for delete (param in path)."""
    id = fields.Integer(required=True)


# ── Before request ───────────────────────────────────────────────────────────

@blp.before_request
def init_interface() -> None:
    """Initialise the app password interface."""
    from app.config.settings.ProcessSetting import process_config

    if "app_password_inter" not in g:
        inter = InterfaceAppPassword(process_config)
        g.app_password_inter = inter


# ── Endpoints ────────────────────────────────────────────────────────────────

@blp.route("")
class ApiAppPasswordListCreate(MethodView):
    """GET  /app-passwords  → list all app passwords for the current user
       POST /app-passwords  → create a new app password
    """

    @blp.response(200, AppPasswordListResponseSchema)
    def get(self) -> dict[str, Any]:
        """List all app passwords (without the raw tokens)."""
        user: User = g.user
        inter: InterfaceAppPassword = g.app_password_inter
        items = inter.list_for_user(user.uid)
        return {"app_passwords": items}

    @blp.arguments(AppPasswordCreateSchema)
    @blp.response(201, AppPasswordCreateResponseSchema)
    def post(self, new_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new app password. The raw token is returned once."""
        user: User = g.user
        inter: InterfaceAppPassword = g.app_password_inter
        result = inter.create(user.uid, new_data["label"])
        return result


@blp.route("/<int:record_id>")
class ApiAppPasswordDelete(MethodView):
    """DELETE /app-passwords/<id>  → revoke an app password."""

    @blp.response(204)
    def delete(self, record_id: int) -> tuple[str, int]:
        """Revoke an app password by its record ID."""
        user: User = g.user
        inter: InterfaceAppPassword = g.app_password_inter
        inter.delete(record_id, user.uid)
        return "", 204


# ── Verification endpoint (for internal / client use) ────────────────────────

@blp.route("/verify")
class ApiAppPasswordVerify(MethodView):
    """POST /app-passwords/verify  → check an app password (rate-limited).

    This endpoint is **public** (no authentication required) because IMAP/SMTP/DAV
    clients such as Thunderbird do not carry a JWT token — they authenticate
    using the app password itself.
    """

    public_access = True  # type: ignore[attr-defined]

    class VerifySchema(Schema):
        """Request body for verification."""
        username = fields.String(required=True)
        token = fields.String(required=True)

    @blp.arguments(VerifySchema)
    @blp.response(200)
    def post(self, data: dict[str, str]) -> dict[str, Any]:
        """Verify an app password. Used by IMAP/SMTP/DAV authentication layer."""
        inter: InterfaceAppPassword = g.app_password_inter
        is_valid = inter.verify(data["username"], data["token"])
        return {"valid": is_valid}
