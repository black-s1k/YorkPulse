"""AWS Lambda entry point for the hourly quest-cleanup job (EventBridge Scheduler trigger).

Replaces the old in-process `while True: sleep(3600)` loop that used to run inside
the API's lifespan — that pattern cannot survive Lambda freezing the execution
environment between invocations, so it now runs as its own scheduled invocation.
"""

import asyncio
import logging

from app.core.database import async_session_maker
from app.services.quest_cleanup import cleanup_quests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def handler(event, context):
    return asyncio.run(_run())


async def _run() -> dict:
    async with async_session_maker() as db:
        result = await cleanup_quests(db)
        logger.info("Quest cleanup completed: %s", result)
        return result
