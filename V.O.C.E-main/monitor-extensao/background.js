// background.js (VERSÃO FINAL COM NATIVE MESSAGING)

// --- VARIÁVEIS GLOBAIS ---
let activeTabs = {};
let dataBuffer = [];
const BACKEND_URL = 'http://localhost:3000/api/data';
const nativeHostName = 'com.meutcc.monitor'; // Nome do host nativo (deve ser o mesmo do manifest e registro)
let osUsername = 'carregando...'; // Variável para guardar o nome de usuário do SO

// --- LÓGICA DE IDENTIFICAÇÃO (NATIVE MESSAGING) ---

// Função para obter o nome de usuário do SO via Native Messaging
function getOSUsername() {
  console.log(`Tentando obter nome de usuário via host nativo: ${nativeHostName}`);
  
  // A mensagem que enviamos ao host é um JSON simples. O conteúdo não importa muito
  // pois o script Python simplesmente responde com o nome de usuário.
  chrome.runtime.sendNativeMessage(nativeHostName, { text: "get_username_request" }, (response) => {
    // Verifica se houve um erro na comunicação em si
    if (chrome.runtime.lastError) {
      console.error('ERRO NATIVE MESSAGING:', chrome.runtime.lastError.message);
      osUsername = 'erro_host_nao_encontrado'; // Define um ID de erro
      return;
    }
    
    // Verifica se a resposta do script Python foi um sucesso ou um erro
    if (response && response.status === 'success') {
      osUsername = response.username;
      console.log('Nome de usuário do SO obtido com sucesso:', osUsername);
    } else {
      console.error('O script do host nativo retornou um erro:', response ? response.message : 'Resposta vazia');
      osUsername = 'erro_script_host'; // Define um ID de erro
    }
  });
}

// Chama a função para obter o nome de usuário assim que a extensão inicia
getOSUsername();


// --- LÓGICA PRINCIPAL DA EXTENSÃO ---

// Função para enviar os dados para o servidor backend
async function sendDataToServer() {
  if (dataBuffer.length === 0) {
    return; // Não envia nada se o buffer estiver vazio
  }

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataBuffer),
    });

    if (response.ok) {
      console.log('Dados enviados com sucesso para o servidor:', dataBuffer);
      dataBuffer = []; // Limpa o buffer após o envio bem-sucedido
    } else {
      console.error('Falha ao enviar dados para o servidor:', response.statusText);
    }
  } catch (error) {
    console.error('Erro de rede ao enviar dados:', error);
  }
}

// Função para registrar o tempo gasto em uma aba
function recordTime(tabId, url) {
  if (activeTabs[tabId]) {
    const startTime = activeTabs[tabId].startTime;
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const domain = new URL(url).hostname;

    // Apenas registra se o tempo for significativo (ex: > 5 segundos)
    if (durationSeconds > 5) {
      dataBuffer.push({
        aluno_id: osUsername, // <-- USANDO O NOME DE USUÁRIO DO SO OBTIDO!
        url: domain,
        durationSeconds: durationSeconds,
        timestamp: new Date().toISOString()
      });
      console.log(`[${osUsername}] Tempo para ${domain}: ${durationSeconds}s`);
    }
  }
}


// --- LISTENERS DE EVENTOS DO CHROME ---

// Evento disparado quando o usuário troca de aba
chrome.tabs.onActivated.addListener(activeInfo => {
  const previousTabId = Object.keys(activeTabs)[0];
  if (previousTabId) {
    chrome.tabs.get(parseInt(previousTabId), (tab) => {
        if (!chrome.runtime.lastError && tab && tab.url && tab.url.startsWith('http')) {
             recordTime(parseInt(previousTabId), tab.url);
        }
        delete activeTabs[previousTabId];
    });
  }

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!chrome.runtime.lastError && tab.url && tab.url.startsWith('http')) {
      activeTabs[tab.id] = { startTime: Date.now() };
    }
  });
});

// Evento disparado quando uma URL na aba é atualizada
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.url && changeInfo.url.startsWith('http')) {
      // Grava o tempo da URL anterior antes de atualizar
      recordTime(tabId, changeInfo.url);
      // Reinicia o contador para a nova URL
      activeTabs[tabId] = { startTime: Date.now() };
    }
});


// Cria um alarme para enviar os dados periodicamente (a cada 5 minutos)
chrome.alarms.create('sendData', { periodInMinutes: 5 });

// Escuta o alarme
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'sendData') {
    sendDataToServer();
  }
});