const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'WAREHOUSE_SECRET_JWT_KEY';
const DATA_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(bodyParser.json());

const initialData = {
    users: [
        { id: 1, username: "admin", password: bcrypt.hashSync("admin", 8), fullname: "Администратор", role: "admin" },
        { id: 2, username: "ivan", password: bcrypt.hashSync("111", 8), fullname: "Иван Кладовщиков", role: "storekeeper" },
        { id: 3, username: "petrov", password: bcrypt.hashSync("222", 8), fullname: "Пётр Менеджеров", role: "manager" },
        { id: 4, username: "sidorov", password: bcrypt.hashSync("333", 8), fullname: "Сидор Аналитиков", role: "analyst" }
    ],
    items: [
        { item_code: "Т001", name: "Деталь X1", uom: "шт" },
        { item_code: "Т002", name: "Деталь X2", uom: "шт" },
        { item_code: "Т003", name: "Упаковка", uom: "кор" },
        { item_code: "Т004", name: "Смазка", uom: "л" },
        { item_code: "Т005", name: "Инструмент", uom: "шт" }
    ],
    receipts: [],
    issues: [],
    stockExpected: [],
    nextDocIdReceipt: 100,
    nextDocIdIssue: 200
};

function readDB() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (e) {
        return initialData;
    }
}

function writeDB(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Доступ запрещен" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Недействительный токен" });
        req.user = user;
        next();
    });
}

// --- AUTH ---
app.post('/api/auth/register', (req, res) => {
    const { username, password, fullname, role } = req.body;
    const db = readDB();
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ message: "Логин уже занят" });
    }
    const newUser = {
        id: Math.max(...db.users.map(u => u.id), 0) + 1,
        username,
        password: bcrypt.hashSync(password, 8),
        fullname: fullname || username,
        role: role || 'storekeeper'
    };
    db.users.push(newUser);
    writeDB(db);
    res.status(201).json({ message: "Успешная регистрация" });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return res.status(404).json({ message: "Пользователь не найден" });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ message: "Неверный пароль" });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: 86400 });
    res.json({ token, user: { id: user.id, username: user.username, fullname: user.fullname, role: user.role } });
});

// --- ITEMS ---
app.get('/api/items', authenticateToken, (req, res) => {
    res.json(readDB().items);
});

app.post('/api/items', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ message: "Нет прав" });
    const { item_code, name, uom } = req.body;
    const db = readDB();
    if (db.items.find(i => i.item_code === item_code)) return res.status(400).json({ message: "Код уже существует" });
    db.items.push({ item_code, name, uom });
    writeDB(db);
    res.status(201).json({ message: "Товар добавлен" });
});

app.delete('/api/items/:code', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ message: "Нет прав" });
    const code = req.params.code;
    const db = readDB();
    db.items = db.items.filter(i => i.item_code !== code);
    db.receipts = db.receipts.filter(r => r.item_code !== code);
    db.issues = db.issues.filter(i => i.item_code !== code);
    db.stockExpected = db.stockExpected.filter(e => e.item_code !== code);
    writeDB(db);
    res.json({ message: "Товар удален" });
});

// --- MOVEMENTS ---
app.get('/api/receipts', authenticateToken, (req, res) => res.json(readDB().receipts));
app.get('/api/issues', authenticateToken, (req, res) => res.json(readDB().issues));

app.post('/api/receipts', authenticateToken, (req, res) => {
    const { item_code, qty, date } = req.body;
    const db = readDB();
    const newDoc = { doc_id: db.nextDocIdReceipt++, item_code, qty, date };
    db.receipts.push(newDoc);
    writeDB(db);
    res.status(201).json(newDoc);
});

app.post('/api/issues', authenticateToken, (req, res) => {
    const { item_code, qty, date } = req.body;
    const db = readDB();
    const rSum = db.receipts.filter(r => r.item_code === item_code && r.date <= date).reduce((a, b) => a + b.qty, 0);
    const iSum = db.issues.filter(i => i.item_code === item_code && i.date <= date).reduce((a, b) => a + b.qty, 0);
    if ((rSum - iSum) < qty) return res.status(400).json({ message: "Недостаточно остатка на складе" });

    const newDoc = { doc_id: db.nextDocIdIssue++, item_code, qty, date };
    db.issues.push(newDoc);
    writeDB(db);
    res.status(201).json(newDoc);
});

app.delete('/api/receipts/:id', authenticateToken, (req, res) => {
    const db = readDB();
    db.receipts = db.receipts.filter(r => r.doc_id !== parseInt(req.params.id));
    writeDB(db);
    res.json({ message: "Удалено" });
});

app.delete('/api/issues/:id', authenticateToken, (req, res) => {
    const db = readDB();
    db.issues = db.issues.filter(i => i.doc_id !== parseInt(req.params.id));
    writeDB(db);
    res.json({ message: "Удалено" });
});

// --- INVENTORY ---
app.get('/api/inventory/expected', authenticateToken, (req, res) => res.json(readDB().stockExpected));

app.post('/api/inventory/perform', authenticateToken, (req, res) => {
    const { newExpected } = req.body;
    const db = readDB();
    newExpected.forEach(item => {
        db.stockExpected = db.stockExpected.filter(e => e.item_code !== item.item_code);
        db.stockExpected.push(item);
    });
    writeDB(db);
    res.json({ message: "Инвентаризация сохранена" });
});

// --- ADMIN USERS ---
app.get('/api/admin/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Нет прав" });
    const users = readDB().users.map(({ password, ...u }) => u);
    res.json(users);
});

app.post('/api/admin/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Нет прав" });
    const { username, password, fullname, role } = req.body;
    const db = readDB();
    if (db.users.find(u => u.username === username)) return res.status(400).json({ message: "Занят" });
    db.users.push({
        id: Math.max(...db.users.map(u => u.id), 0) + 1,
        username, password: bcrypt.hashSync(password, 8), fullname, role
    });
    writeDB(db);
    res.status(201).json({ message: "Создан" });
});

app.delete('/api/admin/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Нет прав" });
    const db = readDB();
    db.users = db.users.filter(u => u.id !== parseInt(req.params.id));
    writeDB(db);
    res.json({ message: "Удален" });
});

app.listen(PORT, () => console.log(`API Server running on http://localhost:${PORT}`));