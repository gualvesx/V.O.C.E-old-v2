import csv
import pandas as pd
import matplotlib.pyplot as plt

# Função para carregar o CSV e retornar os dados
def carregar_csv(caminho):
    dados = []
    with open(caminho, mode='r', encoding='utf-8') as file:
        csv_reader = csv.reader(file)
        for linha in csv_reader:
            dados.append(linha)
    return dados

# Carregar os dados do CSV
dados_csv = carregar_csv('./classifier-tf/dataset.csv')  # Substitua pelo caminho correto do seu arquivo CSV

# Converter para DataFrame do pandas
df = pd.DataFrame(dados_csv, columns=['URL', 'Categoria'])

# Mostrar os 5 primeiros registros para verificação
print(df.head())

# Contar a quantidade de URLs por categoria
contagem_categoria = df['Categoria'].value_counts()

# Plotando a contagem de categorias
plt.figure(figsize=(10, 6))
contagem_categoria.plot(kind='bar', color='skyblue')
plt.title('Quantidade de URLs por Categoria')
plt.xlabel('Categoria')
plt.ylabel('Quantidade de URLs')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.show()

# Filtrando por categoria específica (exemplo: "Rede Social")
categoria_filtrada = df[df['Categoria'] == 'Rede Social']

# Exibindo as URLs filtradas
print("\nURLs da categoria 'Rede Social':")
print(categoria_filtrada['URL'])