const bcrypt = require('bcryptjs');
const { readDB, writeDB, authenticateToken } = require('./setting');
const router = require('express').Router();

// Получить всех пользователей (без паролей)
router.get('/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Нет прав" });
    
    const users = readDB().users.map(({ password, ...u }) => u);
    res.json(users);
});

// Создать пользователя
router.post('/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Нет прав" });
    
    const { username, password, fullname, role } = req.body;
    const db = readDB();
    
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ message: "Логин уже занят" });
    }
    
    db.users.push({
        id: Math.max(...db.users.map(u => u.id), 0) + 1,
        username,
        password: bcrypt.hashSync(password, 8),
        fullname,
        role
    });
    
    writeDB(db);
    res.status(201).json({ message: "Пользователь создан" });
});

// Удалить пользователя
router.delete('/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Нет прав" });
    
    const db = readDB();
    db.users = db.users.filter(u => u.id !== parseInt(req.params.id));
    writeDB(db);
    res.json({ message: "Пользователь удален" });
});

module.exports = router;