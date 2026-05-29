document.addEventListener('DOMContentLoaded', function() {
    let items = [], receipts = [], issues = [], stockExpected = [], adminUsers = [];
    let currentModalType = '';
    let timeTimer = null;

    let stockFilters = { date: '', deviation: 'all' };
    let currentReportType = 'movement'; 
    let currentReportDataCache = []; 

    const roleTabs = {
        admin: ['items', 'receipt', 'issue', 'stock', 'inventory', 'reports', 'admin'],
        manager: ['items', 'receipt', 'issue', 'stock', 'inventory', 'reports'],
        storekeeper: ['items', 'receipt', 'issue', 'stock', 'reports'],
        analyst: ['stock', 'reports']
    };

    if (!document.getElementById('receiptCsvInput')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'receiptCsvInput';
        input.accept = '.csv';
        input.className = 'hidden';
        document.body.appendChild(input);
    }
    if (!document.getElementById('issueCsvInput')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'issueCsvInput';
        input.accept = '.csv';
        input.className = 'hidden';
        document.body.appendChild(input);
    }

    function getLocalDateTimeString() {
        return new Date().toISOString();
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '—';
        return dateStr.replace('T', ' ').slice(0, 19);
    }

    function showToast(title, message, type = 'error') {
        const toast = document.getElementById('toastNotification');
        const iconContainer = document.getElementById('toastIconContainer');
        const icon = document.getElementById('toastIcon');
        
        document.getElementById('toastTitle').innerText = title;
        document.getElementById('toastMessage').innerText = message;
        iconContainer.className = "p-2 rounded-lg text-white";
        
        if (type === 'error') {
            iconContainer.classList.add('bg-rose-500');
            icon.className = 'fas fa-exclamation-circle text-lg';
            toast.style.borderLeft = '4px solid #f43f5e';
        } else if (type === 'success') {
            iconContainer.classList.add('bg-emerald-500');
            icon.className = 'fas fa-check-circle text-lg';
            toast.style.borderLeft = '4px solid #10b981';
        } else {
            iconContainer.classList.add('bg-amber-500');
            icon.className = 'fas fa-info-circle text-lg';
            toast.style.borderLeft = '4px solid #f59e0b';
        }
        
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); }, 4000);
    }

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
        } catch (err) { showToast('Ошибка API', err.message, 'error'); return null; }
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

    function downloadCsvExcel(filename, rows) {
        const csvContent = rows.map(e => e.join(";")).join("\n");
        const BOM = "\uFEFF"; 
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
        const names = { items: '📦 Номенклатура', receipt: '📥 Приход', issue: '📤 Расход', stock: '📊 Остатки', inventory: '🔍 Инвентаризация', reports: '📈 Отчёты', admin: '👑 ...' };
        if (names.admin && role === 'admin') names.admin = '👑 Администрирование';
        
        container.innerHTML = '';
        allowed.forEach(tabId => {
            const btn = document.createElement('button');
            btn.className = `px-5 py-2.5 text-sm font-semibold rounded-xl transition transform active:scale-[0.97] ${window.appState.activeTab===tabId ? 'tab-active' : 'tab-inactive'}`;
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

    function renderItems() {
        const canEdit = window.appState.currentUser.role === 'admin' || window.appState.currentUser.role === 'manager';
        const container = document.getElementById('itemsTab');
        container.innerHTML = `
            <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                <div class="flex justify-between items-center mb-5 flex-wrap gap-2">
                    <h2 class="text-xl font-bold text-slate-800">Каталог товаров и номенклатуры</h2>
                    <div class="flex gap-2">
                        ${canEdit ? `
                            <button id="importNomenclatureBtn" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 transition"><i class="fas fa-file-import mr-1"></i> Импорт CSV</button>
                            <button id="openAddItemModalBtn" class="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition"><i class="fas fa-plus mr-1"></i> Добавить товар</button>
                        ` : ''}
                    </div>
                </div>
                <div class="scrollable-table border border-slate-100 rounded-xl">
                    <table>
                        <thead class="bg-slate-50"><tr><th>Код товара</th><th>Наименование товара</th><th>Ед. изм.</th><th class="w-20">Действие</th></tr></thead>
                        <tbody>${items.map(it => `<tr><td class="font-bold text-slate-700">${it.item_code}</td><td>${it.name}</td><td><span class="px-2 py-0.5 bg-slate-100 rounded text-xs font-semibold text-slate-600">${it.uom}</span></td><td>${canEdit ? `<button onclick="window.deleteItem('${it.item_code}')" class="text-rose-500 hover:text-rose-700"><i class="fas fa-trash-alt"></i></button>` : '—'}</td></tr>`).join('')}</tbody>
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

    document.getElementById('nomenclatureCsvInput').onchange = function(e) {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = async function(evt) {
            const lines = evt.target.result.split('\n'); let successCount = 0;
            for(let i = 0; i < lines.length; i++) {
                const line = lines[i].trim(); if(!line || i === 0) continue; 
                const cols = line.split(/[;,]/); 
                if(cols.length >= 2) {
                    await apiRequest('/items', 'POST', { 
                        item_code: cols[0].trim(), 
                        name: cols[1].trim(),
                        uom: cols[2] ? cols[2].trim() : 'шт' 
                    });
                    successCount++;
                }
            }
            showToast('Импорт выполнен', `Успешно загружено позиций: ${successCount}`, 'success');
            switchTab('items');
        };
        reader.readAsText(file, 'UTF-8');
    };

    window.deleteItem = async (code) => { if(confirm(`Удалить товар ${code}?`)) { await apiRequest(`/items/${code}`, 'DELETE'); switchTab('items'); } };

    document.getElementById('itemModalConfirmBtn').onclick = async () => {
        let item_code = document.getElementById('itemCode').value.trim();
        const name = document.getElementById('itemName').value.trim(); 
        const uom = document.getElementById('itemUom').value;
        if(!name) return showToast('Ошибка', 'Заполните наименование товара!', 'error');
        if(!item_code) item_code = generateNextItemCode();
        if(await apiRequest('/items', 'POST', { item_code, name, uom })) { document.getElementById('itemModal').classList.add('hidden'); switchTab('items'); }
    };

    function renderReceipts() {
        const container = document.getElementById('receiptTab');
        container.innerHTML = `
            <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                <div class="flex justify-between items-center mb-5 flex-wrap gap-2">
                    <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-arrow-down text-emerald-500 mr-2"></i>Документы прихода (Поступления)</h2>
                    <div class="flex gap-2">
                        <button id="importReceiptCsvBtn" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 transition"><i class="fas fa-file-import mr-1"></i> Импорт CSV</button>
                        <button id="openReceiptModalBtn" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition"><i class="fas fa-plus mr-1"></i>Оформить приход</button>
                    </div>
                </div>
                <div class="scrollable-table border border-slate-100 rounded-xl">
                    <table><thead><tr><th>№ Документа</th><th>Код товара</th><th>Наименование товара</th><th>Количество</th><th>Дата и время</th><th>Исполнитель</th><th class="w-20"></th></tr></thead>
                    <tbody>${receipts.map(r => { 
                        const item = items.find(i=>i.item_code===r.item_code); 
                        const creatorName = r.created_by || r.username || (window.appState.currentUser && (window.appState.currentUser.fullname || window.appState.currentUser.username)) || 'Система';
                        return `<tr><td>DOC-REC-${r.doc_id}</td><td class="font-bold">${r.item_code}</td><td>${item ? item.name : 'Неизвестный товар'}</td><td class="font-mono text-emerald-600 font-bold">+${r.qty}</td><td class="text-xs font-mono text-slate-600">${formatDateTime(r.date)}</td><td><span class="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded"><i class="fas fa-user text-slate-400 mr-1"></i>${creatorName}</span></td><td><button onclick="window.delDoc('receipts', ${r.doc_id})" class="text-rose-500 hover:text-rose-700"><i class="fas fa-trash"></i></button></td></tr>`; 
                    }).join('')}</tbody></table>
                </div>
            </div>`;
        document.getElementById('openReceiptModalBtn').onclick = () => openMovementModal('receipt');
        document.getElementById('importReceiptCsvBtn').onclick = () => document.getElementById('receiptCsvInput').click();
    }

    document.getElementById('receiptCsvInput').onchange = function(e) {
        handleMovementCsvImport(e, '/receipts', 'receipt');
    };

    function renderIssues() {
        const container = document.getElementById('issueTab');
        container.innerHTML = `
            <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                <div class="flex justify-between items-center mb-5 flex-wrap gap-2">
                    <h2 class="text-xl font-bold text-slate-800"><i class="fas fa-arrow-up text-orange-500 mr-2"></i>Документы расхода (Отгрузка)</h2>
                    <div class="flex gap-2">
                        <button id="importIssueCsvBtn" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 transition"><i class="fas fa-file-import mr-1"></i> Импорт CSV</button>
                        <button id="openIssueModalBtn" class="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-700 transition"><i class="fas fa-plus mr-1"></i>Оформить расход</button>
                    </div>
                </div>
                <div class="scrollable-table border border-slate-100 rounded-xl">
                    <table><thead><tr><th>№ Документа</th><th>Код товара</th><th>Наименование товара</th><th>Количество</th><th>Дата и время</th><th>Исполнитель</th><th class="w-20"></th></tr></thead>
                    <tbody>${issues.map(i => { 
                        const item = items.find(it=>it.item_code===i.item_code); 
                        const creatorName = i.created_by || i.username || (window.appState.currentUser && (window.appState.currentUser.fullname || window.appState.currentUser.username)) || 'Система';
                        return `<tr><td>DOC-ISS-${i.doc_id}</td><td class="font-bold">${i.item_code}</td><td>${item ? item.name : 'Неизвестный товар'}</td><td class="font-mono text-rose-600 font-bold">-${i.qty}</td><td class="text-xs font-mono text-slate-600">${formatDateTime(i.date)}</td><td><span class="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded"><i class="fas fa-user text-slate-400 mr-1"></i>${creatorName}</span></td><td><button onclick="window.delDoc('issues', ${i.doc_id})" class="text-rose-500 hover:text-rose-700"><i class="fas fa-trash"></i></button></td></tr>`; 
                    }).join('')}</tbody></table>
                </div>
            </div>`;
        document.getElementById('openIssueModalBtn').onclick = () => openMovementModal('issue');
        document.getElementById('importIssueCsvBtn').onclick = () => document.getElementById('issueCsvInput').click();
    }

    document.getElementById('issueCsvInput').onchange = function(e) {
        handleMovementCsvImport(e, '/issues', 'issue');
    };

    function handleMovementCsvImport(e, endpoint, tabName) {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = async function(evt) {
            const lines = evt.target.result.split('\n').map(l => l.replace('\r', '').trim()); 
            const currentUserName = window.appState.currentUser.fullname || window.appState.currentUser.username;
            const stockMap = getCalculatedStock();
            const tempSpentMap = new Map();
            
            let validRows = [];
            let conflictingRows = [];

            for(let i = 0; i < lines.length; i++) {
                const line = lines[i]; if(!line || i === 0) continue; 
                let sep = ',';
                if ((line.match(/;/g) || []).length > (line.match(/,/g) || []).length) sep = ';';
                const cols = line.split(sep); 
                if(cols.length >= 2) {
                    const item_code = cols[0].trim();
                    let rawQty = cols[1].trim();
                    if (sep === ';') rawQty = rawQty.replace(',', '.');
                    const qty = parseFloat(rawQty);

                    if (isNaN(qty) || qty <= 0 || !item_code) continue;

                    if (tabName === 'issue') {
                        const currentAvailable = stockMap.get(item_code) || 0;
                        const alreadySpent = tempSpentMap.get(item_code) || 0;
                        const finalAvailable = currentAvailable - alreadySpent;

                        if (qty > finalAvailable) {
                            const itemObj = items.find(it => it.item_code === item_code);
                            const itemName = itemObj ? itemObj.name : 'Неизвестный товар';
                            conflictingRows.push({
                                line: i + 1,
                                item_code,
                                name: itemName,
                                requested: qty,
                                available: finalAvailable
                            });
                        } else {
                            tempSpentMap.set(item_code, alreadySpent + qty);
                            validRows.push({ item_code, qty });
                        }
                    } else {
                        validRows.push({ item_code, qty });
                    }
                }
            }

            const uploadRows = async (rowsToUpload) => {
                let successCount = 0;
                for (const row of rowsToUpload) {
                    const localTime = getLocalDateTimeString();
                    await apiRequest(endpoint, 'POST', { 
                        item_code: row.item_code, 
                        qty: row.qty,
                        date: localTime, 
                        created_by: currentUserName 
                    });
                    successCount++;
                }
                if (successCount > 0) {
                    showToast('Импорт завершен', `Успешно проведено документов: ${successCount}`, 'success');
                }
                switchTab(tabName);
            };

            if (tabName === 'issue' && conflictingRows.length > 0) {
                const modal = document.getElementById('csvConflictModal');
                const listContainer = document.getElementById('csvConflictList');
                const cancelBtn = document.getElementById('csvCancelAllBtn');
                const partialBtn = document.getElementById('csvProceedPartialBtn');

                listContainer.innerHTML = conflictingRows.map(r => 
                    `<div>Строка ${r.line}: ${r.item_code} "${r.name}" — затребовано ${r.requested}, в наличии ${r.available}</div>`
                ).join('');

                modal.classList.remove('hidden');

                cancelBtn.onclick = () => {
                    modal.classList.add('hidden');
                    showToast('Импорт отменен', 'Операция полностью отклонена пользователем.', 'info');
                };

                partialBtn.onclick = async () => {
                    modal.classList.add('hidden');
                    if (validRows.length === 0) {
                        showToast('Нечего проводить', 'Нет строк, количество которых удовлетворяет остаткам на складе.', 'error');
                        return;
                    }
                    await uploadRows(validRows);
                };
            } else {
                if (validRows.length > 0) {
                    await uploadRows(validRows);
                } else {
                    showToast('Ошибка импорта', 'Файл не содержит корректных данных для загрузки.', 'error');
                }
            }
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = ''; 
    }

    window.delDoc = async (type, id) => { 
        if(confirm('Аннулировать и удалить данный документ движения?')) { 
            const res = await apiRequest(`/${type}/${id}`, 'DELETE'); 
            if (res) {
                showToast('Документ аннулирован', 'Запись о движении успешно удалена из системы', 'success');
                switchTab(type === 'receipts' ? 'receipt' : 'issue'); 
            } else {
                showToast('Ошибка удаления', 'Не удалось удалить выбранный документ', 'error');
            }
        } 
    };

    function openMovementModal(type) {
        currentModalType = type;
        document.getElementById('modalTitle').innerText = type === 'receipt' ? 'Новое поступление товара' : 'Новое списание (Расход)';
        document.getElementById('modalItemCode').innerHTML = '<option value="">Выберите товар из каталога</option>' + items.map(i => `<option value="${i.item_code}">${i.item_code} — ${i.name}</option>`).join('');
        document.getElementById('modalQty').value = ''; 
        
        if(timeTimer) clearInterval(timeTimer);
        const updateLabel = () => {
            const lbl = document.getElementById('modalCurrentTimeLabel');
            if(lbl) lbl.innerText = formatDateTime(getLocalDateTimeString());
        };
        updateLabel();
        timeTimer = setInterval(updateLabel, 1000);

        document.getElementById('movementModal').classList.remove('hidden');
    }

    document.getElementById('modalConfirmBtn').onclick = async () => {
        const item_code = document.getElementById('modalItemCode').value; 
        const qty = parseFloat(document.getElementById('modalQty').value); 
        
        if(!item_code || !qty || qty <= 0 || isNaN(qty)) {
            showToast('Ошибка корректности', 'Проверьте правильность заполнения всех полей!', 'error');
            return;
        }

        const finalDateTime = getLocalDateTimeString();
        
        if (currentModalType === 'issue') {
            const currentStockMap = getCalculatedStock();
            const maxAvailable = currentStockMap.get(item_code) || 0;
            if (qty > maxAvailable) {
                showToast('Списание заблокировано', `Недостаточно свободных единиц на складе. В наличии: ${maxAvailable}.`, 'error');
                return; 
            }
        }
        
        const payload = { 
            item_code, 
            qty, 
            date: finalDateTime, 
            created_by: window.appState.currentUser.fullname || window.appState.currentUser.username 
        };
        
        if(await apiRequest(currentModalType === 'receipt' ? '/receipts' : '/issues', 'POST', payload)) { 
            if(timeTimer) clearInterval(timeTimer);
            document.getElementById('movementModal').classList.add('hidden'); 
            showToast('Успешно проведено', 'Документ успешно записан в базу данных', 'success');
            switchTab(currentModalType); 
        }
    };

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
                    <table>
                        <thead class="bg-slate-50">
                            <tr><th>Код товара</th><th>Наименование товара</th><th>Учетный остаток (Система)</th><th>Фактический остаток (Склад)</th><th>Разница (Дельта)</th></tr>
                        </thead>
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
                    <table>
                        <thead class="bg-slate-50">
                            <tr><th>Код товара</th><th>Наименование товара</th><th class="text-center w-44">Учетные данные</th><th class="text-center w-44">Фактическое наличие</th></tr>
                        </thead>
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

    function displayInventoryProtocol(deviations) {
        const container = document.getElementById('inventoryProtocolContainer');
        if(!container) return;
        if(deviations.length === 0) {
            container.innerHTML = `<div class="p-4 bg-slate-50 text-slate-400 rounded-xl text-xs border border-dashed">Разницы не обнаружено. Введите данные для запуска анализа.</div>`;
        } else {
            container.innerHTML = `
                <div class="scrollable-table border border-slate-100 rounded-xl">
                    <table>
                        <thead class="bg-slate-50"><tr><th>Код товара</th><th>Наименование товара</th><th>Учетный баланс</th><th>Фактический баланс</th><th>Разница</th></tr></thead>
                        <tbody>${deviations.map(d => `<tr><td class="font-bold">${d.item_code}</td><td>${d.name}</td><td class="font-mono">${d.calculated}</td><td class="font-mono bg-blue-50/20">${d.actual}</td><td class="font-bold ${d.diff < 0 ? 'text-rose-600' : 'text-amber-600'}">${d.diff > 0 ? 'Излишек (+' + d.diff + ')' : 'Недостача (' + d.diff + ')'}</td></tr>`).join('')}</tbody>
                    </table>
                </div>`;
        }
    }

    function exportInventoryProtocol() {
        const calculatedMap = getCalculatedStock(); const lastActualMap = getLastActualMap();
        const rows = [['Код товара','Наименование товара','Расчетный остаток','Фактический остаток','Дельта']];
        items.forEach(it => {
            const calculated = calculatedMap.get(it.item_code) || 0; const actual = lastActualMap.get(it.item_code);
            if(actual !== undefined && calculated !== actual) rows.push([it.item_code, it.name, calculated, actual, actual - calculated]);
        });
        downloadCsvExcel(`инвентаризация_расхождения_${new Date().toISOString().slice(0,10)}.csv`, rows);
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
                <table>
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
                <table>
                    <thead class="bg-slate-50">
                        <tr><th>Код товара</th><th>Наименование товара</th><th>Запас на начало</th><th>Запас на конец</th><th>Средний запас</th><th>Расход (Списано)</th><th class="text-indigo-700">Коэф. Оборачиваемости</th></tr>
                    </thead>
                    <tbody>${details.map(d => `
                        <tr>
                            <td class="font-bold">${d.code}</td>
                            <td>${d.name}</td>
                            <td class="font-mono text-slate-500">${d.startStock}</td>
                            <td class="font-mono text-slate-500">${d.endStock}</td>
                            <td class="font-mono bg-slate-50/50">${d.averageStock}</td>
                            <td class="font-mono text-rose-600 font-bold">${d.totalSpent}</td>
                            <td class="bg-indigo-50/40 font-black text-indigo-700">${d.turnoverRatio}</td>
                        </tr>`).join('')}</tbody>
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

    function renderAdmin() {
        document.getElementById('adminTab').innerHTML = `
            <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                <div class="flex justify-between items-center mb-5">
                    <h2 class="text-xl font-bold text-slate-800">Управление учетными записями сотрудников</h2>
                    <button id="createUserAdminBtn" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-md"><i class="fas fa-user-plus mr-1"></i>Создать аккаунт</button>
                </div>
                <div class="scrollable-table border border-slate-100 rounded-xl">
                    <table><thead><tr><th>ID системы</th><th>Логин сотрудника</th><th>ФИО сотрудника</th><th>Права доступа (Роль)</th><th class="w-20">Действие</th></tr></thead>
                    <tbody>${adminUsers.map(u => `<tr><td>#${u.id}</td><td class="font-bold text-slate-700">${u.username}</td><td>${u.fullname}</td><td><span class="px-2 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold rounded-md">${u.role}</span></td><td><button onclick="window.delUser(${u.id}, '${u.username}')" class="text-rose-500 hover:text-rose-700"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody></table>
                </div>
            </div>`;
            
        document.getElementById('createUserAdminBtn').onclick = () => {
            document.getElementById('userFullname').value = ''; document.getElementById('userUsername').value = '';
            document.getElementById('userPassword').value = ''; document.getElementById('userRole').value = 'storekeeper';
            document.getElementById('userModal').classList.remove('hidden');
        };
    }

    document.getElementById('userModalConfirmBtn').onclick = async () => {
        const fullname = document.getElementById('userFullname').value.trim(); const username = document.getElementById('userUsername').value.trim();
        const password = document.getElementById('userPassword').value.trim(); const role = document.getElementById('userRole').value;
        if(!fullname || !username || !password) return showToast('Ошибка валидации', 'Заполните обязательные поля профиля!', 'error');
        if(await apiRequest('/admin/users', 'POST', { username, password, fullname, role })) {
            document.getElementById('userModal').classList.add('hidden');
            showToast('Успешно создан', 'Сотрудник внесен в реестр доступа.', 'success');
            switchTab('admin');
        }
    };

    window.delUser = async (id, targetUsername) => { 
        if (targetUsername === 'admin') {
            return showToast('Системная защита', 'Запрещено удалять главного администратора системы (admin)!', 'error');
        }
        if(id === window.appState.currentUser.id) {
            return showToast('Запрещено', 'Нельзя удалить собственный профиль активной сессии!', 'error'); 
        }
        if(confirm(`Лишить сотрудника ${targetUsername} прав доступа и удалить профиль?`)) { 
            await apiRequest(`/admin/users/${id}`, 'DELETE'); 
            switchTab('admin'); 
        } 
    };
});