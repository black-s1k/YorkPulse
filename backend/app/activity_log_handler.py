"""AWS Lambda entry point for the activity-log processor (CloudWatch Logs
subscription-filter trigger — see multicloud/infra/aws/analytics-lambda.tf).

Mirrors cleanup_handler.py's pattern: same container image as the main
backend Lambda, a distinct entrypoint set via Terraform's
image_config.command, a synchronous asyncio.run() wrapper since Lambda
doesn't support background async work after the handler returns.
"""

import asyncio
import logging

from app.services.activity_log_processor import process_cloudwatch_logs_event

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def handler(event, context):
    return asyncio.run(process_cloudwatch_logs_event(event))
