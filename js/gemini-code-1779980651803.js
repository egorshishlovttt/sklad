// Глобальный контекст базы данных и состояния
window.StorageState = {
    items: [],
    receipts: [],
    issues: [],
    stockExpected: [],
    users: [],
    currentUser: null,
    nextDocIdReceipt: 100,
    nextDocIdIssue: 200,
    activeTab: 'items',
    roleTabs: {
        admin: ['items', 'receipt', 'issue', 'stock', 'inventory', 'reports', 'import', 'admin'],
        manager: ['items', 'receipt', 'issue', 'stock', 'inventory', 'reports', 'import'],
        storekeeper: ['items', 'receipt', 'issue', 'stock', 'reports'],
        analyst: ['stock', 'reports']
    }
};

window.saveToLocal = function() {
    localStorage.setItem('inv_items', JSON.stringify(StorageState.items));
    localStorage.setItem('inv_receipts', JSON.stringify(StorageState.receipts));
    localStorage.setItem('inv_issues', JSON.stringify(StorageState.issues));
    localStorage.setItem('inv_expected', JSON.stringify(StorageState.stockExpected));
    localStorage.setItem('inv_users', JSON.stringify(StorageState.users));
    localStorage.setItem('inv_counters', JSON.stringify({
        nextDocIdReceipt: StorageState.nextDocIdReceipt, 
        nextDocIdIssue: StorageState.nextDocIdIssue
    }));
};

window.loadFromLocal = function() {
    const storedItems = localStorage.getItem('inv_items');
    if(storedItems) StorageState.items = JSON.parse(storedItems);
    
    const storedReceipts = localStorage.getItem('inv_receipts');
    if(storedReceipts) StorageState.receipts = JSON.parse(storedReceipts);
    
    const storedIssues = localStorage.getItem('inv_issues');
    if(storedIssues) StorageState.issues = JSON.parse(storedIssues);
    
    const storedExpected = localStorage.getItem('inv_expected');
    if(storedExpected) StorageState.stockExpected = JSON.parse(storedExpected);
    
    const storedUsers = localStorage.getItem('inv_users');
    if(storedUsers) StorageState.users = JSON.parse(storedUsers);
    
    const storedCounters = localStorage.getItem('inv_counters');
    if(storedCounters) {
        let c = JSON.parse(storedCounters);
        StorageState.nextDocIdReceipt = c.nextDocIdReceipt || 100;
        StorageState.nextDocIdIssue = c.nextDocIdIssue || 200;
    }
    
    if(StorageState.users.length === 0) {
        StorageState.users = [
            {id: 1, username: 'admin', password: 'admin', fullname: 'Администратор', role: 'admin'},
            {id: 2, username: 'ivan', password: '111', fullname: 'Иван Кладовщиков', role: 'storekeeper'},
            {id: 3, username: 'petrov', password: '222', fullname: 'Пётр Менеджеров', role: 'manager'},
            {id: 4, username: 'sidorov', password: '333', fullname: 'Сидор Аналитиков', role: 'analyst'}
        ];
        saveToLocal();
    }
    if(StorageState.items.length === 0) {
        generateDemoData();
    }
};

function generateDemoData() {
    StorageState.items = [
        {item_code: "Т001", name: "Деталь X1", uom: "шт"},
        {item_code: "Т002", name: "Деталь X2", uom: "шт"},
        {item_code: "Т003", name: "Упаковка", uom: "кор"},
        {item_code: "Т004", name: "Смазка", uom: "л"},
        {item_code: "Т005", name: "Инструмент", uom: "шт"}
    ];
    StorageState.receipts = [];
    StorageState.issues = [];
    let docR = 100, docI = 200;
    const startDate = new Date(2025,0,1);
    for(let i=0; i<70; i++) {
        let code = StorageState.items[Math.floor(Math.random()*StorageState.items.length)].item_code;
        let qty = Math.floor(Math.random()*50)+5;
        let date = new Date(startDate.getTime() + Math.random()*90*24*3600000).toISOString().slice(0,10);
        StorageState.receipts.push({doc_id: docR++, item_code: code, qty: qty, date: date});
    }
    for(let i=0; i<50; i++) {
        let code = StorageState.items[Math.floor(Math.random()*StorageState.items.length)].item_code;
        let qty = Math.floor(Math.random()*30)+1;
        let date = new Date(startDate.getTime() + Math.random()*90*24*3600000).toISOString().slice(0,10);
        StorageState.issues.push({doc_id: docI++, item_code: code, qty: qty, date: date});
    }
    StorageState.nextDocIdReceipt = docR;
    StorageState.nextDocIdIssue = docI;
    StorageState.stockExpected = [];
    saveToLocal();
}

window.getCalculatedStock = function(asOfDate = null) {
    const targetDate = asOfDate || new Date().toISOString().slice(0,10);
    const map = new Map();
    StorageState.receipts.forEach(r => { if(r.date <= targetDate) map.set(r.item_code, (map.get(r.item_code)||0) + r.qty); });
    StorageState.issues.forEach(i => { if(i.date <= targetDate) map.set(i.item_code, (map.get(i.item_code)||0) - i.qty); });
    for(let [k,v] of map.entries()) if(v<0) map.set(k,0);
    return map;
};

window.getExpectedMap = function(asOfDate = null) {
    const targetDate = asOfDate || new Date().toISOString().slice(0,10);
    const filtered = StorageState.stockExpected.filter(e => e.date <= targetDate);
    const sorted = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const map = new Map();
    sorted.forEach(e => { if(!map.has(e.item_code)) map.set(e.item_code, e.qty_expected); });
    return map;
};