/**
 * CloudShift Architect Studio - LocalStorage History Manager (Version 3.1.1)
 */

const STORAGE_KEY = 'cloudshift_architect_history';
const MAX_HISTORY = 5;

function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read from localStorage', e);
    return [];
  }
}

function saveToHistory(recommendation) {
  try {
    const history = getHistory();
    // Add a unique ID and timestamp to the item
    const newItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...recommendation
    };

    // Remove duplicates of the same project name to avoid clutter
    const filteredHistory = history.filter(item => item.projectName !== recommendation.projectName);
    
    // Add to the front
    filteredHistory.unshift(newItem);
    
    // Cap size at MAX_HISTORY
    const trimmedHistory = filteredHistory.slice(0, MAX_HISTORY);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
    return trimmedHistory;
  } catch (e) {
    console.error('Failed to save to localStorage', e);
    return [];
  }
}

function deleteFromHistory(id) {
  try {
    const history = getHistory();
    const updatedHistory = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    return updatedHistory;
  } catch (e) {
    console.error('Failed to delete from localStorage', e);
    return [];
  }
}

// Expose to global scope for local file access (bypasses module CORS issues)
window.GCPStorage = {
  getHistory,
  saveToHistory,
  deleteFromHistory
};
