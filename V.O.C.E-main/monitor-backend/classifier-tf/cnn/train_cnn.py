import pickle
import pandas as pd
import numpy as np
import io 
import re
import matplotlib.pyplot as plt
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelBinarizer
from sklearn.metrics import classification_report
from sklearn.utils import class_weight
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Embedding, Conv1D, MaxPooling1D, LSTM, Bidirectional, Dense, Dropout, concatenate, BatchNormalization, SpatialDropout1D
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

print("🚀 Iniciando Treinamento: Modelo Híbrido C-LSTM (State-of-the-Art)...")

# --- 1. Carregar Dados Aumentados ---
print("[1/7] Carregando dataset inteligente...")
try:
    # Força o uso do dataset aumentado gerado no Passo 1
    with open('./classifier-tf/dataset_augmented.csv', 'r', encoding='utf-8') as f:
        print("   -> Usando 'dataset_augmented.csv' (Com IPs e Variações)")
        lines = f.readlines()
except FileNotFoundError:
    print("   ❌ ERRO: Rode o 'augment_data.py' primeiro!")
    exit()

csv_string = "".join([line for line in lines if line.strip()])
df = pd.read_csv(io.StringIO(csv_string))
df.dropna(subset=['url', 'label'], inplace=True)
df['url_cleaned'] = df['url'].str.lower().str.replace('www.', '', regex=False)

# Tokenizer Especializado para URL e IPs
def specialized_tokenizer(url):
    url = re.sub(r'^https?://', '', url)
    # Separa por pontos, mas mantém números juntos para IPs
    # Ex: 192.168.0.1 -> ['192', '168', '0', '1']
    tokens = re.split(r'[\./\-_@:?=&]', url)
    return ' '.join([t for t in tokens if t])

df['tokens'] = df['url_cleaned'].apply(specialized_tokenizer)
texts = df['tokens'].tolist()
labels = df['label'].astype(str).tolist()

# --- 2. Tokenização ---
print("[2/7] Criando vocabulário...")
MAX_WORDS = 20000 
MAX_LEN = 40 # Aumentado para pegar URLs longas
tokenizer = Tokenizer(num_words=MAX_WORDS, oov_token='<UNK>')
tokenizer.fit_on_texts(texts)
X = pad_sequences(tokenizer.texts_to_sequences(texts), maxlen=MAX_LEN)

# --- 3. GloVe Embeddings ---
print("[3/7] Carregando GloVe...")
GLOVE_FILE = './classifier-tf/glove.6B.100d.txt'
embeddings_index = {}
try:
    with open(GLOVE_FILE, encoding='utf-8') as f:
        for line in f:
            values = line.split()
            word = values[0]
            embeddings_index[word] = np.asarray(values[1:], dtype='float32')
except:
    print("   ⚠️ Aviso: GloVe não encontrado. Treinando embeddings do zero.")

EMBEDDING_DIM = 100
embedding_matrix = np.zeros((len(tokenizer.word_index) + 1, EMBEDDING_DIM))
for word, i in tokenizer.word_index.items():
    embedding_vector = embeddings_index.get(word)
    if embedding_vector is not None:
        embedding_matrix[i] = embedding_vector

# --- 4. Split e Pesos ---
encoder = LabelBinarizer()
y = encoder.fit_transform(labels)
label_names = encoder.classes_

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)

y_ints = np.argmax(y_train, axis=1)
class_weights = class_weight.compute_class_weight('balanced', classes=np.unique(y_ints), y=y_ints)
weights_dict = dict(enumerate(class_weights))

# --- 5. Arquitetura C-LSTM (A Mágica) ---
print("[5/7] Construindo C-LSTM...")

input_layer = Input(shape=(MAX_LEN,))

# Camada 1: Entendimento Semântico
embedding = Embedding(len(tokenizer.word_index) + 1, EMBEDDING_DIM, 
                      weights=[embedding_matrix] if embeddings_index else None, 
                      trainable=True)(input_layer)
x = SpatialDropout1D(0.3)(embedding)

# Camada 2: Extração de Padrões Locais (Como a CNN via palavras)
x = Conv1D(filters=256, kernel_size=3, padding='same', activation='relu')(x)
x = BatchNormalization()(x)
x = MaxPooling1D(pool_size=2)(x)

# Camada 3: Entendimento de Sequência (LSTM Bidirecional)
# Isso permite entender que números em sequência (IP) são diferentes de números em jogos
x = Bidirectional(LSTM(128, return_sequences=False))(x)
x = Dropout(0.4)(x)

# Camada 4: Classificação
x = Dense(128, activation='relu')(x)
x = Dropout(0.3)(x)
output_layer = Dense(len(label_names), activation='softmax')(x)

model = Model(inputs=input_layer, outputs=output_layer)
model.compile(loss='categorical_crossentropy', optimizer='adam', metrics=['accuracy'])
model.summary()

# --- 6. Treinamento ---
print("[6/7] Treinando...")
callbacks = [
    EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
    ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=2, verbose=1)
]

history = model.fit(
    X_train, y_train,
    epochs=50,
    batch_size=64,
    validation_data=(X_test, y_test),
    class_weight=weights_dict,
    callbacks=callbacks,
    verbose=1
)

# --- 7. Avaliação e Exportação ---
print("\n[7/7] Finalizando...")
loss, acc = model.evaluate(X_test, y_test, verbose=0)
print(f"\n🏆 Acurácia no Teste: {acc*100:.2f}%")

# Relatório
y_pred = np.argmax(model.predict(X_test), axis=1)
print(classification_report(np.argmax(y_test, axis=1), y_pred, target_names=label_names, zero_division=0))

# Salvar
model.save('./classifier-tf/model_final.keras')
with open('./classifier-tf/tokenizer_word.pkl', 'wb') as f: pickle.dump(tokenizer, f)
# O modelo novo usa apenas 1 tokenizer (mais eficiente), salvamos o mesmo como char para compatibilidade se necessário
with open('./classifier-tf/tokenizer_char.pkl', 'wb') as f: pickle.dump(tokenizer, f) 
with open('./classifier-tf/labels.pkl', 'wb') as f: pickle.dump(label_names, f)

# Gráfico
plt.figure(figsize=(10, 4))
plt.subplot(1, 2, 1); plt.plot(history.history['accuracy']); plt.plot(history.history['val_accuracy']); plt.title('Acurácia')
plt.subplot(1, 2, 2); plt.plot(history.history['loss']); plt.plot(history.history['val_loss']); plt.title('Perda')
plt.savefig('./classifier-tf/training_history.png')
print("✅ Tudo pronto! Modelo salvo.")