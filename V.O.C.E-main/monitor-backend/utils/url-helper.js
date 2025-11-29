/**
 * Extrai o hostname de uma URL de forma consistente
 * @param {string} urlString - A URL a ser processada
 * @returns {string} - O hostname em minúsculas ou a URL original em caso de erro
 */
function extractHostname(urlString) {
    if (!urlString) return '';
    
    try {
        // Verifica se já tem protocolo
        const hasProtocol = urlString.startsWith('http://' ) || urlString.startsWith('https://' );
        const fullUrl = hasProtocol ? urlString : `http://${urlString}`;
        
        return new URL(fullUrl ).hostname.toLowerCase();
    } catch (e) {
        // Em caso de erro, retorna a string original em minúsculas
        console.warn(`Falha ao extrair hostname de: ${urlString}`, e.message);
        return urlString.toLowerCase();
    }
}

module.exports = { extractHostname };