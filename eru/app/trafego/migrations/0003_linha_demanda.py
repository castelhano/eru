# Generated by Django 4.2.6 on 2023-10-23 23:29

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trafego', '0002_trajeto_delta'),
    ]

    operations = [
        migrations.AddField(
            model_name='linha',
            name='demanda',
            field=models.TextField(blank=True),
        ),
    ]