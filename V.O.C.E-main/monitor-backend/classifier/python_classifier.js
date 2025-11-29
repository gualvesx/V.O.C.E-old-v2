// ================================================================
//                            Orquestrador de Classificação - V.O.C.E TCC
// ================================================================

const { spawn } = require('child_process');
const path = require('path');
const simpleClassifier = require('./simple_classifier.js');

const classifier = {
  categorizar: async function(domain) {
    const simpleResult = await simpleClassifier.categorizar(domain);
    if (simpleResult !== 'Outros') {
      console.log(`[Classificador Simples] Sucesso: ${domain} -> ${simpleResult}`);
      return simpleResult;
    }

    console.log(`[IA Python] Acionando IA (Modelo Final Híbrido) para '${domain}'...`);
    
    return new Promise((resolve) => {
      // [MUDANÇA] Agora chama o script de previsão final
      const scriptPath = path.join(__dirname, '..', 'classifier-tf', 'cnn', 'predict_cnn.py');
      const pythonProcess = spawn('python', [scriptPath, domain]);
      let resultJson = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => { resultJson += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

      pythonProcess.on('close', (code) => {
        if (code === 0 && resultJson.trim() !== '') {
          try {
            const resultData = JSON.parse(resultJson);
            if(resultData.category) {
                console.log(`[IA Python] Sucesso: ${domain} -> ${resultData.category} (Confiança: ${resultData.confidence.toFixed(2)})`);
                resolve(resultData.category);
            } else {
                console.error(`[IA Python] Script retornou um erro para '${domain}':`, resultData.error);
                resolve('Outros');
            }
          } catch (e) {
            console.error(`[IA Python] Falha ao parsear o JSON de resposta para '${domain}':`, e, `Raw: ${resultJson}`);
            resolve('Outros');
          }
        } else {
          console.error(`[IA Python] Falha ao classificar '${domain}':`, error);
          resolve('Outros');
        }
      });
      pythonProcess.on('error', (err) => {
        console.error(`[IA Python] Erro crítico ao iniciar o processo para '${domain}':`, err);
        resolve('Outros');
      });
    });
  }
};

module.exports = classifier;

