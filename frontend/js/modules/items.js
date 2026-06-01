function renderItems() {
    const canEdit = window.appState.currentUser?.role === 'admin' || window.appState.currentUser?.role === 'manager';
    const container = document.getElementById('itemsTab');
    
    container.innerHTML = `
        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
            <div class="flex justify-between items-center mb-5 flex-wrap gap-2">
                <h2 class="text-xl font-bold text-slate-800">Каталог товаров и номенклатуры</h2>
                <div class="flex gap-2">
                    ${canEdit ? `
                        <button id="importNomenclatureBtn" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 transition">
                            <i class="fas fa-file-import mr-1"></i> Импорт CSV
                        </button>
                        <button id="openAddItemModalBtn" class="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition">
                            <i class="fas fa-plus mr-1"></i> Добавить товар
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="scrollable-table border border-slate-100 rounded-xl">
                <table class="w-full text-left">
                    <thead class="bg-slate-50">
                        <tr><th>Код товара</th><th>Наименование товара</th><th>Ед. изм.</th><th class="w-20">Действие</th></tr>
                    </thead>
                    <tbody>
                        ${items.map(it => `
                            <tr>
                                <td class="font-bold text-slate-700">${it.item_code}</td>
                                <td>${it.name}</td>
                                <td><span class="px-2 py-0.5 bg-slate-100 rounded text-xs font-semibold text-slate-600">${it.uom}</span></td>
                                <td>${canEdit ? `<button onclick="window.deleteItem('${it.item_code}')" class="text-rose-500 hover:text-rose-700"><i class="fas fa-trash-alt"></i></button>` : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    if (canEdit) {
        document.getElementById('openAddItemModalBtn').onclick = () => {
            document.getElementById('itemCode').value = generateNextItemCode();
            document.getElementById('itemName').value = '';
            document.getElementById('itemUom').value = 'шт';
            document.getElementById('itemModal').classList.remove('hidden');
        };
        document.getElementById('importNomenclatureBtn').onclick = () => document.getElementById('nomenclatureCsvInput').click();
    }
}

window.deleteItem = async (code) => {
    if (confirm(`Удалить товар ${code}?`)) {
        await apiRequest(`/items/${code}`, 'DELETE');
        switchTab('items');
    }
};