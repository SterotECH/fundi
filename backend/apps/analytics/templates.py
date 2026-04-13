"""
Deterministic text templates for the Sprint 3 business assistant.

Variation is handled by template families instead of a language model:
- each family has multiple variants
- selection is deterministic from a stable seed
- the same record gets consistent wording across requests
"""

from __future__ import annotations

import hashlib


def _stable_index(*, seed: str, size: int) -> int:
    """
    Return a deterministic variant index for a stable seed.
    """

    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % size


def get_template_catalog() -> dict[str, list[dict[str, str]]]:
    """
    Return the template catalog keyed by family name.

    Each family contains one or more variants with named placeholders so the
    drafting services can fill CRM data deterministically.
    """

    return {
        "proposal_follow_up_general": [
            {
                "subject": "Following up on {proposal_title}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "I wanted to follow up on the {proposal_title} proposal we shared with {client_name}. "
                    "The proposed investment is GHS {proposal_amount}.\n\n"
                    "If it helps, I can walk through any questions or next steps and help you move things forward.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
            {
                "subject": "Checking in on {proposal_title}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "Just checking in on the {proposal_title} proposal for {client_name}. "
                    "We currently have it scoped at GHS {proposal_amount}.\n\n"
                    "If there is anything you would like clarified before the next step, I can send that over promptly.\n\n"
                    "Best regards,\n"
                    "Stero"
                ),
            },
        ],
        "proposal_follow_up_deadline_near": [
            {
                "subject": "Quick follow-up before the {proposal_title} deadline",
                "body": (
                    "Hi {contact_name},\n\n"
                    "Just checking in on the {proposal_title} proposal for {client_name}. "
                    "The current deadline is {deadline}, which is in {days_to_deadline} day(s).\n\n"
                    "If you need any clarification before deciding, I’m happy to respond quickly.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
            {
                "subject": "Reminder: {proposal_title} decision timeline",
                "body": (
                    "Hi {contact_name},\n\n"
                    "A quick reminder on the {proposal_title} proposal for {client_name}. "
                    "The deadline is {deadline}, so there are {days_to_deadline} day(s) left on the current timeline.\n\n"
                    "If it would help, I can answer questions or help close the final decision points.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
            {
                "subject": "Before the deadline on {proposal_title}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "I’m following up before the {proposal_title} deadline for {client_name}. "
                    "The proposal remains at GHS {proposal_amount}, with the current deadline set for {deadline}.\n\n"
                    "Let me know if there is anything you want me to clarify before then.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
        ],
        "proposal_follow_up_negotiating": [
            {
                "subject": "Next steps on {proposal_title}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "I’m following up on the ongoing discussion around {proposal_title} for {client_name}. "
                    "We currently have the proposal at GHS {proposal_amount}, and I’d be glad to help close any open questions.\n\n"
                    "If useful, I can send a clarified scope or a revised next-step outline.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
            {
                "subject": "Following up on our discussion about {proposal_title}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "I wanted to continue the conversation around {proposal_title} for {client_name}. "
                    "The current proposal amount is GHS {proposal_amount}.\n\n"
                    "If there are still open questions on scope, timing, or next steps, I'm happy to address them directly.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
        ],
        "invoice_overdue_gentle": [
            {
                "subject": "Friendly reminder: {invoice_label} is overdue",
                "body": (
                    "Hi {contact_name},\n\n"
                    "This is a friendly reminder that {invoice_label} for {client_name} was due on {due_date}. "
                    "The current outstanding balance is GHS {outstanding_amount}.\n\n"
                    "Please let me know if payment is already in progress or if you need anything from me to close it.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
            {
                "subject": "Quick payment reminder for {invoice_label}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "Just a quick reminder that {invoice_label} for {client_name} is now overdue. "
                    "The outstanding amount is GHS {outstanding_amount}, and the due date was {due_date}.\n\n"
                    "If payment is already being processed, feel free to ignore this note and let me know.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
        ],
        "invoice_overdue_firm": [
            {
                "subject": "Follow-up required: {invoice_label} remains unpaid",
                "body": (
                    "Hi {contact_name},\n\n"
                    "{invoice_label} for {client_name} is now {overdue_days} day(s) overdue, "
                    "with GHS {outstanding_amount} still outstanding.\n\n"
                    "Please confirm the payment timeline or let me know immediately if there is an issue blocking settlement.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
            {
                "subject": "Outstanding payment on {invoice_label}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "I’m following up again on {invoice_label} for {client_name}. "
                    "It is now {overdue_days} day(s) overdue, with GHS {outstanding_amount} still pending.\n\n"
                    "Please share the expected payment date or flag any issue that needs to be resolved on my side.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
        ],
        "project_stale_follow_up": [
            {
                "subject": "Checking in on {project_title}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "I wanted to check in on {project_title} for {client_name}. "
                    "The project has not had logged activity for {inactive_days} day(s), and the current due date is {due_date}.\n\n"
                    "Could you confirm whether anything is blocking the next step, or whether we should adjust the delivery plan?\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
            {
                "subject": "Next steps for {project_title}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "I’m following up on {project_title} for {client_name}. "
                    "It looks like the project has been quiet for {inactive_days} day(s), with the current status set to {status}.\n\n"
                    "Please let me know the best next step so we can keep delivery moving cleanly.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
            {
                "subject": "Project follow-up: {project_title}",
                "body": (
                    "Hi {contact_name},\n\n"
                    "A quick follow-up on {project_title}. "
                    "The current project budget is GHS {budget}, the due date is {due_date}, and there has been no recent logged activity for {inactive_days} day(s).\n\n"
                    "If priorities have shifted, I can help reset the plan and confirm the next milestone.\n\n"
                    "Best,\n"
                    "Stero"
                ),
            },
        ],
    }


def get_assistant_reply_catalog() -> dict[str, list[str]]:
    """
    Return deterministic assistant reply families.

    These are short natural-language shells used around structured metrics and
    summaries so the assistant does not sound identical on every request.
    """

    return {
        "revenue_summary": [
            (
                "This month you collected GHS {this_month_collected}. "
                "Outstanding invoices total GHS {total_outstanding}, with {overdue_count} overdue invoice(s) worth GHS {overdue_total}."
            ),
            (
                "You have collected GHS {this_month_collected} so far this month. "
                "Current receivables stand at GHS {total_outstanding}, including {overdue_count} overdue invoice(s) worth GHS {overdue_total}."
            ),
            (
                "Revenue collected this month is GHS {this_month_collected}. "
                "There is GHS {total_outstanding} still outstanding, and GHS {overdue_total} of that is already overdue across {overdue_count} invoice(s)."
            ),
        ],
        "overdue_balance": [
            (
                "{client_name} still owes GHS {outstanding_amount} on {invoice_label}. "
                "GHS {paid_amount} has been paid against a total of GHS {invoice_total}. "
                "The invoice is {overdue_days} day(s) overdue."
            ),
            (
                "For {client_name}, {invoice_label} has GHS {outstanding_amount} remaining. "
                "Total invoice value is GHS {invoice_total}, with GHS {paid_amount} already paid. "
                "It is now {overdue_days} day(s) overdue."
            ),
        ],
        "proposal_summary": [
            (
                "{proposal_title} for {client_name} is currently {status} at GHS {proposal_amount}. "
                "{age_fragment}{deadline_fragment}"
            ),
            (
                "The proposal {proposal_title} for {client_name} is in {status} status at GHS {proposal_amount}. "
                "{age_fragment}{deadline_fragment}"
            ),
        ],
        "client_health": [
            (
                "{client_name} has GHS {invoiced_ghs} invoiced, GHS {collected_ghs} collected, and GHS {outstanding_ghs} outstanding. "
                "There are {open_proposals} open proposal(s), {active_projects} active project(s), and {billable_hours} billable hour(s) logged."
            ),
            (
                "For {client_name}, total invoiced value is GHS {invoiced_ghs}, collections are GHS {collected_ghs}, and outstanding value is GHS {outstanding_ghs}. "
                "The account also has {open_proposals} open proposal(s), {active_projects} active project(s), and {billable_hours} billable hour(s)."
            ),
        ],
        "project_risk": [
            (
                "{title} for {client_name} is currently {risk_label}. "
                "Budget is GHS {budget_ghs}, invoiced value is GHS {invoiced_ghs}, and burn is {burn_pct}% across {billable_hours} billable hour(s)."
            ),
            (
                "{title} is in a {risk_label} state for {client_name}. "
                "The budget is GHS {budget_ghs}, invoiced value is GHS {invoiced_ghs}, and current burn is {burn_pct}% with {billable_hours} billable hour(s) logged."
            ),
        ],
    }


def select_template_variant(*, family: str, seed: str) -> tuple[str, dict[str, str]]:
    """
    Select one deterministic template variant from a family.

    The returned key stays at the family level so API consumers can reason about
    a stable template identity even when the actual wording varies underneath.
    """

    catalog = get_template_catalog()
    variants = catalog[family]
    index = _stable_index(seed=seed, size=len(variants))
    return family, variants[index]


def select_assistant_reply(
    *, family: str, seed: str, context: dict[str, object]
) -> str:
    """
    Select and format one deterministic assistant reply variant.
    """

    catalog = get_assistant_reply_catalog()
    variants = catalog[family]
    index = _stable_index(seed=seed, size=len(variants))
    return variants[index].format(**context)
