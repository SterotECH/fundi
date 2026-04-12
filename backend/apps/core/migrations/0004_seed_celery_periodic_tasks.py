from django.db import migrations


def create_periodic_tasks(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _created = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="7",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
        timezone="Africa/Accra",
    )

    tasks = [
        (
            "Check overdue invoices daily",
            "apps.core.tasks.check_overdue_invoices",
        ),
        (
            "Check proposal deadlines daily",
            "apps.core.tasks.check_proposal_deadlines",
        ),
    ]
    for name, task in tasks:
        PeriodicTask.objects.update_or_create(
            name=name,
            defaults={
                "task": task,
                "crontab": schedule,
                "enabled": True,
            },
        )


def delete_periodic_tasks(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(
        name__in=[
            "Check overdue invoices daily",
            "Check proposal deadlines daily",
        ]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_alter_notification_type"),
        ("django_celery_beat", "__latest__"),
    ]

    operations = [
        migrations.RunPython(create_periodic_tasks, delete_periodic_tasks),
    ]
