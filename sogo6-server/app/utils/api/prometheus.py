"""
Prometheus metrics collection for the SOGo API server.

Exposes a ``/metrics`` endpoint (Prometheus scrape target) and provides
middleware that tracks request count, latency, and error rate per endpoint.
"""

from __future__ import annotations

from time import time
from typing import cast

from flask import Flask, Response, request, g

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    REGISTRY,
    CONTENT_TYPE_LATEST,
)

# ── Metrics ──────────────────────────────────────────────────────────────────

REQUEST_COUNT = Counter(
    "sogo_http_requests_total",
    "Total HTTP requests handled by the SOGo API server",
    ["method", "endpoint", "status"],
)

REQUEST_LATENCY = Histogram(
    "sogo_http_request_duration_seconds",
    "HTTP request latency in seconds (histogram)",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

ACTIVE_REQUESTS = Gauge(
    "sogo_http_requests_in_flight",
    "Number of HTTP requests currently being processed",
)

ERROR_COUNT = Counter(
    "sogo_http_errors_total",
    "Total HTTP errors (status >= 400) handled by the API server",
    ["method", "endpoint", "status"],
)

DB_QUERY_DURATION = Histogram(
    "sogo_db_query_duration_seconds",
    "Database query duration in seconds",
    ["operation"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
)

CACHE_OPERATION_DURATION = Histogram(
    "sogo_cache_operation_duration_seconds",
    "Cache (Redis) operation duration in seconds",
    ["operation"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
)


def init_prometheus(app: Flask) -> None:
    """Register before/after request hooks that collect Prometheus metrics."""

    @app.before_request
    def _before_request_metrics() -> None:
        g._prometheus_request_start = time()
        g._prometheus_endpoint = request.endpoint or "unknown"
        ACTIVE_REQUESTS.inc()

    @app.after_request
    def _after_request_metrics(response: Response) -> Response:
        method = request.method or "UNKNOWN"
        endpoint = cast(str, getattr(g, "_prometheus_endpoint", "unknown"))
        status = str(response.status_code)
        latency = time() - cast(float, getattr(g, "_prometheus_request_start", time()))

        REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status).inc()
        REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(latency)

        if response.status_code >= 400:
            ERROR_COUNT.labels(method=method, endpoint=endpoint, status=status).inc()

        ACTIVE_REQUESTS.dec()
        return response

    # Expose the /metrics endpoint directly on the Flask app (outside the
    # regular API blueprints) so it is available without any auth middleware.
    @app.route("/metrics")
    def metrics() -> Response:
        return Response(generate_latest(REGISTRY), mimetype=CONTENT_TYPE_LATEST)
