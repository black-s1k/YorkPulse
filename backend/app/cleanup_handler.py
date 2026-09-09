"""AWS Lambda entry point for the hourly quest-cleanup job (EventBridge Scheduler trigger).

Replaces the old in-process `while True: sleep(3600)` loop that used to run inside
the API's lifespan — that pattern cannot survive Lambda freezing the execution
environment between invocations, so it now runs as its own scheduled invocation.
"""

import asyncio
import logging

from app.core.database import async_session_maker
from app.services.activity import purge_old_activity_data
from app.services.quest_cleanup import cleanup_quests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def handler(event, context):
    return asyncio.run(_run())


async def _run() -> dict:
    async with async_session_maker() as db:
        quest_result = await cleanup_quests(db)
        logger.info("Quest cleanup completed: %s", quest_result)

        # Activity-tracking retention enforcement rides this same existing
        # scheduled job rather than needing its own — see
        # activity.py's purge_old_activity_data docstring.
        activity_result = await purge_old_activity_data(db)
        logger.info("Activity retention cleanup completed: %s", activity_result)

        return {**quest_result, "activity": activity_result}
