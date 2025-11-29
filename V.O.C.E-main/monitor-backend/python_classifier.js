// python_classifier.js
const { spawn } = require('child_process');
const path = require('path');

const classifier = {
  categorizar: function(domain) {
    // Retorna uma Promise, pois a execução do script Python é assíncrona
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'classifier-tf', 'predict.py');

      // Inicia o processo Python, passando o script e o domínio como argumentos
      const pythonProcess = spawn('python', [scriptPath, domain]);

      let result = '';
      let error = '';

      // Captura a saída do script Python (o nome da categoria)
      pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
      });

      // Captura qualquer erro que o script Python possa gerar
      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      // Quando o processo terminar, resolve ou rejeita a Promise
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Erro no script Python (código ${code}):`, error);
          return resolve('Erro de Classificação'); // Retorna uma categoria de erro
        }
        resolve(result.trim());
      });
    });
  }
};

module.exports = classifier;