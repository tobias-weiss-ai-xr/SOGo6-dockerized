from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any
from datetime import datetime, timezone

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
    AttestationConveyancePreference,
    RegistrationCredential,
    AuthenticationCredential,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url

from app.config.db import tables as tbl
from app.config.settings.ProcessSetting import process_config
from app.utils.db.Condition import EqualCondition
from app.utils.exceptions import RequestException
from app.utils import errors as err
from app.utils.logger.logger import logger_api
from app.utils.module.importManager import import_and_instantiate_manager

if TYPE_CHECKING:
    from app.manager.db.ClientSQL import ClientSQL


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ModuleWebAuthn:
    TABLE_NAME: str = process_config.SOGO_P_TABLE_MFA_WEBAUTHN

    def __init__(self) -> None:
        db_type = f"Client{process_config.SOGO_P_DB_TYPE}"
        self._db: ClientSQL = import_and_instantiate_manager(
            module_path="app.manager.db",
            module_and_class_name=db_type,
            module_args=process_config.get_db_settings(),
        )
        self._db.connect()

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def generate_registration_options(
        self,
        user_uid: str,
        user_display_name: str,
        rp_id: str,
        rp_name: str = "SOGo 6",
        origin: str = "https://localhost:3000",
    ) -> dict[str, Any]:
        existing_ids = self._get_credential_ids(user_uid)
        options = generate_registration_options(
            rp_id=rp_id,
            rp_name=rp_name,
            user_id=user_uid.encode("utf-8"),
            user_name=user_uid,
            user_display_name=user_display_name,
            exclude_credentials=[
                {"type": "public-key", "id": base64url_to_bytes(cid)}
                for cid in existing_ids
            ] if existing_ids else None,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.PREFERRED,
                user_verification=UserVerificationRequirement.PREFERRED,
            ),
            attestation=AttestationConveyancePreference.DIRECT,
        )
        return json.loads(options.model_dump_json())

    def verify_registration(
        self,
        credential: dict[str, Any],
        expected_challenge: str,
        expected_origin: str,
        expected_rp_id: str,
    ) -> dict[str, Any]:
        response = verify_registration_response(
            credential=RegistrationCredential.model_validate(credential),
            expected_challenge=base64url_to_bytes(expected_challenge),
            expected_origin=expected_origin,
            expected_rp_id=expected_rp_id,
        )
        return {
            "credential_id": bytes_to_base64url(response.credential_id),
            "public_key": bytes_to_base64url(response.credential_public_key),
            "sign_count": response.sign_count,
        }

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def generate_authentication_options(
        self,
        rp_id: str,
        user_uid: str | None = None,
    ) -> dict[str, Any]:
        if user_uid:
            creds = self._get_credentials(user_uid)
            allow_credentials = [
                {"type": "public-key", "id": base64url_to_bytes(c["credential_id"])}
                for c in creds if c["enabled"]
            ]
        else:
            allow_credentials = None

        options = generate_authentication_options(
            rp_id=rp_id,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.PREFERRED,
        )
        return json.loads(options.model_dump_json())

    def verify_authentication(
        self,
        credential: dict[str, Any],
        expected_challenge: str,
        expected_origin: str,
        expected_rp_id: str,
    ) -> dict[str, Any]:
        cred_id = credential.get("id", "")
        stored = self._get_credential_by_id(cred_id)
        if not stored:
            raise RequestException(
                "WebAuthn credential not found",
                err.ERROR_WEBAUTHN_CREDENTIAL_NOT_FOUND,
            )

        response = verify_authentication_response(
            credential=AuthenticationCredential.model_validate(credential),
            expected_challenge=base64url_to_bytes(expected_challenge),
            expected_origin=expected_origin,
            expected_rp_id=expected_rp_id,
            credential_public_key=base64url_to_bytes(stored["public_key"]),
            credential_current_sign_count=stored["sign_count"],
        )

        self._update_sign_count(cred_id, response.new_sign_count)
        self._update_last_used(cred_id)
        return {
            "credential_id": cred_id,
            "user_uid": stored["user_uid"],
            "new_sign_count": response.new_sign_count,
        }

    # ------------------------------------------------------------------
    # Credential CRUD
    # ------------------------------------------------------------------

    def store_credential(
        self,
        user_uid: str,
        credential_id: str,
        public_key: str,
        sign_count: int,
        device_name: str = "",
        transports: list[str] | None = None,
    ) -> None:
        now = _now()
        self._db.insert_in_table(
            self.TABLE_NAME,
            column_tuple=(
                "user_uid", "credential_id", "public_key",
                "sign_count", "device_name", "transports",
                "enabled", "created_at", "last_used_at",
            ),
            values_tuple=[[
                user_uid, credential_id, public_key,
                sign_count, device_name, json.dumps(transports or []),
                True, now, now,
            ]],
        )
        logger_api.info("WebAuthn credential stored for user=%s id=%s", user_uid, credential_id[:16])

    def get_credentials(self, user_uid: str) -> list[dict[str, Any]]:
        rows = list(self._db.select_from_table(
            self.TABLE_NAME,
            column_tuple=("*",),
            condition=EqualCondition("user_uid", user_uid),
        ))
        return [self._row_to_dict(r) for r in rows]

    def delete_credential(self, credential_id: str, user_uid: str) -> None:
        self._db.delete_from_table(
            self.TABLE_NAME,
            condition=EqualCondition("credential_id", credential_id)
            & EqualCondition("user_uid", user_uid),
        )
        logger_api.info("WebAuthn credential deleted id=%s user=%s", credential_id[:16], user_uid)

    def has_enabled_credentials(self, user_uid: str) -> bool:
        creds = self._get_credentials(user_uid)
        return any(c["enabled"] for c in creds)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _row_to_dict(self, row: tuple[Any, ...]) -> dict[str, Any]:
        return {
            "id": row[0],
            "user_uid": row[1],
            "credential_id": row[2],
            "public_key": row[3],
            "sign_count": row[4],
            "device_name": row[5],
            "transports": row[6],
            "enabled": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
            "last_used_at": row[9].isoformat() if row[9] else None,
        }

    def _get_credentials(self, user_uid: str) -> list[dict[str, Any]]:
        try:
            rows = list(self._db.select_from_table(
                self.TABLE_NAME,
                column_tuple=("*",),
                condition=EqualCondition("user_uid", user_uid),
            ))
            return [self._row_to_dict(r) for r in rows]
        except Exception as exc:
            logger_api.error("Failed to get WebAuthn creds for %s: %s", user_uid, exc)
            return []

    def _get_credential_ids(self, user_uid: str) -> list[str]:
        return [c["credential_id"] for c in self._get_credentials(user_uid)]

    def _get_credential_by_id(self, credential_id: str) -> dict[str, Any] | None:
        try:
            rows = list(self._db.select_from_table(
                self.TABLE_NAME,
                column_tuple=("*",),
                condition=EqualCondition("credential_id", credential_id),
            ))
            return self._row_to_dict(rows[0]) if rows else None
        except Exception as exc:
            logger_api.error("Failed to get WebAuthn credential %s: %s", credential_id[:16], exc)
            return None

    def _update_sign_count(self, credential_id: str, new_count: int) -> None:
        self._db.update_in_table(
            self.TABLE_NAME,
            column_tuple=("sign_count",),
            values_list=[new_count],
            condition=EqualCondition("credential_id", credential_id),
        )

    def _update_last_used(self, credential_id: str) -> None:
        self._db.update_in_table(
            self.TABLE_NAME,
            column_tuple=("last_used_at",),
            values_list=[_now()],
            condition=EqualCondition("credential_id", credential_id),
        )
