import subprocess
import sys

def run():
# roda o makemessage do python, se omitido idioma usa --all
# ex: py mkmsg ou py mkmsg en
    # define se usa um idioma especifico ou todos (-a)
    lang_arg = ["-l", sys.argv[1]] if len(sys.argv) > 1 else ["-a"]
    make_cmd = [
        "python", "manage.py", "makemessages",
        "-d", "djangojs",
        *lang_arg,
        "--ignore=venv/*"
    ]
    try:
        print(f"Rodando: {' '.join(make_cmd)}")
        subprocess.run(make_cmd, check=True)
        print("Processo concluido com sucesso")
    except subprocess.CalledProcessError:
        print("Erro: Verifique se o 'gettext' está instalado (necessário Linux/WSL)")
if __name__ == "__main__":
    run()
