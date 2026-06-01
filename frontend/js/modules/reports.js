function getTotalReceipts(item_code, startDate, endDate) {
    let sum = 0; 
    receipts.forEach(r => { 
        if(r.item_code === item_code && (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate)) sum += r.qty; 
    }); 
    return sum;
}

function getTotalIssues(item_code, startDate, endDate) {
    let sum = 0; 
    issues.forEach(i => { 
        if(i.item_code === item_code && (!startDate || i.date >= startDate) && (!endDate || i.date <= endDate)) sum += i.qty; 
    }); 
    return sum;
}

function initLiveFilter() {
    const searchContainer = document.getElementById('reportSearchContainer');
    if (searchContainer) {
        searchContainer.classList.remove('hidden');
        const searchInput = document.getElementById('reportSearchItem');
        searchInput.value = '';
        searchInput.oninput = () => {
            const query = searchInput.value.toLowerCase().trim();
            const tableRows = document.querySelectorAll('#reportContent tbody tr');
            tableRows.forEach(row => {
                const text = row.innerText.toLowerCase();
                if (text.includes(query)) {
                    row.classList.remove('hidden');
                } else {
                    row.classList.add('hidden');
                }
            });
        };
    }
}

function validateReportDates() {
    const start = document.getElementById('reportStart').value;
    const end = document.getElementById('reportEnd').value;
    if (start && end && new Date(start) > new Date(end)) {
        showToast('Неверный период', 'Дата начала не может быть позже даты конца!', 'error');
        return false;
    }
    return { start, end };
}

function generateReport() {
    currentReportType = 'movement';
    const dates = validateReportDates();
    if (!dates) return;

    const startDate = dates.start; 
    const endDate = dates.end;
    const selectedItemCode = document.getElementById('reportItemSelect').value;

    const targetDate = endDate ? endDate + "T23:59:59" : new Date().toISOString();
    const calculatedMap = getCalculatedStock(targetDate); 
    const lastActualMap = getLastActualMap(endDate);
    
    let totalReceiptQty = 0, totalIssueQty = 0, totalCalculated = 0; 
    const details = [];

    currentReportDataCache = [['Код товара', 'Наименование товара', 'Ед. изм.', 'Приход за период', 'Расход за период', 'Учетный остаток', 'Факт', 'Дельта']];

    items.forEach(it => {
        if (selectedItemCode !== 'all' && it.item_code !== selectedItemCode) return;

        const receiptsSum = getTotalReceipts(it.item_code, startDate, endDate); 
        const issuesSum = getTotalIssues(it.item_code, startDate, endDate);
        const calculatedStock = calculatedMap.get(it.item_code) || 0; 
        const actualStock = lastActualMap.get(it.item_code); 
        const delta = actualStock !== undefined ? actualStock - calculatedStock : null;
        
        totalReceiptQty += receiptsSum; 
        totalIssueQty += issuesSum; 
        totalCalculated += calculatedStock;

        const factText = actualStock !== undefined ? actualStock : '—';
        const deltaText = delta !== null ? (delta > 0 ? '+' + delta : delta) : '—';

        details.push({ code: it.item_code, name: it.name, uom: it.uom, receiptsSum, issuesSum, calculatedStock, actualStock: factText, delta: deltaText });
        currentReportDataCache.push([it.item_code, it.name, it.uom, receiptsSum, issuesSum, calculatedStock, factText, deltaText]);
    });

    document.getElementById('reportContent').innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-5">
            <div class="bg-white p-4 border border-slate-100 shadow-sm rounded-xl"><div class="text-xs text-slate-400 font-bold">ПОЗИЦИЙ В ВЕДОМОСТИ</div><div class="text-2xl font-black mt-1 text-slate-800">${details.length} шт.</div></div>
            <div class="bg-white p-4 border border-slate-100 shadow-sm rounded-xl"><div class="text-xs text-slate-400 font-bold">ОБОРОТ ПРИХОДА</div><div class="text-2xl font-black mt-1 text-emerald-600">+${totalReceiptQty}</div></div>
            <div class="bg-white p-4 border border-slate-100 shadow-sm rounded-xl"><div class="text-xs text-slate-400 font-bold">ОБОРОТ РАСХОДА</div><div class="text-2xl font-black mt-1 text-rose-600">-${totalIssueQty}</div></div>
            <div class="bg-white p-4 border border-slate-100 shadow-sm rounded-xl"><div class="text-xs text-slate-400 font-bold">ИТОГ БАЛАНСА</div><div class="text-2xl font-black mt-1 text-blue-600">${totalCalculated}</div></div>
        </div>
        <div class="scrollable-table border border-slate-100 rounded-xl">
            <table class="w-full text-left">
                <thead class="bg-slate-50"><tr><th>Код товара</th><th>Наименование товара</th><th>Ед. изм.</th><th>Приход за период</th><th>Расход за период</th><th>Учетный остаток</th><th>Факт</th><th>Дельта</th></tr></thead>
                <tbody>${details.map(d => `<tr><td class="font-bold">${d.code}</td><td>${d.name}</td><td>${d.uom}</td><td class="font-mono text-emerald-600">+${d.receiptsSum}</td><td class="font-mono text-rose-600">-${d.issuesSum}</td><td class="font-semibold">${d.calculatedStock}</td><td>${d.actualStock}</td><td class="${d.delta !== '—' && d.delta !== 0 ? 'text-rose-600 font-bold' : ''}">${d.delta}</td></tr>`).join('')}</tbody>
            </table>
        </div>`;

    initLiveFilter();
}

function generateTurnoverReport() {
    currentReportType = 'turnover';
    const dates = validateReportDates();
    if (!dates) return;

    let startDate = dates.start; 
    let endDate = dates.end;
    const selectedItemCode = document.getElementById('reportItemSelect').value;

    const stockAtStartMap = getCalculatedStock(startDate ? startDate + "T00:00:00" : "1970-01-01T00:00:00");
    const stockAtEndMap = getCalculatedStock(endDate ? endDate + "T23:59:59" : new Date().toISOString());
    const details = [];

    currentReportDataCache = [['Код товара', 'Наименование товара', 'Запас на начало', 'Запас на конец', 'Средний запас', 'Расход (Списано)', 'Коэф. Оборачиваемости']];

    items.forEach(it => {
        if (selectedItemCode !== 'all' && it.item_code !== selectedItemCode) return;

        const startStock = stockAtStartMap.get(it.item_code) || 0;
        const endStock = stockAtEndMap.get(it.item_code) || 0;
        const averageStock = (startStock + endStock) / 2;
        const totalSpent = getTotalIssues(it.item_code, startDate, endDate);
        
        let turnoverRatio = 0;
        if (averageStock > 0) {
            turnoverRatio = parseFloat((totalSpent / averageStock).toFixed(2));
        } else if (totalSpent > 0 && averageStock === 0) {
            turnoverRatio = totalSpent;
        }

        details.push({ code: it.item_code, name: it.name, startStock, endStock, averageStock, totalSpent, turnoverRatio });
        currentReportDataCache.push([it.item_code, it.name, startStock, endStock, averageStock, totalSpent, turnoverRatio]);
    });

    document.getElementById('reportContent').innerHTML = `
        <div class="mb-3 p-4 bg-indigo-50 border-l-4 border-indigo-600 text-indigo-900 rounded-r-xl text-xs">
            <i class="fas fa-info-circle mr-1"></i> <strong>Оборачиваемость запасов:</strong> Коэффициент = Расход за период / Средний запас за период. ${!startDate && !endDate ? 'Расчет произведен <strong>за всё время</strong> работы системы.' : ''}
        </div>
        <div class="scrollable-table border border-slate-100 rounded-xl">
            <table class="w-full text-left">
                <thead class="bg-slate-50"><tr><th>Код товара</th><th>Наименование товара</th><th>Запас на начало</th><th>Запас на конец</th><th>Средний запас</th><th>Расход (Списано)</th><th class="text-indigo-700">Коэф. Оборачиваемости</th></tr></thead>
                <tbody>${details.map(d => `<tr><td class="font-bold">${d.code}</td><td>${d.name}</td><td class="font-mono text-slate-500">${d.startStock}</td><td class="font-mono text-slate-500">${d.endStock}</td><td class="font-mono bg-slate-50/50">${d.averageStock}</td><td class="font-mono text-rose-600 font-bold">${d.totalSpent}</td><td class="bg-indigo-50/40 font-black text-indigo-700">${d.turnoverRatio}</td></tr>`).join('')}</tbody>
            </table>
        </div>`;

    initLiveFilter();
}

function exportActiveReport() {
    if (currentReportDataCache.length <= 1) {
        return showToast('Нет данных', 'Сформируйте отчет перед выгрузкой!', 'error');
    }
    const namePrefix = currentReportType === 'movement' ? 'ведомость_движения' : 'анализ_оборачиваемости';
    const dateStamp = new Date().toISOString().slice(0,10);
    downloadCsvExcel(`${namePrefix}_${dateStamp}.csv`, currentReportDataCache);
}

function renderReports() {
    document.getElementById('reportsTab').innerHTML = `
        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
            <h2 class="text-xl font-bold text-slate-800 mb-4">Аналитические отчеты и материальные ведомости</h2>
            
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner space-y-3 mb-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end text-xs">
                    <div>
                        <label class="block font-bold text-slate-500 mb-1">Начало периода</label>
                        <input type="date" id="reportStart" class="w-full border rounded-xl p-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block font-bold text-slate-500 mb-1">Конец периода</label>
                        <input type="date" id="reportEnd" class="w-full border rounded-xl p-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block font-bold text-slate-500 mb-1">Интерактивный выбор / Поиск товара</label>
                        <select id="reportItemSelect" class="w-full border rounded-xl p-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="all">Все товары (Полный отчет)</option>
                        </select>
                    </div>
                    <div class="flex gap-1.5">
                        <button id="applyReportBtn" class="flex-1 bg-blue-600 text-white py-2 px-2 rounded-xl font-semibold hover:bg-blue-700 transition text-[11px]">Движение</button>
                        <button id="applyTurnoverReportBtn" class="flex-1 bg-indigo-600 text-white py-2 px-2 rounded-xl font-semibold hover:bg-indigo-700 transition text-[11px]">Оборачиваемость</button>
                    </div>
                </div>
                
                <div id="reportSearchContainer" class="hidden text-xs pt-1">
                    <label class="block font-bold text-slate-500 mb-1">Поиск совпадений по введенным символам</label>
                    <input type="text" id="reportSearchItem" placeholder="Введите код или наименование товара для фильтрации таблицы..." class="w-full border rounded-xl p-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                </div>

                <div class="flex justify-end pt-2 border-t border-slate-200">
                    <button id="unifiedDownloadReportBtn" class="bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-900 transition flex items-center gap-2">
                        <i class="fas fa-file-download"></i> Выгрузить отчет
                    </button>
                </div>
            </div>
            
            <div id="reportContent"></div>
        </div>`;

    const selectEl = document.getElementById('reportItemSelect');
    items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = it.item_code;
        opt.innerText = `${it.item_code} — ${it.name}`;
        selectEl.appendChild(opt);
    });

    document.getElementById('applyReportBtn').onclick = () => generateReport();
    document.getElementById('applyTurnoverReportBtn').onclick = () => generateTurnoverReport();
    document.getElementById('unifiedDownloadReportBtn').onclick = exportActiveReport;
}