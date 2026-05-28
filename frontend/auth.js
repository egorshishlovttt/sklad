const API_URL = 'http://localhost:5000/api';

window.appState = {
    currentUser: null,
    activeTab: 'items'
};

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('doLoginBtn').onclick = async () => {
        const username = document.getElementById('loginUsername').value.trim(); 
        const password = document.getElementById('loginPassword').value.trim();
        
        if(!username || !password) {
            return alert('Заполни все поля ввода!');
        }
        
        try {
            const res = await fetch(`${API_URL}/auth/login`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ username, password }) 
            });
            
            const data = await res.json(); 
            
            if(!res.ok) {
                throw new Error(data.message || `Ошибка сервера: ${res.status}`);
            }
            
            sessionStorage.setItem('token', data.token); 
            window.appState.currentUser = data.user;
            
            document.getElementById('authScreen').classList.add('hidden'); 
            document.getElementById('mainApp').classList.remove('hidden');
            
            document.getElementById('currentUserDisplay').innerText = data.user.fullname || data.user.username; 
            document.getElementById('roleDisplay').innerText = data.user.role;
            
            if (window.initializeMainApp) {
                window.initializeMainApp();
            }
            
        } catch(e) { 
            alert(`Вход не выполнен: ${e.message}`); 
        }
    };

    window.logout = function() { 
        sessionStorage.removeItem('token'); 
        window.appState.currentUser = null; 
        document.getElementById('authScreen').classList.remove('hidden'); 
        document.getElementById('mainApp').classList.add('hidden'); 
    };
    
    document.getElementById('logoutBtn').onclick = window.logout;
    document.getElementById('modalCancelBtn').onclick = () => document.getElementById('movementModal').classList.add('hidden');
    document.getElementById('itemModalCancelBtn').onclick = () => document.getElementById('itemModal').classList.add('hidden');
    document.getElementById('userModalCancelBtn').onclick = () => document.getElementById('userModal').classList.add('hidden');
});