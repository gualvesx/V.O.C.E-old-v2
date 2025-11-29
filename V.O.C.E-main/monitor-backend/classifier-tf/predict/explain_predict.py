# classifier-tf/explain_predict.py
import sys
import pickle
import numpy as np

def preprocess_url(u: str) -> str:
    # Mesma normalização que você deve usar no treino
    u = u.strip().lower()
    # remover esquema
    if u.startswith("http://") or u.startswith("https://"):
        u = u.split("://", 1)[1]
    # remover trailing slash
    u = u.rstrip("/")
    # remover www.
    if u.startswith("www."):
        u = u[4:]
    return u

if len(sys.argv) < 2:
    print("Uso: python explain_predict.py <url>")
    sys.exit(1)

url = preprocess_url(sys.argv[1])

# carregar artefatos
with open("classifier-tf/model.pkl", "rb") as f:
    model = pickle.load(f)          # supondo LogisticRegression
with open("classifier-tf/vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)
with open("classifier-tf/labels.pkl", "rb") as f:
    label_encoder = pickle.load(f)

# transformar
X = vectorizer.transform([url])

# probabilidades
if hasattr(model, "predict_proba"):
    probs = model.predict_proba(X)[0]
else:
    # MultinomialNB também tem predict_proba
    probs = model.predict_proba(X)[0]

pred_idx = int(model.predict(X)[0])
pred_label = label_encoder.inverse_transform([pred_idx])[0]

print(f"\nURL: {url}")
print(f"Predição: {pred_label} (índice {pred_idx})")
print("Probabilidades (top 5):")
top5 = np.argsort(probs)[::-1][:5]
for i in top5:
    print(f"  {label_encoder.inverse_transform([i])[0]}: {probs[i]:.4f}")

# Mostrar features mais importantes (apenas para modelos lineares como LogisticRegression)
if hasattr(model, "coef_"):
    coef = model.coef_  # shape (n_classes, n_features)
    vocab = vectorizer.vocabulary_  # dict term->idx
    inv_vocab = {v:k for k,v in vocab.items()}

    x = X.tocoo()
    # calcular contribuição por feature para a classe prevista:
    # contribution = x_feature_value * coef[class_index, feature_index]
    contributions = {}
    for idx, val in zip(x.col, x.data):
        contributions[idx] = contributions.get(idx, 0.0) + val * coef[pred_idx, idx]

    # ordenar top contribs
    top_feats = sorted(contributions.items(), key=lambda kv: kv[1], reverse=True)[:15]
    print("\nTop features que empurraram para a classe predita (feature : contribuição):")
    for feat_idx, contrib in top_feats:
        print(f"  {inv_vocab.get(feat_idx, '<unk>')} : {contrib:.4f}")
else:
    print("\nAviso: modelo não linear — não é trivial extrair coeficientes (considere usar LogisticRegression).")