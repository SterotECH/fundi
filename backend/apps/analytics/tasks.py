from celery import shared_task

from apps.accounts.models import Organisation
from apps.analytics import services


@shared_task(name="apps.analytics.tasks.build_daily_briefings")
def build_daily_briefings() -> dict[str, int]:
    """
    Build the deterministic daily briefing for every organisation.

    Sprint 3 does not persist these briefings yet. The task exists so the rule
    engine can be scheduled and promoted into notification delivery later.
    """

    organisations = Organisation.objects.order_by("name")
    processed = 0
    for organisation in organisations:
        services.build_daily_briefing(organisation=organisation)
        processed += 1

    return {"organisations_processed": processed}
