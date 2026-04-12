from celery import shared_task

from apps.core import services


@shared_task(name="apps.core.tasks.check_overdue_invoices")
def check_overdue_invoices() -> dict[str, int]:
    """
    Run the Sprint 2 daily overdue invoice sweep.
    """
    return services.check_overdue_invoices()


@shared_task(name="apps.core.tasks.check_proposal_deadlines")
def check_proposal_deadlines() -> dict[str, int]:
    """
    Run the Sprint 2 daily proposal deadline reminder sweep.
    """
    return services.check_proposal_deadlines()
