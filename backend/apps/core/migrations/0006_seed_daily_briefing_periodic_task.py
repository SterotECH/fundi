from django.db import migrations


def create_daily_briefing_task(apps, schema_editor):
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

    PeriodicTask.objects.update_or_create(
        name="Build daily assistant briefings",
        defaults={
            "task": "apps.analytics.tasks.build_daily_briefings",
            "crontab": schedule,
            "enabled": True,
        },
    )


def delete_daily_briefing_task(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="Build daily assistant briefings").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_migrate_notification_type_values"),
        ("django_celery_beat", "__latest__"),
    ]

    operations = [
        migrations.RunPython(create_daily_briefing_task, delete_daily_briefing_task),
    ]
