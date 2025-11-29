// ============================
// 🔍 MANIFEST DO FIREFOX
// ============================

// ============================
// 🔧 CONFIGURAÇÕES
// ============================

const BACKEND_URL = 'http://localhost:8081/api/public/logs';
const NATIVE_HOST = 'com.meutcc.monitor';

let activeTabs = {};
let dataBuffer = [];
let osUsername = 'Desconhecido';
let ready = false; // ⚠ só começa depois que o CPF chegar

const CPFregex = /^\d{11}$/;
const MAX_BATCH_SIZE = 200;


// ============================
// 🧠 PEGAR USERNAME DO SISTEMA
// ============================

async function getOSUsername() {
  try {
    const response = await browser.runtime.sendNativeMessage(NATIVE_HOST, {
      text: "get_username_request"
    });

    if (response?.status === "success") {
      osUsername = response.username?.trim() || "erro_script_host";
    } else {
      osUsername = "erro_script_host";
    }

  } catch (err) {
    osUsername = "erro_host_nao_encontrado";
  }

  // Só agora libera os eventos
  ready = true;

  // Logs
  if (CPFregex.test(osUsername)) {
    console.log("🎓 Usuário identificado como ALUNO:", osUsername);
  } else {
    console.log("👨‍🏫 Usuário identificado como PROFESSOR:", osUsername);
  }
}

getOSUsername();



// ============================
// 🚀 ENVIO COM BATCH
// ============================

async function sendBatch() {

  if (!ready) return; // espera o CPF chegar

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
      return;
    }

    console.log(`✔ Enviados ${batch.length} registros.`);

  } catch (e) {
    console.error("Erro ao enviar batch:", e);
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

  if (!ready) return; // SEM CPF → NÃO FAZ NADA

  if (!CPFregex.test(osUsername)) return; // professor não monitora

  const session = activeTabs[tabId];
  if (!session) return;

  const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);

  if (durationSeconds > 5) {
    const domain = new URL(url).hostname;

    dataBuffer.push({
      aluno_id: osUsername,
      url: domain,
      durationSeconds,
      timestamp: new Date().toISOString(),
    });

    console.log(`+ Registro armazenado (${domain} - ${durationSeconds}s)`);

    checkBatchSize();
  }
}



// ============================
// 🔄 TROCA DE ABA
// ============================

browser.tabs.onActivated.addListener(async (activeInfo) => {

  if (!ready) return;

  const prevId = Object.keys(activeTabs)[0];

  if (prevId) {
    try {
      const prevTab = await browser.tabs.get(parseInt(prevId));
      if (prevTab.url && prevTab.url.startsWith("http")) {
        recordTime(parseInt(prevId), prevTab.url);
      }
    } catch (e) {}

    delete activeTabs[prevId];
  }

  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.startsWith("http")) {
      activeTabs[tab.id] = { startTime: Date.now() };
    }
  } catch (error) {}

});



// ============================
// 🌐 URL MUDOU
// ============================

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

  if (!ready) return;

  if (tab.active && changeInfo.url && changeInfo.url.startsWith("http")) {
    recordTime(tabId, changeInfo.url);
    activeTabs[tabId] = { startTime: Date.now() };
  }
});



// ============================
// ⏱️ ENVIO PERIÓDICO
// ============================

browser.alarms.create("sendData", { periodInMinutes: 10 });

browser.alarms.onAlarm.addListener((alarm) => {
  if (!ready) return;

  if (alarm.name === "sendData") {
    sendBatch();
  }
});
