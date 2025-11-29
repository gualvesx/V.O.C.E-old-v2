import sys
import tensorflow as tf
import pickle
import numpy as np
import json
import re
# [CORREÇÃO] Importa a função que estava em falta
from tensorflow.keras.preprocessing.sequence import pad_sequences

try:
    # Carregar os artefatos salvos
    model = tf.keras.models.load_model('./classifier-tf/model_final.keras')
    with open('./classifier-tf/tokenizer_word.pkl', 'rb') as f:
        tokenizer_word = pickle.load(f)
    with open('./classifier-tf/tokenizer_char.pkl', 'rb') as f:
        tokenizer_char = pickle.load(f)
    with open('./classifier-tf/labels.pkl', 'rb') as f:
        label_names = pickle.load(f)

    url_to_classify = sys.argv[1]
    url_cleaned = url_to_classify.lower().replace('www.', '')

    # --- Preparar entrada de Palavras ---
    def url_word_tokenizer(url):
        url = re.sub(r'^https?://', '', url)
        parts = url.split('.')
        if len(parts) > 1:
            tld = "tld_" + parts[-1]
            url_tokens = re.split(r'[\./-]', ".".join(parts[:-1]))
            url_tokens.append(tld)
            return ' '.join(url_tokens)
        return ' '.join(re.split(r'[\./-]', url))

    word_sequence = url_word_tokenizer(url_cleaned)
    X_words = pad_sequences(tokenizer_word.texts_to_sequences([word_sequence]), maxlen=20)

    # --- Preparar entrada de Caracteres ---
    X_chars = pad_sequences(tokenizer_char.texts_to_sequences([url_cleaned]), maxlen=120)

    # Fazer a predição com as duas entradas
    prediction = model.predict([X_words, X_chars], verbose=0)
    predicted_index = np.argmax(prediction)
    confidence = float(prediction[0][predicted_index])
    category = label_names[predicted_index]

    result_data = {
        'category': category,
        'confidence': confidence
    }
    print(json.dumps(result_data))

except Exception as e:
    error_data = {'error': str(e)}
    print(json.dumps(error_data))

