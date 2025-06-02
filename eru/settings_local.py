from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent

ALLOWED_HOSTS = ['*']
CSRF_TRUSTED_ORIGINS = ['https://*.127.0.0.1','https://*.192.168.5.45', 'https://localhost']

SECRET_KEY = 'django-insecure-vy-@yf$=0^7s&i7d$3z81pr4ve)6!-c2ol&$0zp+ev$!7%h@wn'
DEBUG = True

COMPANY_DATA = {
'homepage': 'http://localhost:8000/index',
'recrutamento_fone': '(65) 3619-5122',
'recrutamento_email': 'curriculo@sit.com.br',
'sac_fone':'(65) 3618-5522',
'sac_email': None,
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql',
#         'NAME': 'mydatabase',
#         'USER': 'mydatabaseuser',
#         'PASSWORD': 'mypassword',
#         'HOST': '127.0.0.1',
#         'PORT': '5432',
#     }
# }