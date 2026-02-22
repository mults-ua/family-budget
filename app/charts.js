// Family Budget — Reports & Charts

import * as api from './api.js';
import * as tags from './tags.js';

let allTransactions = [];
let currentSettings = {};
let chartInstances = {};
let timelineMode = 'daily'; // daily or weekly

const filterState = {
  fromDate: null,
  toDate: null,
  authors: [],
  tagKey: null,
  tagValue: null,
  displayCurrency: 'UAH'
};

// ============================================================================
// Main Render
// ============================================================================

export async function render(containerId) {
  try {
    currentSettings = await api.fetchSettings();

    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);

    container.innerHTML = '';
    container.appendChild(createFilterBar());

    const content = document.createElement('div');
    content.id = 'charts-content';
    content.className = 'p-6 space-y-6';
    container.appendChild(content);

    await loadAndRender();
  } catch (error) {
    showToast(`Error loading charts: ${error.message}`, 'error');
  }
}

// ============================================================================
// Filter Bar
// ============================================================================

function createFilterBar() {
  const bar = document.createElement('div');
  bar.className = 'p-4 bg-gray-50 border-b space-y-4';

  bar.innerHTML = `
    <div class="grid grid-cols-5 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">From Date</label>
        <input type="date" id="charts-from-date" class="w-full px-3 py-2 border border-gray-300 rounded-md">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">To Date</label>
        <input type="date" id="charts-to-date" class="w-full px-3 py-2 border border-gray-300 rounded-md">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Author</label>
        <select id="charts-author" class="w-full px-3 py-2 border border-gray-300 rounded-md" multiple size="1">
          <option value="">-- All --</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Tag Key</label>
        <select id="charts-tag-key" class="w-full px-3 py-2 border border-gray-300 rounded-md">
          <option value="">-- All Tags --</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
        <select id="charts-currency" class="w-full px-3 py-2 border border-gray-300 rounded-md">
          <option value="UAH">UAH</option>
          <option value="PLN">PLN</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Tag Value</label>
      <select id="charts-tag-value" class="w-full px-3 py-2 border border-gray-300 rounded-md" disabled>
        <option value="">-- Select Value --</option>
      </select>
    </div>
  `;

  const authorSelect = bar.querySelector('#charts-author');
  if (currentSettings.member_names) {
    currentSettings.member_names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      authorSelect.appendChild(opt);
    });
  }

  const tagKeySelect = bar.querySelector('#charts-tag-key');
  tags.getAllKeys().forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    tagKeySelect.appendChild(opt);
  });

  // Event listeners
  bar.querySelector('#charts-from-date').addEventListener('change', (e) => {
    filterState.fromDate = e.target.value || null;
    loadAndRender();
  });

  bar.querySelector('#charts-to-date').addEventListener('change', (e) => {
    filterState.toDate = e.target.value || null;
    loadAndRender();
  });

  authorSelect.addEventListener('change', (e) => {
    filterState.authors = Array.from(e.target.selectedOptions).map(o => o.value);
    loadAndRender();
  });

  bar.querySelector('#charts-currency').addEventListener('change', (e) => {
    filterState.displayCurrency = e.target.value;
    loadAndRender();
  });

  tagKeySelect.addEventListener('change', async (e) => {
    filterState.tagKey = e.target.value || null;
    filterState.tagValue = null;

    const tagValueSelect = bar.querySelector('#charts-tag-value');
    tagValueSelect.innerHTML = '<option value="">-- Select Value --</option>';

    if (filterState.tagKey) {
      try {
        const values = await tags.getCascadedValues(filterState.tagKey, {}, currentSettings.member_names);
        values.forEach(val => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          tagValueSelect.appendChild(opt);
        });
        tagValueSelect.disabled = false;
      } catch (error) {
        console.error('Error loading tag values:', error);
      }
    } else {
      tagValueSelect.disabled = true;
    }

    loadAndRender();
  });

  bar.querySelector('#charts-tag-value').addEventListener('change', (e) => {
    filterState.tagValue = e.target.value || null;
    loadAndRender();
  });

  return bar;
}

// ============================================================================
// Load & Render
// ============================================================================

async function loadAndRender() {
  try {
    const raw = await api.fetchTransactions({
      from: filterState.fromDate,
      to: filterState.toDate
    });

    allTransactions = raw.filter(t => !t.deleted);
    destroyAllCharts();
    renderContent();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

function filterTransactions() {
  let filtered = allTransactions;

  if (filterState.authors.length > 0) {
    filtered = filtered.filter(txn => filterState.authors.includes(txn.author));
  }

  if (filterState.tagKey && filterState.tagValue) {
    // Use exact match instead of substring match (Security: MEDIUM-1 fix)
    filtered = filtered.filter(txn => {
      const tagObj = tags.parseTags(txn.tags);
      return tagObj[filterState.tagKey] === filterState.tagValue;
    });
  }

  return filtered;
}

function getAmountForCurrency(txn, currency) {
  const key = `amount_${currency.toLowerCase()}`;
  return txn[key] || 0;
}

// ============================================================================
// Render Content
// ============================================================================

function renderContent() {
  const content = document.getElementById('charts-content');
  content.innerHTML = '';

  const filtered = filterTransactions();

  // Cards
  const cardsDiv = document.createElement('div');
  cardsDiv.className = 'grid grid-cols-3 gap-4';
  cardsDiv.appendChild(createCard('Total', formatAmount(getTotal(filtered)), 'indigo'));
  cardsDiv.appendChild(createCard('Top Category', getTopCategory(filtered), 'green'));
  cardsDiv.appendChild(createCard('Top Spender', getTopSpender(filtered), 'blue'));
  content.appendChild(cardsDiv);

  // Charts grid
  const chartsDiv = document.createElement('div');
  chartsDiv.className = 'grid grid-cols-2 gap-6';

  // Chart 1: Category
  const categoryDiv = createChartContainer('Spending by Category');
  chartsDiv.appendChild(categoryDiv);
  renderCategoryChart(categoryDiv.querySelector('canvas'), filtered);

  // Chart 2: Timeline with toggle
  const timelineDiv = createChartContainer('Spending Over Time');
  const toggle = document.createElement('div');
  toggle.className = 'mb-4 flex gap-2';
  const dailyBtn = document.createElement('button');
  dailyBtn.textContent = 'Daily';
  dailyBtn.className = `px-3 py-1 rounded-md ${timelineMode === 'daily' ? 'bg-indigo-600 text-white' : 'bg-gray-300'}`;
  dailyBtn.addEventListener('click', () => {
    timelineMode = 'daily';
    updateTimelineToggle(toggle);
    destroyChart('timeline');
    renderTimelineChart(timelineDiv.querySelector('canvas'), filtered);
  });

  const weeklyBtn = document.createElement('button');
  weeklyBtn.textContent = 'Weekly';
  weeklyBtn.className = `px-3 py-1 rounded-md ${timelineMode === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-gray-300'}`;
  weeklyBtn.addEventListener('click', () => {
    timelineMode = 'weekly';
    updateTimelineToggle(toggle);
    destroyChart('timeline');
    renderTimelineChart(timelineDiv.querySelector('canvas'), filtered);
  });

  toggle.appendChild(dailyBtn);
  toggle.appendChild(weeklyBtn);
  toggle.id = 'timeline-toggle';

  timelineDiv.insertBefore(toggle, timelineDiv.querySelector('canvas'));
  chartsDiv.appendChild(timelineDiv);

  // Chart 3: Author (Pie)
  const authorDiv = createChartContainer('Spending by Author');
  chartsDiv.appendChild(authorDiv);
  renderAuthorChart(authorDiv.querySelector('canvas'), filtered);

  // Chart 4: Companies (Top 10)
  const companyDiv = createChartContainer('Top 10 Companies');
  chartsDiv.appendChild(companyDiv);
  renderCompanyChart(companyDiv.querySelector('canvas'), filtered);

  content.appendChild(chartsDiv);
}

function createChartContainer(title) {
  const div = document.createElement('div');
  div.className = 'bg-white p-4 rounded-lg shadow-sm';

  const h3 = document.createElement('h3');
  h3.className = 'text-lg font-semibold text-gray-800 mb-4';
  h3.textContent = title;
  div.appendChild(h3);

  const canvas = document.createElement('canvas');
  div.appendChild(canvas);

  return div;
}

function createCard(title, value, color) {
  const div = document.createElement('div');
  div.className = `bg-white p-6 rounded-lg shadow-sm border-l-4 border-${color}-500`;
  div.innerHTML = `
    <h3 class="text-sm font-medium text-gray-600 mb-2">${title}</h3>
    <p class="text-2xl font-bold text-gray-800">${value}</p>
  `;
  return div;
}

// ============================================================================
// Cards Data
// ============================================================================

function getTotal(txns) {
  return txns.reduce((sum, txn) => sum + getAmountForCurrency(txn, filterState.displayCurrency), 0);
}

function getTopCategory(txns) {
  const categorySpending = {};
  txns.forEach(txn => {
    const tagObj = tags.parseTags(txn.tags);
    const category = tagObj.category || 'Uncategorized';
    categorySpending[category] = (categorySpending[category] || 0) + getAmountForCurrency(txn, filterState.displayCurrency);
  });

  const sorted = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'N/A';
}

function getTopSpender(txns) {
  const authorSpending = {};
  txns.forEach(txn => {
    const author = txn.author || 'Unknown';
    authorSpending[author] = (authorSpending[author] || 0) + getAmountForCurrency(txn, filterState.displayCurrency);
  });

  const sorted = Object.entries(authorSpending).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'N/A';
}

// ============================================================================
// Chart Renderers
// ============================================================================

function renderCategoryChart(canvas, txns) {
  const categorySpending = {};
  txns.forEach(txn => {
    const tagObj = tags.parseTags(txn.tags);
    const category = tagObj.category || 'Uncategorized';
    categorySpending[category] = (categorySpending[category] || 0) + getAmountForCurrency(txn, filterState.displayCurrency);
  });

  const sorted = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([cat]) => cat);
  const data = sorted.map(([, amount]) => amount);

  chartInstances.category = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: filterState.displayCurrency,
        data,
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderTimelineChart(canvas, txns) {
  const byDate = {};
  txns.forEach(txn => {
    const key = timelineMode === 'daily' ? txn.date : getWeekKey(txn.date);
    byDate[key] = (byDate[key] || 0) + getAmountForCurrency(txn, filterState.displayCurrency);
  });

  const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
  const labels = sorted.map(([date]) => date);
  let data = sorted.map(([, amount]) => amount);

  // Cumulative
  data = data.reduce((acc, val) => {
    acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + val);
    return acc;
  }, []);

  chartInstances.timeline = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Cumulative ${filterState.displayCurrency}`,
        data,
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderAuthorChart(canvas, txns) {
  const authorSpending = {};
  txns.forEach(txn => {
    const author = txn.author || 'Unknown';
    authorSpending[author] = (authorSpending[author] || 0) + getAmountForCurrency(txn, filterState.displayCurrency);
  });

  const sorted = Object.entries(authorSpending).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([author]) => author);
  const data = sorted.map(([, amount]) => amount);

  const colors = ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#ff6384'];

  chartInstances.author = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderCompanyChart(canvas, txns) {
  const companySpending = {};
  txns.forEach(txn => {
    const tagObj = tags.parseTags(txn.tags);
    const company = tagObj.company || 'Unknown';
    companySpending[company] = (companySpending[company] || 0) + getAmountForCurrency(txn, filterState.displayCurrency);
  });

  const sorted = Object.entries(companySpending).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const labels = sorted.map(([co]) => co);
  const data = sorted.map(([, amount]) => amount);

  chartInstances.company = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: filterState.displayCurrency,
        data,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    }
  });
}

// ============================================================================
// Utilities
// ============================================================================

function updateTimelineToggle(toggle) {
  const buttons = toggle.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white');
    btn.classList.add('bg-gray-300');
  });

  const activeBtn = Array.from(buttons).find(btn => btn.textContent.toLowerCase() === timelineMode);
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-300');
    activeBtn.classList.add('bg-indigo-600', 'text-white');
  }
}

function getWeekKey(dateStr) {
  const date = new Date(dateStr);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  return weekStart.toISOString().split('T')[0];
}

function destroyChart(name) {
  if (chartInstances[name]) {
    chartInstances[name].destroy();
    delete chartInstances[name];
  }
}

function destroyAllCharts() {
  Object.keys(chartInstances).forEach(key => destroyChart(key));
}

function formatAmount(amount) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-md shadow-lg`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
