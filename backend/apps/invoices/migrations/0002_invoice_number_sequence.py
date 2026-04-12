from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("invoices", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE SEQUENCE IF NOT EXISTS stero_invoice_seq START 1;",
            reverse_sql="DROP SEQUENCE IF EXISTS stero_invoice_seq;",
        ),
    ]
