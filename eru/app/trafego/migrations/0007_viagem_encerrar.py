# Generated by Django 4.2.4 on 2023-10-25 17:20

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trafego', '0006_alter_viagem_sentido_alter_viagem_tipo'),
    ]

    operations = [
        migrations.AddField(
            model_name='viagem',
            name='encerrar',
            field=models.BooleanField(default=False),
        ),
    ]
