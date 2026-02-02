"""
UTILIZAÇÃO:
1. Gerar/Atualizar mensagens (makemessages):
    - Todos: py mkmsg.py (gera tando para django quanto djangojs)
    - Idioma específico: py mkmsg.py en
    - Domínio específico: py mkmsg.py -d djangojs
2. Compilar mensagens (compilemessages):
    - py mkmsg.py -c
"""
import subprocess
import argparse
import sys

def run():
    parser = argparse.ArgumentParser(description="Gerenciador de Traduções Django")
    parser.add_argument("lang", nargs="?", help="Idioma (ex: en, pt_BR). Vazio para todos.")
    parser.add_argument("-d", "--domain", choices=["django", "djangojs"], help="Domínio específico.")
    parser.add_argument("-c", "--compile", action="store_true", help="Executa compilemessages.")
    
    args = parser.parse_args()

    if args.compile:
        cmd = ["python", "manage.py", "compilemessages", "--ignore=venv/*"]
        print("Iniciando compile:")
        print(f"{"-"*5}")
        print(f"Run: {' '.join(cmd)}")
        subprocess.run(cmd, check=True)
    else:
        # Define idiomas e domínios
        lang_arg = ["-l", args.lang] if args.lang else ["-a"]
        domains = [args.domain] if args.domain else ["django", "djangojs"]

        print("Iniciando mkmsg:")
        for d in domains:
            cmd = [
                "python", "manage.py", "makemessages",
                "-d", d,
                *lang_arg,
                "--ignore=venv/*",
                "--ignore=requirements/*"
            ]
            print(f"{"-"*5}")
            print(f"Dominio: {d.upper()}")
            print(f"Run: {' '.join(cmd)}")
            subprocess.run(cmd, check=True)

    print("\n[OK] Processo concluído.")

if __name__ == "__main__":
    run()
