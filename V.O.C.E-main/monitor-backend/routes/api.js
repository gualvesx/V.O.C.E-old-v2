const express = require('express');
const router = express.Router();
const { pool } = require('../models/db'); 
const { requireLogin } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
// Certifique-se de que o classifier e o url-helper existem nesses caminhos na nova versão
const classifier = require('../classifier/python_classifier'); 
const { extractHostname } = require('../utils/url-helper');
const bcrypt = require('bcrypt'); // Necessário para a troca de senha

// ================================================================
//      APIs PROTEGIDAS DE GESTÃO E DADOS (SQL)
// ================================================================ 

// --- Override de Categoria ---
router.post('/override-category', requireLogin, async (req, res) => {
    const { url, newCategory } = req.body;
    const professorId = req.session.professorId;

    if (!url || !newCategory || newCategory.trim() === '') {
        return res.status(400).json({ error: 'URL e nova categoria são obrigatórios.' });
    }

    let hostname = '';
    try {
        hostname = extractHostname(url);
    } catch(e) {
         hostname = url.toLowerCase();
    }

    if (!hostname) return res.status(400).json({ error: 'URL inválida.' });

    try {
        const sql = `
            INSERT INTO category_overrides (hostname, category, updated_by_professor_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                category = VALUES(category),
                updated_by_professor_id = VALUES(updated_by_professor_id),
                updated_at = NOW();
        `;
        const values = [hostname, newCategory.trim(), professorId];
        const [result] = await pool.query(sql, values);

        if (result.affectedRows > 0 || result.warningStatus === 0) {
             res.json({ success: true, message: `Categoria para "${hostname}" atualizada para "${newCategory.trim()}".` });
        } else {
             res.status(500).json({ error: 'Não foi possível confirmar a alteração no banco de dados.' });
        }
    } catch (error) {
        console.error('Erro ao salvar override de categoria:', error);
        res.status(500).json({ error: 'Erro interno ao salvar a regra de categoria.' });
    }
});

// --- Gestão de Turmas ---

// Criar Turma
router.post('/classes', requireLogin, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Nome da turma é obrigatório.' });
    const owner_id = req.session.professorId;
    const connection = await pool.getConnection(); 
    try {
        await connection.beginTransaction();
        const [classResult] = await connection.query('INSERT INTO classes (name, owner_id) VALUES (?, ?)', [name.trim(), owner_id]);
        const classId = classResult.insertId;
        await connection.query('INSERT INTO class_members (class_id, professor_id) VALUES (?, ?)', [classId, owner_id]);
        await connection.commit();
        res.status(201).json({ success: true, message: 'Turma criada com sucesso!', classId });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao criar turma:', error);
        res.status(500).json({ error: 'Erro interno ao criar turma.' });
    } finally {
        connection.release(); 
    }
});

// Editar Turma (ESTA ROTA ESTAVA FALTANDO)
router.post('/classes/:classId/edit', requireLogin, async (req, res) => {
    const { classId } = req.params;
    const { newName } = req.body;
    const professorId = req.session.professorId;

    if (!newName || newName.trim() === '') {
        return res.status(400).json({ error: 'O nome da turma não pode ser vazio.' });
    }

    try {
        const [rows] = await pool.query('SELECT owner_id FROM classes WHERE id = ?', [classId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Turma não encontrada.' });
        
        if (rows[0].owner_id !== professorId) {
            return res.status(403).json({ error: 'Apenas o dono pode editar o nome da turma.' });
        }

        await pool.query('UPDATE classes SET name = ? WHERE id = ?', [newName.trim(), classId]);
        res.json({ success: true, message: 'Nome da turma atualizado com sucesso!' });

    } catch (error) {
        console.error('Erro ao editar nome da turma:', error);
        res.status(500).json({ error: 'Erro interno ao editar a turma.' });
    }
});

// Deletar Turma
router.delete('/classes/:classId', requireLogin, async (req, res) => {
    const { classId } = req.params;
    const professorId = req.session.professorId;
    try {
        const [rows] = await pool.query('SELECT owner_id FROM classes WHERE id = ?', [classId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Turma não encontrada.' });
        if (rows[0].owner_id !== professorId) return res.status(403).json({ error: 'Apenas o dono pode remover a turma.' });

        await pool.query('DELETE FROM classes WHERE id = ?', [classId]);
        res.json({ success: true, message: 'Turma removida com sucesso!' });
    } catch (error) {
        console.error('Erro ao remover turma:', error);
        res.status(500).json({ error: 'Erro interno ao remover a turma.' });
    }
});

// Compartilhar Turma
router.post('/classes/:classId/share', requireLogin, async (req, res) => {
    const { classId } = req.params;
    const { professorId: professorToShareId } = req.body; 
    if (!professorToShareId) return res.status(400).json({ error: 'ID do professor para compartilhar é obrigatório.' });
    try {
        const [rows] = await pool.query('SELECT owner_id FROM classes WHERE id = ?', [classId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Turma não encontrada.' });
        if (rows[0].owner_id !== req.session.professorId) return res.status(403).json({ error: 'Apenas o dono pode compartilhar a turma.' });

        const [profExists] = await pool.query('SELECT id FROM professors WHERE id = ?', [professorToShareId]);
        if (profExists.length === 0) return res.status(404).json({ error: 'Professor a ser adicionado não encontrado.' });

        await pool.query('INSERT IGNORE INTO class_members (class_id, professor_id) VALUES (?, ?)', [classId, professorToShareId]);
        res.json({ success: true, message: 'Turma compartilhada com sucesso!' });
    } catch (error) {
        console.error("Erro ao compartilhar turma:", error);
        res.status(500).json({ error: 'Erro interno ao compartilhar turma.' });
    }
});

// Remover Membro da Turma
router.delete('/classes/:classId/remove-member/:professorId', requireLogin, async (req, res) => {
    const { classId, professorId: memberToRemoveId } = req.params; 
    if (!memberToRemoveId) return res.status(400).json({ error: 'ID do professor a remover é obrigatório.' });
    try {
        const [rows] = await pool.query('SELECT owner_id FROM classes WHERE id = ?', [classId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Turma não encontrada.' });
        const ownerId = rows[0].owner_id;
        if (ownerId !== req.session.professorId) return res.status(403).json({ error: 'Apenas o dono pode remover membros.' });
        if (ownerId == memberToRemoveId) return res.status(400).json({ error: 'O dono da turma não pode ser removido.' });

        const [result] = await pool.query('DELETE FROM class_members WHERE class_id = ? AND professor_id = ?', [classId, memberToRemoveId]);
        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Professor removido da turma!' });
        } else {
            res.status(404).json({ error: 'Professor não encontrado nesta turma.' });
        }
    } catch (error) {
        console.error("Erro ao remover membro da turma:", error);
        res.status(500).json({ error: 'Erro interno ao remover membro.' });
    }
});

// Listar Membros
router.get('/classes/:classId/members', requireLogin, async (req, res) => {
    try {
        const { classId } = req.params;
        const [isMember] = await pool.query('SELECT 1 FROM class_members WHERE class_id = ? AND professor_id = ?', [classId, req.session.professorId]);
        if (isMember.length === 0) return res.status(403).json({ error: 'Você não é membro desta turma.' });

        const [members] = await pool.query(`
            SELECT p.id, p.full_name, p.username, (c.owner_id = p.id) as isOwner
            FROM professors p
            JOIN class_members cm ON p.id = cm.professor_id
            JOIN classes c ON cm.class_id = c.id
            WHERE cm.class_id = ? ORDER BY p.full_name
        `, [classId]);
        const [rows] = await pool.query('SELECT owner_id FROM classes WHERE id = ?', [classId]);
        const isCurrentUserOwner = rows.length > 0 && rows[0].owner_id === req.session.professorId;
        res.json({ members, isCurrentUserOwner });
    } catch (error) {
        console.error("Erro ao buscar membros da turma:", error);
        res.status(500).json({ error: "Erro interno ao buscar membros." });
    }
});

// --- Gestão de Alunos ---

// Criar Aluno
router.post('/students', requireLogin, async (req, res) => {
    const { fullName, cpf, pc_id } = req.body;
    if (!fullName || fullName.trim() === '') return res.status(400).json({ error: 'Nome do aluno é obrigatório.' });
    const cleanCpf = cpf ? cpf.trim() : null;
    const cleanPcId = pc_id ? pc_id.trim() : null;
    try {
        const [result] = await pool.query('INSERT INTO students (full_name, cpf, pc_id) VALUES (?, ?, ?)', [fullName.trim(), cleanCpf || null, cleanPcId || null]);
        res.status(201).json({ success: true, student: { id: result.insertId, full_name: fullName.trim(), cpf: cleanCpf, pc_id: cleanPcId } });
    } catch (error) {
        console.error('Erro ao criar aluno:', error);
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ error: 'CPF ou ID do PC já cadastrado.' });
        }
        res.status(500).json({ error: 'Erro interno ao criar aluno.' });
    }
});

// Editar Aluno (ESTA ROTA ESTAVA FALTANDO)
router.post('/students/:studentId/edit', requireLogin, async (req, res) => {
    const { studentId } = req.params;
    const { fullName, cpf, pc_id } = req.body;

    if (!fullName || fullName.trim() === '') {
        return res.status(400).json({ error: 'Nome do aluno é obrigatório.' });
    }
    
    const cleanCpf = cpf ? cpf.trim() : null;
    const cleanPcId = pc_id ? pc_id.trim() : null;

    try {
        await pool.query(
            'UPDATE students SET full_name = ?, cpf = ?, pc_id = ? WHERE id = ?', 
            [fullName.trim(), cleanCpf || null, cleanPcId || null, studentId]
        );
        res.json({ success: true, message: 'Dados do aluno atualizados com sucesso!' });
    } catch (error) {
        console.error('Erro ao editar aluno:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'CPF ou ID do PC já cadastrado em outro aluno.' });
        }
        res.status(500).json({ error: 'Erro interno ao editar aluno.' });
    }
});

// Listar todos os alunos
router.get('/students/all', requireLogin, async (req, res) => {
    try {
        const [students] = await pool.query('SELECT * FROM students ORDER BY full_name');
        res.json(students);
    } catch (error) {
        console.error('Erro ao buscar todos os alunos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar alunos.' });
    }
});

// Listar alunos da turma
router.get('/classes/:classId/students', requireLogin, async (req, res) => {
    try {
        const { classId } = req.params;
        const [isMember] = await pool.query('SELECT 1 FROM class_members WHERE class_id = ? AND professor_id = ?', [classId, req.session.professorId]);
        if (isMember.length === 0) return res.status(403).json({ error: 'Você não tem permissão para ver os alunos desta turma.' });

        const [students] = await pool.query(`
            SELECT s.* FROM students s
            JOIN class_students cs ON s.id = cs.student_id
            WHERE cs.class_id = ? ORDER BY s.full_name
        `, [classId]);
        res.json(students);
    } catch (error) {
        console.error('Erro ao buscar alunos da turma:', error);
        res.status(500).json({ error: 'Erro interno ao buscar alunos da turma.' });
    }
});

// Adicionar Aluno à Turma
router.post('/classes/:classId/add-student', requireLogin, async (req, res) => {
    const { classId } = req.params;
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'ID do aluno é obrigatório.' });
    try {
        const [isMember] = await pool.query('SELECT 1 FROM class_members WHERE class_id = ? AND professor_id = ?', [classId, req.session.professorId]);
        if (isMember.length === 0) return res.status(403).json({ error: 'Você não tem permissão para adicionar alunos a esta turma.' });

         const [studentExists] = await pool.query('SELECT id FROM students WHERE id = ?', [studentId]);
         if (studentExists.length === 0) return res.status(404).json({ error: 'Aluno não encontrado.' });

        await pool.query('INSERT IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)', [classId, studentId]);
        res.json({ success: true, message: 'Aluno adicionado à turma!' });
    } catch (error) {
        console.error('Erro ao adicionar aluno à turma:', error);
        res.status(500).json({ error: 'Erro interno ao associar aluno.' });
    }
});

// Remover Aluno da Turma
router.delete('/classes/:classId/remove-student/:studentId', requireLogin, async (req, res) => {
    const { classId, studentId } = req.params;
    try {
        const [isMember] = await pool.query('SELECT 1 FROM class_members WHERE class_id = ? AND professor_id = ?', [classId, req.session.professorId]);
        if (isMember.length === 0) return res.status(403).json({ error: 'Você não tem permissão para remover alunos desta turma.' });

        const [result] = await pool.query('DELETE FROM class_students WHERE class_id = ? AND student_id = ?', [classId, studentId]);
        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Aluno removido da turma!' });
        } else {
             res.status(404).json({ error: 'Aluno não encontrado nesta turma.' });
        }
    } catch (error) {
        console.error('Erro ao remover aluno da turma:', error);
        res.status(500).json({ error: 'Erro interno ao remover aluno.' });
    }
});

// --- Listagem de Professores ---
router.get('/professors/list', requireLogin, async (req, res) => {
    try {
        const [professors] = await pool.query('SELECT id, full_name, username, email FROM professors WHERE id != ? ORDER BY full_name', [req.session.professorId]);
        res.json(professors);
    } catch (error) {
        console.error("Erro ao listar professores:", error);
        res.status(500).json({ error: 'Erro interno ao buscar professores.' });
    }
});

// --- Alteração de Senha (ESTA ROTA ESTAVA FALTANDO) ---
router.post('/change-password', requireLogin, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const professorId = req.session.professorId;

    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'A nova senha deve ter pelo menos 6 caracteres.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'A nova senha e a confirmação não coincidem.' });
    if (newPassword === currentPassword) return res.status(400).json({ success: false, message: 'A nova senha não pode ser igual à senha atual.' });

    try {
        const [rows] = await pool.query('SELECT password_hash FROM professors WHERE id = ?', [professorId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });

        const currentHashedPassword = rows[0].password_hash;
        const isMatch = await bcrypt.compare(currentPassword, currentHashedPassword);

        if (!isMatch) return res.status(401).json({ success: false, message: 'A senha atual está incorreta.' });

        const newHashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE professors SET password_hash = ? WHERE id = ?', [newHashedPassword, professorId]);

        res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor ao tentar alterar a senha.' });
    }
});

// --- Dados para Dashboard e Alertas ---

router.get('/data', requireLogin, async (req, res) => {
    try {
        const targetDate = req.query.date || new Date().toISOString().split('T')[0];
        const classId = req.query.classId; 
        
        // 1. Query de Logs (Detalhada)
        let query = `
            SELECT l.id as log_id, l.aluno_id, l.url, l.duration, 
                   l.categoria as original_category, l.timestamp, 
                   s.full_name as student_name
            FROM logs l 
            LEFT JOIN students s ON l.aluno_id = s.pc_id OR l.aluno_id = s.cpf
        `;
        
        const params = [targetDate];
        
        if (classId && classId !== 'null') {
            query += ` INNER JOIN class_students cs ON s.id = cs.student_id WHERE cs.class_id = ? AND DATE(l.timestamp) = ?`;
            params.unshift(classId); 
        } else {
            query += ` WHERE DATE(l.timestamp) = ?`;
        }
        query += ` ORDER BY l.timestamp DESC`;

        const [rawLogsData] = await pool.query(query, params);

        // 2. Processar Overrides e Categorias
        const uniqueHostnames = [...new Set(rawLogsData.map(log => extractHostname(log.url)).filter(Boolean))];
        let overrideMap = {};
        if (uniqueHostnames.length > 0) {
            const [overrideRows] = await pool.query('SELECT hostname, category FROM category_overrides WHERE hostname IN (?)', [uniqueHostnames]);
            overrideMap = overrideRows.reduce((map, row) => { map[row.hostname] = row.category; return map; }, {});
        }

        const finalLogs = rawLogsData.map(log => {
            const hostname = extractHostname(log.url);
            const overriddenCategory = overrideMap[hostname];
            const finalCategory = overriddenCategory !== undefined ? overriddenCategory : (log.original_category || 'Não Categorizado');
            return { ...log, categoria: finalCategory };
        });

        // 3. Calcular Alertas (COM NORMALIZAÇÃO DE ID)
        const redAlerts = new Set();
        const blueAlerts = new Set();

        finalLogs.forEach(log => {
            if (!log.aluno_id) return;
            const normalizedId = String(log.aluno_id).trim().toLowerCase(); // Normaliza para evitar erro
            
            if (['Rede Social', 'Streaming & Jogos'].includes(log.categoria)) {
                redAlerts.add(normalizedId);
            }
            if (log.categoria === 'IA') {
                blueAlerts.add(normalizedId);
            }
        });

        // 4. Query de Resumo (Summary)
        const [summary] = await pool.query(`
            SELECT s.full_name as student_name, COALESCE(s.pc_id, s.cpf) as aluno_id, 
                   COALESCE(SUM(CASE WHEN DATE(l.timestamp) = ? THEN l.duration ELSE 0 END), 0) as total_duration, 
                   COALESCE(SUM(CASE WHEN DATE(l.timestamp) = ? THEN 1 ELSE 0 END), 0) as log_count, 
                   MAX(CASE WHEN DATE(l.timestamp) = ? THEN l.timestamp ELSE NULL END) as last_activity
             FROM students s 
             LEFT JOIN logs l ON (s.pc_id = l.aluno_id OR s.cpf = l.aluno_id) AND DATE(l.timestamp) = ?
             GROUP BY s.id, s.full_name, s.pc_id, s.cpf
             ORDER BY MAX(CASE WHEN DATE(l.timestamp) = ? THEN l.timestamp ELSE NULL END) IS NULL ASC, 
                      MAX(CASE WHEN DATE(l.timestamp) = ? THEN l.timestamp ELSE NULL END) DESC, s.full_name ASC
        `, [targetDate, targetDate, targetDate, targetDate, targetDate, targetDate]);

        // 5. Unir Alertas ao Resumo
        const finalSummary = summary.map(s => {
            const id = s.aluno_id ? String(s.aluno_id).trim().toLowerCase() : '';
            return {
                ...s,
                has_red_alert: redAlerts.has(id),
                has_blue_alert: blueAlerts.has(id)
            };
        });

        res.json({ logs: finalLogs, summary: finalSummary });

    } catch (err) {
        console.error('ERRO na rota /api/data:', err);
        res.status(500).json({ error: 'Erro interno ao buscar dados.' });
    }
});

router.get('/alerts/:alunoId/:type', requireLogin, async (req, res) => {
    const alunoId = decodeURIComponent(req.params.alunoId);
    const { type } = req.params;
    let categories;
    if (type === 'red') categories = ['Rede Social', 'Streaming & Jogos'];
    else if (type === 'blue') categories = ['IA'];
    else return res.status(400).json({ error: 'Tipo de alerta inválido.' });

    try {
        const [logs] = await pool.query(
            'SELECT * FROM logs WHERE aluno_id = ? AND categoria IN (?) ORDER BY timestamp DESC',
            [alunoId, categories]
        );
        res.json(logs);
    } catch (err) {
        console.error('ERRO na rota /api/alerts/:alunoId:', err);
        res.status(500).json({ error: 'Erro interno ao buscar logs de alerta.' });
    }
});

// ================================================================
//      RELATÓRIO PDF (CONTRASTE INTELIGENTE)
// ================================================================

router.get('/download-report/:date', requireLogin, async (req, res) => {
    try {
        const dateStr = req.params.date; 
        const requestedDate = new Date(dateStr + 'T00:00:00'); 
        if (isNaN(requestedDate.getTime())) return res.status(400).send('Data inválida.');

        // 1. Busca Dados
        const [students] = await pool.query('SELECT full_name, cpf, pc_id FROM students');
        const studentNameMap = new Map();
        students.forEach(s => {
            if (s.pc_id) studentNameMap.set(s.pc_id, s.full_name);
            if (s.cpf) studentNameMap.set(s.cpf, s.full_name);
        });

        // 2. Configurações
        const IMPROPER_CATEGORIES = ['Rede Social', 'Streaming', 'Jogos', 'Streaming & Jogos', 'Loja Digital', 'Anime', 'Musica', 'Outros'];
        const colors = { 
            primary: '#B91C1C',    danger: '#DC2626',     success: '#16A34A', 
            secondary: '#1F2937',  accent: '#F3F4F6',     text: '#374151', muted: '#9CA3AF'
        };

        // 3. Coleta de Dados
        const today = new Date(); today.setHours(0,0,0,0);
        const requestedDateOnly = new Date(requestedDate);
        let aggregatedData = {};
        let dataSource = '';
        let foundData = false;

        if (requestedDateOnly.getTime() === today.getTime()) {
            dataSource = 'Monitoramento em Tempo Real';
            const [logsResult] = await pool.query(
                `SELECT aluno_id, url, categoria, SUM(duration) as total_duration, COUNT(*) as count
                 FROM logs WHERE DATE(timestamp) = ? GROUP BY aluno_id, url, categoria`, [dateStr]);
            if (logsResult.length > 0) {
                 foundData = true;
                 logsResult.forEach(row => {
                    if (!aggregatedData[row.aluno_id]) aggregatedData[row.aluno_id] = {};
                    aggregatedData[row.aluno_id][row.url] = { total_duration: row.total_duration, count: row.count, category: row.categoria };
                 });
            }
        } else {
            dataSource = 'Histórico Arquivado';
            const [rows] = await pool.query('SELECT aluno_id, daily_logs FROM old_logs WHERE archive_date = ?', [dateStr]);
            if (rows.length > 0) {
                foundData = true;
                rows.forEach(row => {
                    try { aggregatedData[row.aluno_id] = typeof row.daily_logs === 'string' ? JSON.parse(row.daily_logs) : row.daily_logs; } catch (e) {}
                });
            }
        }

        if (!foundData) return res.status(404).send(`Nenhum dado encontrado para ${dateStr}.`);

        // --- GERAÇÃO DO PDF ---
        const PDFDocument = require('pdfkit'); // Garantindo require
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const filename = `Relatorio_VOCE_${dateStr}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        const drawHeader = () => {
            doc.rect(0, 0, 595.28, 80).fill(colors.primary);
            doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('Relatório de Monitoramento', 40, 25);
            doc.fontSize(10).font('Helvetica').text(`Gerado via V.O.C.E | ${dataSource}`, 40, 55);
            doc.fontSize(14).text(requestedDate.toLocaleDateString('pt-BR'), 450, 25, { align: 'right' });
            doc.moveDown(4);
        };
        const formatMinutes = (s) => `${(s/60).toFixed(1)} min`;

        drawHeader();

        // --- Resumo Geral ---
        let totalStudents = Object.keys(aggregatedData).length;
        let grandTotalTime = 0, grandImproperTime = 0;
        let topSiteOverall = { url: '-', duration: 0 };
        let siteMapGlobal = {};

        for (const uid in aggregatedData) {
            for (const url in aggregatedData[uid]) {
                const item = aggregatedData[uid][url];
                grandTotalTime += item.total_duration;
                if (IMPROPER_CATEGORIES.includes(item.category)) grandImproperTime += item.total_duration;
                siteMapGlobal[url] = (siteMapGlobal[url] || 0) + item.total_duration;
                if (siteMapGlobal[url] > topSiteOverall.duration) topSiteOverall = { url: url, duration: siteMapGlobal[url] };
            }
        }

        doc.fillColor(colors.secondary).fontSize(16).font('Helvetica-Bold').text('Resumo da Turma');
        doc.moveDown(0.5);
        const summaryY = doc.y;
        
        const drawCard = (x, title, value, valColor=colors.primary, note='') => {
            doc.roundedRect(x, summaryY, 120, 60, 5).fill(colors.accent);
            if(note) doc.roundedRect(x, summaryY, 120, 60, 5).fill('#FEF2F2');
            doc.fillColor(valColor).fontSize(16).text(value, x+10, summaryY+15, {width: 100, align:'center'});
            doc.fillColor(colors.text).fontSize(8).font('Helvetica').text(title, x+10, summaryY+40, {width: 100, align:'center'});
        };

        drawCard(40, 'Alunos Ativos', totalStudents);
        drawCard(170, 'Tempo Total', formatMinutes(grandTotalTime), colors.secondary);
        drawCard(300, 'Tempo em Distração', formatMinutes(grandImproperTime), colors.danger, true);
        drawCard(430, 'Site Mais Acessado', topSiteOverall.url.substring(0,18), colors.secondary);

        doc.moveDown(5);

        // --- Detalhes por Aluno ---
        for (const alunoId in aggregatedData) {
            const displayName = studentNameMap.get(alunoId) || `ID: ${alunoId}`;
            const userLogs = aggregatedData[alunoId];
            
            if (doc.y > 650) { doc.addPage(); drawHeader(); }

            doc.rect(40, doc.y, 515, 25).fill('#E5E7EB');
            doc.fillColor(colors.secondary).fontSize(12).font('Helvetica-Bold').text(displayName, 50, doc.y - 18);
            doc.moveDown(0.5);

            const sortedSites = Object.entries(userLogs).map(([url, data]) => ({ url, ...data })).sort((a, b) => b.total_duration - a.total_duration);
            const top5 = sortedSites.slice(0, 5);
            const maxDuration = top5.length > 0 ? top5[0].total_duration : 1;

            const startY = doc.y;
            doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.text).text('Top 5 Sites (Visual)', 40, startY);
            
            // --- GRÁFICO INTELIGENTE ---
            let currentBarY = startY + 15;
            const chartWidth = 200;
            const barHeight = 15;

            top5.forEach((site) => {
                const barW = (site.total_duration / maxDuration) * chartWidth;
                const isImproper = IMPROPER_CATEGORIES.includes(site.category);
                const barColor = isImproper ? colors.danger : colors.secondary;
                
                // Fundo da barra
                doc.rect(40, currentBarY, chartWidth, barHeight).fill('#F3F4F6');
                // Barra de valor
                doc.rect(40, currentBarY, Math.max(barW, 2), barHeight).fill(barColor);
                
                // Texto do Site
                const urlText = site.url.substring(0, 28);
                const textWidth = doc.widthOfString(urlText);
                
                // LÓGICA DE CONTRASTE:
                // Se a barra for maior que o texto + margem, escreve DENTRO em BRANCO
                // Se não, escreve FORA em CINZA ESCURO
                if (barW > textWidth + 10) {
                    doc.fillColor('#FFFFFF').text(urlText, 45, currentBarY + 3);
                } else {
                    // Escreve logo após a barra
                    doc.fillColor(colors.text).text(urlText, 45 + Math.max(barW, 2) + 5, currentBarY + 3);
                }

                // Tempo (Fixo à direita)
                doc.fillColor(colors.muted).text(formatMinutes(site.total_duration), 40 + chartWidth + 10, currentBarY + 3);
                
                currentBarY += 23;
            });

            // --- TABELA ---
            const tableX = 320;
            const tableY = startY + 15;
            doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.text);
            doc.text('Site', tableX, startY);
            doc.text('Categoria', tableX + 110, startY);
            doc.text('Tempo', tableX + 190, startY);

            let rowY = tableY;
            sortedSites.slice(0, 10).forEach((site, i) => {
                const isImproper = IMPROPER_CATEGORIES.includes(site.category);
                if (i % 2 === 0) doc.rect(tableX - 2, rowY - 2, 235, 12).fill('#FAFAFA');
                
                if (isImproper) doc.fillColor(colors.danger).font('Helvetica-Bold');
                else doc.fillColor(colors.text).font('Helvetica');

                doc.fontSize(8);
                doc.text(site.url.substring(0, 20), tableX, rowY);
                doc.text((site.category||'Geral').substring(0, 12), tableX + 110, rowY);
                doc.text(formatMinutes(site.total_duration), tableX + 190, rowY);
                rowY += 12;
            });

            const sectionHeight = Math.max((top5.length * 23) + 20, (sortedSites.slice(0,10).length * 12) + 20);
            doc.y = startY + sectionHeight + 10;
            doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#E5E7EB').stroke();
            doc.moveDown(1);
        }

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor(colors.muted).text(`Página ${i + 1} de ${range.count}`, 0, doc.page.height - 30, { align: 'center' });
        }
        doc.end();

    } catch (error) {
        console.error('ERRO PDF:', error);
        if (!res.headersSent) res.status(500).send('Erro ao gerar relatório.');
    }
});

module.exports = router;