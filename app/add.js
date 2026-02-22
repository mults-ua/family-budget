// Family Budget — Add Transaction Form

import * as api from './api.js';
import * as currency from './currency.js';
import * as tags from './tags.js';

let currentRates = {};
let currentSettings = {};

// ============================================================================
// Render Form
// ============================================================================

export async function render(containerId) {
  try {
    currentSettings = await api.fetchSettings();
    currentRates = await currency.getRates();

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    container.innerHTML = '';
    const form = createFormElement();
    container.appendChild(form);

    attachEventListeners(form);
  } catch (error) {
    showToast(`Error loading form: ${error.message}`, 'error');
  }
}

function createFormElement() {
  const form = document.createElement('form');
  form.className = 'space-y-6 p-6 max-w-2xl mx-auto';

  form.innerHTML = `
    <h2 class="text-2xl font-bold text-gray-800">Add Transaction</h2>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input type="date" id="date" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Author</label>
        <input type="text" id="author" class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700" readonly>
      </div>
    </div>

    <div class="border-t pt-6">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Amount</h3>
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select id="base-currency" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="UAH">UAH</option>
            <option value="PLN">PLN</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input type="number" id="input-amount" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" step="0.01" required>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-2">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">UAH</label>
          <input type="number" id="amount-uah" class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" step="0.01">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">PLN</label>
          <input type="number" id="amount-pln" class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" step="0.01">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">EUR</label>
          <input type="number" id="amount-eur" class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" step="0.01">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">USD</label>
          <input type="number" id="amount-usd" class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" step="0.01">
        </div>
      </div>
    </div>

    <div class="border-t pt-6" id="tags-section">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Tags</h3>
      <div id="tags-container" class="space-y-4"></div>
    </div>

    <div class="border-t pt-6 flex gap-3">
      <button type="submit" class="flex-1 bg-indigo-600 text-white py-2 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        Save Transaction
      </button>
      <button type="reset" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md font-medium hover:bg-gray-400">
        Clear
      </button>
    </div>
  `;

  return form;
}

// ============================================================================
// Event Listeners
// ============================================================================

function attachEventListeners(form) {
  // Set default date
  const dateInput = form.querySelector('#date');
  dateInput.valueAsDate = new Date();

  // Auto-fill author
  const authorInput = form.querySelector('#author');
  authorInput.value = currentSettings.current_user_name || 'Unknown';

  // Currency amount input
  const baseCurrencySelect = form.querySelector('#base-currency');
  const inputAmountField = form.querySelector('#input-amount');
  const amountFields = {
    uah: form.querySelector('#amount-uah'),
    pln: form.querySelector('#amount-pln'),
    eur: form.querySelector('#amount-eur'),
    usd: form.querySelector('#amount-usd')
  };

  const updateDisplayAmounts = () => {
    const baseCurrency = baseCurrencySelect.value;
    const amount = parseFloat(inputAmountField.value) || 0;

    if (amount > 0) {
      const converted = currency.convertAll(amount, baseCurrency, currentRates);
      amountFields.uah.value = converted.uah;
      amountFields.pln.value = converted.pln;
      amountFields.eur.value = converted.eur;
      amountFields.usd.value = converted.usd;
    } else {
      Object.values(amountFields).forEach(field => field.value = '');
    }
  };

  inputAmountField.addEventListener('input', updateDisplayAmounts);
  baseCurrencySelect.addEventListener('change', updateDisplayAmounts);

  // Editable amount fields trigger recalculation
  const currencyFieldMap = {
    'amount-uah': 'UAH',
    'amount-pln': 'PLN',
    'amount-eur': 'EUR',
    'amount-usd': 'USD'
  };

  Object.entries(currencyFieldMap).forEach(([fieldId, currencyCode]) => {
    const field = form.querySelector(`#${fieldId}`);
    field.addEventListener('change', () => {
      const value = parseFloat(field.value) || 0;
      if (value > 0) {
        const recalculated = currency.recalcFrom(currencyCode, value, {}, currentRates);
        amountFields.uah.value = recalculated.uah;
        amountFields.pln.value = recalculated.pln;
        amountFields.eur.value = recalculated.eur;
        amountFields.usd.value = recalculated.usd;
        inputAmountField.value = '';
      }
    });
  });

  // Render tag selectors
  renderTagSelectors(form);

  // Form submit
  form.addEventListener('submit', (e) => handleSubmit(e, form));
}

async function renderTagSelectors(form) {
  try {
    const allKeys = tags.getAllKeys();
    const memberNames = currentSettings.member_names || [];
    const container = form.querySelector('#tags-container');
    container.innerHTML = '';

    for (const key of allKeys) {
      const values = await tags.getCascadedValues(key, {}, memberNames);
      const select = document.createElement('select');
      select.id = `tag-${key}`;
      select.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500';
      select.dataset.tagKey = key;

      const option = document.createElement('option');
      option.value = '';
      option.textContent = `-- Select ${key} --`;
      select.appendChild(option);

      values.forEach(value => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      });

      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<label class="block text-sm font-medium text-gray-700 mb-1">${key.charAt(0).toUpperCase() + key.slice(1)}</label>`;
      wrapper.appendChild(select);
      container.appendChild(wrapper);

      // Cascading: when tag changes, update other dropdowns
      select.addEventListener('change', () => updateCascadingSelects(form));
    }
  } catch (error) {
    showToast(`Error loading tags: ${error.message}`, 'error');
  }
}

async function updateCascadingSelects(form) {
  try {
    const allKeys = tags.getAllKeys();
    const memberNames = currentSettings.member_names || [];
    const activeTag = {};

    allKeys.forEach(key => {
      const select = form.querySelector(`#tag-${key}`);
      if (select.value) {
        activeTag[key] = select.value;
      }
    });

    // Refresh all dropdowns based on active tag
    for (const key of allKeys) {
      const values = await tags.getCascadedValues(key, activeTag, memberNames);
      const select = form.querySelector(`#tag-${key}`);
      const currentValue = select.value;

      const options = select.querySelectorAll('option:not(:first-child)');
      options.forEach(opt => opt.remove());

      values.forEach(value => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      });

      if (values.includes(currentValue)) {
        select.value = currentValue;
      } else {
        select.value = '';
      }
    }
  } catch (error) {
    console.error('Error updating cascading selects:', error);
  }
}

// ============================================================================
// Form Submit
// ============================================================================

async function handleSubmit(e, form) {
  e.preventDefault();

  try {
    const dateInput = form.querySelector('#date');
    const amountUah = parseFloat(form.querySelector('#amount-uah').value) || 0;
    const amountPln = parseFloat(form.querySelector('#amount-pln').value) || 0;
    const amountEur = parseFloat(form.querySelector('#amount-eur').value) || 0;
    const amountUsd = parseFloat(form.querySelector('#amount-usd').value) || 0;
    const baseCurrency = form.querySelector('#base-currency').value;
    const author = form.querySelector('#author').value;

    if (!dateInput.value || (amountUah === 0 && amountPln === 0 && amountEur === 0 && amountUsd === 0)) {
      showToast('Please fill in date and amount', 'error');
      return;
    }

    // Collect tags
    const tagObj = {};
    const allKeys = tags.getAllKeys();
    allKeys.forEach(key => {
      const select = form.querySelector(`#tag-${key}`);
      if (select.value) {
        tagObj[key] = select.value;
      }
    });

    const transaction = {
      id: generateUUID(),
      date: dateInput.value,
      amount_uah: amountUah,
      amount_pln: amountPln,
      amount_eur: amountEur,
      amount_usd: amountUsd,
      base_currency: baseCurrency,
      author,
      tags: tags.serializeTags(tagObj)
    };

    await api.addTransaction(transaction);
    showToast('Transaction saved successfully!', 'success');
    api.clearCaches();
    form.reset();
    form.querySelector('#date').valueAsDate = new Date();
    form.querySelector('#author').value = currentSettings.current_user_name || 'Unknown';
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// ============================================================================
// Utilities
// ============================================================================

function generateUUID() {
  // Use crypto.randomUUID() for cryptographically secure UUIDs (Security: HIGH-2 fix)
  return crypto.randomUUID();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-md shadow-lg`;
  toast.textContent = message;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
