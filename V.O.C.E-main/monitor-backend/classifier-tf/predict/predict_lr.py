import sys
import pickle
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder

try:
    # Carregar os artefatos salvos
    with open("./classifier-tf/model_lr.pkl", "rb") as f:
        model = pickle.load(f)
    with open("./classifier-tf/vectorizer.pkl", "rb") as f:
        vectorizer = pickle.load(f)
    with open("./classifier-tf/labels.pkl", "rb") as f:
        label_encoder = pickle.load(f)

    # Pegar a URL passada como argumento pelo Node.js
    url_to_classify = sys.argv[1].lower().replace('www.', '')

    # Transformar a URL usando o mesmo vetorizador do treino
    X_new = vectorizer.transform([url_to_classify])

    # Fazer a predição
    prediction_index = model.predict(X_new)[0]
    category = label_encoder.inverse_transform([prediction_index])[0]
    
    # Obter a probabilidade (confiança)
    probabilities = model.predict_proba(X_new)[0]
    confidence = float(probabilities[prediction_index])

    # Criar um dicionário com o resultado
    result_data = {
        'category': category,
        'confidence': confidence
    }

    # Imprime o resultado como uma string JSON
    print(json.dumps(result_data))

except Exception as e:
    # Em caso de erro, retorna um JSON de erro para o Node.js
    error_data = {'error': str(e)}
    print(json.dumps(error_data))

