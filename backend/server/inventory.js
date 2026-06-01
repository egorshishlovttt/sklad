const { readDB, writeDB, authenticateToken } = require('./setting');
const router = require('express').Router();

// --- INVENTORY ---
router.get('/expected', authenticateToken, (req, res) => {
    res.json(readDB().stockExpected || []);
});

router.post('/perform', authenticateToken, (req, res) => {
    const { newExpected } = req.body;
    const db = readDB();
    newExpected.forEach(item => {
        db.stockExpected = db.stockExpected.filter(e => e.item_code !== item.item_code);
        db.stockExpected.push(item);
    });
    writeDB(db);
    res.json({ message: "Инвентаризация сохранена" });
});

module.exports = router;