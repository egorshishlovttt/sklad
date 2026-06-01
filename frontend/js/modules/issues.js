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
                <table class="w-full text-left">
                    <thead class="bg-slate-50"><tr><th>№ Документа</th><th>Код товара</th><th>Наименование товара</th><th>Количество</th><th>Дата и время</th><th>Исполнитель</th><th class="w-20"></th></tr></thead>
                    <tbody>${issues.map(i => { 
                        const item = items.find(it=>it.item_code===i.item_code); 
                        const creatorName = i.created_by || i.username || (window.appState.currentUser && (window.appState.currentUser.fullname || window.appState.currentUser.username)) || 'Система';
                        return `<tr><td>DOC-ISS-${i.doc_id}</td><td class="font-bold">${i.item_code}</td><td>${item ? item.name : 'Неизвестный товар'}</td><td class="font-mono text-rose-600 font-bold">-${i.qty}</td><td class="text-xs font-mono text-slate-600">${formatDateTime(i.date)}</td><td><span class="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded"><i class="fas fa-user text-slate-400 mr-1"></i>${creatorName}</span></td><td><button onclick="window.delDoc('issues', ${i.doc_id})" class="text-rose-500 hover:text-rose-700"><i class="fas fa-trash"></i></button></td></tr>`; 
                    }).join('')}</tbody>
                </table>
            </div>
        </div>`;
    document.getElementById('openIssueModalBtn').onclick = () => openMovementModal('issue');
    document.getElementById('importIssueCsvBtn').onclick = () => document.getElementById('issueCsvInput').click();
}

document.getElementById('issueCsvInput').onchange = function(e) {
    handleMovementCsvImport(e, '/issues', 'issue');
};

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