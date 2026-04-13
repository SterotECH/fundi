import pytest

from apps.analytics import tasks


@pytest.mark.django_db
def test_build_daily_briefings_task_processes_each_organisation(org):
    payload = tasks.build_daily_briefings()

    assert payload["organisations_processed"] >= 1
