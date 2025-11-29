import pandas as pd
import random
import os

print("Gerando dados sintéticos para 'blindar' a IA...")

# Define o caminho base como a pasta onde este script está salvo
base_dir = os.path.dirname(os.path.abspath(__file__))
dataset_path = os.path.join(base_dir, 'dataset.csv')
output_path = os.path.join(base_dir, 'dataset_augmented.csv')

# 1. Carrega o dataset original
try:
    print(f" -> Lendo dataset de: {dataset_path}")
    df = pd.read_csv(dataset_path)
except FileNotFoundError:
    print(f"❌ Erro: Não encontrei 'dataset.csv' em {dataset_path}")
    print("Verifique se o arquivo existe na pasta 'classifier-tf'.")
    exit()

new_rows = []

# --- A. Gerador de IPs (A Chave para o 100%) ---
print(" -> Gerando 500 endereços IP simulados...")
for _ in range(500):
    # Gera IPs aleatórios realistas (ex: 192.168.1.50, 10.0.0.12)
    ip_parts = [str(random.randint(0, 255)) for _ in range(4)]
    ip = ".".join(ip_parts)
    
    # 50% de chance de ter porta (ex: :8080)
    if random.random() > 0.5:
        ip += f":{random.randint(1000, 9999)}"
    
    # Alguns com http://
    if random.random() > 0.7:
        ip = "http://" + ip
        
    new_rows.append({'url': ip, 'label': 'Produtividade & Ferramentas'})

# --- B. Gerador de Localhost ---
print(" -> Gerando 100 variações de Localhost...")
for _ in range(100):
    port = random.randint(3000, 9000)
    options = [
        f'localhost:{port}',
        f'http://localhost:{port}',
        f'127.0.0.1:{port}',
        f'http://127.0.0.1:{port}/dashboard',
        f'localhost:{port}/login'
    ]
    new_rows.append({'url': random.choice(options), 'label': 'Produtividade & Ferramentas'})

# --- C. Variações do Dataset Existente ---
print(" -> Criando variações das URLs existentes...")
for index, row in df.iterrows():
    url = str(row['url'])
    label = row['label']
    
    # Adicionar www. se não tiver
    if not url.startswith('www.') and not url.startswith('http'):
        new_rows.append({'url': 'www.' + url, 'label': label})
    
    # Simular caminhos internos (ex: /login, /home)
    paths = ['/login', '/app', '/dashboard', '/index.html', '/search?q=teste']
    if random.random() > 0.5:
        p = random.choice(paths)
        new_rows.append({'url': url + p, 'label': label})

# Salvar
df_aug = pd.DataFrame(new_rows)
df_final = pd.concat([df, df_aug]).drop_duplicates().reset_index(drop=True)

# Limpar URLs vazias e salvar
df_final = df_final[df_final['url'].notna()]
df_final = df_final[df_final['url'] != '']

df_final.to_csv(output_path, index=False)
print(f"\n✅ SUCESSO! Novo dataset salvo em: '{output_path}'")
print(f"   - Tamanho original: {len(df)} linhas")
print(f"   - Tamanho final: {len(df_final)} linhas (Agora a IA conhece IPs!)")