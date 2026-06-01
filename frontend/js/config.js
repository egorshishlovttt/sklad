const API_URL = 'http://localhost:5001/api';

const ROLE_TABS = {
    admin: ['items', 'receipt', 'issue', 'stock', 'inventory', 'reports', 'admin'],
    manager: ['items', 'receipt', 'issue', 'stock', 'inventory', 'reports'],
    storekeeper: ['items', 'receipt', 'issue', 'stock', 'reports'],
    analyst: ['stock', 'reports']
};

const TAB_NAMES = {
    items: 'Номенклатура',
    receipt: 'Приход',
    issue: 'Расход',
    stock: 'Остатки',
    inventory: 'Инвентаризация',
    reports: 'Отчеты',
    admin: 'Администрирование'
};

const TAB_ICONS = {
    items: 'fa-boxes',
    receipt: 'fa-arrow-down',
    issue: 'fa-arrow-up',
    stock: 'fa-warehouse',
    inventory: 'fa-clipboard-list',
    reports: 'fa-chart-line',
    admin: 'fa-user-shield'
};