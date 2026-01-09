from django.urls import path

def generate_urls(model_name_str, views_module, plural_name=None):
    singular = model_name_str.lower()
    plural = plural_name.lower() if plural_name else f"{singular}s"
    urls = []
    config = [
        ('ListView',   f'{plural}/', '_list'),
        ('CreateView', f'{singular}/new/','_create'),
        ('UpdateView', f'{singular}/<int:pk>/update/', '_update'),
        ('DeleteView', f'{singular}/<int:pk>/delete/', '_delete'),
    ]
    for suffix, url_path, url_name in config:
        # procuramos a classe no modulo de views pelo nome da string
        view_class_name = f"{model_name_str}{suffix}"
        view_class = getattr(views_module, view_class_name, None)
        if view_class:
            urls.append(path(url_path, view_class.as_view(), name=f'{singular}{url_name}'))
    return urls

def generate_urls_related(model_name_str, views_module, plural_name=None):
    singular = model_name_str.lower()
    plural = plural_name.lower() if plural_name else f"{singular}s"
    urls = []
    config = [
        ('ListView',   f'{plural}/<int:pk>/', '_list'),
        ('CreateView', f'{singular}/<int:pk>/new/','_create'),
        ('UpdateView', f'{singular}/<int:pk>/update/', '_update'),
        ('DeleteView', f'{singular}/<int:pk>/delete/', '_delete'),
    ]
    for suffix, url_path, url_name in config:
        # procuramos a classe no modulo de views pelo nome da string
        view_class_name = f"{model_name_str}{suffix}"
        view_class = getattr(views_module, view_class_name, None)
        if view_class:
            urls.append(path(url_path, view_class.as_view(), name=f'{singular}{url_name}'))
    return urls
