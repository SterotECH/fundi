from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from apps.accounts.models import Organisation
from apps.projects.models import Project
from apps.proposals.models import Proposal


def get_dashboard_summary(*, organisation: Organisation) -> dict:
    """
    Return the Sprint 1 dashboard payload for one organisation.

    Sprint 1 deliberately excludes invoices, payments, time logs, charts, and
    analytics. Those belong to later sprints.
    """
    today = timezone.localdate()
    deadline_limit = today + timedelta(days=14)

    proposal_counts = {status: 0 for status, _label in Proposal.ProposalStatus.choices}
    counts = (
        Proposal.objects.filter(organisation=organisation)
        .values("status")
        .annotate(total=Count("id"))
    )
    for row in counts:
        proposal_counts[row["status"]] = row["total"]

    upcoming_deadlines = (
        Proposal.objects.select_related("client")
        .filter(
            organisation=organisation,
            deadline__gte=today,
            deadline__lte=deadline_limit,
        )
        .exclude(
            status__in=[
                Proposal.ProposalStatus.WON,
                Proposal.ProposalStatus.LOST,
            ]
        )
        .order_by("deadline", "-created_at")[:10]
    )

    active_projects = (
        Project.objects.select_related("client")
        .filter(
            organisation=organisation,
            status=Project.ProjectStatus.ACTIVE,
        )
        .order_by("due_date", "-created_at")[:10]
    )

    return {
        "proposal_counts": proposal_counts,
        "upcoming_proposal_deadlines": [
            {
                "id": str(proposal.id),
                "title": proposal.title,
                "client": str(proposal.client_id),
                "client_name": proposal.client.name,
                "status": proposal.status,
                "deadline": proposal.deadline.isoformat(),
                "amount": str(proposal.amount),
            }
            for proposal in upcoming_deadlines
        ],
        "active_projects": [
            {
                "id": str(project.id),
                "title": project.title,
                "client": str(project.client_id),
                "client_name": project.client.name,
                "status": project.status,
                "due_date": project.due_date.isoformat(),
                "budget": str(project.budget),
            }
            for project in active_projects
        ],
    }
