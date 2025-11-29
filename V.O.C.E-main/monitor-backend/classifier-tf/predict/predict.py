import sys
import pickle

# Carregar modelo e vectorizer salvos
import os
script_dir = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(script_dir, "model_lr.pkl"), "rb") as f:
    model = pickle.load(f)

with open(os.path.join(script_dir, "vectorizer.pkl"), "rb") as f:
    vectorizer = pickle.load(f)

with open(os.path.join(script_dir, "labels.pkl"), "rb") as f:
    label_encoder = pickle.load(f)

# Entrada da URL
url_to_classify = sys.argv[1]

# Transformar usando o MESMO vectorizer do treino
X_data = vectorizer.transform([url_to_classify])

# Predição
predicted_index = model.predict(X_data)[0]
category = label_encoder.inverse_transform([predicted_index])[0]

print(category)