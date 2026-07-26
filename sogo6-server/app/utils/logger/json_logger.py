"""
Structured JSON logging for the SOGo API server.

Provides a ``JsonFormatter`` that outputs structured JSON lines instead of the
default text format. The logger instances from ``app.utils.logger.logger`` are
patched at import time to use the JSON formatter when the ``SOGO_JSON_LOG``
environment variable is set to ``"1"``.

Each log line contains:
  - ``timestamp`` (ISO-8601)
  - ``level``
  - ``logger`` (logger name, e.g. ``sogolog.api``)
  - ``pid``
  - ``file``, ``func``, ``line``
  - ``message``
  - optional extra fields passed as keyword arguments to the log call
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """Log formatter that emits structured JSON lines."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "pid": record.process,
            "file": record.pathname,
            "func": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }

        # Add any extra custom fields (passed as kwargs to the log call)
        for key, value in record.__dict__.items():
            if key not in (
                "args", "asctime", "created", "exc_info", "exc_text", "filename",
                "funcName", "levelname", "levelno", "lineno", "module",
                "msecs", "message", "msg", "name", "pathname", "process",
                "processName", "relativeCreated", "stack_info", "thread",
                "threadName",
            ):
                payload[key] = value

        if record.exc_info and record.exc_info[0]:
            payload["exception"] = {
                "type": record.exc_info[0].__name__,
                "value": str(record.exc_info[1]),
            }

        return json.dumps(payload, default=str)


def enable_json_logging() -> None:
    """Patch the root sogolog logger and its children to use ``JsonFormatter``.

    Called automatically at import time when ``SOGO_JSON_LOG=1``.
    """
    if os.environ.get("SOGO_JSON_LOG") != "1":
        return

    json_handler = logging.StreamHandler()
    json_handler.setFormatter(JsonFormatter())

    root = logging.getLogger("sogolog")
    # Remove existing handlers
    for h in list(root.handlers):
        root.removeHandler(h)
    root.addHandler(json_handler)
    root.propagate = False

    # Ensure all child loggers use the same handler (no duplicate propagation)
    for name in logging.root.manager.loggerDict:  # type: ignore[attr-defined]
        if name.startswith("sogolog."):
            child = logging.getLogger(name)
            child.handlers.clear()
            child.propagate = False


# Auto-enable on import
enable_json_logging()
