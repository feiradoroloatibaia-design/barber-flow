const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuração de CORS - Liberando o acesso para o seu Netlify
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://famous-taiyaki-ec420a.netlify.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Importação das rotas (ajuste o caminho conforme sua estrutura se necessário)
const routes = require('./src/routes'); 
app.use(routes);

// Servir arquivos estáticos se necessário
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
