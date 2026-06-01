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

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return dateStr.replace('T', ' ').slice(0, 19);
}

function getLocalDateTimeString() {
    return new Date().toISOString();
}

function getHeaders() {
    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${sessionStorage.getItem('token')}` 
    };
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
    } catch (err) { 
        showToast('Ошибка API', err.message, 'error'); 
        return null; 
    }
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

function generateNextItemCode() {
    const prefix = "Т";
    let maxNum = 0;
    items.forEach(it => {
        const match = it.item_code.match(/Т(\d+)/);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) maxNum = num;
        }
    });
    return prefix + String(maxNum + 1).padStart(3, '0');
}