from flask_smorest import Blueprint

from .AuthUserApi import blp as user_auth_api
from .ApiMFA import blp as mfa_api
from .ApiPasswordReset import blp as password_reset_api
from .ApiWebAuthn import blp as webauthn_api

user_auth_apis : list[Blueprint] = [user_auth_api, mfa_api, password_reset_api, webauthn_api]
