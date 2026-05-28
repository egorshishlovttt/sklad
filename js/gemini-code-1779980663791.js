document.addEventListener('DOMContentLoaded', function() {
    // Безопасная загрузка базы данных
    window.loadFromLocal();

    // Функция инициализации интерфейса после успешного входа
    window.initMainApp = function() {
        document.getElementById('currentUserDisplay').innerText = StorageState.currentUser.fullname;
        document.getElementById('roleDisplay').innerText = StorageState.currentUser.role;
        window.renderTabs();
        window.switchTab(StorageState.activeTab);
    };

    window.renderTabs = function() {
        const container = document.getElementById('tabsContainer');
        if(!container) return;
        const allowed = StorageState.roleTabs[StorageState.currentUser?.role] || ['items'];
        const tabNames = {
            items: '📦 Номенклатура', receipt: '📥 Приход', issue: '📤 Расход',
            stock: '📊 Остатки', inventory: '🔍 Инвентаризация', reports: '📈 Отчёты',
            import: '📂 Импорт CSV', admin: '👑 Администрирование'
        };
        container.innerHTML = '';
        allowed.forEach(tabId => {
            const btn = document.createElement('button');
            btn.className = `px-4 py-2 text-sm font-medium rounded-lg transition ${StorageState.activeTab===tabId ? 'tab-active' : 'tab-inactive'}`;
            btn.innerText = tabNames[tabId];
            btn.onclick = () => window.switchTab(tabId);
            container.appendChild(btn);
        });
    };

    window.switchTab = function(tabId) {
        StorageState.activeTab = tabId;
        window.renderTabs();
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(tabId+'Tab');
        if(target) target.classList.remove('hidden');
        
        // Ленивый вызов рендеринга из модулей
        if(tabId === 'items' && window.renderItems) window.renderItems();
        if(tabId === 'receipt' && window.renderReceipts) window.renderReceipts();
        if(tabId === 'issue' && window.renderIssues) window.renderIssues();
        if(tabId === 'stock' && window.renderStock) window.renderStock();
        if(tabId === 'inventory' && window.renderInventory) window.renderInventory();
        if(tabId === 'reports' && window.renderReports) window.renderReports();
        if(tabId === 'import' && window.renderImport) window.renderImport();
        if(tabId === 'admin' && window.renderAdmin) window.renderAdmin();
    };

    // --- ОБРАБОТЧИКИ СОБЫТИЙ АВТОРИЗАЦИИ ---
    document.getElementById('doLoginBtn')?.addEventListener('click', () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        const user = StorageState.users.find(u => u.username === username && u.password === password);
        if(user) {
            StorageState.currentUser = user;
            document.getElementById('authScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            window.initMainApp();
        } else {
            const errDiv = document.getElementById('loginError');
            errDiv.innerText = 'Неверный логин или пароль';
            errDiv.classList.remove('hidden');
        }
    });

    document.getElementById('doRegisterBtn')?.addEventListener('click', () => {
        const uname = document.getElementById('regUsername').value.trim();
        const pwd = document.getElementById('regPassword').value.trim();
        const fname = document.getElementById('regFullname').value.trim();
        const role = document.getElementById('regRole').value;
        if(!uname || !pwd) { alert("Заполните логин и пароль"); return; }
        if(StorageState.users.find(u=>u.username===uname)) { alert("Логин занят"); return; }
        const newId = Math.max(...StorageState.users.map(u=>u.id),0)+1;
        StorageState.users.push({id:newId, username:uname, password:pwd, fullname:fname||uname, role});
        window.saveToLocal();
        alert("Регистрация успешна! Теперь войдите.");
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        StorageState.currentUser = null;
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    });

    document.getElementById('loginTabBtn')?.addEventListener('click', () => {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    });
    document.getElementById('registerTabBtn')?.addEventListener('click', () => {
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('loginForm').classList.add('hidden');
    });

    // Модальные окна общих событий
    document.getElementById('modalCancelBtn').onclick = () => document.getElementById('movementModal').classList.add('hidden');
    document.getElementById('itemModalCancelBtn')?.addEventListener('click', () => document.getElementById('itemModal').classList.add('hidden'));
    document.getElementById('itemModalConfirmBtn')?.addEventListener('click', () => { if(window.addNewItem) window.addNewItem(); });
    
    document.getElementById('modalConfirmBtn').onclick = () => {
        const item_code = document.getElementById('modalItemCode').value;
        const qty = parseInt(document.getElementById('modalQty').value);
        const date = document.getElementById('modalDate').value;
        if(!item_code || !qty || qty<=0 || !date) { alert("Заполните все поля"); return; }
        if(window.currentModalType === 'receipt') {
            window.addReceipt(item_code, qty, date);
            window.renderReceipts();
        } else {
            if(window.addIssue(item_code, qty, date)) window.renderIssues();
        }
        if(StorageState.activeTab === 'stock') window.renderStock();
        document.getElementById('movementModal').classList.add('hidden');
    };

    // Администрирование пользователей
    window.renderAdmin = function() {
        const container = document.getElementById('adminTab');
        if(!container) return;
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow p-5">
                <h2 class="text-xl font-bold mb-3">Управление пользователями</h2>
                <div class="scrollable-table border rounded">
                    <table class="min-w-full"><thead><tr><th>ID</th><th>Логин</th><th>ФИО</th><th>Роль</th><th>Действия</th></tr></thead>
                    <tbody id="adminUserList"></tbody></table>
                </div>
                <button id="createUserAdminBtn" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded">+ Создать пользователя</button>
            </div>`;
        const tbody = document.getElementById('adminUserList');
        if(tbody) {
            tbody.innerHTML = StorageState.users.map(u => `
                <tr><td>${u.id}</td><td>${u.username}</td><td>${u.fullname}</td><td>${u.role}</td>
                <td><button onclick="window.adminDeleteUser(${u.id})" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>
            `).join('');
        }
        document.getElementById('createUserAdminBtn')?.addEventListener('click', () => {
            let uname = prompt("Логин"); if(!uname) return;
            let pwd = prompt("Пароль");
            let fname = prompt("ФИО");
            let role = prompt("Роль (admin/manager/storekeeper/analyst)");
            if(uname && pwd && role) {
                let newId = Math.max(...StorageState.users.map(u=>u.id),0)+1;
                StorageState.users.push({id:newId, username:uname, password:pwd, fullname:fname||uname, role});
                window.saveToLocal(); window.renderAdmin();
            }
        });
    };
    window.adminDeleteUser = function(id) {
        if(id === StorageState.currentUser.id){ alert("Нельзя удалить самого себя"); return; }
        if(confirm("Удалить пользователя?")){ StorageState.users = StorageState.users.filter(u=>u.id!==id); window.saveToLocal(); window.renderAdmin(); }
    };
});