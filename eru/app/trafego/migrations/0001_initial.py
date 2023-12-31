# Generated by Django 4.2.4 on 2023-12-28 13:05

import datetime
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Carro',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('classificacao', models.CharField(blank=True, choices=[('', '---'), ('CV', 'Convencional'), ('PD', 'Padron'), ('MC', 'Microonibus'), ('AT', 'Articulado'), ('BI', 'Biarticulado')], default='CV', max_length=3)),
                ('escalas', models.TextField(blank=True)),
                ('labels', models.CharField(blank=True, max_length=250)),
            ],
            options={
                'default_permissions': [],
            },
        ),
        migrations.CreateModel(
            name='Linha',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=8, unique=True)),
                ('nome', models.CharField(max_length=80)),
                ('classificacao', models.CharField(blank=True, choices=[('RD', 'Radial'), ('DM', 'Diametral'), ('CR', 'Circular'), ('TR', 'Troncal'), ('AL', 'Alimentadora'), ('IT', 'Intersetorial'), ('ES', 'Especial')], max_length=3)),
                ('extensao_ida', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('extensao_volta', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('acesso_origem_km', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('acesso_destino_km', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('acesso_origem_minutos', models.PositiveIntegerField(blank=True, null=True)),
                ('acesso_destino_minutos', models.PositiveIntegerField(blank=True, null=True)),
                ('recolhe_origem_km', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('recolhe_destino_km', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('recolhe_origem_minutos', models.PositiveIntegerField(blank=True, null=True)),
                ('recolhe_destino_minutos', models.PositiveIntegerField(blank=True, null=True)),
                ('inativa', models.BooleanField(default=False)),
                ('demanda', models.TextField(blank=True)),
                ('detalhe', models.TextField(blank=True)),
            ],
            options={
                'permissions': [('dop_linha', 'Pode acessar DOP')],
            },
        ),
        migrations.CreateModel(
            name='Localidade',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=80, unique=True)),
                ('eh_garagem', models.BooleanField(default=False)),
                ('troca_turno', models.BooleanField(default=False)),
                ('ponto_de_controle', models.BooleanField(default=False)),
            ],
        ),
        migrations.CreateModel(
            name='Viagem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('inicio', models.PositiveIntegerField()),
                ('fim', models.PositiveIntegerField()),
                ('sentido', models.CharField(blank=True, choices=[('I', 'Ida'), ('V', 'Volta')], default='1', max_length=3)),
                ('tipo', models.CharField(blank=True, choices=[('1', '1 Produtiva'), ('2', '2 Expresso'), ('3', '3 Semi Expresso'), ('4', '4 Extra'), ('5', '5 Acesso'), ('6', '6 Recolhe'), ('7', '7 Intervalo'), ('9', '9 Reservado')], default='1', max_length=3)),
                ('encerrar', models.BooleanField(default=False)),
                ('detalhe', models.CharField(blank=True, max_length=10)),
                ('carro', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='trafego.carro')),
                ('destino', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, related_name='viagem_destino', to='trafego.localidade')),
                ('origem', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, related_name='viagem_origem', to='trafego.localidade')),
            ],
            options={
                'default_permissions': [],
            },
        ),
        migrations.CreateModel(
            name='Trajeto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sentido', models.CharField(blank=True, choices=[('I', 'Ida'), ('V', 'Volta'), ('U', 'Unico')], default='I', max_length=3)),
                ('seq', models.PositiveIntegerField(default=1)),
                ('delta', models.PositiveIntegerField(default=0)),
                ('labels', models.CharField(blank=True, max_length=250)),
                ('fechado', models.BooleanField(default=False)),
                ('detalhe', models.CharField(blank=True, max_length=250)),
                ('linha', models.ForeignKey(on_delete=django.db.models.deletion.RESTRICT, to='trafego.linha')),
                ('local', models.ForeignKey(on_delete=django.db.models.deletion.RESTRICT, to='trafego.localidade')),
            ],
            options={
                'default_permissions': [],
            },
        ),
        migrations.CreateModel(
            name='Planejamento',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=15, unique=True)),
                ('descricao', models.CharField(blank=True, max_length=200)),
                ('dia_tipo', models.CharField(blank=True, choices=[('U', 'Util'), ('S', 'Sabado'), ('D', 'Domingo'), ('F', 'Ferias'), ('E', 'Especial')], default='U', max_length=3)),
                ('data_criacao', models.DateField(blank=True, default=datetime.datetime.today, null=True)),
                ('patamares', models.TextField(blank=True)),
                ('ativo', models.BooleanField(default=False)),
                ('pin', models.BooleanField(default=True)),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.RESTRICT, to='core.empresa')),
                ('linha', models.ForeignKey(on_delete=django.db.models.deletion.RESTRICT, to='trafego.linha')),
                ('usuario', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Patamar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('inicial', models.PositiveIntegerField()),
                ('final', models.PositiveIntegerField()),
                ('ida', models.PositiveIntegerField(blank=True, null=True)),
                ('volta', models.PositiveIntegerField(blank=True, null=True)),
                ('intervalo_ida', models.PositiveIntegerField(blank=True, null=True)),
                ('intervalo_volta', models.PositiveIntegerField(blank=True, null=True)),
                ('linha', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='trafego.linha')),
            ],
            options={
                'default_permissions': ('change',),
            },
        ),
        migrations.CreateModel(
            name='Passageiro',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('embarque', models.DateTimeField()),
                ('referencia', models.DateField()),
                ('dia_tipo', models.CharField(blank=True, choices=[('U', 'Util'), ('S', 'Sabado'), ('D', 'Domingo'), ('F', 'Ferias'), ('E', 'Especial')], default='U', max_length=3)),
                ('veiculo', models.CharField(blank=True, max_length=30)),
                ('cartao', models.CharField(blank=True, max_length=60)),
                ('aplicacao', models.CharField(blank=True, max_length=60)),
                ('tipo', models.CharField(blank=True, max_length=60)),
                ('tarifa', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.RESTRICT, to='core.empresa')),
                ('linha', models.ForeignKey(on_delete=django.db.models.deletion.RESTRICT, to='trafego.linha')),
            ],
        ),
        migrations.AddField(
            model_name='linha',
            name='destino',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, related_name='local_destino', to='trafego.localidade'),
        ),
        migrations.AddField(
            model_name='linha',
            name='empresa',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, to='core.empresa'),
        ),
        migrations.AddField(
            model_name='linha',
            name='garagem',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, related_name='local_garagem', to='trafego.localidade'),
        ),
        migrations.AddField(
            model_name='linha',
            name='origem',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, related_name='local_origem', to='trafego.localidade'),
        ),
        migrations.AddField(
            model_name='carro',
            name='planejamento',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='trafego.planejamento'),
        ),
    ]
