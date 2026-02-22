// Family Budget — Currency Conversion Logic
// Fetches exchange rates from NBU (National Bank of Ukraine) API
// Rates cached in localStorage for 4 hours

const NBU_API = 'https://bank.gov.ua/NBU_Exchange/exchange_new?json';
const CACHE_KEY = 'nbu_rates_cache';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
const CURRENCIES = ['USD', 'EUR', 'PLN'];

// ============================================================================
// Fetch and Cache Rates
// ============================================================================

export async function getRates() {
  const cached = getCachedRates();
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(NBU_API);
    if (!response.ok) {
      throw new Error('NBU API request failed');
    }

    const data = await response.json();
    const rates = parseRates(data);

    setCachedRates(rates);
    return rates;
  } catch (error) {
    throw new Error(`Could not fetch exchange rates: ${error.message}`);
  }
}

function parseRates(data) {
  const rates = { USD: 1, EUR: 1, PLN: 1 };

  for (const item of data) {
    const cc = item.cc?.toUpperCase();
    if (CURRENCIES.includes(cc)) {
      rates[cc] = item.rate || 1;
    }
  }

  return rates;
}

function getCachedRates() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return null;

  const { rates, timestamp } = JSON.parse(cached);
  const age = Date.now() - timestamp;

  if (age > CACHE_TTL) {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }

  return rates;
}

function setCachedRates(rates) {
  const cache = {
    rates,
    timestamp: Date.now()
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// ============================================================================
// Conversion
// ============================================================================

export function convertAll(amount, fromCurrency, rates) {
  const amountInUAH = fromCurrency === 'UAH'
    ? amount
    : amount * rates[fromCurrency];

  return {
    uah: round(amountInUAH),
    pln: round(amountInUAH / rates.PLN),
    eur: round(amountInUAH / rates.EUR),
    usd: round(amountInUAH / rates.USD)
  };
}

export function recalcFrom(changedCurrency, changedValue, currentAmounts, rates) {
  const amounts = { ...currentAmounts };
  amounts[changedCurrency.toLowerCase()] = changedValue;

  const converted = convertAll(changedValue, changedCurrency, rates);

  return {
    uah: converted.uah,
    pln: converted.pln,
    eur: converted.eur,
    usd: converted.usd
  };
}

// ============================================================================
// Utility
// ============================================================================

function round(value) {
  return Math.round(value * 100) / 100;
}
