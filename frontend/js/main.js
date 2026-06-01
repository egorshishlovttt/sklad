// Подключаем все модули в правильном порядке
// В index.html нужно будет подключить их через <script>

document.addEventListener('DOMContentLoaded', function() {
    // Инициализация CSV инпутов
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
    
    // Инициализация обработчиков модальных окон
    document.getElementById('modalCancelBtn').onclick = () => document.getElementById('movementModal').classList.add('hidden');
    document.getElementById('itemModalCancelBtn').onclick = () => document.getElementById('itemModal').classList.add('hidden');
    document.getElementById('userModalCancelBtn').onclick = () => document.getElementById('userModal').classList.add('hidden');
    document.getElementById('itemModalConfirmBtn').onclick = async () => {
        let item_code = document.getElementById('itemCode').value.trim();
        const name = document.getElementById('itemName').value.trim();
        const uom = document.getElementById('itemUom').value;
        if (!name) return showToast('Ошибка', 'Заполните наименование товара!', 'error');
        if (!item_code) item_code = generateNextItemCode();
        if (await apiRequest('/items', 'POST', { item_code, name, uom })) {
            document.getElementById('itemModal').classList.add('hidden');
            switchTab('items');
        }
    };
    
    document.getElementById('userModalConfirmBtn').onclick = async () => {
        const fullname = document.getElementById('userFullname').value.trim();
        const username = document.getElementById('userUsername').value.trim();
        const password = document.getElementById('userPassword').value.trim();
        const role = document.getElementById('userRole').value;
        if (!fullname || !username || !password) return showToast('Ошибка валидации', 'Заполните обязательные поля профиля!', 'error');
        if (await apiRequest('/admin/users', 'POST', { username, password, fullname, role })) {
            document.getElementById('userModal').classList.add('hidden');
            showToast('Успешно создан', 'Сотрудник внесен в реестр доступа.', 'success');
            switchTab('admin');
        }
    };
    
    document.getElementById('modalConfirmBtn').onclick = async () => {
        const item_code = document.getElementById('modalItemCode').value;
        const qty = parseFloat(document.getElementById('modalQty').value);
        
        if (!item_code || !qty || qty <= 0 || isNaN(qty)) {
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
        
        if (await apiRequest(currentModalType === 'receipt' ? '/receipts' : '/issues', 'POST', payload)) {
            if (timeTimer) clearInterval(timeTimer);
            document.getElementById('movementModal').classList.add('hidden');
            showToast('Успешно проведено', 'Документ успешно записан в базу данных', 'success');
            switchTab(currentModalType);
        }
    };
    
    document.getElementById('nomenclatureCsvInput').onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(evt) {
            const lines = evt.target.result.split('\n');
            let successCount = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line || i === 0) continue;
                const cols = line.split(/[;,]/);
                if (cols.length >= 2) {
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
});