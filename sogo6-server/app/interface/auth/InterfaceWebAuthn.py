from __future__ import annotations

import json
import time
from typing import TYPE_CHECKING, Any

from app.module.auth.ModuleWebAuthn import ModuleWebAuthn
from app.utils import errors as err
from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

if TYPE_CHECKING:
    from app.auth.User import User
    from app.config.settings.ProcessSetting import ProcessSetting


# Challenge TTL in seconds
_CHALLENGE_TTL = 120


class InterfaceWebAuthn:
    """High-level WebAuthn operations used by the API layer."""

    def __init__(self, process: ProcessSetting) -> None:
        self._process = process
        self._module = ModuleWebAuthn()
        # Challenges are stored in-memory per-process — acceptable for dev;
        # production should use Redis when scaling beyond one worker.
        self._challenges: dict[str, dict[str, Any]] = {}

    # ── Registration ─────────────────────────────────────────────────────

    def registration_begin(
        self,
        user: User,
        rp_id: str,
        rp_name: str = "SOGo 6",
        origin: str | None = None,
    ) -> dict[str, Any]:
        origin = origin or f"https://{rp_id}"
        options = self._module.generate_registration_options(
            user_uid=user.uid,
            user_display_name=user.cn or user.uid,
            rp_id=rp_id,
            rp_name=rp_name,
            origin=origin,
        )
        challenge = options.get("challenge", "")
        self._challenges[user.uid] = {
            "type": "registration",
            "challenge": challenge,
            "origin": origin,
            "rp_id": rp_id,
            "created_at": time.time(),
        }
        logger_api.debug("WebAuthn registration begin for user=%s", user.uid)
        return {"publicKey": options}

    def registration_complete(
        self,
        user: User,
        credential: dict[str, Any],
        device_name: str = "",
    ) -> dict[str, Any]:
        challenge_data = self._challenges.pop(user.uid, None)
        if not challenge_data or challenge_data["type"] != "registration":
            raise RequestException(
                "No registration challenge in progress",
                err.ERROR_WEBAUTHN_CHALLENGE_EXPIRED,
            )
        if time.time() - challenge_data["created_at"] > _CHALLENGE_TTL:
            raise RequestException(
                "Registration challenge expired",
                err.ERROR_WEBAUTHN_CHALLENGE_EXPIRED,
            )

        try:
            result = self._module.verify_registration(
                credential=credential,
                expected_challenge=challenge_data["challenge"],
                expected_origin=challenge_data["origin"],
                expected_rp_id=challenge_data["rp_id"],
            )
        except Exception as exc:
            logger_api.warning("WebAuthn registration failed for %s: %s", user.uid, exc)
            raise RequestException(
                "WebAuthn registration verification failed",
                err.ERROR_WEBAUTHN_REGISTRATION_FAILED,
            ) from exc

        self._module.store_credential(
            user_uid=user.uid,
            credential_id=result["credential_id"],
            public_key=result["public_key"],
            sign_count=result["sign_count"],
            device_name=device_name,
        )

        logger_api.info("WebAuthn registration complete for user=%s", user.uid)
        return {
            "credential_id": result["credential_id"],
            "device_name": device_name,
        }

    # ── Authentication (login) ────────────────────────────────────────────

    def authentication_begin(
        self,
        rp_id: str,
        user_uid: str | None = None,
        origin: str | None = None,
    ) -> dict[str, Any]:
        origin = origin or f"https://{rp_id}"
        options = self._module.generate_authentication_options(
            rp_id=rp_id,
            user_uid=user_uid,
        )
        challenge = options.get("challenge", "")
        challenge_key = user_uid or "__anonymous__"
        self._challenges[challenge_key] = {
            "type": "authentication",
            "challenge": challenge,
            "origin": origin,
            "rp_id": rp_id,
            "created_at": time.time(),
        }
        logger_api.debug("WebAuthn authentication begin for user=%s", user_uid or "anonymous")
        return {"publicKey": options}

    def authentication_complete(
        self,
        credential: dict[str, Any],
    ) -> dict[str, Any]:
        cred_id = credential.get("id", "")
        # Find the challenge by iterating — the credential may have been
        # preceded by a user-specific or anonymous begin call
        challenge_data: dict[str, Any] | None = None
        challenge_key: str | None = None
        for key, data in list(self._challenges.items()):
            if data["type"] == "authentication":
                challenge_data = data
                challenge_key = key
                break

        if not challenge_data:
            raise RequestException(
                "No authentication challenge in progress",
                err.ERROR_WEBAUTHN_CHALLENGE_EXPIRED,
            )
        if time.time() - challenge_data["created_at"] > _CHALLENGE_TTL:
            self._challenges.pop(challenge_key, None)
            raise RequestException(
                "Authentication challenge expired",
                err.ERROR_WEBAUTHN_CHALLENGE_EXPIRED,
            )

        self._challenges.pop(challenge_key, None)

        try:
            result = self._module.verify_authentication(
                credential=credential,
                expected_challenge=challenge_data["challenge"],
                expected_origin=challenge_data["origin"],
                expected_rp_id=challenge_data["rp_id"],
            )
        except Exception as exc:
            logger_api.warning("WebAuthn authentication failed: %s", exc)
            raise RequestException(
                "WebAuthn authentication verification failed",
                err.ERROR_WEBAUTHN_AUTHENTICATION_FAILED,
            ) from exc

        logger_api.info("WebAuthn authentication succeeded for user=%s", result["user_uid"])
        return result

    # ── Credential management ─────────────────────────────────────────────

    def get_credentials(self, user_uid: str) -> list[dict[str, Any]]:
        return self._module.get_credentials(user_uid)

    def delete_credential(self, credential_id: str, user_uid: str) -> None:
        self._module.delete_credential(credential_id, user_uid)

    def has_enabled_credentials(self, user_uid: str) -> bool:
        return self._module.has_enabled_credentials(user_uid)
