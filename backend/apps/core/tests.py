from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from django_celery_beat.models import PeriodicTask

from apps.accounts.factories import OrganisationFactory, UserFactory
from apps.clients.factories import ClientFactory
from apps.clients.models import Client
from apps.core import services, tasks
from apps.core.models import AuditLog, Notification
from apps.invoices.factories import InvoiceFactory, PaymentFactory
from apps.invoices.models import Invoice
from apps.projects.factories import ProjectFactory
from apps.projects.models import Project
from apps.proposals.factories import ProposalFactory
from apps.proposals.models import Proposal


@pytest.mark.django_db
def test_audit_log_is_created_when_audited_model_is_created(org):
    client = ClientFactory(organisation=org, name="Audit Client")

    audit_log = AuditLog.objects.filter(
        entity_type="Client",
        entity_id=client.id,
        action=AuditLog.Action.CREATED,
    ).latest("timestamp")

    assert audit_log.organisation == org
    assert audit_log.diff["name"]["after"] == "Audit Client"


@pytest.mark.django_db
def test_audit_log_records_status_changed_updates(org):
    project = ProjectFactory(organisation=org, status=Project.ProjectStatus.PLANNING)

    project.status = Project.ProjectStatus.ACTIVE
    project.save()

    audit_log = AuditLog.objects.filter(
        entity_type="Project",
        entity_id=project.id,
        action=AuditLog.Action.STATUS_CHANGED,
    ).latest("timestamp")

    assert audit_log.organisation == org
    assert audit_log.diff["status"] == {
        "before": Project.ProjectStatus.PLANNING,
        "after": Project.ProjectStatus.ACTIVE,
    }


@pytest.mark.django_db
def test_audit_log_records_deletes(org):
    client = ClientFactory(organisation=org, name="Deleted Client")
    client_id = client.id

    client.delete()

    audit_log = AuditLog.objects.filter(
        entity_type="Client",
        entity_id=client_id,
        action=AuditLog.Action.DELETED,
    ).latest("timestamp")

    assert audit_log.organisation == org
    assert audit_log.diff["name"]["before"] == "Deleted Client"
    assert audit_log.diff["name"]["after"] is None


@pytest.mark.django_db
def test_audit_log_records_authenticated_request_user(authenticated_client, user):
    response = authenticated_client.post(
        reverse("client-list"),
        {
            "type": Client.ClientType.SHS,
            "name": "Request Audit Client",
            "email": "request-audit@example.com",
            "contact_person": "Request User",
            "phone": "0240000000",
            "address": "Accra",
            "region": "Greater Accra",
            "notes": "Created through authenticated request.",
        },
        format="json",
    )

    assert response.status_code == 201
    audit_log = AuditLog.objects.filter(
        entity_type="Client",
        entity_id=response.json()["id"],
        action=AuditLog.Action.CREATED,
    ).latest("timestamp")
    assert audit_log.user == user


@pytest.mark.django_db
def test_dashboard_api_returns_sprint_2_summary_data(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    upcoming = ProposalFactory(
        organisation=org,
        client=client,
        status=Proposal.ProposalStatus.SENT,
        deadline=timezone.localdate() + timedelta(days=3),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.DRAFT,
        deadline=timezone.localdate() + timedelta(days=20),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.WON,
        deadline=timezone.localdate() + timedelta(days=2),
    )
    ProposalFactory(organisation=OrganisationFactory())
    active_project = ProjectFactory(
        organisation=org,
        client=client,
        status=Project.ProjectStatus.ACTIVE,
    )
    ProjectFactory(organisation=org, status=Project.ProjectStatus.PLANNING)
    ProjectFactory(
        organisation=OrganisationFactory(),
        status=Project.ProjectStatus.ACTIVE,
    )
    overdue_invoice = InvoiceFactory(
        organisation=org,
        client=client,
        status="sent",
        due_date=timezone.localdate() - timedelta(days=2),
        total="900.00",
        subtotal="900.00",
    )
    PaymentFactory(invoice=overdue_invoice, amount="200.00")
    InvoiceFactory(
        organisation=org,
        client=client,
        status="paid",
        due_date=timezone.localdate() - timedelta(days=4),
    )
    Notification.objects.create(
        user=org.users.first(),
        type=Notification.NotificationType.INVOICE_OVERDUE,
        message="Invoice overdue",
        is_read=False,
    )

    response = authenticated_client.get(reverse("dashboard"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["proposal_counts"][Proposal.ProposalStatus.SENT] == 1
    assert payload["proposal_counts"][Proposal.ProposalStatus.DRAFT] == 1
    assert payload["proposal_counts"][Proposal.ProposalStatus.WON] == 1
    assert payload["upcoming_proposal_deadlines"] == [
        {
            "id": str(upcoming.id),
            "title": upcoming.title,
            "client": str(client.id),
            "client_name": client.name,
            "status": Proposal.ProposalStatus.SENT,
            "deadline": upcoming.deadline.isoformat(),
            "amount": "1000.00",
        }
    ]
    assert payload["active_projects"] == [
        {
            "id": str(active_project.id),
            "title": active_project.title,
            "client": str(client.id),
            "client_name": client.name,
            "status": Project.ProjectStatus.ACTIVE,
            "due_date": active_project.due_date.isoformat(),
            "budget": "1000.00",
        }
    ]
    assert payload["total_outstanding"] == "700.00"
    assert payload["overdue_invoices"] == [
        {
            "id": str(overdue_invoice.id),
            "invoice_number": None,
            "client": str(client.id),
            "client_name": client.name,
            "status": "sent",
            "due_date": overdue_invoice.due_date.isoformat(),
            "total": "900.00",
            "amount_paid": "200.00",
            "amount_remaining": "700.00",
        }
    ]
    assert payload["unread_notifications_count"] == 1


@pytest.mark.django_db
def test_notification_model_defaults_to_unread_and_orders_newest_first(user):
    older = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        message="Older reminder",
    )
    newer = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.INVOICE_OVERDUE,
        message="Newer reminder",
    )

    notifications = list(Notification.objects.all())

    assert older.is_read is False
    assert notifications == [newer, older]


@pytest.mark.django_db
def test_list_notifications_service_filters_and_returns_unread_count(user):
    unread = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        message="Unread reminder",
        is_read=False,
    )
    Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROJECT_DUE,
        message="Read reminder",
        is_read=True,
    )

    payload = services.list_notifications(
        user=user,
        filters={"read": "false"},
    )

    assert list(payload["queryset"]) == [unread]
    assert payload["unread_count"] == 1


@pytest.mark.django_db
def test_mark_all_notifications_read_service_updates_rows_and_writes_audit(user, org):
    first = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        message="First unread",
    )
    second = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.INVOICE_OVERDUE,
        message="Second unread",
    )

    updated = services.mark_all_notifications_read(user=user)

    first.refresh_from_db()
    second.refresh_from_db()
    assert updated == 2
    assert first.is_read is True
    assert second.is_read is True
    assert AuditLog.objects.filter(
        organisation=org,
        entity_type="Notification",
        action=AuditLog.Action.UPDATED,
    ).count() == 2


@pytest.mark.django_db
def test_notification_list_endpoint_returns_unread_count_and_user_rows(
    authenticated_client,
    user,
):
    unread = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        message="Own unread",
    )
    Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROJECT_DUE,
        message="Own read",
        is_read=True,
    )
    other_user = UserFactory(organisation=OrganisationFactory())
    Notification.objects.create(
        user=other_user,
        type=Notification.NotificationType.INVOICE_OVERDUE,
        message="Other unread",
    )

    response = authenticated_client.get(
        reverse("notification-list"),
        {"read": "false"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["unread_count"] == 1
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(unread.id)


@pytest.mark.django_db
def test_notification_read_endpoint_marks_read_and_records_actor(
    authenticated_client,
    user,
):
    notification = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        message="Review proposal deadline",
    )

    response = authenticated_client.post(
        reverse("notification-read", kwargs={"pk": notification.id}),
        {},
        format="json",
    )

    notification.refresh_from_db()
    assert response.status_code == 200
    assert notification.is_read is True

    audit_log = AuditLog.objects.filter(
        entity_type="Notification",
        entity_id=notification.id,
        action=AuditLog.Action.UPDATED,
    ).latest("timestamp")
    assert audit_log.user == user
    assert audit_log.diff["is_read"] == {"before": False, "after": True}


@pytest.mark.django_db
def test_notification_read_all_endpoint_marks_all_read(authenticated_client, user):
    first = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        message="First unread",
    )
    second = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROJECT_DUE,
        message="Second unread",
    )

    response = authenticated_client.post(
        reverse("notification-read-all"),
        {},
        format="json",
    )

    first.refresh_from_db()
    second.refresh_from_db()
    assert response.status_code == 204
    assert first.is_read is True
    assert second.is_read is True
    assert AuditLog.objects.filter(
        entity_type="Notification",
        action=AuditLog.Action.UPDATED,
        user=user,
    ).count() >= 2


@pytest.mark.django_db
def test_notification_detail_is_user_scoped(authenticated_client, user):
    own = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        message="Own detail",
    )
    other = Notification.objects.create(
        user=UserFactory(organisation=OrganisationFactory()),
        type=Notification.NotificationType.INVOICE_OVERDUE,
        message="Other detail",
    )

    response = authenticated_client.get(
        reverse("notification-detail", kwargs={"pk": own.id}),
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(own.id)

    response = authenticated_client.get(
        reverse("notification-detail", kwargs={"pk": other.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_notification_read_endpoint_is_idempotent_for_already_read_notification(
    authenticated_client,
    user,
):
    notification = Notification.objects.create(
        user=user,
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        message="Already read",
        is_read=True,
    )
    before_count = AuditLog.objects.filter(
        entity_type="Notification",
        entity_id=notification.id,
        action=AuditLog.Action.UPDATED,
    ).count()

    response = authenticated_client.post(
        reverse("notification-read", kwargs={"pk": notification.id}),
        {},
        format="json",
    )

    notification.refresh_from_db()
    after_count = AuditLog.objects.filter(
        entity_type="Notification",
        entity_id=notification.id,
        action=AuditLog.Action.UPDATED,
    ).count()

    assert response.status_code == 200
    assert notification.is_read is True
    assert after_count == before_count


@pytest.mark.django_db
def test_mark_all_notifications_read_service_returns_zero_when_nothing_to_update(user):
    updated = services.mark_all_notifications_read(user=user)

    assert updated == 0


@pytest.mark.django_db
def test_check_overdue_invoices_marks_status_and_notifies_active_org_users(
    org,
    user,
):
    second_user = UserFactory(organisation=org)
    UserFactory(organisation=org, is_active=False)
    invoice = InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.SENT,
        due_date=timezone.localdate() - timedelta(days=1),
        invoice_number="STERO-2026-0001",
    )
    InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.PAID,
        due_date=timezone.localdate() - timedelta(days=2),
    )

    result = services.check_overdue_invoices()

    invoice.refresh_from_db()
    assert result == {
        "invoices_checked": 1,
        "invoices_marked_overdue": 1,
        "notifications_created": 2,
    }
    assert invoice.status == Invoice.InvoiceStatus.OVERDUE
    notifications = Notification.objects.filter(
        type=Notification.NotificationType.INVOICE_OVERDUE,
        entity_type="Invoice",
        entity_id=invoice.id,
    ).order_by("user__email")
    assert set(notifications.values_list("user", flat=True)) == {
        user.id,
        second_user.id,
    }

    duplicate_result = services.check_overdue_invoices()

    assert duplicate_result == {
        "invoices_checked": 1,
        "invoices_marked_overdue": 0,
        "notifications_created": 0,
    }


@pytest.mark.django_db
def test_check_proposal_deadlines_notifies_active_org_users_once_per_day(org, user):
    second_user = UserFactory(organisation=org)
    UserFactory(organisation=org, is_active=False)
    due_soon = ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.SENT,
        deadline=timezone.localdate() + timedelta(days=3),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.WON,
        deadline=timezone.localdate() + timedelta(days=1),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.SENT,
        deadline=timezone.localdate() + timedelta(days=10),
    )

    result = services.check_proposal_deadlines()

    assert result == {
        "proposals_checked": 1,
        "notifications_created": 2,
    }
    notifications = Notification.objects.filter(
        type=Notification.NotificationType.PROPOSAL_DEADLINE,
        entity_type="Proposal",
        entity_id=due_soon.id,
    ).order_by("user__email")
    assert set(notifications.values_list("user", flat=True)) == {
        user.id,
        second_user.id,
    }

    duplicate_result = services.check_proposal_deadlines()

    assert duplicate_result == {
        "proposals_checked": 1,
        "notifications_created": 0,
    }


@pytest.mark.django_db
def test_celery_task_wrappers_return_service_payloads(org):
    InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.PARTIAL,
        due_date=timezone.localdate() - timedelta(days=1),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.SENT,
        deadline=timezone.localdate() + timedelta(days=1),
    )

    overdue_result = tasks.check_overdue_invoices()
    deadline_result = tasks.check_proposal_deadlines()

    assert overdue_result["invoices_checked"] == 1
    assert overdue_result["invoices_marked_overdue"] == 1
    assert deadline_result["proposals_checked"] == 1


@pytest.mark.django_db
def test_celery_beat_periodic_tasks_are_seeded():
    overdue_task = PeriodicTask.objects.get(name="Check overdue invoices daily")
    deadline_task = PeriodicTask.objects.get(name="Check proposal deadlines daily")

    assert overdue_task.task == "apps.core.tasks.check_overdue_invoices"
    assert deadline_task.task == "apps.core.tasks.check_proposal_deadlines"
    assert overdue_task.crontab.minute == "0"
    assert overdue_task.crontab.hour == "7"
    assert str(overdue_task.crontab.timezone) == "Africa/Accra"
    assert deadline_task.crontab == overdue_task.crontab


@pytest.mark.django_db
def test_invoice_model_create_writes_audit_log(org):
    invoice = InvoiceFactory(organisation=org)

    audit_log = AuditLog.objects.filter(
        entity_type="Invoice",
        entity_id=invoice.id,
        action=AuditLog.Action.CREATED,
    ).latest("timestamp")

    assert audit_log.organisation == org
    assert audit_log.diff["total"]["after"] == "1000.00"
