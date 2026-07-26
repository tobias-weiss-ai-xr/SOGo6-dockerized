"""Interface layer for app password operations.

Sits between the API layer and the module, manages database client lifecycle.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.module.auth.ModuleAppPassword import ModuleAppPassword
from app.utils import errors as err
from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

if TYPE_CHECKING:
    from app.config.settings.ProcessSetting import ProcessSetting


class InterfaceAppPassword:
    """Wraps ModuleAppPassword with database client setup/teardown."""

    def __init__(self, process: ProcessSetting) -> None:
        self._process = process
        self._module: ModuleAppPassword | None = None

    def _get_module(self) -> ModuleAppPassword:
        """Lazy-init the module with a DB client."""
        if self._module is not None:
            return self._module

        from app.manager.db.ClientSQL import ClientSQL
        from app.utils.module.importManager import import_and_instantiate_manager

        db_type = f"Client{self._process.SOGO_P_DB_TYPE}"
        db: ClientSQL = import_and_instantiate_manager(
            module_path="app.manager.db",
            module_and_class_name=db_type,
            module_args=self._process.get_db_settings(),
        )
        db.connect()
        self._module = ModuleAppPassword(db)
        return self._module

    def list_for_user(self, user_uid: str) -> list[dict[str, Any]]:
        """Return all app passwords for the user."""
        return self._get_module().list_for_user(user_uid)

    def create(self, user_uid: str, label: str) -> dict[str, Any]:
        """Create a new app password and return the record (with raw token)."""
        try:
            raw_token, record = self._get_module().create(user_uid, label)
        except RequestException:
            raise
        except Exception as exc:
            logger_api.error("Failed to create app password: %s", str(exc))
            raise RequestException(
                "Failed to create app password",
                err.ERROR_APP_PASSWORD_NOT_FOUND,
            ) from exc

        return {
            "id": record.get("id"),
            "label": record.get("label", label),
            "token": raw_token,
            "created_at": record.get("created_at"),
        }

    def delete(self, record_id: int, user_uid: str) -> None:
        """Revoke an app password."""
        try:
            self._get_module().delete(record_id, user_uid)
        except RequestException:
            raise
        except Exception as exc:
            logger_api.error("Failed to delete app password %d: %s", record_id, str(exc))
            raise RequestException(
                "Failed to delete app password",
                err.ERROR_APP_PASSWORD_NOT_FOUND,
            ) from exc

    def verify(self, username: str, token: str) -> bool:
        """Check whether ``token`` is a valid app password for ``username``."""
        try:
            return self._get_module().verify(username, token)
        except Exception as exc:  # pylint: disable=broad-except
            logger_api.warning("App password verification error for %s: %s", username, exc)
            return False
