def get_model_diff(before, after):
    changes = {}
    all_keys = set(before.keys()) | set(after.keys())
    for key in all_keys:
        b = before.get(key)
        a = after.get(key)
        if b != a:
            changes[key] = {"before": b, "after": a}
    return changes


def audit(sender, instance, action, user=None, diff=None, **kwargs):
    from apps.core.models import AuditLog

    AuditLog.objects.create(
        user=user,
        organisation=getattr(instance, "organisation", None),
        action=action,
        entity_type=sender.__name__,
        entity_id=instance.pk,
        diff=diff or {},
    )
