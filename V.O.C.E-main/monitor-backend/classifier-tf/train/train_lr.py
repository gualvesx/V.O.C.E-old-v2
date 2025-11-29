import pickle
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
import io

print("Iniciando o processo de treinamento (Regressão Logística com Balanceamento de Classes)...")

# 1. Carregar Dados de forma Robusta
print("[1/5] Carregando e limpando dados...")
with open('./classifier-tf/dataset.csv', 'r', encoding='utf-8') as f:
    lines = f.readlines()
cleaned_lines = [line for line in lines if not line.strip().startswith('#') and line.strip()]
csv_string = "".join(cleaned_lines)
df = pd.read_csv(io.StringIO(csv_string))
df.dropna(subset=['url', 'label'], inplace=True)
df['url'] = df['url'].str.lower().str.replace('www.', '', regex=False)

texts = df['url'].astype(str).tolist()
labels = df['label'].astype(str).tolist()

label_counts = pd.Series(labels).value_counts()
if (label_counts < 2).any():
    print("\nERRO CRÍTICO: As seguintes categorias têm apenas 1 exemplo e não podem ser divididas para teste:")
    print(label_counts[label_counts < 2])
    print("\nPor favor, adicione mais exemplos para estas categorias no 'dataset.csv' e tente novamente.")
    exit()

# 2. Codificar as Labels
print("[2/5] Codificando as categorias...")
label_encoder = LabelEncoder()
y = label_encoder.fit_transform(labels)

# 3. Vetorização com TF-IDF (N-gramas de Caracteres)
print("[3/5] Criando features com TF-IDF (N-gramas de Caracteres)...")
vectorizer = TfidfVectorizer(
    analyzer='char', 
    ngram_range=(3, 6),
    max_features=10000
)
X = vectorizer.fit_transform(texts)

# 4. Dividir Dados para Treino e Teste
print("[4/5] Dividindo dados para treino e teste...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 5. Treinar o Modelo
print("[5/5] Treinando o modelo...")
# [MUDANÇA CRUCIAL] Adicionado class_weight='balanced' para lidar com o desequilíbrio de classes.
model = LogisticRegression(
    max_iter=1000, 
    solver="lbfgs", 
    multi_class="multinomial", 
    random_state=42,
    class_weight='balanced'
)
model.fit(X_train, y_train)
print("Treinamento concluído!")

# Salvar os Artefatos
print("\n--- Salvando os Artefatos ---")
with open('./classifier-tf/model_lr.pkl', 'wb') as f:
    pickle.dump(model, f)
with open('./classifier-tf/vectorizer.pkl', 'wb') as f:
    pickle.dump(vectorizer, f)
with open('./classifier-tf/labels.pkl', 'wb') as f:
    pickle.dump(label_encoder, f)
print("Artefatos salvos com sucesso!")

# Avaliar o desempenho
print("\n--- Avaliação do Modelo ---")
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"\n📊 Acurácia final no conjunto de teste: {acc:.4f}\n")
print("📌 Relatório de Classificação Detalhado:")
print(classification_report(y_test, y_pred, target_names=label_encoder.classes_, zero_division=0))

