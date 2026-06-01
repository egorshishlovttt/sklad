async function loadAllData() {
    const role = window.appState.currentUser?.role;
    const allowed = ROLE_TABS[role] || [];
    
    if (allowed.includes('items')) items = await apiRequest('/items') || [];
    if (allowed.includes('receipt')) receipts = await apiRequest('/receipts') || [];
    if (allowed.includes('issue')) issues = await apiRequest('/issues') || [];
    if (allowed.includes('stock') || allowed.includes('inventory') || allowed.includes('reports')) 
        stockExpected = await apiRequest('/inventory/expected') || [];
    if (allowed.includes('admin')) adminUsers = await apiRequest('/admin/users') || [];
}

function renderTabs() {
    const container = document.getElementById('tabsContainer');
    const role = window.appState.currentUser?.role;
    const allowed = ROLE_TABS[role] || ['items'];
    
    container.innerHTML = '';
    allowed.forEach(tabId => {
        const isActive = window.appState.activeTab === tabId;
        const btn = document.createElement('button');
        btn.className = `px-5 py-2.5 text-sm font-semibold rounded-xl transition flex items-center gap-2 ${
            isActive 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`;
        btn.innerHTML = `<i class="fas ${TAB_ICONS[tabId]}"></i> ${TAB_NAMES[tabId]}`;
        btn.onclick = () => switchTab(tabId);
        container.appendChild(btn);
    });
}

async function switchTab(tabId) {
    window.appState.activeTab = tabId;
    renderTabs();
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId + 'Tab')?.classList.remove('hidden');
    
    await loadAllData();
    
    if (tabId === 'items') renderItems();
    if (tabId === 'receipt') renderReceipts();
    if (tabId === 'issue') renderIssues();
    if (tabId === 'stock') renderStock();
    if (tabId === 'inventory') renderInventory();
    if (tabId === 'reports') renderReports();
    if (tabId === 'admin') renderAdmin();
}

window.initializeMainApp = function() {
    switchTab('items');
};