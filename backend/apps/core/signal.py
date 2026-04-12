from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.core.middleware import get_current_user
from apps.core.models import AuditLog

AUDITED_APP_LABELS = {
    "accounts",
    "clients",
    "proposals",
    "projects",
}


def _serialize_value(value):
    if isinstance(value, (UUID, Decimal)):
        return str(value)

    if isinstance(value, (date, datetime)):
        return value.isoformat()

    return value


def _snapshot(instance):
    data = {}
    for field in instance._meta.concrete_fields:
        data[field.attname] = _serialize_value(getattr(instance, field.attname))
    return data


def get_model_diff(before, after):
    changes = {}
    all_keys = set(before.keys()) | set(after.keys())
    for key in all_keys:
        b = before.get(key)
        a = after.get(key)
        if b != a:
            changes[key] = {"before": b, "after": a}
    return changes


def _is_audited_model(sender):
    return (
        sender is not AuditLog
        and sender._meta.app_label in AUDITED_APP_LABELS
        and not sender._meta.abstract
    )


def _get_organisation(instance):
    organisation = getattr(instance, "organisation", None)
    if organisation is not None:
        return organisation

    if instance._meta.label == "accounts.Organisation":
        return instance

    return None


def audit(sender, instance, action, user=None, diff=None, **kwargs):
    actor = user or get_current_user()
    AuditLog.objects.create(
        user=actor,
        organisation=_get_organisation(instance),
        action=action,
        entity_type=sender.__name__,
        entity_id=instance.pk,
        diff=diff or {},
    )


@receiver(pre_save, dispatch_uid="core_capture_audit_before_save")
def capture_before_save(sender, instance, **kwargs):
    if not _is_audited_model(sender) or instance.pk is None:
        return

    before = sender.objects.filter(pk=instance.pk).first()
    instance._audit_before = _snapshot(before) if before else {}


@receiver(post_save, dispatch_uid="core_write_audit_after_save")
def write_after_save(sender, instance, created, **kwargs):
    if not _is_audited_model(sender):
        return

    before = {} if created else getattr(instance, "_audit_before", {})
    after = _snapshot(instance)
    diff = get_model_diff(before, after)

    if created:
        action = AuditLog.Action.CREATED
    elif "status" in diff:
        action = AuditLog.Action.STATUS_CHANGED
    else:
        action = AuditLog.Action.UPDATED

    audit(sender=sender, instance=instance, action=action, diff=diff)


@receiver(post_delete, dispatch_uid="core_write_audit_after_delete")
def write_after_delete(sender, instance, **kwargs):
    if not _is_audited_model(sender):
        return

    before = _snapshot(instance)
    after = {}
    audit(
        sender=sender,
        instance=instance,
        action=AuditLog.Action.DELETED,
        diff=get_model_diff(before, after),
    )
