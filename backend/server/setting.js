const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken'); 

const SECRET_KEY = 'WAREHOUSE_SECRET_JWT_KEY';
const DATA_FILE = path.join(__dirname, '..', 'db.json');

// Начальные данные
const initialData = {
    users: [
        { id: 1, username: "admin", password: require('bcryptjs').hashSync("admin", 8), fullname: "Администратор", role: "admin" },
        { id: 2, username: "ivan", password: require('bcryptjs').hashSync("111", 8), fullname: "Иван Кладовщиков", role: "storekeeper" },
        { id: 3, username: "petrov", password: require('bcryptjs').hashSync("222", 8), fullname: "Пётр Менеджеров", role: "manager" },
        { id: 4, username: "sidorov", password: require('bcryptjs').hashSync("333", 8), fullname: "Сидор Аналитиков", role: "analyst" }
    ],
    items: [
        { item_code: "Т001", name: "Деталь X1", uom: "шт" },
        { item_code: "Т002", name: "Деталь X2", uom: "шт" },
        { item_code: "Т003", name: "Кабель питания", uom: "м" }
    ],
    receipts: [],
    issues: [],
    stockExpected: []
};

// Функции для работы с JSON файлом
function readDB() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Middleware для проверки токена (без app!)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: "Токен отсутствует" });
    }
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Невалидный токен" });
        }
        req.user = user;
        next();
    });
}

// Экспортируем всё, что нужно другим модулям
module.exports = { 
    readDB, 
    writeDB, 
    SECRET_KEY, 
    authenticateToken 
};