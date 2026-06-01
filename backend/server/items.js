const { readDB, writeDB, authenticateToken } = require('./setting');
const router = require('express').Router();

// --- ITEMS (NOMENCLATURE) ---
router.get('/', authenticateToken, (req, res) => {
    res.json(readDB().items);
});

router.post('/', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ message: "Нет прав" });
    const { item_code, name, uom } = req.body;
    const db = readDB();
    if (db.items.find(i => i.item_code === item_code)) {
        return res.status(409).json({message: "Предмет с таким кодом уже существует"})
    }
    if (db.items.find(i => i.name === name)){
        return res.status(409).json({message: "Предмет с таким названием уже существует"})
    }
    db.items.push({ item_code, name, uom });
    writeDB(db);
    res.status(201).json({ message: "Сохранено" });
});

router.delete('/:code', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ message: "Нет прав" });
    const db = readDB();
    db.items = db.items.filter(i => i.item_code !== req.params.code);
    writeDB(db);
    res.json({ message: "Удалено" });
});

module.exports = router;
