// ia_classifier.js (VERSÃO ATUALIZADA COM API REST)
require('dotenv').config();
const fetch = require('node-fetch'); // Usando o node-fetch que já temos

// Pega a sua NOVA E SEGURA chave de API do arquivo .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Define o endpoint da API. Usaremos o gemini-1.5-flash que é um modelo real e rápido.
// O "gemini-2.0-flash" do exemplo pode ainda não estar disponível para todos.
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const IA = {
  categorizar: async function(domain) {
    if (!domain) return "Outros";

    // O prompt de sistema que instrui a IA sobre sua tarefa
    const systemInstruction = "Você é um classificador de websites. Sua única função é categorizar o domínio de um site em uma das seguintes categorias: 'Rede Social', 'Jogos', 'Educacional', 'Notícias', 'Produtividade', 'Compras', 'Adulto', 'Outros'. Você deve responder APENAS com o nome exato da categoria e absolutamente mais nada.";

    // Monta o corpo da requisição, como no exemplo 'curl'
    const requestBody = {
      contents: [
        // Primeiro, a instrução do sistema
        {
          role: "user",
          parts: [{ "text": systemInstruction }]
        },
        {
          role: "model",
          parts: [{ "text": "Entendido. Apenas a categoria será retornada." }]
        },
        // Agora, o domínio que queremos classificar
        {
          role: "user",
          parts: [{ "text": domain }]
        }
      ]
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Se a resposta não for OK, captura o erro
        const errorData = await response.json();
        console.error("Erro da API Gemini:", errorData);
        return "Erro de API";
      }

      const data = await response.json();
      
      // Extrai o texto da resposta da IA. O caminho pode ser um pouco longo.
      const category = data.candidates[0].content.parts[0].text.trim();
      return category;

    } catch (error) {
      console.error("Erro na chamada da IA:", error);
      return "Erro de Classificação";
    }
  }
}

module.exports = IA;