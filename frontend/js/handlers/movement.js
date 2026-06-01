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