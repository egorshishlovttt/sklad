window.canIssue = function(item_code, qty, date) {
    const stock = getCalculatedStock(date);
    return (stock.get(item_code)||0) >= qty;
};

window.addReceipt = function(item_code, qty, date) {
    StorageState.receipts.push({doc_id: StorageState.nextDocIdReceipt++, item_code, qty, date});
    saveToLocal();
};

window.addIssue = function(item_code, qty, date) {
    if(!canIssue(item_code, qty, date)) { alert(`Недостаточно остатка для товара ${item_code}`); return false; }
    StorageState.issues.push({doc_id: StorageState.nextDocIdIssue++, item_code, qty, date});
    saveToLocal();
    return true;
};

window.generateNextItemCode = function() {
    const prefix = "Т";
    let maxNum = 0;
    StorageState.items.forEach(it => {
        const match = it.item_code.match(/Т(\d+)/);
        if(match) {
            const num = parseInt(match[1]);
            if(num > maxNum) maxNum = num;
        }
    });
    return prefix + String(maxNum + 1).padStart(3, '0');
};

window.renderItems = function() {
    const container = document.getElementById('itemsTab');
    if(!container) return;
    const canEdit = StorageState.currentUser.role === 'admin' || StorageState.currentUser.role === 'manager';
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow p-5">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold">Товары</h2>
                ${canEdit ? '<button id="openAddItemModalBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg"><i class="fas fa-plus mr-1"></i>Добавить товар</button>' : ''}
            </div>
            <div class="scrollable-table border rounded">
                <table class="min-w-full">
                    <thead class="bg-gray-50"><tr><th>Код</th><th>Наименование</th><th>Ед.изм</th><th></th></tr></thead>
                    <tbody id="itemsTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    const tbody = document.getElementById('itemsTableBody');
    if(tbody) {
        tbody.innerHTML = StorageState.items.map(it => `
            <tr>
                <td>${it.item_code}</td>
                <td>${it.name}</td>
                <td>${it.uom}</td>
                <td>${canEdit ? `<button onclick="window.deleteItem('${it.item_code}')" class="text-red-500"><i class="fas fa-trash-alt"></i></button>` : '-'}</td>
            </tr>
        `).join('');
    }
    const addBtn = document.getElementById('openAddItemModalBtn');
    if(addBtn) addBtn.onclick = () => window.openItemModal();
};

window.openItemModal = function() {
    const generatedCode = generateNextItemCode();
    document.getElementById('itemCode').value = generatedCode;
    document.getElementById('itemName').value = '';
    document.getElementById('itemUom').value = 'шт';
    document.getElementById('itemModal').classList.remove('hidden');
};

window.addNewItem = function() {
    let code = document.getElementById('itemCode').value.trim();
    const name = document.getElementById('itemName').value.trim();
    const uom = document.getElementById('itemUom').value;
    if(!name) { alert("Введите наименование товара"); return; }
    if(!code) code = generateNextItemCode();
    if(StorageState.items.find(i=>i.item_code===code)) { alert("Код товара уже существует"); return; }
    StorageState.items.push({item_code: code, name: name, uom: uom});
    saveToLocal();
    renderItems();
    document.getElementById('itemModal').classList.add('hidden');
};

window.deleteItem = function(code) {
    if(confirm(`Удалить товар ${code}?`)) {
        StorageState.items = StorageState.items.filter(i=>i.item_code!==code);
        StorageState.receipts = StorageState.receipts.filter(r=>r.item_code!==code);
        StorageState.issues = StorageState.issues.filter(i=>i.item_code!==code);
        StorageState.stockExpected = StorageState.stockExpected.filter(e=>e.item_code!==code);
        saveToLocal();
        renderItems();
        if(StorageState.activeTab==='receipt') renderReceipts();
        if(StorageState.activeTab==='issue') renderIssues();
        if(StorageState.activeTab==='stock') renderStock();
    }
};

window.renderReceipts = function() {
    const container = document.getElementById('receiptTab');
    if(!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow p-5">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold"><i class="fas fa-arrow-down text-green-600"></i> Документы прихода</h2>
                <button id="openReceiptModalBtn" class="bg-emerald-600 text-white px-4 py-2 rounded-lg"><i class="fas fa-plus mr-1"></i>Добавить приход</button>
            </div>
            <div class="scrollable-table border rounded">
                <table class="min-w-full"><thead><tr><th>№ док</th><th>Код товара</th><th>Наименование</th><th>Кол-во</th><th>Дата</th><th></th></tr></thead>
                <tbody id="receiptsBody"></tbody></table>
            </div>
        </div>
    `;
    const tbody = document.getElementById('receiptsBody');
    if(tbody) {
        tbody.innerHTML = StorageState.receipts.map(r => {
            const item = StorageState.items.find(i=>i.item_code===r.item_code);
            return `
                <tr>
                    <td>${r.doc_id}</td>
                    <td>${r.item_code}</td>
                    <td>${item ? item.name : '?'}</td>
                    <td>${r.qty}</td>
                    <td>${r.date}</td>
                    <td>${(StorageState.currentUser.role==='admin'||StorageState.currentUser.role==='storekeeper') ? `<button onclick="window.deleteReceipt(${r.doc_id})" class="text-red-500"><i class="fas fa-trash"></i></button>` : '-'}</td>
                </tr>
            `;
        }).join('');
    }
    document.getElementById('openReceiptModalBtn')?.addEventListener('click', () => window.openMovementModal('receipt'));
};

window.renderIssues = function() {
    const container = document.getElementById('issueTab');
    if(!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow p-5">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold"><i class="fas fa-arrow-up text-amber-600"></i> Документы расхода</h2>
                <button id="openIssueModalBtn" class="bg-orange-600 text-white px-4 py-2 rounded-lg"><i class="fas fa-plus mr-1"></i>Добавить расход</button>
            </div>
            <div class="scrollable-table border rounded">
                <table class="min-w-full"><thead><tr><th>№ док</th><th>Код товара</th><th>Наименование</th><th>Кол-во</th><th>Дата</th><th></th></tr></thead>
                <tbody id="issuesBody"></tbody></table>
            </div>
        </div>
    `;
    const tbody = document.getElementById('issuesBody');
    if(tbody) {
        tbody.innerHTML = StorageState.issues.map(i => {
            const item = StorageState.items.find(it=>it.item_code===i.item_code);
            return `
                <tr>
                    <td>${i.doc_id}</td>
                    <td>${i.item_code}</td>
                    <td>${item ? item.name : '?'}</td>
                    <td>${i.qty}</td>
                    <td>${i.date}</td>
                    <td>${(StorageState.currentUser.role==='admin'||StorageState.currentUser.role==='storekeeper') ? `<button onclick="window.deleteIssue(${i.doc_id})" class="text-red-500"><i class="fas fa-trash"></i></button>` : '-'}</td>
                </tr>
            `;
        }).join('');
    }
    document.getElementById('openIssueModalBtn')?.addEventListener('click', () => window.openMovementModal('issue'));
};

window.deleteReceipt = function(id) { StorageState.receipts = StorageState.receipts.filter(r=>r.doc_id!==id); saveToLocal(); renderReceipts(); if(StorageState.activeTab==='stock') renderStock(); };
window.deleteIssue = function(id) { StorageState.issues = StorageState.issues.filter(i=>i.doc_id!==id); saveToLocal(); renderIssues(); if(StorageState.activeTab==='stock') renderStock(); };

window.openMovementModal = function(type) {
    window.currentModalType = type;
    document.getElementById('modalTitle').innerText = type === 'receipt' ? 'Добавить приход' : 'Добавить расход';
    const select = document.getElementById('modalItemCode');
    select.innerHTML = '<option value="">Выберите товар</option>' + StorageState.items.map(it => `<option value="${it.item_code}">${it.item_code} - ${it.name}</option>`).join('');
    document.getElementById('modalQty').value = '';
    document.getElementById('modalDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('movementModal').classList.remove('hidden');
};