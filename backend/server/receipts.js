const { readDB, writeDB, authenticateToken } = require('./setting');
const router = require('express').Router();

// --- RECEIPTS (ПРИХОД) ---
router.get('/', authenticateToken, (req, res) => {
    res.json(readDB().receipts);
});

router.post('/', authenticateToken, (req, res) => {
    const { item_code, qty, date, created_by } = req.body;
    const db = readDB();
    const author = created_by || req.user.fullname || req.user.username || 'Система';
    
    const newDoc = {
        doc_id: Math.max(...db.receipts.map(r => r.doc_id), 0) + 1,
        item_code,
        qty: parseFloat(qty),
        date: date || new Date().toISOString().replace('T', ' ').slice(0, 19),
        created_by: author
    };
    db.receipts.push(newDoc);
    writeDB(db);
    res.status(201).json(newDoc);
});

// Точный роут для удаления прихода
router.delete('/:id', authenticateToken, (req, res) => {
    const db = readDB();
    const initialLength = db.receipts.length;
    db.receipts = db.receipts.filter(r => r.doc_id !== parseInt(req.params.id));
    
    if (db.receipts.length === initialLength) {
        return res.status(444).json({ message: "Документ прихода не найден" });
    }
    
    writeDB(db);
    res.json({ message: "Аннулировано" });
});

module.exports = router;