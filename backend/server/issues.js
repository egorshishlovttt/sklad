const { readDB, writeDB, authenticateToken } = require('./setting');
const router = require('express').Router();

// --- ISSUES (РАСХОД) ---
router.get('/', authenticateToken, (req, res) => {
    res.json(readDB().issues);
});

router.post('/', authenticateToken, (req, res) => {
    const { item_code, qty, date, created_by } = req.body;
    const db = readDB();
    const author = created_by || req.user.fullname || req.user.username || 'Система';

    const newDoc = {
        doc_id: Math.max(...db.issues.map(i => i.doc_id), 0) + 1,
        item_code,
        qty: parseFloat(qty),
        date: date || new Date().toISOString().replace('T', ' ').slice(0, 19),
        created_by: author
    };
    db.issues.push(newDoc);
    writeDB(db);
    res.status(201).json(newDoc);
});

// Точный роут для удаления расхода
router.delete('/:id', authenticateToken, (req, res) => {
    const db = readDB();
    const initialLength = db.issues.length;
    db.issues = db.issues.filter(i => i.doc_id !== parseInt(req.params.id));
    
    if (db.issues.length === initialLength) {
        return res.status(444).json({ message: "Документ расхода не найден" });
    }

    writeDB(db);
    res.json({ message: "Аннулировано" });
});

module.exports = router;