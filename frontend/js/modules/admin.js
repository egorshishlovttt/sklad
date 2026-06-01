function renderAdmin() {
    document.getElementById('adminTab').innerHTML = `
        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
            <div class="flex justify-between items-center mb-5">
                <h2 class="text-xl font-bold text-slate-800">Управление учетными записями сотрудников</h2>
                <button id="createUserAdminBtn" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-md"><i class="fas fa-user-plus mr-1"></i>Создать аккаунт</button>
            </div>
            <div class="scrollable-table border border-slate-100 rounded-xl">
                <table class="w-full text-left">
                    <thead class="bg-slate-50"><tr><th>ID системы</th><th>Логин сотрудника</th><th>ФИО сотрудника</th><th>Права доступа (Роль)</th><th class="w-20">Действие</th></tr></thead>
                    <tbody>${adminUsers.map(u => `<tr><td>#${u.id}</td><td class="font-bold text-slate-700">${u.username}</td><td>${u.fullname}</td><td><span class="px-2 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold rounded-md">${u.role}</span></td><td><button onclick="window.delUser(${u.id}, '${u.username}')" class="text-rose-500 hover:text-rose-700"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>`;
        
    document.getElementById('createUserAdminBtn').onclick = () => {
        document.getElementById('userFullname').value = ''; 
        document.getElementById('userUsername').value = '';
        document.getElementById('userPassword').value = ''; 
        document.getElementById('userRole').value = 'storekeeper';
        document.getElementById('userModal').classList.remove('hidden');
    };
}

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