// Глобальное состояние
window.appState = {
    currentUser: null,
    activeTab: 'items'
};

// Данные из API
let items = [];
let receipts = [];
let issues = [];
let stockExpected = [];
let adminUsers = [];

// Состояние фильтров и отчетов
let stockFilters = { date: '', deviation: 'all' };
let currentReportType = 'movement';
let currentReportDataCache = [];
let currentModalType = '';
let timeTimer = null;