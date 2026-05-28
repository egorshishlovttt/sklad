window.getTotalReceipts = function(item_code, startDate, endDate) {
    let sum = 0;
    StorageState.receipts.forEach(r => {
        if(r.item_code === item_code && (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate)) sum += r.qty;
    });
    return sum;
};

window.getTotalIssues = function(item_code, startDate, endDate) {
    let sum = 0;
    StorageState.issues.forEach(i => {
        if(i.item_code === item_code && (!startDate || i.date >= startDate) && (!endDate || i.date <= endDate)) sum += i.qty;
    });
    return sum;
};

window.renderStock = function() {
    const container = document.getElementById('stockTab');
    if(!container) return;
    const stockMap = getCalculatedStock();
    const expMap = getExpectedMap();
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow p-5">
            <h2 class="text-xl font-semibold mb-3"><i class="fas fa-cubes"></i> Текущие остатки и эталоны</h2>
            <div class="scrollable-table border rounded">
                <table class="min-w-full"><thead><tr><th>Код</th><th>Товар</th><th>Расчётный остаток</th><th>Эталон (инвентаризация)</th><th>Расхождение</th></tr></thead>
                <tbody id="stockTableBody"></tbody></table>
            </div>
            <p class="text-xs text-gray-500 mt-3">* Эталон задаётся только через инвентаризацию.</p>
        </div>
    `;
    const tbody = document.getElementById('stockTableBody');
    if(tbody) {
        tbody.innerHTML = StorageState.items.map(it => {
            const calc = stockMap.get(it.item_code) || 0;
            const exp = expMap.get(it.item_code);
            const delta = exp !== undefined ? calc - exp : '—';
            return `<tr><td>${it.item_code}</td><td>${it.name}</td><td class="font-mono">${calc}</td>
                     <td>${exp !== undefined ? exp : '—'}</td>
                     <td class="${delta!=='—' && Math.abs(delta)>0 ? 'text-red-500' : ''}">${delta!=='—' ? delta : '—'}</td></tr>`;
        }).join('');
    }
};

window.renderInventory = function() {
    const container = document.getElementById('inventoryTab');
    if(!container) return;
    const expMap = getExpectedMap();
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow p-5">
            <h2 class="text-xl font-semibold mb-3"><i class="fas fa-clipboard-list"></i> Скан-лист (фактические остатки)</h2>
            <div class="scrollable-table border rounded mb-4">
                <table class="min-w-full"><thead><tr><th>Код</th><th>Товар</th><th>Фактический остаток</th></tr></thead>
                <tbody id="scanlistBody"></tbody></table>
            </div>
            <div class="flex gap-3 mb-6">
                <button id="performInventoryBtn" class="bg-blue-600 text-white px-5 py-2 rounded-lg"><i class="fas fa-check-circle mr-1"></i> Провести инвентаризацию</button>
                <button id="exportInventoryProtocolBtn" class="bg-green-700 text-white px-5 py-2 rounded-lg"><i class="fas fa-file-csv"></i> Экспорт протокола</button>
            </div>
            <div id="inventoryResultArea" class="border-t pt-4">
                <h3 class="font-bold text-lg">Протокол расхождений</h3>
                <div id="inventoryProtocolContainer" class="scrollable-table mt-2"></div>
            </div>
        </div>
    `;
    const tbody = document.getElementById('scanlistBody');
    if(tbody) {
        tbody.innerHTML = StorageState.items.map(it => {
            const currentExp = expMap.get(it.item_code) !== undefined ? expMap.get(it.item_code) : 0;
            return `<tr><td>${it.item_code}</td><td>${it.name}</td><td><input type="number" id="scan_${it.item_code}" class="border rounded p-1 w-28" value="${currentExp}" step="1"></td></tr>`;
        }).join('');
    }
    document.getElementById('performInventoryBtn')?.addEventListener('click', window.performInventory);
    document.getElementById('exportInventoryProtocolBtn')?.addEventListener('click', window.exportInventoryProtocol);
};

window.performInventory = function() {
    const stockMap = getCalculatedStock();
    const newExpectedMap = new Map();
    StorageState.items.forEach(it => {
        const inp = document.getElementById(`scan_${it.item_code}`);
        if(inp) newExpectedMap.set(it.item_code, parseFloat(inp.value) || 0);
    });
    const deviations = [];
    for(let it of StorageState.items) {
        const calc = stockMap.get(it.item_code) || 0;
        const fact = newExpectedMap.get(it.item_code) || 0;
        if(calc !== fact) deviations.push({item_code: it.item_code, name: it.name, calculated: calc, actual: fact, diff: Math.abs(calc-fact)});
    }
    if(deviations.length === 0) {
        alert("✅ Расхождений нет! Инвентаризация завершена, эталон обновлён.");
    } else {
        alert(`⚠️ Обнаружены расхождения по ${deviations.length} позициям. Протокол сформирован.`);
    }
    for(let it of StorageState.items) {
        const fact = newExpectedMap.get(it.item_code);
        if(fact !== undefined) {
            StorageState.stockExpected = StorageState.stockExpected.filter(e => e.item_code !== it.item_code);
            StorageState.stockExpected.push({item_code: it.item_code, qty_expected: fact, date: new Date().toISOString().slice(0,10)});
        }
    }
    saveToLocal();
    window.displayInventoryProtocol(deviations);
    if(StorageState.activeTab === 'stock') renderStock();
};

window.displayInventoryProtocol = function(deviations) {
    const container = document.getElementById('inventoryProtocolContainer');
    if(!container) return;
    if(deviations.length === 0) {
        container.innerHTML = `<div class="p-3 bg-green-50 text-green-700 rounded">Нет расхождений. Все позиции соответствуют.</div>`;
    } else {
        let html = `<table class="min-w-full border"><thead><tr><th>Товар</th><th>Расчётный остаток</th><th>Фактический</th><th>|Расхождение|</th></tr></thead><tbody>`;
        deviations.forEach(d => {
            html += `<tr><td>${d.item_code} (${d.name})</td><td>${d.calculated}</td><td>${d.actual}</td><td class="font-bold text-red-600">${d.diff}</td></tr>`;
        });
        html += `</tbody></table><p class="mt-2 text-sm">Всего расхождений: ${deviations.length}</p>`;
        container.innerHTML = html;
    }
};

window.exportInventoryProtocol = function() {
    const stockMap = getCalculatedStock();
    const expMap = getExpectedMap();
    const rows = [['Код товара','Наименование','Расчётный остаток','Эталон (факт)','|Расхождение|']];
    StorageState.items.forEach(it => {
        const calc = stockMap.get(it.item_code) || 0;
        const exp = expMap.get(it.item_code);
        if(exp !== undefined && calc !== exp) {
            rows.push([it.item_code, it.name, calc, exp, Math.abs(calc-exp)]);
        }
    });
    if(rows.length === 1) { alert("Нет расхождений для экспорта"); return; }
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventory_protocol_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
};

window.renderReports = function() {
    const container = document.getElementById('reportsTab');
    if(!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow p-5">
            <h2 class="text-xl font-bold mb-4">Отчёты по складу</h2>
            <div class="flex flex-wrap gap-3 items-end mb-6">
                <div><label class="block text-sm">Дата начала</label><input type="date" id="reportStart" class="border rounded p-2"></div>
                <div><label class="block text-sm">Дата окончания</label><input type="date" id="reportEnd" class="border rounded p-2"></div>
                <button id="applyReportBtn" class="bg-blue-600 text-white px-4 py-2 rounded">Сформировать</button>
                <button id="fullReportBtn" class="bg-green-700 text-white px-4 py-2 rounded">Полный отчёт</button>
            </div>
            <div id="reportContent" class="mt-4"></div>
        </div>
    `;
    document.getElementById('applyReportBtn').onclick = () => window.generateReport(true);
    document.getElementById('fullReportBtn').onclick = () => window.generateReport(false);
};

window.generateReport = function(usePeriod) {
    let startDate = null, endDate = null;
    if(usePeriod) {
        startDate = document.getElementById('reportStart').value;
        endDate = document.getElementById('reportEnd').value;
        if(!endDate) { alert("Выберите дату окончания"); return; }
    }
    const targetDate = endDate || new Date().toISOString().slice(0,10);
    const stockMap = getCalculatedStock(targetDate);
    const expMap = getExpectedMap(targetDate);
    
    let totalItems = StorageState.items.length;
    let totalReceiptQty = 0, totalIssueQty = 0, totalCalculated = 0, totalExpected = 0, totalDelta = 0;
    
    const details = [];
    for(let it of StorageState.items) {
        const receiptsSum = getTotalReceipts(it.item_code, startDate, endDate);
        const issuesSum = getTotalIssues(it.item_code, startDate, endDate);
        const currentStock = stockMap.get(it.item_code) || 0;
        const expected = expMap.get(it.item_code);
        const delta = expected !== undefined ? currentStock - expected : null;
        
        totalReceiptQty += receiptsSum;
        totalIssueQty += issuesSum;
        totalCalculated += currentStock;
        if(expected !== undefined) {
            totalExpected += expected;
            if(delta !== null) totalDelta += delta;
        }
        
        details.push({
            code: it.item_code, name: it.name, uom: it.uom,
            receiptsSum, issuesSum, currentStock,
            expected: expected !== undefined ? expected : '—',
            delta: delta !== null ? delta : '—'
        });
    }
    
    let html = `
        <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 class="text-lg font-bold mb-2">Краткая сводка</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span class="font-semibold">Всего товаров:</span> ${totalItems}</div>
                <div><span class="font-semibold">Суммарный приход:</span> ${totalReceiptQty} ед.</div>
                <div><span class="font-semibold">Суммарный расход:</span> ${totalIssueQty} ед.</div>
                <div><span class="font-semibold">Суммарный расчётный остаток:</span> ${totalCalculated} ед.</div>
                <div><span class="font-semibold">Суммарный эталонный остаток:</span> ${totalExpected} ед.</div>
                <div><span class="font-semibold text-red-600">Общее расхождение:</span> ${totalDelta} ед.</div>
            </div>
        </div>
        <h3 class="text-lg font-bold mb-2">Детальная информация по товарам</h3>
        <div class="scrollable-table border rounded">
            <table class="min-w-full">
                <thead class="bg-gray-100">
                    <tr><th>Код</th><th>Наименование</th><th>Ед.изм</th><th>Приход</th><th>Расход</th><th>Текущий остаток</th><th>Эталон</th><th>Дельта</th></tr>
                </thead>
                <tbody>
                    ${details.map(d => `
                        <tr>
                            <td>${d.code}</td><td>${d.name}</td><td>${d.uom}</td>
                            <td>${d.receiptsSum}</td><td>${d.issuesSum}</td><td>${d.currentStock}</td>
                            <td>${d.expected}</td><td class="${d.delta !== '—' && d.delta !== 0 ? 'text-red-500 font-semibold' : ''}">${d.delta}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    document.getElementById('reportContent').innerHTML = html;
};

window.renderImport = function() {
    const container = document.getElementById('importTab');
    if(!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow p-5">
            <h2 class="text-xl font-semibold mb-3">Импорт данных из CSV</h2>
            <div class="space-y-4">
                <div><label class="block font-medium">Приходы (item_code,qty,date)</label><input type="file" id="importReceiptsFile" accept=".csv" class="border p-1"></div>
                <div><label class="block font-medium">Расходы (item_code,qty,date)</label><input type="file" id="importIssuesFile" accept=".csv" class="border p-1"></div>
                <button id="doImportBtn" class="bg-indigo-600 text-white px-4 py-2 rounded">Загрузить и добавить</button>
            </div>
        </div>`;
    document.getElementById('doImportBtn')?.addEventListener('click', () => {
        const receiptFile = document.getElementById('importReceiptsFile')?.files[0];
        const issueFile = document.getElementById('importIssuesFile')?.files[0];
        if(receiptFile) window.parseCSVFile(receiptFile, 'receipts');
        if(issueFile) window.parseCSVFile(issueFile, 'issues');
    });
};

window.parseCSVFile = function(file, type) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).slice(1);
        let added = 0;
        for(let line of lines) {
            if(!line.trim()) continue;
            const parts = line.split(',');
            if(parts.length < 3) continue;
            const item_code = parts[0].trim();
            const qty = parseFloat(parts[1]);
            const date = parts[2].trim();
            if(!StorageState.items.find(i=>i.item_code===item_code)) continue;
            if(isNaN(qty) || !date) continue;
            if(type === 'receipts') addReceipt(item_code, qty, date);
            else if(type === 'issues') addIssue(item_code, qty, date);
            added++;
        }
        alert(`Импортировано зарисей: ${added}`);
        if(StorageState.activeTab === 'receipt') renderReceipts();
        if(StorageState.activeTab === 'issue') renderIssues();
    };
    reader.readAsText(file);
};