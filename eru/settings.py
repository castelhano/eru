import os, sys
from pathlib import Path
from django.contrib.messages import constants as messages
from django.utils.translation import gettext_lazy as _
from .settings_local import *

APP_DIR = os.path.join(BASE_DIR,'eru/app/')
TEMPLATES_DIR = os.path.join(BASE_DIR,'eru/templates/')


INSTALLED_APPS = [
    'core',
    'pessoal',
    'django_filters',
    'rest_framework',
    'auditlog',
    'django_tables2',
    'django_extensions',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

if DEBUG:
    INSTALLED_APPS += ['rosetta']

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'auditlog.middleware.AuditlogMiddleware'
]

ROOT_URLCONF = 'eru.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR,'eru/templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'eru.wsgi.application'

REST_FRAMEWORK = {
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend']
}

AUTH_PASSWORD_VALIDATORS = [
    # {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    # {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    # {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    # {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'pt-br'
LANGUAGES = [
    ('pt-br', 'Português'),
    ('en', 'English'),
]
LOCALE_PATHS = [
    os.path.join(BASE_DIR, 'locale'),
]

TIME_ZONE = 'America/Cuiaba'
USE_I18N = True
USE_TZ = True
USE_THOUSAND_SEPARATOR = True


STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'eru/static')]

FIXTURE_DIRS = [
    os.path.join(BASE_DIR, 'eru/fixture/')
]

PROJECT_ROOT = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'app'))


LOGIN_URL = 'login' 
LOGOUT_REDIRECT_URL = 'login'
LOGIN_REDIRECT_URL = 'index'

MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'

def FILTERS_VERBOSE_LOOKUPS():
    from django_filters.conf import DEFAULTS
    verbose_lookups = DEFAULTS['VERBOSE_LOOKUPS'].copy()
    verbose_lookups.update({
        'contains': '',
        'icontains': ''
    })
    return verbose_lookups


MESSAGE_TAGS = {
    messages.ERROR: 'danger',
    messages.SUCCESS: 'success',
    messages.INFO: 'info',
    messages.WARNING: 'warning',
    messages.DEBUG: 'dark'
}