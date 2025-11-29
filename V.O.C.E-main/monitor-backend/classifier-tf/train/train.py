# classifier-tf/train.py (VERSÃO COM EARLY STOPPING E MODELO OTIMIZADO)
import tensorflow as tf
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.callbacks import EarlyStopping # Importa o EarlyStopping
import pandas as pd
import pickle
import numpy as np
import matplotlib.pyplot as plt

print("Iniciando o processo de treinamento avançado (CNN)...")

# 1. Carregar Dados
print("[1/6] Carregando dados...")
# Garante que a primeira linha seja tratada como cabeçalho
df = pd.read_csv('../dataset.csv', header=0, names=['url', 'categoria'])
df.dropna(subset=['url', 'categoria'], inplace=True) # Remove linhas vazias

urls = [str(url).lower().replace('www.', '') for url in df['url'].values]
labels = pd.get_dummies(df['categoria']).values
label_names = list(pd.get_dummies(df['categoria']).columns)

# 2. Pré-processamento com Keras Tokenizer
print("[2/6] Processando texto com Keras Tokenizer...")
MAX_NUM_WORDS = 2000
MAX_SEQUENCE_LENGTH = 100

tokenizer = Tokenizer(num_words=MAX_NUM_WORDS, char_level=True, oov_token='<UNK>')
tokenizer.fit_on_texts(urls)
sequences = tokenizer.texts_to_sequences(urls)

X_data = pad_sequences(sequences, maxlen=MAX_SEQUENCE_LENGTH)

# 3. Construir o Modelo CNN (Versão Simplificada para evitar Overfitting)
print("[3/6] Construindo o modelo CNN otimizado...")
model = tf.keras.Sequential([
    tf.keras.layers.Embedding(input_dim=len(tokenizer.word_index) + 1, output_dim=32, input_length=MAX_SEQUENCE_LENGTH),
    tf.keras.layers.Conv1D(64, 5, activation='relu'), # Reduzido
    tf.keras.layers.GlobalMaxPooling1D(),
    tf.keras.layers.Dense(32, activation='relu'), # Reduzido
    tf.keras.layers.Dropout(0.5),
    tf.keras.layers.Dense(len(label_names), activation='softmax')
])

model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
model.summary()

# [NOVO] Configurar o Early Stopping
# O treino vai parar se a 'val_loss' (perda de validação) não melhorar após 3 épocas.
early_stopping = EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True)

# 4. Treinar o Modelo
print("[4/6] Treinando o modelo com Early Stopping...")
# Aumentamos as épocas para 50, mas o Early Stopping vai parar antes se o modelo parar de aprender.
history = model.fit(X_data, labels, 
                    epochs=50, 
                    batch_size=32, 
                    validation_split=0.2, 
                    verbose=1,
                    callbacks=[early_stopping]) # Adiciona o callback aqui

# 5. Salvar o Modelo e os Metadados
print("[5/6] Salvando modelo e metadados...")
model.save('../model_cnn.keras')
with open('../tokenizer.pkl', 'wb') as f:
    pickle.dump(tokenizer, f)
with open('../labels.pkl', 'wb') as f:
    pickle.dump(label_names, f)

print("Modelo CNN e metadados salvos com sucesso!")

# 6. Gerar e Salvar Gráficos do Histórico de Treinamento
print("[6/6] Gerando gráficos do treinamento...")
plt.figure(figsize=(12, 5))

# Gráfico de Acurácia
plt.subplot(1, 2, 1)
plt.plot(history.history['accuracy'], label='Acurácia de Treino')
plt.plot(history.history['val_accuracy'], label='Acurácia de Validação')
plt.title('Acurácia do Modelo')
plt.xlabel('Época')
plt.ylabel('Acurácia')
plt.legend()

# Gráfico de Perda
plt.subplot(1, 2, 2)
plt.plot(history.history['loss'], label='Perda de Treino')
plt.plot(history.history['val_loss'], label='Perda de Validação')
plt.title('Perda do Modelo')
plt.xlabel('Época')
plt.ylabel('Perda')
plt.legend()

plt.tight_layout()
plt.savefig('../training_history.png')
print("Gráfico 'training_history.png' salvo com sucesso!")

