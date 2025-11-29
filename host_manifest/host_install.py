import os
import json
from pathlib import Path
import subprocess

user_home = Path.home()
base_path = user_home / "Downloads" / "V.O.C.E"
user_path = base_path / "native_host" / "run_host.bat"

chrome_path = base_path / "host_manifest" / "host_manifest-chrome.json"
firefox_path = base_path / "host_manifest" / "host_manifest-firefox.json"

manifest_chrome = {
    "name": "com.meutcc.monitor",
    "description": "Host nativo para o TCC de monitoramento",
    "path": str(user_path),
    "type": "stdio",
    "allowed_origins": ["chrome-extension://<id_da_extensao>/"]
}

manifest_firefox = {
    "name": "com.meutcc.monitor",
    "description": "Host nativo para o TCC de monitoramento",
    "path": str(user_path),
    "type": "stdio",
    "allowed_extensions": ["moz-extension://monitor-tcc@meuprojeto.com"]
}

chrome_path_str = str(chrome_path).replace('\\', '\\\\')
firefox_path_str = str(firefox_path).replace('\\', '\\\\')


# Escreve os manifests
with open(chrome_path, "w") as f:
    json.dump(manifest_chrome, f, indent=4)

with open(firefox_path, "w") as f:
    json.dump(manifest_firefox, f, indent=4)

print("✅ Manifests do Chrome e Firefox gerados com sucesso!")

content_reg = f"""Windows Registry Editor Version 5.00

; Google Chrome
[HKEY_CURRENT_USER\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.meutcc.monitor]
@="{chrome_path_str}"

; Mozilla Firefox
[HKEY_CURRENT_USER\\SOFTWARE\\Mozilla\\NativeMessagingHosts\\com.meutcc.monitor]
@="{firefox_path_str}"
"""

# salva o arquivo .reg
file_reg = os.path.join(os.getcwd(), "instalador_host.reg")
with open(file_reg, "w") as f:
    f.write(content_reg)

try: 
    subprocess.run(['regedit', '/s', file_reg], check=True)
    print("Arquivo .reg aplicado com sucesso!")

except subprocess.CalledProcessError as e:
    print("Erro ao aplicar o arquivo .reg:", e)

print("✅ Arquivo instalador_host.reg gerado com sucesso!")
print(f"📂 Caminho: {file_reg}")