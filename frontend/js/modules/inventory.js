function displayInventoryProtocol(deviations) {
    const container = document.getElementById('inventoryProtocolContainer');
    if(!container) return;
    if(deviations.length === 0) {
        container.innerHTML = `<div class="p-4 bg-slate-50 text-slate-400 rounded-xl text-xs border border-dashed">Разницы не обнаружено. Введите данные для запуска анализа.</div>`;
    } else {
        container.innerHTML = `
            <div class="scrollable-table border border-slate-100 rounded-xl">
                <table class="w-full text-left">
                    <thead class="bg-slate-50"><tr><th>Код товара</th><th>Наименование товара</th><th>Учетный баланс</th><th>Фактический баланс</th><th>Разница</th></tr></thead>
                    <tbody>${deviations.map(d => `<tr><td class="font-bold">${d.item_code}</td><td>${d.name}</td><td class="font-mono">${d.calculated}</td><td class="font-mono bg-blue-50/20">${d.actual}</td><td class="font-bold ${d.diff < 0 ? 'text-rose-600' : 'text-amber-600'}">${d.diff > 0 ? 'Излишек (+' + d.diff + ')' : 'Недостача (' + d.diff + ')'}</td></tr>`).join('')}</tbody>
                </table>
            </div>`;
    }
}

async function performInventory() {
    const calculatedMap = getCalculatedStock();
    const newActualData = items.map(it => ({ item_code: it.item_code, qty_expected: parseFloat(document.getElementById(`scan_${it.item_code}`).value) || 0, date: new Date().toISOString().slice(0,10) }));
    if(await apiRequest('/inventory/perform', 'POST', { newExpected: newActualData })) {
        stockExpected = await apiRequest('/inventory/expected') || [];
        const deviations = [];
        items.forEach(it => {
            const calculated = calculatedMap.get(it.item_code) || 0;
            const actual = newActualData.find(e => e.item_code === it.item_code).qty_expected;
            if(calculated !== actual) deviations.push({ item_code: it.item_code, name: it.name, calculated, actual, diff: actual - calculated });
        });
        const banner = document.getElementById('inventoryAlertBanner'); banner.classList.remove('hidden');
        
        if (deviations.length === 0) {
            banner.className = "p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl text-emerald-800 text-sm font-medium";
            banner.innerHTML = `<i class="fas fa-check-circle mr-2"></i>Инвентаризационная ведомость закрыта без отклонений.`;
        } else {
            banner.className = "p-4 bg-rose-50 border-l-4 border-rose-500 rounded-xl text-rose-800 text-sm font-medium";
            banner.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>Зафиксировано <strong>${deviations.length} отклонений</strong> в инвентаризационной ведомости.`;
        }
        displayInventoryProtocol(deviations);
    }
}

function exportInventoryProtocol() {
    const calculatedMap = getCalculatedStock(); 
    const lastActualMap = getLastActualMap();
    const rows = [['Код товара','Наименование товара','Расчетный остаток','Фактический остаток','Дельта']];
    items.forEach(it => {
        const calculated = calculatedMap.get(it.item_code) || 0; 
        const actual = lastActualMap.get(it.item_code);
        if(actual !== undefined && calculated !== actual) rows.push([it.item_code, it.name, calculated, actual, actual - calculated]);
    });
    downloadCsvExcel(`инвентаризация_расхождения_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function renderInventory() {
    const calculatedMap = getCalculatedStock();
    document.getElementById('inventoryTab').innerHTML = `
        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
            <div class="flex justify-between items-center flex-wrap gap-2 mb-4">
                <h2 class="text-xl font-bold text-slate-800">Проведение инвентаризационной ведомости</h2>
                <button id="importInventoryCsvBtn" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"><i class="fas fa-file-upload mr-1"></i>Загрузить факт (CSV)</button>
            </div>
            <div id="inventoryAlertBanner" class="my-3 hidden"></div>
            <div class="scrollable-table border border-slate-100 rounded-xl mb-4">
                <table class="w-full text-left">
                    <thead class="bg-slate-50"><tr><th>Код товара</th><th>Наименование товара</th><th class="text-center w-44">Учетные данные</th><th class="text-center w-44">Фактическое наличие</th></tr></thead>
                    <tbody>${items.map(it => {
                        return `<tr><td class="font-bold">${it.item_code}</td><td>${it.name}</td><td class="text-center font-mono font-bold text-slate-500 bg-slate-50/50" id="calc_val_${it.item_code}">${calculatedMap.get(it.item_code) || 0}</td><td class="text-center"><input type="number" id="scan_${it.item_code}" class="border border-blue-200 rounded-xl p-1.5 w-32 text-center bg-blue-50/50 font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white" value="0" min="0" step="any"></td></tr>`;
                    }).join('')}</tbody>
                </table>
            </div>
            <div class="flex gap-3 mb-5">
                <button id="performInventoryBtn" class="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md hover:bg-blue-700 transition"><i class="fas fa-check-circle mr-1"></i>Провести ведомость</button>
                <button id="exportInventoryProtocolBtn" class="bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-800 transition"><i class="fas fa-file-csv mr-1"></i>Скачать протокол расхождений</button>
            </div>
            <div class="border-t pt-4">
                <h3 class="font-bold text-slate-700 mb-3 text-base">Протокол схождения текущей сессии</h3>
                <div id="inventoryProtocolContainer"></div>
            </div>
        </div>`;
        
    document.getElementById('performInventoryBtn').onclick = performInventory;
    document.getElementById('exportInventoryProtocolBtn').onclick = exportInventoryProtocol;
    document.getElementById('importInventoryCsvBtn').onclick = () => document.getElementById('inventoryCsvInput').click();
    displayInventoryProtocol([]); 
}

document.getElementById('inventoryCsvInput').onchange = function(e) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const lines = evt.target.result.split('\n').map(line => line.replace('\r', '').trim()); 
        const csvTotals = {};
        let processedLinesCount = 0;

        lines.forEach((line, idx) => {
            if(idx === 0 || !line) return;

            let separator = ',';
            if ((line.match(/;/g) || []).length > (line.match(/,/g) || []).length) separator = ';';

            const cols = line.split(separator);
            if(cols.length >= 2) {
                const itemCode = cols[0].trim();
                let rawQty = cols[1].trim();
                if (separator === ';') rawQty = rawQty.replace(',', '.');
                const qty = parseFloat(rawQty);
                
                if (!isNaN(qty) && itemCode) {
                    if (csvTotals[itemCode] !== undefined) {
                        csvTotals[itemCode] += qty;
                    } else {
                        csvTotals[itemCode] = qty;
                    }
                    processedLinesCount++;
                }
            }
        });

        let successCount = 0;
        for (const itemCode in csvTotals) {
            const inputEl = document.getElementById(`scan_${itemCode}`);
            if (inputEl) {
                inputEl.value = csvTotals[itemCode];
                successCount++;
            }
        }

        if (successCount === 0) {
            showToast('Ошибка импорта', 'Не удалось сопоставить товары. Проверьте совпадение кодов!', 'error');
        } else {
            showToast('Данные подтянуты', `Строк обработано: ${processedLinesCount}. Заполнено товаров: ${successCount}. Нажмите "Провести ведомость"!`, 'success');
        }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; 
};