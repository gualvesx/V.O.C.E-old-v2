import pickle
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, ConfusionMatrixDisplay
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import pandas as pd

# ============================
# 1. Carregar dados
# ============================
try:
    df = pd.read_csv("classifier-tf/dataset.csv")
except Exception as e:
    print(f"❌ Erro ao ler CSV: {e}")
    exit()

# Se o CSV não tiver cabeçalho, o pandas cria colunas 0,1,...
if df.columns[0] not in ["url", "URL", "link", "Link"]:
    print("⚠️ Nenhum cabeçalho detectado, atribuindo nomes às colunas...")
    df = pd.read_csv("classifier-tf/dataset.csv", header=None, names=["url", "categoria"])

# Agora garantimos que temos 'url' e 'categoria'
texts = df["url"].astype(str).tolist()
labels = df["categoria"].astype(str).tolist()

# ============================
# 2. Carregar tokenizer e labels
# ============================
with open("classifier-tf/tokenizer.pkl", "rb") as f:
    tokenizer = pickle.load(f)

with open("classifier-tf/labels.pkl", "rb") as f:
    loaded_labels = pickle.load(f)

# Se for lista → reconstruímos o LabelEncoder
if isinstance(loaded_labels, list):
    label_encoder = LabelEncoder()
    label_encoder.fit(loaded_labels)
else:
    label_encoder = loaded_labels

y = label_encoder.transform(labels)

# Dividir dados (mesmo split do treino)
X_train, X_test, y_train, y_test = train_test_split(
    texts, y, test_size=0.2, random_state=42
)
X_test_seq = tokenizer.texts_to_sequences(X_test)
X_test_pad = pad_sequences(X_test_seq, maxlen=50)

# ============================
# 3. Carregar modelo treinado
# ============================
model = load_model("classifier-tf/model_cnn.keras")

# ============================
# 4. Fazer predições
# ============================
y_pred_probs = model.predict(X_test_pad)
y_pred = np.argmax(y_pred_probs, axis=1)

# ============================
# 5. Avaliar desempenho
# ============================
acc = accuracy_score(y_test, y_pred)
print(f"\n📊 Acurácia no conjunto de teste: {acc:.4f}\n")

print("📌 Classification Report:")

# Usar apenas as classes presentes no y_test
unique_classes = np.unique(y_test)
print(classification_report(
    y_test, y_pred,
    labels=unique_classes,
    target_names=label_encoder.inverse_transform(unique_classes)
))
# ============================
# 6. Matriz de confusão
# ============================
cm = confusion_matrix(y_test, y_pred, labels=unique_classes)

disp = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=label_encoder.inverse_transform(unique_classes)
)

fig, ax = plt.subplots(figsize=(10, 8))
disp.plot(cmap="Blues", xticks_rotation=45, ax=ax, values_format="d")
plt.title("Matriz de Confusão")
plt.tight_layout()
plt.show()