// ================================================================
//                       IMPORTS E CONFIGURAÇÃO INICIAL
// ================================================================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const { requireLogin } = require('./middlewares/auth.js')

// Módulos de Rotas (ADICIONADO RECENTEMENTE)
const apiRoutes = require('./routes/api.js');
const publicApiRoutes = require('./routes/public_api.js')
const viewRoutes = require('./routes/views.js'); 

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const port = process.env.PORT || 8081;

// ================================================================
//                       CONFIGURAÇÃO DO EXPRESS
// ================================================================
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'chave-secreta-para-a-versao-oficial-do-tcc',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // 1 dia
}));


// ================================================================
//                       APLICAÇÃO DAS ROTAS
// ================================================================
// Middleware global — TODAS as rotas terão acesso a req.io
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Rotas públicas
app.use('/api/public', publicApiRoutes);

// Rotas protegidas
app.use(['/api', '/dashboard'], requireLogin);

// Rotas privadas de API
app.use('/api', apiRoutes);

// Registra as rotas normais
app.use('/', viewRoutes);  
// ================================================================
//                       TRATAMENTO DE ERROS E INICIALIZAÇÃO
// ================================================================

// Rota de fallback para erro 404
app.use((req, res) => res.status(404).render('error404'));

// Middleware CENTRALIZADO para tratamento de erros 500
app.use((err, req, res, next) => {
    console.error('ERRO CENTRALIZADO NO BACKEND:', err.stack);
    // Para APIs, retorna JSON; para views, renderiza erro ou redireciona
    if (req.originalUrl.startsWith('/api')) {
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    } else {
        res.status(500).send("Erro interno ao processar a requisição.");
    }
});


app.set('socketio', io);  // OBRIGATÓRIO

io.on('connection', (socket) => {
    console.log("🔥 Socket conectado!", socket.id);
});
 
server.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://${getLocalIP()}:${port}`);
});

function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (let iface in interfaces) {
      for (let i of interfaces[iface]) {
        if (i.family === 'IPv4' && !i.internal) return i.address;
      }
    }
    return 'localhost';
  }