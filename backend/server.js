const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Подключаем маршруты (один раз, не дублируем!)
const authRoutes = require('./server/auth');
const itemsRoutes = require('./server/items');
const receiptsRoutes = require('./server/receipts');
const issuesRoutes = require('./server/issues');
const inventoryRoutes = require('./server/inventory');
const adminRoutes = require('./server/admin');

// Регистрируем роуты (ВСЕ пути будут с префиксом /api)
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`📍 API доступен по адресу: http://localhost:${PORT}/api`);
});