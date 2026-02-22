// Family Budget — Tag Management
// Handles tag parsing, cascading, and definitions

import * as api from './api.js';

const PREDEFINED_KEYS = ['category', 'company', 'target', 'payment_method'];
let cachedDefinitions = null;

// ============================================================================
// Load & Structure Definitions
// ============================================================================

export async function loadTagDefinitions() {
  if (cachedDefinitions) {
    return cachedDefinitions;
  }

  try {
    const raw = await api.fetchTagDefinitions();
    cachedDefinitions = structureDefinitions(raw);
    return cachedDefinitions;
  } catch (error) {
    throw new Error(`Could not load tag definitions: ${error.message}`);
  }
}

function structureDefinitions(raw) {
  const structured = {};

  for (const key of PREDEFINED_KEYS) {
    structured[key] = [];
  }

  for (const def of raw) {
    const key = def.key || '';
    if (!structured[key]) {
      structured[key] = [];
    }

    structured[key].push({
      value: def.value || '',
      related_to: def.related_to || ''
    });
  }

  return structured;
}

// ============================================================================
// Cascading Values
// ============================================================================

export async function getCascadedValues(key, activeTag, memberNames = []) {
  const definitions = await loadTagDefinitions();

  // Special handling for 'target' key — values come from settings.member_names
  if (key === 'target') {
    return memberNames;
  }

  if (!definitions[key]) {
    return [];
  }

  const values = [];

  for (const def of definitions[key]) {
    if (!def.related_to) {
      // No constraint, always show
      values.push(def.value);
    } else {
      // Check if related_to matches active tag
      if (matchesActiveTag(def.related_to, activeTag)) {
        values.push(def.value);
      }
    }
  }

  return values;
}

function matchesActiveTag(relatedTo, activeTag) {
  const [relKey, relValue] = relatedTo.split(':').map(s => s.trim());

  if (activeTag[relKey] === relValue) {
    return true;
  }

  return false;
}

// ============================================================================
// Tag Parsing & Serialization
// ============================================================================

export function parseTags(tagString) {
  const tags = {};

  if (!tagString || typeof tagString !== 'string') {
    return tags;
  }

  const pairs = tagString.split(';').map(p => p.trim()).filter(p => p);

  for (const pair of pairs) {
    const [key, value] = pair.split(':').map(s => s.trim());
    if (key && value) {
      tags[key] = value;
    }
  }

  return tags;
}

export function serializeTags(tagObj) {
  if (!tagObj || typeof tagObj !== 'object') {
    return '';
  }

  const pairs = Object.entries(tagObj)
    .filter(([key, value]) => key && value)
    .map(([key, value]) => `${key}:${value}`);

  return pairs.join(';');
}

// ============================================================================
// Utility
// ============================================================================

export function clearCache() {
  cachedDefinitions = null;
}

export function getAllKeys() {
  return PREDEFINED_KEYS;
}
