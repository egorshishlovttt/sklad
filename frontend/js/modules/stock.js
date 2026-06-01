function getCalculatedStock(asOfDate = null) {
    const targetTime = asOfDate ? new Date(asOfDate).getTime() : Date.now();
    const map = new Map();
    
    receipts.forEach(r => { 
        if(new Date(r.date).getTime() <= targetTime) {
            map.set(r.item_code, (map.get(r.item_code) || 0) + parseFloat(r.qty));
        }
    });
    issues.forEach(i => { 
        if(new Date(i.date).getTime() <= targetTime) {
            map.set(i.item_code, (map.get(i.item_code) || 0) - parseFloat(i.qty));
        }
    });
    return map;
}

function getLastActualMap(asOfDate = null) {
    const targetDate = asOfDate || new Date().toISOString().slice(0,10);
    const map = new Map();
    const sorted = [...stockExpected].filter(e => e.date <= targetDate).sort((a,b)=>new Date(b.date)-new Date(a.date));
    sorted.forEach(e => { if(!map.has(e.item_code)) map.set(e.item_code, e.qty_expected); });
    return map;
}

function calculateAndFillStockTable() {
    const asOfDate = stockFilters.date ? stockFilters.date + "T23:59:59" : null;
    const calculatedMap = getCalculatedStock(asOfDate); 
    const lastActualMap = getLastActualMap(asOfDate ? stockFilters.date : null);
    
    const tbody = document.getElementById('stockTableBody');
    if(!tbody) return;

    let totalPositionsCount = 0;
    let accuratePositionsCount = 0;
    let htmlLines = [];

    items.forEach(it => {
        const calculated = calculatedMap.get(it.item_code) || 0; 
        const actual = lastActualMap.get(it.item_code); 
        const delta = actual !== undefined ? actual - calculated : 0;

        totalPositionsCount++;
        if (actual !== undefined && delta === 0) accuratePositionsCount++;

        if (stockFilters.deviation === 'match' && delta !== 0) return;
        if (stockFilters.deviation === 'diff' && delta === 0) return;
        if (stockFilters.deviation === 'deficit' && (actual === undefined || delta >= 0)) return;
        if (stockFilters.deviation === 'surplus' && (actual === undefined || delta <= 0)) return;

        const deltaText = actual !== undefined ? (delta > 0 ? '+' + delta : delta) : '—';
        const deltaClass = actual !== undefined ? (delta < 0 ? 'text-rose-600 font-bold' : delta > 0 ? 'text-amber-600 font-bold' : 'text-slate-500') : 'text-slate-400';

        htmlLines.push(`
            <tr>
                <td class="font-bold">${it.item_code}</td>
                <td>${it.name}</td>
                <td class="font-mono text-slate-700 font-bold">${calculated}</td>
                <td class="font-mono">${actual !== undefined ? actual : '<span class="text-slate-400 text-xs">не проводилась</span>'}</td>
                <td class="${deltaClass}">${deltaText}</td>
            </tr>`);
    });

    tbody.innerHTML = htmlLines.join('');
    const accuracyPercent = totalPositionsCount > 0 ? ((accuratePositionsCount / totalPositionsCount) * 100).toFixed(1) : "0.0";
    const widget = document.getElementById('accuracyWidgetValue');
    if(widget) widget.innerText = `${accuracyPercent}%`;
}

function renderStock() {
    const container = document.getElementById('stockTab');
    container.innerHTML = `
        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
            <div class="flex justify-between items-start mb-5 flex-wrap gap-4">
                <div>
                    <h2 class="text-xl font-bold text-slate-800">Состояние баланса остатков</h2>
                    <p class="text-xs text-slate-400 mt-1">Панель сквозного мониторинга запасов в реальном времени</p>
                </div>
                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3 shadow-inner">
                    <div class="p-2.5 bg-blue-600 text-white rounded-lg"><i class="fas fa-bullseye text-xl"></i></div>
                    <div>
                        <div class="text-[10px] font-black text-blue-500 tracking-wider uppercase">Точность склада</div>
                        <div class="text-xl font-black text-slate-800" id="accuracyWidgetValue">0.0%</div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-5 shadow-inner text-xs">
                <div>
                    <label class="block font-bold text-slate-500 mb-1">Фильтр по дате остатков</label>
                    <input type="date" id="filterStockDate" class="w-full border rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-blue-500" value="${stockFilters.date}">
                </div>
                <div>
                    <label class="block font-bold text-slate-500 mb-1">Диапазон расхождений</label>
                    <select id="filterStockDeviation" class="w-full border rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="all" ${stockFilters.deviation==='all'?'selected':''}>Все позиции</option>
                        <option value="match" ${stockFilters.deviation==='match'?'selected':''}>Идеальное совпадение (Дельта = 0)</option>
                        <option value="diff" ${stockFilters.deviation==='diff'?'selected':''}>Любые расхождения (Дельта ≠ 0)</option>
                        <option value="deficit" ${stockFilters.deviation==='deficit'?'selected':''}>Только недостачи (Дельта < 0)</option>
                        <option value="surplus" ${stockFilters.deviation==='surplus'?'selected':''}>Только излишки (Дельта > 0)</option>
                    </select>
                </div>
            </div>

            <div class="scrollable-table border border-slate-100 rounded-xl">
                <table class="w-full text-left">
                    <thead class="bg-slate-50"><tr><th>Код товара</th><th>Наименование товара</th><th>Учетный остаток (Система)</th><th>Фактический остаток (Склад)</th><th>Разница (Дельта)</th></tr></thead>
                    <tbody id="stockTableBody"></tbody>
                </table>
            </div>
        </div>`;

    const triggerReRender = () => {
        stockFilters.date = document.getElementById('filterStockDate').value;
        stockFilters.deviation = document.getElementById('filterStockDeviation').value;
        calculateAndFillStockTable();
    };

    document.getElementById('filterStockDate').onchange = triggerReRender;
    document.getElementById('filterStockDeviation').onchange = triggerReRender;

    calculateAndFillStockTable();
}