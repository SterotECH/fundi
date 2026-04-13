from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Organisation, User
from apps.clients.models import Client
from apps.invoices.models import Invoice, Payment
from apps.projects.models import Project, TimeLog
from apps.proposals.models import Proposal


def _first_day_of_month(value: date) -> date:
    return value.replace(day=1)


def _shift_months(value: date, months_back: int) -> date:
    year = value.year
    month = value.month - months_back
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


@dataclass(frozen=True)
class DemoClientSeed:
    name: str
    email: str
    contact_person: str
    phone: str
    address: str
    region: str
    type: str


DEMO_CLIENTS: list[DemoClientSeed] = [
    DemoClientSeed(
        name="Accra Academy",
        email="admin@accraacademy.edu.gh",
        contact_person="Ama Osei",
        phone="+233540001001",
        address="East Legon, Accra",
        region="Greater Accra",
        type=Client.ClientType.SHS,
    ),
    DemoClientSeed(
        name="Tema Technical Institute",
        email="it@tematech.edu.gh",
        contact_person="Kwesi Boateng",
        phone="+233540001002",
        address="Community 8, Tema",
        region="Greater Accra",
        type=Client.ClientType.INTL,
    ),
    DemoClientSeed(
        name="Cape Coast Preparatory",
        email="ops@capecoastprep.edu.gh",
        contact_person="Efua Mensah",
        phone="+233540001003",
        address="Abura, Cape Coast",
        region="Central",
        type=Client.ClientType.JHS,
    ),
    DemoClientSeed(
        name="Kumasi STEM College",
        email="director@kumasistem.edu.gh",
        contact_person="Yaw Asante",
        phone="+233540001004",
        address="Ahodwo, Kumasi",
        region="Ashanti",
        type=Client.ClientType.UNI,
    ),
]


class Command(BaseCommand):
    help = (
        "Seed realistic 6-month CRM demo data for Sprint 3 analytics: "
        "clients, proposals, projects, invoices, payments, and timelogs."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--organisation-slug",
            type=str,
            default="",
            help="Only seed one organisation by slug. Default: all organisations.",
        )
        parser.add_argument(
            "--months",
            type=int,
            default=6,
            help="How many past months to seed. Default: 6.",
        )
        parser.add_argument(
            "--skip-if-present",
            action="store_true",
            help="Skip organisation if it already has invoices, proposals, and timelogs.",
        )

    def handle(self, *args, **options) -> None:
        months = int(options["months"])
        if months < 1:
            raise CommandError("--months must be >= 1.")

        organisation_slug = (options["organisation_slug"] or "").strip()
        skip_if_present = bool(options["skip_if_present"])

        organisations = Organisation.objects.all()
        if organisation_slug:
            organisations = organisations.filter(slug=organisation_slug)

        if not organisations.exists():
            raise CommandError("No organisation found for the given filter.")

        seeded_count = 0
        skipped_count = 0
        for organisation in organisations:
            if skip_if_present and self._has_existing_data(organisation):
                skipped_count += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped {organisation.slug}: data already present."
                    )
                )
                continue

            with transaction.atomic():
                self._seed_organisation(organisation=organisation, months=months)
            seeded_count += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"Seeded {organisation.slug} with {months} month(s) of demo analytics data."
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Seeded {seeded_count} organisation(s), skipped {skipped_count}."
            )
        )

    def _has_existing_data(self, organisation: Organisation) -> bool:
        return (
            organisation.invoices.exists()
            and organisation.proposals.exists()
            and TimeLog.objects.filter(project__organisation=organisation).exists()
        )

    def _seed_organisation(self, *, organisation: Organisation, months: int) -> None:
        owner = (
            User.objects.filter(organisation=organisation, is_active=True)
            .order_by("created_at")
            .first()
        )
        if owner is None:
            raise CommandError(
                f"Organisation {organisation.slug} has no active user to own time logs."
            )

        clients: list[Client] = []
        for index, seed in enumerate(DEMO_CLIENTS, start=1):
            client, _ = Client.objects.get_or_create(
                organisation=organisation,
                name=seed.name,
                defaults={
                    "email": seed.email,
                    "contact_person": seed.contact_person,
                    "phone": seed.phone,
                    "address": seed.address,
                    "region": seed.region,
                    "type": seed.type,
                    "notes": "Seeded for Sprint 3 analytics validation.",
                },
            )
            clients.append(client)

            # Keep contact data fresh if the record pre-exists from earlier runs.
            client.email = client.email or seed.email
            client.contact_person = client.contact_person or seed.contact_person
            client.phone = client.phone or seed.phone
            client.address = client.address or seed.address
            client.region = client.region or seed.region
            if not client.type:
                client.type = seed.type
            client.save(
                update_fields=[
                    "email",
                    "contact_person",
                    "phone",
                    "address",
                    "region",
                    "type",
                    "updated_at",
                ]
            )

        today = timezone.localdate()
        anchor = _first_day_of_month(today)
        invoice_status_cycle = [
            Invoice.InvoiceStatus.DRAFT,
            Invoice.InvoiceStatus.SENT,
            Invoice.InvoiceStatus.PARTIAL,
            Invoice.InvoiceStatus.PAID,
            Invoice.InvoiceStatus.OVERDUE,
            Invoice.InvoiceStatus.SENT,
        ]
        proposal_status_cycle = [
            Proposal.ProposalStatus.WON,
            Proposal.ProposalStatus.LOST,
            Proposal.ProposalStatus.SENT,
            Proposal.ProposalStatus.NEGOTIATING,
            Proposal.ProposalStatus.DRAFT,
            Proposal.ProposalStatus.SENT,
        ]

        for month_index in range(months):
            month_start = _shift_months(anchor, month_index)
            due_date = month_start + timedelta(days=24)
            issue_date = month_start + timedelta(days=3)
            sent_date = month_start + timedelta(days=7)
            decision_date = month_start + timedelta(days=18)
            log_date = month_start + timedelta(days=10)
            status = invoice_status_cycle[month_index % len(invoice_status_cycle)]
            proposal_status = proposal_status_cycle[
                month_index % len(proposal_status_cycle)
            ]

            for client_index, client in enumerate(clients):
                amount = Decimal("1200.00") + Decimal(str((month_index * 145) + (client_index * 80)))
                tax = (amount * Decimal("0.05")).quantize(Decimal("0.01"))
                total = amount + tax

                project_status = (
                    Project.ProjectStatus.DONE
                    if month_index >= max(months - 2, 1)
                    else Project.ProjectStatus.ACTIVE
                )
                project, _ = Project.objects.get_or_create(
                    organisation=organisation,
                    client=client,
                    title=f"{client.name} Platform Rollout {month_start:%b %Y}",
                    defaults={
                        "description": "Seeded implementation stream for analytics validation.",
                        "status": project_status,
                        "start_date": month_start + timedelta(days=1),
                        "due_date": due_date + timedelta(days=20),
                        "budget": (total * Decimal("2.8")).quantize(Decimal("0.01")),
                    },
                )

                proposal = Proposal.objects.create(
                    organisation=organisation,
                    client=client,
                    title=f"{client.name} Upgrade Proposal {month_start:%b %Y}",
                    description=(
                        "Delivery proposal seeded for Sprint 3 analytics and pipeline metrics."
                    ),
                    amount=total,
                    status=proposal_status,
                    sent_date=(
                        sent_date
                        if proposal_status
                        in {
                            Proposal.ProposalStatus.SENT,
                            Proposal.ProposalStatus.NEGOTIATING,
                            Proposal.ProposalStatus.WON,
                            Proposal.ProposalStatus.LOST,
                        }
                        else None
                    ),
                    decision_date=(
                        decision_date
                        if proposal_status
                        in {
                            Proposal.ProposalStatus.WON,
                            Proposal.ProposalStatus.LOST,
                        }
                        else None
                    ),
                    deadline=due_date,
                    notes="Seeded record for deterministic analytics.",
                )

                if proposal_status == Proposal.ProposalStatus.WON and project.proposal_id is None:
                    project.proposal = proposal
                    project.save(update_fields=["proposal", "updated_at"])

                invoice = Invoice.objects.create(
                    organisation=organisation,
                    client=client,
                    project=project,
                    subtotal=amount,
                    tax=tax,
                    total=total,
                    status=status,
                    issue_date=issue_date,
                    due_date=due_date,
                    notes=f"{client.name} billing cycle {month_start:%b %Y}",
                )

                if status in {Invoice.InvoiceStatus.PARTIAL, Invoice.InvoiceStatus.PAID}:
                    paid_ratio = Decimal("1.00") if status == Invoice.InvoiceStatus.PAID else Decimal("0.55")
                    Payment.objects.create(
                        invoice=invoice,
                        amount=(total * paid_ratio).quantize(Decimal("0.01")),
                        provider_reference=f"SEED-{month_start:%Y%m}-{client_index + 1}",
                        payment_date=month_start + timedelta(days=16),
                        method=Payment.PaymentMethod.MTN_MOMO,
                        notes="Seeded payment for analytics.",
                    )

                TimeLog.objects.create(
                    project=project,
                    user=owner,
                    log_date=log_date,
                    hours=Decimal("4.50") + Decimal(str((client_index % 3) * 1.25)),
                    description=f"{client.name} implementation work",
                    is_billable=True,
                )
                TimeLog.objects.create(
                    project=project,
                    user=owner,
                    log_date=log_date + timedelta(days=2),
                    hours=Decimal("1.75"),
                    description=f"{client.name} internal sync",
                    is_billable=False,
                )
