const express = require('express');
const router = express.Router();
const { pool } = require('../models/db');
const classifier = require('../classifier/python_classifier');
const { extractHostname } = require('../utils/url-helper');

// ================================================================
//      FUNÇÕES AUXILIARES (REGRA DE NEGÓCIO)
// ================================================================

/**
 * Classificação Rápida por Regex (Heurística)
 * Detecta padrões óbvios para economizar processamento da IA e evitar erros simples.
 */
function fastCategorization(url) {
    const u = url.toLowerCase();
    
    // --- CORREÇÃO: IPs e Localhost agora são 'Produtividade & Ferramentas' ---
    // Detecta localhost puro ou com porta
    if (u.startsWith('localhost') || u.includes('127.0.0.1')) return 'Produtividade & Ferramentas';
    
    // Detecta endereços IP (ex: 192.168.0.1, 10.0.0.5)
    if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(u)) return 'Produtividade & Ferramentas';
    // --- FIM DA CORREÇÃO ---

    // Governo e Militar
    if (u.includes('.gov.br') || u.includes('.jus.br') || u.includes('.mil.br')) return 'Governo';
    
    // Educação
    if (u.includes('.edu.br') || u.includes('ava.') || u.includes('moodle') || u.includes('portal.senai') || u.includes('sp.senai')) return 'Produtividade & Ferramentas';
    
    // Lojas
    if (u.includes('shop') || u.includes('store') || u.includes('loja.') || u.includes('vendas.')) return 'Loja Digital';
    
    // Redes Sociais comuns (Regex simples para agilidade)
    if (u.includes('tiktok.') || u.includes('instagram.') || u.includes('facebook.') || u.includes('twitter.') || u.includes('x.com')) return 'Rede Social';

    return null; 
}
// ================================================================
//      APIs PÚBLICAS (SEM AUTENTICAÇÃO - EXTENSÃO CHAMA AQUI)
// ================================================================

// --- Coleta de Logs ---
router.post('/logs', async (req, res) => {
    const logs = Array.isArray(req.body) ? req.body : [req.body];
    const io = req.io; // O io é injetado pelo middleware no arquivo principal
    
    if (!logs || logs.length === 0) return res.status(400).send('Nenhum log recebido.');

    try {
        // 1. Obter hostnames únicos para buscar overrides no banco
        const uniqueHostnames = [...new Set(logs.map(log => {
            try { return new URL(`http://${log.url}`).hostname.toLowerCase(); }
            catch (e) { return log.url.toLowerCase(); }
        }).filter(Boolean))];

        let overrides = {};
        if (uniqueHostnames.length > 0) {
            const [overrideRows] = await pool.query(
                'SELECT hostname, category FROM category_overrides WHERE hostname IN (?)', 
                [uniqueHostnames]
            );
            overrides = overrideRows.reduce((map, row) => { map[row.hostname] = row.category; return map; }, {});
        }

        // 2. Processar cada log e definir a categoria final
        const values = await Promise.all(logs.map(async log => {
            let category = 'Não Categorizado';
            let hostname = '';
            
            try { 
                hostname = extractHostname(log.url); 
            } catch(e) { 
                hostname = log.url.toLowerCase(); 
            }

            // --- FLUXO DE DECISÃO HÍBRIDO ---

            // A. Existe regra manual do professor? (Prioridade Máxima)
            if (overrides[hostname]) {
                category = overrides[hostname];
            } 
            // B. Existe regra óbvia de padrão? (Regex Rápido)
            else {
                const fastCat = fastCategorization(log.url);
                if (fastCat) {
                    category = fastCat;
                }
                // C. Se não sabe, pergunta para a IA (Último Recurso)
                else if (log.url) {
                    try {
                        category = await classifier.categorizar(log.url);
                    } catch (classifierError) {
                        console.error(`Erro ao classificar URL ${log.url}:`, classifierError);
                        // Em caso de erro da IA, mantém 'Não Categorizado'
                    }
                }
            }

            return [ 
                log.aluno_id, 
                log.url || '', 
                log.durationSeconds || 0, 
                category, 
                new Date(log.timestamp || Date.now()) 
            ];
        }));

        // 3. Inserir no Banco de Dados
        if (values.length > 0) await pool.query(
            'INSERT INTO logs (aluno_id, url, duration, categoria, timestamp) VALUES ?', [values]
        );

        // 4. Preparar dados para o Dashboard em Tempo Real (Socket.IO)
        const categoryCounts = {};
        values.forEach(([aluno_id, url, duration, categoria]) => {
            categoryCounts[categoria] = (categoryCounts[categoria] || 0) + 1;
        });

        if (io) {
            // Busca nomes dos alunos para enriquecer o evento do socket
            const studentIds = [...new Set(values.map(v => v[0]))];
            let studentMap = new Map();
            
            if (studentIds.length > 0) {
                const [students] = await pool.query(
                    'SELECT full_name, cpf, pc_id FROM students WHERE cpf IN (?) OR pc_id IN (?)', 
                    [studentIds, studentIds]
                );
                students.forEach(s => {
                    if (s.pc_id) studentMap.set(s.pc_id, s.full_name);
                    if (s.cpf) studentMap.set(s.cpf, s.full_name);
                });
            }
            
            // Emite o evento para atualizar a tela do professor
            io.emit('logs_updated', { 
                count: values.length,
                categoryCounts,
                logs: values.map(([aluno_id, url, duration, categoria, timestamp]) => ({ 
                    aluno_id, 
                    url, 
                    duration, 
                    categoria, 
                    timestamp,
                    student_name: studentMap.get(aluno_id) || null
                })) 
            });
        }   

        res.status(200).send('Logs salvos com sucesso.');

    } catch (error) {
        console.error('Erro ao salvar logs:', error);
        res.status(500).send('Erro interno ao processar os logs.');
    }
});

module.exports = router;