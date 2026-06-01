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