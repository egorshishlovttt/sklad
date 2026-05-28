document.addEventListener('DOMContentLoaded', function() {
    let items = [], receipts = [], issues = [], stockExpected = [], adminUsers = [];
    let currentModalType = '';

    const roleTabs = {
        admin: ['items', 'receipt', 'issue', 'stock', 'inventory', 'reports', 'admin'],
        manager: ['items', 'receipt', 'issue', 'stock', 'inventory', 'reports'],
        storekeeper: ['items', 'receipt', 'issue', 'stock', 'reports'],
        analyst: ['stock', 'reports']
    };

    function getHeaders() { 
        return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }; 
    }

    async function apiRequest(endpoint, method = 'GET', body = null) {
        const config = { method, headers: getHeaders() };
        if (body) config.body = JSON.stringify(body);
        try {
            const res = await fetch(`${API_URL}${endpoint}`, config);
            if (res.status === 401 || res.status === 403) { window.logout(); return null; }
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Ошибка сервера');
            return data;
        } catch (err) { alert(err.message); return null; }
    }

    async function loadAllData() {
        const role = window.appState.currentUser?.role;
        const allowed = roleTabs[role] || [];
        if (allowed.includes('items')) items = await apiRequest('/items') || [];
        if (allowed.includes('receipt')) receipts = await apiRequest('/receipts') || [];
        if (allowed.includes('issue')) issues = await apiRequest('/issues') || [];
        if (allowed.includes('stock') || allowed.includes('inventory') || allowed.includes('reports')) stockExpected = await apiRequest('/inventory/expected') || [];
        if (allowed.includes('admin')) adminUsers = await apiRequest('/admin/users') || [];
    }

    function getCalculatedStock(asOfDate = null) {
        const targetDate = asOfDate || new Date().toISOString().slice(0,10);
        const map = new Map();
        receipts.forEach(r => { if(r.date <= targetDate) map.set(r.item_code, (map.get(r.item_code)||0) + r.qty); });
        issues.forEach(i => { if(i.date <= targetDate) map.set(i.item_code, (map.get(i.item_code)||0) - i.qty); });
        for(let [k,v] of map.entries()) if(v<0) map.set(k,0);
        return map;
    }

    function getLastActualMap(asOfDate = null) {
        const targetDate = asOfDate || new Date().toISOString().slice(0,10);
        const map = new Map();
        const sorted = [...stockExpected].filter(e => e.date <= targetDate).sort((a,b)=>new Date(b.date)-new Date(a.date));
        sorted.forEach(e => { if(!map.has(e.item_code)) map.set(e.item_code, e.qty_expected); });
        return map;
    }

    function getTotalReceipts(item_code, startDate, endDate) {
        let sum = 0; receipts.forEach(r => { if(r.item_code === item_code && (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate)) sum += r.qty; }); return sum;
    }
    function getTotalIssues(item_code, startDate, endDate) {
        let sum = 0; issues.forEach(i => { if(i.item_code === item_code && (!startDate || i.date >= startDate) && (!endDate || i.date <= endDate)) sum += i.qty; }); return sum;
    }
    function generateNextItemCode() {
        const prefix = "Т"; let maxNum = 0;
        items.forEach(it => { const match = it.item_code.match(/Т(\d+)/); if(match) { const num = parseInt(match[1]); if(num > maxNum) maxNum = num; } });
        return prefix + String(maxNum + 1).padStart(3, '0');
    }

    // Универсальная функция скачивания CSV, которая открывается в Excel без кракозябр
    function downloadCsvExcel(filename, rows) {
        const csvContent = rows.map(e => e.join(";")).join("\n");
        const BOM = "\uFEFF"; // Маркер Unicode для Microsoft Excel
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function renderTabs() {
        const container = document.getElementById('tabsContainer');
        const role = window.appState.currentUser?.role;
        const allowed = roleTabs[role] || ['items'];
        const names = { items: '📦 Номенклатура', receipt: '📥 Приход', issue: '📤 Расход', stock: '📊 Остатки', inventory: '🔍 Инвентаризация', reports: '📈 Отчёты', admin: '👑 Администрирование' };
        container.innerHTML = '';
        allowed.forEach(tabId => {
            const btn = document.createElement('button');
            btn.className = `px-4 py-2 text-sm font-medium rounded-lg transition ${window.appState.activeTab===tabId ? 'tab-active bg-blue-600 text-white' : 'tab-inactive bg-gray-200'}`;
            btn.innerText = names[tabId];
            btn.onclick = () => switchTab(tabId);
            container.appendChild(btn);
        });
    }

    async function switchTab(tabId) {
        window.appState.activeTab = tabId; renderTabs();
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId+'Tab')?.classList.remove('hidden');
        await loadAllData();
        if(tabId === 'items') renderItems();
        if(tabId === 'receipt') renderReceipts();
        if(tabId === 'issue') renderIssues();
        if(tabId === 'stock') renderStock();
        if(tabId === 'inventory') renderInventory();
        if(tabId === 'reports') renderReports();
        if(tabId === 'admin') renderAdmin();
    }

    window.initializeMainApp = function() { switchTab('items'); };

    // --- 1. В К Л А Д К А  Н О М Е Н К Л А Т У Р А ---
    function renderItems() {
        const canEdit = window.appState.currentUser.role === 'admin' || window.appState.currentUser.role === 'manager';
        const container = document.getElementById('itemsTab');
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow p-5">
                <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h2 class="text-xl font-semibold">Товары и Номенклатура</h2>
                    <div class="flex gap-2">
                        ${canEdit ? `
                            <button id="importNomenclatureBtn" class="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 transition"><i class="fas fa-file-import mr-1"></i> Импорт CSV</button>
                            <button id="openAddItemModalBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition"><i class="fas fa-plus mr-1"></i> Добавить товар</button>
                        ` : ''}
                    </div>
                </div>
                <div class="scrollable-table border rounded">
                    <table>
                        <thead class="bg-gray-50"><tr><th>Код</th><th>Наименование</th><th>Ед.изм</th><th></th></tr></thead>
                        <tbody>${items.map(it => `<tr><td>${it.item_code}</td><td>${it.name}</td><td>${it.uom}</td><td>${canEdit ? `<button onclick="window.deleteItem('${it.item_code}')" class="text-red-500"><i class="fas fa-trash-alt"></i></button>` : '-'}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>`;
        if(canEdit) {
            document.getElementById('openAddItemModalBtn').onclick = () => {
                document.getElementById('itemCode').value = generateNextItemCode();
                document.getElementById('itemName').value = ''; document.getElementById('itemUom').value = 'шт';
                document.getElementById('itemModal').classList.remove('hidden');
            };
            document.getElementById('importNomenclatureBtn').onclick = () => document.getElementById('nomenclatureCsvInput').click();
        }
    }

    // Обработчик импорта номенклатуры из CSV
    document.getElementById('nomenclatureCsvInput').onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = async function(evt) {
            const text = evt.target.result;
            const lines = text.split('\n');
            let successCount = 0;
            
            for(let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if(!line || i === 0) continue; // Пропускаем заголовок или пустоту
                const columns = line.split(/[;,]/); // Разделение по ; или ,
                if(columns.length >= 2) {
                    const item_code = columns[0].trim();
                    const name = columns[1].trim();
                    const uom = columns[2] ? columns[2].trim() : 'шт';
                    await apiRequest('/items', 'POST', { item_code, name, uom });
                    successCount++;
                }
            }
            alert(`Импорт завершен! Успешно обработано строк: ${successCount}`);
            switchTab('items');
        };
        reader.readAsText(file, 'UTF-8');
    };

    window.deleteItem = async (code) => { if(confirm(`Удалить товар ${code}?`)) { await apiRequest(`/items/${code}`, 'DELETE'); switchTab('items'); } };

    document.getElementById('itemModalConfirmBtn').onclick = async () => {
        let item_code = document.getElementById('itemCode').value.trim();
        const name = document.getElementById('itemName').value.trim(); const uom = document.getElementById('itemUom').value;
        if(!name) return alert('Введите наименование товара'); if(!item_code) item_code = generateNextItemCode();
        const res = await apiRequest('/items', 'POST', { item_code, name, uom });
        if(res) { document.getElementById('itemModal').classList.add('hidden'); switchTab('items'); }
    };

    // --- ПРИХОД / РАСХОД / ОСТАТКИ (СТАНДАРТНАЯ ЛОГИКА) ---
    function renderReceipts() {
        const container = document.getElementById('receiptTab');
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow p-5">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold"><i class="fas fa-arrow-down text-green-600"></i> Документы прихода</h2>
                    <button id="openReceiptModalBtn" class="bg-emerald-600 text-white px-4 py-2 rounded-lg"><i class="fas fa-plus mr-1"></i>Добавить приход</button>
                </div>
                <div class="scrollable-table border rounded">
                    <table><thead><tr><th>№ док</th><th>Код товара</th><th>Наименование</th><th>Кол-во</th><th>Дата</th><th></th></tr></thead>
                    <tbody>${receipts.map(r => { const item = items.find(i=>i.item_code===r.item_code); return `<tr><td>${r.doc_id}</td><td>${r.item_code}</td><td>${item ? item.name : '?'}</td><td>${r.qty}</td><td>${r.date}</td><td><button onclick="window.delDoc('receipts', ${r.doc_id})" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>`; }).join('')}</tbody></table>
                </div>
            </div>`;
        document.getElementById('openReceiptModalBtn').onclick = () => openMovementModal('receipt');
    }

    function renderIssues() {
        const container = document.getElementById('issueTab');
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow p-5">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold"><i class="fas fa-arrow-up text-amber-600"></i> Документы расходов</h2>
                    <button id="openIssueModalBtn" class="bg-orange-600 text-white px-4 py-2 rounded-lg"><i class="fas fa-plus mr-1"></i>Добавить расход</button>
                </div>
                <div class="scrollable-table border rounded">
                    <table><thead><tr><th>№ док</th><th>Код товара</th><th>Наименование</th><th>Кол-во</th><th>Дата</th><th></th></tr></thead>
                    <tbody>${issues.map(i => { const item = items.find(it=>it.item_code===i.item_code); return `<tr><td>${i.doc_id}</td><td>${i.item_code}</td><td>${item ? item.name : '?'}</td><td>${i.qty}</td><td>${i.date}</td><td><button onclick="window.delDoc('issues', ${i.doc_id})" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>`; }).join('')}</tbody></table>
                </div>
            </div>`;
        document.getElementById('openIssueModalBtn').onclick = () => openMovementModal('issue');
    }

    window.delDoc = async (type, id) => { if(confirm('Удалить этот документ?')) { await apiRequest(`/${type}/${id}`, 'DELETE'); switchTab(type === 'receipts' ? 'receipt' : 'issue'); } };

    function openMovementModal(type) {
        currentModalType = type;
        document.getElementById('modalTitle').innerText = type === 'receipt' ? 'Добавить приход' : 'Добавить расход';
        document.getElementById('modalItemCode').innerHTML = '<option value="">Выберите товар</option>' + items.map(i => `<option value="${i.item_code}">${i.item_code} - ${i.name}</option>`).join('');
        document.getElementById('modalQty').value = ''; document.getElementById('modalDate').value = new Date().toISOString().slice(0,10);
        document.getElementById('movementModal').classList.remove('hidden');
    }

    document.getElementById('modalConfirmBtn').onclick = async () => {
        const item_code = document.getElementById('modalItemCode').value; const qty = parseInt(document.getElementById('modalQty').value); const date = document.getElementById('modalDate').value;
        if(!item_code || !qty || qty<=0 || !date) return alert('Заполните все поля корректно');
        const res = await apiRequest(currentModalType === 'receipt' ? '/receipts' : '/issues', 'POST', { item_code, qty, date });
        if(res) { document.getElementById('movementModal').classList.add('hidden'); switchTab(currentModalType); }
    };

    function renderStock() {
        const calculatedMap = getCalculatedStock(); const lastActualMap = getLastActualMap();
        document.getElementById('stockTab').innerHTML = `
            <div class="bg-white rounded-xl shadow p-5">
                <h2 class="text-xl font-semibold mb-1"><i class="fas fa-cubes"></i> Текущие остатки на складе</h2>
                <div class="scrollable-table border rounded mt-4">
                    <table>
                        <thead class="bg-gray-50">
                            <tr><th>Код</th><th>Товар</th><th>Расчётный остаток (Система)</th><th>Последний факт (Инвентаризация)</th><th>Разница</th></tr>
                        </thead>
                        <tbody>${items.map(it => {
                            const calculated = calculatedMap.get(it.item_code) || 0; const actual = lastActualMap.get(it.item_code); const delta = actual !== undefined ? calculated - actual : '—';
                            return `<tr><td>${it.item_code}</td><td>${it.name}</td><td class="font-mono">${calculated}</td><td>${actual !== undefined ? actual : '<span class="text-gray-400">не проводилась</span>'}</td><td class="${delta !== '—' && Math.abs(delta) > 0 ? 'text-red-500 font-bold' : ''}">${delta}</td></tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>`;
    }

    // --- 2. В К Л А Д К А  И Н В Е Н Т А Р И З А Ц И Я ---
    function renderInventory() {
        const calculatedMap = getCalculatedStock();
        const container = document.getElementById('inventoryTab');
        
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow p-5">
                <div class="flex justify-between items-center flex-wrap gap-2 mb-2">
                    <h2 class="text-xl font-semibold"><i class="fas fa-clipboard-list"></i> Модуль инвентаризации</h2>
                    <button id="importInventoryCsvBtn" class="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition"><i class="fas fa-file-upload"></i> Загрузить факт (CSV)</button>
                </div>
                
                <div id="inventoryAlertBanner" class="my-4 hidden"></div>

                <div class="scrollable-table border rounded mb-4">
                    <table>
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="w-32">Код</th>
                                <th>Товар</th>
                                <th class="text-center w-48">Учётный остаток</th>
                                <th class="text-center w-48">Фактический остаток</th>
                            </tr>
                        </thead>
                        <tbody>${items.map(it => {
                            const currentCalculated = calculatedMap.get(it.item_code) || 0;
                            return `
                            <tr>
                                <td class="font-bold text-slate-700">${it.item_code}</td>
                                <td>${it.name}</td>
                                <td class="text-center font-mono text-gray-600 font-bold bg-gray-50" id="calc_val_${it.item_code}">${currentCalculated}</td>
                                <td class="text-center">
                                    <input type="number" id="scan_${it.item_code}" 
                                           class="border border-blue-300 rounded p-1 w-32 text-center bg-blue-50 font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                           value="0" min="0">
                                </td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
                <div class="flex gap-3 mb-6">
                    <button id="performInventoryBtn" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"><i class="fas fa-check-circle mr-1"></i> Провести инвентаризацию</button>
                    <button id="exportInventoryProtocolBtn" class="bg-green-700 text-white px-5 py-2 rounded-lg text-sm hover:bg-green-800 transition"><i class="fas fa-file-csv"></i> Выгрузить протокол (Excel)</button>
                </div>
                <div class="border-t pt-4">
                    <h3 class="font-bold text-lg text-slate-700 mb-2">Лог текущей проверки (Протокол схождения)</h3>
                    <div id="inventoryProtocolContainer" class="scrollable-table"></div>
                </div>
            </div>`;
            
        document.getElementById('performInventoryBtn').onclick = performInventory;
        document.getElementById('exportInventoryProtocolBtn').onclick = exportInventoryProtocol;
        document.getElementById('importInventoryCsvBtn').onclick = () => document.getElementById('inventoryCsvInput').click();
        
        displayInventoryProtocol([]); 
    }

    // Логика импорта фактических остатков из CSV-файла для инвентаризации
    document.getElementById('inventoryCsvInput').onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const text = evt.target.result;
            const lines = text.split('\n');
            let matched = 0;
            
            lines.forEach((line, idx) => {
                if(idx === 0 || !line.trim()) return;
                const cols = line.split(/[;,]/);
                if(cols.length >= 2) {
                    const code = cols[0].trim();
                    const qty = parseFloat(cols[1].trim()) || 0;
                    const inputEl = document.getElementById(`scan_${code}`);
                    if(inputEl) {
                        inputEl.value = qty;
                        matched++;
                    }
                }
            });
            alert(`Данные загружены! Заполнено остатков для ${matched} товаров. Проверьте таблицу и нажмите "Провести инвентаризацию".`);
        };
        reader.readAsText(file, 'UTF-8');
    };

    async function performInventory() {
        const calculatedMap = getCalculatedStock();
        const newActualData = items.map(it => ({
            item_code: it.item_code,
            qty_expected: parseFloat(document.getElementById(`scan_${it.item_code}`).value) || 0,
            date: new Date().toISOString().slice(0,10)
        }));

        const res = await apiRequest('/inventory/perform', 'POST', { newExpected: newActualData });
        if(res) {
            stockExpected = await apiRequest('/inventory/expected') || [];
            const deviations = [];
            
            items.forEach(it => {
                const calculated = calculatedMap.get(it.item_code) || 0;
                const actual = newActualData.find(e => e.item_code === it.item_code).qty_expected;
                if(calculated !== actual) {
                    deviations.push({ item_code: it.item_code, name: it.name, calculated, actual, diff: actual - calculated });
                }
            });
            
            const banner = document.getElementById('inventoryAlertBanner');
            banner.classList.remove('hidden');
            if (deviations.length === 0) {
                banner.className = "my-4 p-4 bg-green-100 border-l-4 border-green-500 rounded text-green-800 font-medium";
                banner.innerHTML = `<i class="fas fa-check-circle mr-2 text-lg"></i> Инвентаризация завершена! Расхождений не обнаружено.`;
            } else {
                banner.className = "my-4 p-4 bg-amber-100 border-l-4 border-amber-500 rounded text-amber-800 font-medium";
                banner.innerHTML = `<i class="fas fa-exclamation-triangle mr-2 text-lg"></i> Инвентаризация зафиксировала <strong>${deviations.length} отклонений</strong>. Подробности в логе.`;
            }
            displayInventoryProtocol(deviations);
        }
    }

    function displayInventoryProtocol(deviations) {
        const container = document.getElementById('inventoryProtocolContainer');
        if(!container) return;
        if(deviations.length === 0) {
            container.innerHTML = `<div class="p-3 bg-slate-50 text-slate-500 rounded text-sm border"><i class="fas fa-info-circle mr-1"></i>Разницы не обнаружено. Введите данные и нажмите кнопку выше.</div>`;
        } else {
            container.innerHTML = `
                <table class="min-w-full border text-sm bg-white shadow-inner">
                    <thead class="bg-slate-100">
                        <tr><th>Код</th><th>Товар</th><th>Расчётный остаток</th><th>Фактический остаток</th><th>Дельта</th></tr>
                    </thead>
                    <tbody>${deviations.map(d => `
                        <tr>
                            <td class="font-bold">${d.item_code}</td>
                            <td>${d.name}</td>
                            <td class="font-mono">${d.calculated}</td>
                            <td class="font-mono bg-blue-50/30">${d.actual}</td>
                            <td class="font-bold ${d.diff < 0 ? 'text-red-600' : 'text-amber-600'}">
                                ${d.diff > 0 ? 'Излишек (+' + d.diff + ')' : 'Недостача (' + d.diff + ')'}
                            </td>
                        </tr>`).join('')}</tbody>
                </table>`;
        }
    }

    function exportInventoryProtocol() {
        const calculatedMap = getCalculatedStock(); const lastActualMap = getLastActualMap();
        const rows = [['Код товара','Наименование','Расчетный остаток (Система)','Фактический остаток (Склад)','Дельта']];
        items.forEach(it => {
            const calculated = calculatedMap.get(it.item_code) || 0; const actual = lastActualMap.get(it.item_code);
            if(actual !== undefined && calculated !== actual) rows.push([it.item_code, it.name, calculated, actual, actual - calculated]);
        });
        downloadCsvExcel(`inventory_report_${new Date().toISOString().slice(0,10)}.csv`, rows);
    }

    // --- 3. В К Л А Д К А  О Т Ч Ё Т Ы  (ВЫГРУЗКА ПОЛНОГО ОТЧЕТА) ---
    function renderReports() {
        document.getElementById('reportsTab').innerHTML = `
            <div class="bg-white rounded-xl shadow p-5">
                <h2 class="text-xl font-bold mb-4">Отчёты по складу</h2>
                <div class="flex flex-wrap gap-3 items-end mb-6">
                    <div><label class="block text-sm">Дата начала</label><input type="date" id="reportStart" class="border rounded p-2"></div>
                    <div><label class="block text-sm">Дата окончания</label><input type="date" id="reportEnd" class="border rounded p-2"></div>
                    <button id="applyReportBtn" class="bg-blue-600 text-white px-4 py-2 rounded">Сформировать</button>
                    <button id="fullReportBtn" class="bg-slate-700 text-white px-4 py-2 rounded">Экспорт всего отчета в Excel</button>
                </div>
                <div id="reportContent" class="mt-4"></div>
            </div>`;
        document.getElementById('applyReportBtn').onclick = () => generateReport(true);
        document.getElementById('fullReportBtn').onclick = () => exportFullReportExcel();
    }

    function generateReport(usePeriod) {
        let startDate = null, endDate = null;
        if(usePeriod) { startDate = document.getElementById('reportStart').value; endDate = document.getElementById('reportEnd').value; if(!endDate) return alert("Укажите конечную дату"); }
        const targetDate = endDate || new Date().toISOString().slice(0,10);
        const calculatedMap = getCalculatedStock(targetDate); const lastActualMap = getLastActualMap(targetDate);
        let totalReceiptQty = 0, totalIssueQty = 0, totalCalculated = 0; const details = [];

        items.forEach(it => {
            const receiptsSum = getTotalReceipts(it.item_code, startDate, endDate); const issuesSum = getTotalIssues(it.item_code, startDate, endDate);
            const calculatedStock = calculatedMap.get(it.item_code) || 0; const actualStock = lastActualMap.get(it.item_code); const delta = actualStock !== undefined ? actualStock - calculatedStock : null;
            totalReceiptQty += receiptsSum; totalIssueQty += issuesSum; totalCalculated += calculatedStock;
            details.push({ code: it.item_code, name: it.name, uom: it.uom, receiptsSum, issuesSum, calculatedStock, actualStock: actualStock !== undefined ? actualStock : '—', delta: delta !== null ? delta : '—' });
        });

        document.getElementById('reportContent').innerHTML = `
            <div class="bg-gray-50 p-4 rounded-lg mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span class="font-semibold">Всего наименований:</span> ${items.length}</div>
                <div><span class="font-semibold">Приходов:</span> ${totalReceiptQty} ед.</div>
                <div><span class="font-semibold">Расходов:</span> ${totalIssueQty} ед.</div>
                <div><span class="font-semibold">Итого остаток:</span> ${totalCalculated} ед.</div>
            </div>
            <div class="scrollable-table border rounded">
                <table>
                    <thead class="bg-gray-100">
                        <tr><th>Код</th><th>Наименование</th><th>Ед.изм</th><th>Приходы</th><th>Расходы</th><th>Расчётный остаток</th><th>Фактический остаток</th><th>Дельта</th></tr>
                    </thead>
                    <tbody>${details.map(d => `<tr><td>${d.code}</td><td>${d.name}</td><td>${d.uom}</td><td>${d.receiptsSum}</td><td>${d.issuesSum}</td><td class="font-semibold">${d.calculatedStock}</td><td>${d.actualStock}</td><td class="${d.delta !== '—' && d.delta !== 0 ? 'text-red-500 font-bold' : ''}">${d.delta > 0 ? '+' + d.delta : d.delta}</td></tr>`).join('')}</tbody>
                </table>
            </div>`;
    }

    // Выгрузка абсолютно всей базы данных товаров и движения в одном файле Excel (CSV)
    function exportFullReportExcel() {
        const targetDate = new Date().toISOString().slice(0,10);
        const calculatedMap = getCalculatedStock(targetDate);
        const lastActualMap = getLastActualMap(targetDate);
        
        const headers = ['Код товара', 'Наименование', 'Ед. Изм.', 'Всего Приходов', 'Всего Расходов', 'Текущий расчетный остаток', 'Последний факт инвентаризации', 'Разница (Дельта)'];
        const rows = [headers];
        
        items.forEach(it => {
            const rSum = getTotalReceipts(it.item_code, null, null);
            const iSum = getTotalIssues(it.item_code, null, null);
            const calc = calculatedMap.get(it.item_code) || 0;
            const fact = lastActualMap.get(it.item_code);
            const delta = fact !== undefined ? fact - calc : 'не проводилась';
            
            rows.push([it.item_code, it.name, it.uom, rSum, iSum, calc, fact !== undefined ? fact : '—', delta]);
        });
        
        downloadCsvExcel(`full_warehouse_report_${targetDate}.csv`, rows);
    }

    // --- 4. В К Л А Д К А  А Д М И Н И С Т Р И Р О В А Н И Е  (НОВЫЙ ИНТЕРФЕЙС) ---
    function renderAdmin() {
        document.getElementById('adminTab').innerHTML = `
            <div class="bg-white rounded-xl shadow p-5">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold">Управление пользователями</h2>
                    <button id="createUserAdminBtn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"><i class="fas fa-user-plus mr-1"></i> Новый пользователь</button>
                </div>
                <div class="scrollable-table border rounded">
                    <table><thead><tr><th>ID</th><th>Логин</th><th>ФИО</th><th>Роль</th><th></th></tr></thead>
                    <tbody>${adminUsers.map(u => `<tr><td>${u.id}</td><td>${u.username}</td><td>${u.fullname}</td><td>${u.role}</td><td><button onclick="window.delUser(${u.id})" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody></table>
                </div>
            </div>`;
            
        // Открытие красивого модального окна вместо prompt
        document.getElementById('createUserAdminBtn').onclick = () => {
            document.getElementById('userFullname').value = '';
            document.getElementById('userUsername').value = '';
            document.getElementById('userPassword').value = '';
            document.getElementById('userRole').value = 'storekeeper';
            document.getElementById('userModal').classList.remove('hidden');
        };
    }

    // Логика кнопок внутри красивого модального окна добавления пользователей
    document.getElementById('userModalCancelBtn').onclick = () => document.getElementById('userModal').classList.add('hidden');
    
    document.getElementById('userModalConfirmBtn').onclick = async () => {
        const fullname = document.getElementById('userFullname').value.trim();
        const username = document.getElementById('userUsername').value.trim();
        const password = document.getElementById('userPassword').value.trim();
        const role = document.getElementById('userRole').value;
        
        if(!fullname || !username || !password || !role) return alert('Заполните все поля формы!');
        
        const res = await apiRequest('/admin/users', 'POST', { username, password, fullname, role });
        if(res) {
            document.getElementById('userModal').classList.add('hidden');
            alert('Пользователь успешно создан!');
            switchTab('admin');
        }
    };

    window.delUser = async (id) => { if(id === window.appState.currentUser.id) return alert("Нельзя удалить себя"); if(confirm('Удалить пользователя?')) { await apiRequest(`/admin/users/${id}`, 'DELETE'); switchTab('admin'); } };
});