from django.db import migrations


def forwards(apps, schema_editor):
    Notification = apps.get_model("core", "Notification")
    Notification.objects.filter(type="deadline").update(type="proposal_deadline")
    Notification.objects.filter(type="overdue").update(type="invoice_overdue")


def backwards(apps, schema_editor):
    Notification = apps.get_model("core", "Notification")
    Notification.objects.filter(type="proposal_deadline").update(type="deadline")
    Notification.objects.filter(type="invoice_overdue").update(type="overdue")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_seed_celery_periodic_tasks"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
