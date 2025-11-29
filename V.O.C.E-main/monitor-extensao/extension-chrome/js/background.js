// ============================
// 🔍 MANIFEST DO CHROME 
// ============================

// ============================
// 🔧 CONFIGURAÇÕES
// ============================

const BACKEND_URL = 'http://localhost:8081/api/public/logs';
const NATIVE_HOST = 'com.meutcc.monitor';

let activeTabs = {};
let dataBuffer = [];
let osUsername = 'Desconhecido';
const CPFregex = /^\d{11}$/;
const MAX_BATCH_SIZE = 200;


// ==============================
// 🧠 PEGAR USERNAME DO SISTEMA
// ==============================

function getOSUsername() {

  chrome.runtime.sendNativeMessage(NATIVE_HOST, { text: "get_username_request" }, (response) => {

    if (chrome.runtime.lastError) {
      osUsername = 'erro_host_nao_encontrado';
      console.log("⚠️ Não foi possível obter username do sistema.");
      return;
    }

    if (response?.status === 'success') {
      osUsername = response.username;
    } else {
      osUsername = 'erro_script_host';
    }

    // Logs
    if (!CPFregex.test(osUsername)) {
      console.log("👨‍🏫 Usuário identificado como PROFESSOR. Monitoração desativada.");
    } else {
      console.log("🎓 Usuário identificado como ALUNO. Monitoração ativa.");
    }
  });
}

getOSUsername();



// ============================
// 🚀 ENVIO COM BATCH
// ============================

async function sendBatch() {

  if (!CPFregex.test(osUsername)) {
    console.log("⛔ Professor detectado — bloqueando envio.");
    dataBuffer = [];
    return;
  }

  if (dataBuffer.length === 0) return;

  const batch = [...dataBuffer];
  dataBuffer = [];

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch)
    });

    if (!res.ok) {
      console.error("Falha ao enviar batch:", res.status);
      dataBuffer.push(...batch);
    } else {
      console.log(`✔ Enviados ${batch.length} registros.`);
    }

  } catch (err) {
    console.error("Erro ao enviar batch:", err);
    dataBuffer.push(...batch);
  }
}

function checkBatchSize() {
  if (dataBuffer.length >= MAX_BATCH_SIZE) {
    console.log(`⚡ Buffer cheio (${dataBuffer.length}). Enviando agora...`);
    sendBatch();
  }
}



// ============================
// 📌 REGISTRO DE TEMPO
// ============================

function recordTime(tabId, url) {

  if (!CPFregex.test(osUsername)) return;

  const session = activeTabs[tabId];
  if (!session) return;

  const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);

  if (durationSeconds > 5) {
    const domain = new URL(url).hostname;

    dataBuffer.push({
      aluno_id: osUsername,
      url: domain,
      durationSeconds,
      timestamp: new Date().toISOString()
    });

    console.log(`+ Registro armazenado (${domain} - ${durationSeconds}s)`);

    checkBatchSize();
  }
}



// ============================
// 🔄 EVENTOS DE TROCA DE ABA
// ============================

chrome.tabs.onActivated.addListener((activeInfo) => {

  const prevId = Object.keys(activeTabs)[0];

  if (prevId) {
    chrome.tabs.get(parseInt(prevId), (prevTab) => {
      if (prevTab && prevTab.url && prevTab.url.startsWith("http")) {
        recordTime(parseInt(prevId), prevTab.url);
      }
      delete activeTabs[prevId];
    });
  }

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url && tab.url.startsWith("http")) {
      activeTabs[tab.id] = { startTime: Date.now() };
    }
  });

});



// ============================
// 🌐 URL mudou
// ============================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

  if (tab.active && changeInfo.url && changeInfo.url.startsWith("http")) {
    recordTime(tabId, changeInfo.url);
    activeTabs[tabId] = { startTime: Date.now() };
  }

});



// ============================
// ⏱️ ENVIO PERIÓDICO
// ============================

chrome.alarms.create("sendData", { periodInMinutes: 10 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sendData") {
    sendBatch();
  }
});
