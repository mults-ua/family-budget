// Family Budget — Frontend API Wrapper
// Update GAS_URL below with your deployed Google Apps Script Web App URL

const GAS_URL = '__GAS_URL__';

// ============================================================================
// GET Endpoints
// ============================================================================

export async function fetchTransactions(filters = {}) {
  const params = new URLSearchParams({ action: 'transactions' });

  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.author) params.append('author', filters.author);
  if (filters.tag) params.append('tag', filters.tag);

  try {
    const response = await fetch(`${GAS_URL}?${params.toString()}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch transactions');
    }

    return data.data || [];
  } catch (error) {
    throw new Error(`Could not load transactions: ${error.message}`);
  }
}

export async function fetchTagDefinitions() {
  const cached = sessionStorage.getItem('tag_definitions_cache');
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const response = await fetch(`${GAS_URL}?action=tag_definitions`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch tags');
    }

    const definitions = data.data || [];
    sessionStorage.setItem('tag_definitions_cache', JSON.stringify(definitions));
    return definitions;
  } catch (error) {
    throw new Error(`Could not load tag definitions: ${error.message}`);
  }
}

export async function fetchSettings() {
  const cached = sessionStorage.getItem('settings_cache');
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const response = await fetch(`${GAS_URL}?action=settings`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch settings');
    }

    const settings = data.data || {};
    sessionStorage.setItem('settings_cache', JSON.stringify(settings));
    return settings;
  } catch (error) {
    throw new Error(`Could not load settings: ${error.message}`);
  }
}

// ============================================================================
// POST Endpoints
// ============================================================================

export async function addTransaction(transaction) {
  try {
    const response = await postToGAS('add', transaction);
    return response;
  } catch (error) {
    throw new Error(`Could not add transaction: ${error.message}`);
  }
}

export async function editTransaction(transaction) {
  try {
    const response = await postToGAS('edit', transaction);
    return response;
  } catch (error) {
    throw new Error(`Could not edit transaction: ${error.message}`);
  }
}

export async function softDelete(id) {
  try {
    const response = await postToGAS('soft_delete', { id });
    return response;
  } catch (error) {
    throw new Error(`Could not delete transaction: ${error.message}`);
  }
}

export async function restoreTransaction(id) {
  try {
    const response = await postToGAS('restore', { id });
    return response;
  } catch (error) {
    throw new Error(`Could not restore transaction: ${error.message}`);
  }
}

// ============================================================================
// Helper
// ============================================================================

async function postToGAS(action, payload) {
  try {
    // text/plain avoids CORS preflight (OPTIONS) which GAS cannot handle.
    // GAS still receives e.postData.contents as a JSON string.
    const response = await fetch(`${GAS_URL}?action=${action}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }

    return data.data;
  } catch (error) {
    throw error;
  }
}

// ============================================================================
// Cache Management
// ============================================================================

export function clearCaches() {
  sessionStorage.removeItem('tag_definitions_cache');
  sessionStorage.removeItem('settings_cache');
}

// ============================================================================
// Debug
// ============================================================================

export function getDebugInfo() {
  return { gasUrl: GAS_URL };
}
