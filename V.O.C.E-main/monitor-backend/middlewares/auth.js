// Middleware para verificar login do professor
const requireLogin = (req, res, next) => {
    // exceção: /api/logs pode passar sem login
    if (req.originalUrl.startsWith('/api/logs')) {
        return next();
    }
      
    // se não tiver sessão OU não tiver professor logado
    if (!req.session || !req.session.professorId) {
        if (req.path.startsWith('/api')) {
            return res.status(401).json({ message: 'Não autenticado' });
          }

        return res.redirect('/login');
    }
  
    // se passou nas verificações, continua
    next();
  };
  
  module.exports = { requireLogin };