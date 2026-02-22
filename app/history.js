// Family Budget — History & Transactions Table

import * as api from './api.js';
import * as currency from './currency.js';
import * as tags from './tags.js';

const PAGE_SIZE = 20;
let allTransactions = [];
let currentSettings = {};
let currentRates = {};
let currentPage = 1;

// Filter state
const filterState = {
  fromDate: null,
  toDate: null,
  authors: [],
  tagKey: null,
  tagValue: null
};

// ============================================================================
// Main Render
// ============================================================================

export async function render(containerId) {
  try {
    currentSettings = await api.fetchSettings();
    currentRates = await currency.getRates();

    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);

    container.innerHTML = '';
    container.appendChild(createFilterBar());
    container.appendChild(document.createElement('hr'));
    container.appendChild(document.createElement('div')); // table container

    await loadAndRenderData();
  } catch (error) {
    showToast(`Error loading history: ${error.message}`, 'error');
  }
}

// ============================================================================
// Filter Bar
// ============================================================================

function createFilterBar() {
  const bar = document.createElement('div');
  bar.className = 'p-4 bg-gray-50 border-b space-y-4';

  bar.innerHTML = `
    <div class="grid grid-cols-4 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">From Date</label>
        <input type="date" id="filter-from-date" class="w-full px-3 py-2 border border-gray-300 rounded-md">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">To Date</label>
        <input type="date" id="filter-to-date" class="w-full px-3 py-2 border border-gray-300 rounded-md">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Author</label>
        <select id="filter-author" class="w-full px-3 py-2 border border-gray-300 rounded-md" multiple size="1">
          <option value="">-- All Authors --</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Tag Key</label>
        <select id="filter-tag-key" class="w-full px-3 py-2 border border-gray-300 rounded-md">
          <option value="">-- All Tags --</option>
        </select>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Tag Value</label>
        <select id="filter-tag-value" class="w-full px-3 py-2 border border-gray-300 rounded-md" disabled>
          <option value="">-- Select Value --</option>
        </select>
      </div>
      <div class="flex items-end">
        <button id="filter-reset" class="w-full bg-gray-400 text-white py-2 rounded-md hover:bg-gray-500">
          Reset Filters
        </button>
      </div>
    </div>
  `;

  // Populate author dropdown
  const authorSelect = bar.querySelector('#filter-author');
  if (currentSettings.member_names) {
    currentSettings.member_names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      authorSelect.appendChild(opt);
    });
  }

  // Populate tag key dropdown
  const tagKeySelect = bar.querySelector('#filter-tag-key');
  tags.getAllKeys().forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    tagKeySelect.appendChild(opt);
  });

  // Event listeners
  bar.querySelector('#filter-from-date').addEventListener('change', (e) => {
    filterState.fromDate = e.target.value || null;
    currentPage = 1;
    loadAndRenderData();
  });

  bar.querySelector('#filter-to-date').addEventListener('change', (e) => {
    filterState.toDate = e.target.value || null;
    currentPage = 1;
    loadAndRenderData();
  });

  authorSelect.addEventListener('change', (e) => {
    filterState.authors = Array.from(e.target.selectedOptions).map(o => o.value);
    currentPage = 1;
    loadAndRenderData();
  });

  tagKeySelect.addEventListener('change', async (e) => {
    filterState.tagKey = e.target.value || null;
    filterState.tagValue = null;

    const tagValueSelect = bar.querySelector('#filter-tag-value');
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

    currentPage = 1;
    loadAndRenderData();
  });

  bar.querySelector('#filter-tag-value').addEventListener('change', (e) => {
    filterState.tagValue = e.target.value || null;
    currentPage = 1;
    loadAndRenderData();
  });

  bar.querySelector('#filter-reset').addEventListener('click', () => {
    filterState.fromDate = null;
    filterState.toDate = null;
    filterState.authors = [];
    filterState.tagKey = null;
    filterState.tagValue = null;
    currentPage = 1;

    bar.querySelector('#filter-from-date').value = '';
    bar.querySelector('#filter-to-date').value = '';
    authorSelect.value = '';
    tagKeySelect.value = '';
    bar.querySelector('#filter-tag-value').value = '';
    bar.querySelector('#filter-tag-value').disabled = true;

    loadAndRenderData();
  });

  return bar;
}

// ============================================================================
// Load & Filter Data
// ============================================================================

async function loadAndRenderData() {
  try {
    const raw = await api.fetchTransactions({
      from: filterState.fromDate,
      to: filterState.toDate
    });

    allTransactions = raw;
    renderTable();
  } catch (error) {
    showToast(`Error loading transactions: ${error.message}`, 'error');
  }
}

function filterTransactions(includeDeleted = false) {
  let filtered = allTransactions.filter(txn => txn.deleted === includeDeleted);

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

  return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ============================================================================
// Render Table
// ============================================================================

function renderTable() {
  const container = document.querySelector('body > div:nth-child(1)');
  const tableDiv = container?.querySelector('hr + div') || document.querySelector('#history-table-container');

  if (!tableDiv) return;
  tableDiv.innerHTML = '';

  // Active transactions
  const active = filterTransactions(false);
  const activePaginated = paginate(active, currentPage);

  const activeSection = document.createElement('div');
  activeSection.className = 'p-6 space-y-4';

  const activeTitle = document.createElement('h3');
  activeTitle.className = 'text-xl font-bold text-gray-800';
  activeTitle.textContent = `Transactions (${active.length})`;
  activeSection.appendChild(activeTitle);

  if (activePaginated.length === 0 && active.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-gray-500';
    empty.textContent = 'No transactions found.';
    activeSection.appendChild(empty);
  } else {
    const table = createTransactionTable(activePaginated);
    activeSection.appendChild(table);

    if (active.length > PAGE_SIZE) {
      activeSection.appendChild(createPaginationControls(active));
    }
  }

  tableDiv.appendChild(activeSection);

  // Deleted transactions
  const deleted = filterTransactions(true);
  if (deleted.length > 0) {
    const deletedSection = document.createElement('details');
    deletedSection.className = 'p-6 border-t';

    const summary = document.createElement('summary');
    summary.className = 'text-lg font-bold text-gray-700 cursor-pointer';
    summary.textContent = `Deleted Transactions (${deleted.length})`;
    deletedSection.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'mt-4 space-y-4';

    const deletedTable = createTransactionTable(deleted, true);
    content.appendChild(deletedTable);
    deletedSection.appendChild(content);

    tableDiv.appendChild(deletedSection);
  }
}

function createTransactionTable(transactions, isDeleted = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'overflow-x-auto';

  const table = document.createElement('table');
  table.className = 'w-full text-sm border-collapse';

  // Header (safe: static content)
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr class="border-b border-gray-300 bg-gray-100">
      <th class="text-left px-4 py-2 font-semibold text-gray-700">Date</th>
      <th class="text-left px-4 py-2 font-semibold text-gray-700">Author</th>
      <th class="text-left px-4 py-2 font-semibold text-gray-700">Tags</th>
      <th class="text-right px-4 py-2 font-semibold text-gray-700">UAH</th>
      <th class="text-right px-4 py-2 font-semibold text-gray-700">PLN</th>
      <th class="text-right px-4 py-2 font-semibold text-gray-700">EUR</th>
      <th class="text-right px-4 py-2 font-semibold text-gray-700">USD</th>
      <th class="text-center px-4 py-2 font-semibold text-gray-700">Actions</th>
    </tr>
  `;
  table.appendChild(thead);

  // Body (Security: CRITICAL-1, CRITICAL-2, HIGH-1 fixes - use DOM methods instead of innerHTML)
  const tbody = document.createElement('tbody');
  transactions.forEach(txn => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-200 hover:bg-gray-50';

    // Date cell
    const tdDate = document.createElement('td');
    tdDate.className = 'px-4 py-2 text-gray-700';
    tdDate.textContent = txn.date;
    tr.appendChild(tdDate);

    // Author cell
    const tdAuthor = document.createElement('td');
    tdAuthor.className = 'px-4 py-2 text-gray-700';
    tdAuthor.textContent = txn.author;
    tr.appendChild(tdAuthor);

    // Tags cell (build with DOM methods, not innerHTML)
    const tdTags = document.createElement('td');
    tdTags.className = 'px-4 py-2';
    const tagObj = tags.parseTags(txn.tags);
    if (Object.keys(tagObj).length === 0) {
      const emptySpan = document.createElement('span');
      emptySpan.className = 'text-gray-400';
      emptySpan.textContent = '-';
      tdTags.appendChild(emptySpan);
    } else {
      Object.entries(tagObj).forEach(([k, v]) => {
        const badge = document.createElement('span');
        badge.className = 'inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded mr-1';
        badge.textContent = `${k}:${v}`;
        tdTags.appendChild(badge);
      });
    }
    tr.appendChild(tdTags);

    // Amount cells
    const amounts = [
      txn.amount_uah,
      txn.amount_pln,
      txn.amount_eur,
      txn.amount_usd
    ];
    amounts.forEach(amount => {
      const tdAmount = document.createElement('td');
      tdAmount.className = 'px-4 py-2 text-right text-gray-700';
      tdAmount.textContent = amount.toFixed(2);
      tr.appendChild(tdAmount);
    });

    // Actions cell
    const tdActions = document.createElement('td');
    tdActions.className = 'px-4 py-2 text-center';

    if (isDeleted) {
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'text-green-600 hover:text-green-800 font-medium text-xs';
      restoreBtn.textContent = 'Restore';
      restoreBtn.addEventListener('click', () => window.historyRestoreTransaction(txn.id));
      tdActions.appendChild(restoreBtn);
    } else {
      const editBtn = document.createElement('button');
      editBtn.className = 'text-blue-600 hover:text-blue-800 font-medium text-xs mr-2';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => window.historyEditTransaction(txn.id));
      tdActions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'text-red-600 hover:text-red-800 font-medium text-xs';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => window.historyDeleteTransaction(txn.id));
      tdActions.appendChild(deleteBtn);
    }
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  wrapper.appendChild(table);
  return wrapper;
}

function createPaginationControls(transactions) {
  const maxPage = Math.ceil(transactions.length / PAGE_SIZE);
  const div = document.createElement('div');
  div.className = 'flex items-center justify-center gap-2 mt-4';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Previous';
  prevBtn.disabled = currentPage === 1;
  prevBtn.className = 'px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50';
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  const pageLabel = document.createElement('span');
  pageLabel.textContent = `Page ${currentPage} of ${maxPage}`;
  pageLabel.className = 'text-gray-700';

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.disabled = currentPage === maxPage;
  nextBtn.className = 'px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50';
  nextBtn.addEventListener('click', () => {
    if (currentPage < maxPage) {
      currentPage++;
      renderTable();
    }
  });

  div.appendChild(prevBtn);
  div.appendChild(pageLabel);
  div.appendChild(nextBtn);
  return div;
}

// ============================================================================
// Actions
// ============================================================================

window.historyDeleteTransaction = async function (id) {
  if (confirm('Delete this transaction?')) {
    try {
      await api.softDelete(id);
      showToast('Transaction deleted.', 'success');
      api.clearCaches();
      await loadAndRenderData();
    } catch (error) {
      showToast(`Error: ${error.message}`, 'error');
    }
  }
};

window.historyRestoreTransaction = async function (id) {
  try {
    await api.restoreTransaction(id);
    showToast('Transaction restored.', 'success');
    api.clearCaches();
    await loadAndRenderData();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
};

window.historyEditTransaction = async function (id) {
  const txn = allTransactions.find(t => t.id === id);
  if (!txn) return;

  showEditModal(txn);
};

// ============================================================================
// Edit Modal
// ============================================================================

function showEditModal(txn) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto';

  const tagObj = tags.parseTags(txn.tags);

  // Build form with static HTML structure (Security: HIGH-1 fix - set values via JS, not interpolation)
  dialog.innerHTML = `
    <h2 class="text-2xl font-bold text-gray-800 mb-4">Edit Transaction</h2>
    <form id="edit-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" id="edit-date" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Author</label>
          <input type="text" id="edit-author" class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100" readonly>
        </div>
      </div>

      <div class="border-t pt-4">
        <h3 class="font-semibold text-gray-800 mb-3">Amounts</h3>
        <div class="grid grid-cols-4 gap-2">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">UAH</label>
            <input type="number" id="edit-uah" class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" step="0.01">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">PLN</label>
            <input type="number" id="edit-pln" class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" step="0.01">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">EUR</label>
            <input type="number" id="edit-eur" class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" step="0.01">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">USD</label>
            <input type="number" id="edit-usd" class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" step="0.01">
          </div>
        </div>
      </div>

      <div id="edit-tags-section" class="border-t pt-4 space-y-3"></div>

      <div class="border-t pt-4 flex gap-3">
        <button type="submit" class="flex-1 bg-indigo-600 text-white py-2 rounded-md font-medium hover:bg-indigo-700">Save</button>
        <button type="button" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md font-medium">Cancel</button>
      </div>
    </form>
  `;

  // Set field values via .value property (not innerHTML) (Security: HIGH-1 fix)
  dialog.querySelector('#edit-date').value = txn.date;
  dialog.querySelector('#edit-author').value = txn.author;
  dialog.querySelector('#edit-uah').value = txn.amount_uah;
  dialog.querySelector('#edit-pln').value = txn.amount_pln;
  dialog.querySelector('#edit-eur').value = txn.amount_eur;
  dialog.querySelector('#edit-usd').value = txn.amount_usd;

  // Append dialog to modal (Security: MEDIUM-2 fix)
  modal.appendChild(dialog);

  // Event listeners
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  dialog.querySelector('button[type="button"]').addEventListener('click', () => modal.remove());

  // Append modal to body (only once)
  document.body.appendChild(modal);

  // Populate tags dropdowns
  renderEditTagSelectors(modal, txn, tagObj);

  dialog.querySelector('#edit-form').addEventListener('submit', (e) => handleEditSubmit(e, txn.id, modal));
}

async function renderEditTagSelectors(modal, txn, tagObj) {
  const container = modal.querySelector('#edit-tags-section');
  const allKeys = tags.getAllKeys();

  for (const key of allKeys) {
    const values = await tags.getCascadedValues(key, tagObj, currentSettings.member_names);
    const select = document.createElement('select');
    select.id = `edit-tag-${key}`;
    select.className = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm';

    const option = document.createElement('option');
    option.value = '';
    option.textContent = `-- ${key} --`;
    select.appendChild(option);

    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      opt.selected = tagObj[key] === v;
      select.appendChild(opt);
    });

    const label = document.createElement('label');
    label.className = 'block text-sm font-medium text-gray-700 mb-1';
    label.textContent = key;

    const wrapper = document.createElement('div');
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.appendChild(wrapper);
  }
}

async function handleEditSubmit(e, txnId, modal) {
  e.preventDefault();

  try {
    const form = e.target;
    const date = form.querySelector('#edit-date').value;
    const uah = parseFloat(form.querySelector('#edit-uah').value) || 0;
    const pln = parseFloat(form.querySelector('#edit-pln').value) || 0;
    const eur = parseFloat(form.querySelector('#edit-eur').value) || 0;
    const usd = parseFloat(form.querySelector('#edit-usd').value) || 0;

    const tagObj = {};
    tags.getAllKeys().forEach(key => {
      const select = form.querySelector(`#edit-tag-${key}`);
      if (select.value) tagObj[key] = select.value;
    });

    const updated = {
      id: txnId,
      date,
      amount_uah: uah,
      amount_pln: pln,
      amount_eur: eur,
      amount_usd: usd,
      base_currency: allTransactions.find(t => t.id === txnId)?.base_currency || 'UAH',
      author: allTransactions.find(t => t.id === txnId)?.author || '',
      tags: tags.serializeTags(tagObj)
    };

    await api.editTransaction(updated);
    showToast('Transaction updated.', 'success');
    api.clearCaches();
    modal.remove();
    await loadAndRenderData();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// ============================================================================
// Utilities
// ============================================================================

function paginate(items, page) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-md shadow-lg`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
