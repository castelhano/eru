# Generated by Django 4.2.6 on 2023-10-23 23:31

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('trafego', '0003_linha_demanda'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='linha',
            name='demanda',
        ),
    ]