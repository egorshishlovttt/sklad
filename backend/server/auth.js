const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { readDB, SECRET_KEY } = require('./setting');
const router = require('express').Router(); 

// Логин
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(400).json({ message: "Неверный логин или пароль" });
    }
    
    const token = jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            fullname: user.fullname 
        }, 
        SECRET_KEY, 
        { expiresIn: '24h' }
    );
    
    res.json({ 
        token, 
        user: { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            fullname: user.fullname 
        } 
    });
});

module.exports = router; 