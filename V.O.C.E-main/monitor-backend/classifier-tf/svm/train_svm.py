import pickle
import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.metrics import classification_report, accuracy_score
import io

print("Iniciando o processo de treinamento (SVM com Otimização de Hiperparâmetros)...")

# 1. Carregar Dados
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
    print(f"\nERRO CRÍTICO: As seguintes categorias têm apenas 1 exemplo: {label_counts[label_counts < 2].index.tolist()}")
    print("Por favor, adicione mais exemplos para estas categorias no 'dataset.csv'.")
    exit()

# 2. Codificar as Labels
print("[2/5] Codificando as categorias...")
label_encoder = LabelEncoder()
y = label_encoder.fit_transform(labels)

# 3. Vetorização com TF-IDF
print("[3/5] Criando features com TF-IDF...")
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

# 5. Otimização com Grid Search e Treinamento do Modelo SVM
print("[5/5] Encontrando os melhores parâmetros e treinando o modelo SVM...")
# Define os parâmetros que queremos testar. 'C' é o parâmetro de regularização.
param_grid = {'C': [0.1, 1, 10, 100]}

# Cria o objeto Grid Search. Ele vai testar cada valor de 'C' e encontrar o melhor.
# cv=3 significa que ele vai dividir os dados de treino em 3 partes para validar internamente.
grid_search = GridSearchCV(
    SVC(kernel='linear', class_weight='balanced', probability=True, random_state=42),
    param_grid,
    cv=3,
    verbose=1 # Mostra o progresso
)

# Executa a busca (isso pode demorar alguns minutos)
grid_search.fit(X_train, y_train)

# Pega o melhor modelo encontrado pelo Grid Search
best_model = grid_search.best_estimator_

print("Treinamento concluído!")
print(f"Melhor parâmetro encontrado: {grid_search.best_params_}")

# Salvar os Artefatos
print("\n--- Salvando os Artefatos do Melhor Modelo ---")
with open('./classifier-tf/model_svm.pkl', 'wb') as f:
    pickle.dump(best_model, f)
with open('./classifier-tf/vectorizer.pkl', 'wb') as f:
    pickle.dump(vectorizer, f)
with open('./classifier-tf/labels.pkl', 'wb') as f:
    pickle.dump(label_encoder, f)
print("Artefatos salvos com sucesso!")

# Avaliar o desempenho
print("\n--- Avaliação do Modelo Final ---")
y_pred = best_model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"\n📊 Acurácia final no conjunto de teste: {acc:.4f}\n")
print("📌 Relatório de Classificação Detalhado:")
print(classification_report(y_test, y_pred, target_names=label_encoder.classes_, zero_division=0))

