"""AWS Lambda entry point for the periodic activity-profile refresh job
(EventBridge Scheduler trigger, every 30 min — see
multicloud/infra/aws/analytics-lambda.tf).

Mirrors cleanup_handler.py's pattern exactly: same container image as the
main backend Lambda, a distinct entrypoint set via Terraform's
image_config.command, a synchronous asyncio.run() wrapper.
"""

import asyncio
import logging

from app.core.database import async_session_maker
from app.services.activity_profile_refresh import refresh_all_profiles

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def handler(event, context):
    return asyncio.run(_run())


async def _run() -> dict:
    async with async_session_maker() as db:
        result = await refresh_all_profiles(db)
        logger.info("Activity profile refresh completed: %s", result)
        return result
