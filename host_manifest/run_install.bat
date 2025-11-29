@echo off
:: Este script usa o comando 'python' que estiver no PATH do sistema
:: para executar nosso script Python. O %~dp0 aponta para o diretório
:: onde este .bat está, tornando o caminho para o host_install.py relativo.
python "%~dp0\host_install.py"