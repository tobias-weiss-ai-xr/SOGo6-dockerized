from flask_smorest import Blueprint

from .ApiUserPreferences import blp as user_preference_api
from .ApiUserProfile import blp as user_profile_api
from .ApiUserCustomization import blp as user_customization_api
from .ApiAppPassword import blp as app_password_api

user_profile_apis : list[Blueprint] = [user_profile_api, user_preference_api, user_customization_api, app_password_api]
