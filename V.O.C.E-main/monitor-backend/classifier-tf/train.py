# classifier-tf/train.py (VERSÃO ATUALIZADA)
import tensorflow as tf
from sklearn.feature_extraction.text import CountVectorizer
import pandas as pd
import pickle # Para salvar nosso pré-processador de texto

# --- NOVA FUNÇÃO ---
# Esta função personalizada ensina o vetorizador a "ler" as URLs
# quebrando-as em palavras usando o ponto como separador.
def url_tokenizer(url):
    # Limpa a URL (remove www. e converte para minúsculas)
    clean_url = url.lower().replace('www.', '')
    # Retorna uma lista de "palavras"
    return clean_url.split('.')
# --------------------

print("Iniciando o processo de treinamento em Python...")

# 1. Carregar Dados
print("[1/4] Carregando dados...")
df = pd.read_csv('./classifier-tf/dataset.csv', names=['url', 'categoria'])
urls = df['url'].values
labels = pd.get_dummies(df['categoria']).values
label_names = list(pd.get_dummies(df['categoria']).columns)

# 2. Pré-processamento e Vetorização com Scikit-learn
print("[2/4] Vetorizando URLs...")

# --- LINHA ALTERADA ---
# Em vez de analisar caracteres, agora usamos nossa função personalizada
# para analisar as "palavras" do domínio.
vectorizer = CountVectorizer(tokenizer=url_tokenizer)
# --------------------

X_data = vectorizer.fit_transform(urls).toarray()

# 3. Construir o Modelo
print("[3/4] Construindo o modelo...")
model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(X_data.shape[1],)),
    tf.keras.layers.Dense(64, activation='relu'),
    tf.keras.layers.Dense(32, activation='relu'),
    tf.keras.layers.Dense(len(label_names), activation='softmax')
])

model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

# 4. Treinar e Salvar
print("[4/4] Treinando o modelo...")
model.fit(X_data, labels, epochs=50, verbose=0)

print("Treinamento concluído. Salvando modelo e metadados...")
model.save('./classifier-tf/model.keras')
with open('./classifier-tf/vectorizer.pkl', 'wb') as f:
    pickle.dump(vectorizer, f)
with open('./classifier-tf/labels.pkl', 'wb') as f:
    pickle.dump(label_names, f)

print("Modelo e metadados salvos com sucesso!")