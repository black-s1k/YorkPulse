"""AWS Lambda entry point for the FastAPI app (API Gateway HTTP API, payload v2.0).

Fronted by an API Gateway HTTP API rather than a Lambda Function URL: this AWS
account rejects public/unauthenticated Function URL invocations outright, and
CloudFront's OAC (SigV4 signing) alternative doesn't support POST/PUT/PATCH
bodies without the client pre-computing a payload hash — impractical for a
browser frontend. API Gateway invokes Lambda via a normal authenticated
service-principal resource policy, sidestepping both issues, with no code
changes needed (same v2.0 proxy payload shape as a Function URL).
"""

import os

from mangum import Mangum

from app.main import app

_asgi_handler = Mangum(app, lifespan="auto")

# Defense in depth: CloudFront attaches this secret as a custom origin header on
# every request it forwards to API Gateway. Any request missing/mismatching it
# did not come through CloudFront and is rejected before reaching the ASGI app.
_ORIGIN_VERIFY_SECRET = os.environ.get("ORIGIN_VERIFY_SECRET", "")


def handler(event, context):
    # EventBridge warm-up ping (see infra: 5-minute keep-warm rule) — short-circuit
    # before Mangum, which expects an API Gateway / Function URL shaped event.
    if event.get("warmup"):
        return {"statusCode": 200, "body": "warm"}

    headers = event.get("headers") or {}
    if _ORIGIN_VERIFY_SECRET and headers.get("x-origin-verify") != _ORIGIN_VERIFY_SECRET:
        return {"statusCode": 403, "body": '{"detail":"Forbidden"}', "headers": {"content-type": "application/json"}}

    return _asgi_handler(event, context)
