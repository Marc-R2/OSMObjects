/**
 * Enhanced Fuzzy Search with Typeahead for OSM Objects
 * Provides intelligent search with fuzzy matching, typeahead suggestions, and search history
 */

// Global variables for search functionality
let searchHistory = [];
let searchFavorites = [];
let searchSuggestions = [];
let currentSearchTimeout = null;
let lastSearchResults = [];
let fuzzySearchEnabled = true;

// Configuration for fuzzy search
const SEARCH_CONFIG = {
    // Minimum characters before triggering search
    MIN_SEARCH_LENGTH: 2,
    // Debounce delay for search requests (milliseconds)
    SEARCH_DEBOUNCE_MS: 300,
    // Maximum number of search results to display
    MAX_RESULTS: 10,
    // Maximum number of suggestions in typeahead
    MAX_SUGGESTIONS: 5,
    // Maximum search history items to keep
    MAX_HISTORY: 20,
    // Maximum favorites to keep
    MAX_FAVORITES: 10,
    // Fuzzy matching threshold (0-1, lower = more strict)
    FUZZY_THRESHOLD: 0.6,
    // Storage keys for localStorage
    STORAGE_KEYS: {
        HISTORY: 'osmobjects_search_history',
        FAVORITES: 'osmobjects_search_favorites'
    },
    // Nominatim API settings
    NOMINATIM_API: {
        BASE_URL: 'https://nominatim.openstreetmap.org/search',
        LANGUAGE: 'en',
        LIMIT: 10,
        FORMAT: 'json',
        ADDRESSDETAILS: 1,
        EXTRATAGS: 1
    }
};

/**
 * Fuzzy string matching algorithm using Levenshtein distance
 * @param {string} pattern - Search pattern
 * @param {string} target - Target string to match
 * @returns {number} Similarity score (0-1, higher = more similar)
 */
function fuzzyMatch(pattern, target) {
    if (!pattern || !target) return 0;
    
    const patternLower = pattern.toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Exact match gets highest score
    if (patternLower === targetLower) return 1;
    
    // Check if pattern is contained in target
    if (targetLower.includes(patternLower)) {
        return 0.8 + (patternLower.length / targetLower.length) * 0.2;
    }
    
    // Calculate Levenshtein distance
    const matrix = [];
    const n = patternLower.length;
    const m = targetLower.length;
    
    if (n === 0) return m === 0 ? 1 : 0;
    if (m === 0) return 0;
    
    // Initialize matrix
    for (let i = 0; i <= n; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= m; j++) {
        matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = patternLower[i - 1] === targetLower[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    
    const distance = matrix[n][m];
    const maxLength = Math.max(n, m);
    return (maxLength - distance) / maxLength;
}

/**
 * Enhanced search input with fuzzy matching and typeahead
 * @param {object} map - Leaflet map instance
 * @returns {object} Enhanced search control
 */
function createEnhancedSearchControl(map) {
    const SearchControl = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-control-search');
            container.innerHTML = `
                <div class="search-container">
                    <input type="text" id="search-input" placeholder="Search places..." autocomplete="off" />
                    <button id="search-clear" class="search-clear-btn" title="Clear search">×</button>
                    <div id="search-suggestions" class="search-suggestions"></div>
                    <div id="search-history-panel" class="search-panel">
                        <div class="search-panel-header">
                            <span>Recent Searches</span>
                            <button id="clear-history" title="Clear history">🗑️</button>
                        </div>
                        <div id="search-history-list" class="search-list"></div>
                    </div>
                    <div id="search-favorites-panel" class="search-panel">
                        <div class="search-panel-header">
                            <span>Favorites</span>
                            <button id="clear-favorites" title="Clear favorites">🗑️</button>
                        </div>
                        <div id="search-favorites-list" class="search-list"></div>
                    </div>
                </div>
            `;
            
            // Prevent map interaction when using search
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);
            
            this._initializeSearchEvents(container, map);
            
            return container;
        },
        
        _initializeSearchEvents: function(container, map) {
            const searchInput = container.querySelector('#search-input');
            const clearButton = container.querySelector('#search-clear');
            const suggestionsDiv = container.querySelector('#search-suggestions');
            
            // Search input events
            searchInput.addEventListener('input', (e) => {
                this._handleSearchInput(e.target.value, suggestionsDiv, map);
            });
            
            searchInput.addEventListener('focus', () => {
                this._showSearchPanels();
                this._updateSearchHistory();
                this._updateSearchFavorites();
            });
            
            searchInput.addEventListener('blur', (e) => {
                // Delay hiding to allow clicks on suggestions
                setTimeout(() => {
                    if (!container.contains(document.activeElement)) {
                        this._hideSearchPanels();
                    }
                }, 200);
            });
            
            searchInput.addEventListener('keydown', (e) => {
                this._handleSearchKeydown(e, suggestionsDiv, map);
            });
            
            // Clear button
            clearButton.addEventListener('click', () => {
                searchInput.value = '';
                suggestionsDiv.innerHTML = '';
                this._hideSearchPanels();
                searchInput.focus();
            });
            
            // History and favorites management
            container.querySelector('#clear-history').addEventListener('click', () => {
                this._clearSearchHistory();
            });
            
            container.querySelector('#clear-favorites').addEventListener('click', () => {
                this._clearSearchFavorites();
            });
        },
        
        _handleSearchInput: function(query, suggestionsDiv, map) {
            // Clear previous timeout
            if (currentSearchTimeout) {
                clearTimeout(currentSearchTimeout);
            }
            
            if (query.length < SEARCH_CONFIG.MIN_SEARCH_LENGTH) {
                suggestionsDiv.innerHTML = '';
                return;
            }
            
            // Debounce search requests
            currentSearchTimeout = setTimeout(() => {
                this._performSearch(query, suggestionsDiv, map);
            }, SEARCH_CONFIG.SEARCH_DEBOUNCE_MS);
        },
        
        _handleSearchKeydown: function(e, suggestionsDiv, map) {
            const suggestions = suggestionsDiv.querySelectorAll('.search-suggestion');
            let selectedIndex = -1;
            
            // Find currently selected suggestion
            suggestions.forEach((suggestion, index) => {
                if (suggestion.classList.contains('selected')) {
                    selectedIndex = index;
                }
            });
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                    this._updateSelectedSuggestion(suggestions, selectedIndex);
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    this._updateSelectedSuggestion(suggestions, selectedIndex);
                    break;
                    
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                        const result = lastSearchResults[selectedIndex];
                        this._selectSearchResult(result, map);
                    } else {
                        this._performSearch(e.target.value, suggestionsDiv, map);
                    }
                    break;
                    
                case 'Escape':
                    suggestionsDiv.innerHTML = '';
                    this._hideSearchPanels();
                    e.target.blur();
                    break;
            }
        },
        
        _updateSelectedSuggestion: function(suggestions, selectedIndex) {
            suggestions.forEach((suggestion, index) => {
                if (index === selectedIndex) {
                    suggestion.classList.add('selected');
                } else {
                    suggestion.classList.remove('selected');
                }
            });
        },
        
        _performSearch: async function(query, suggestionsDiv, map) {
            try {
                showSearchNotification('Searching...', 'info');
                
                // Search in local history/favorites first
                const localResults = this._searchLocal(query);
                
                // Search using Nominatim API
                const apiResults = await this._searchNominatim(query);
                
                // Combine and sort results
                const allResults = [...localResults, ...apiResults];
                const uniqueResults = this._deduplicateResults(allResults);
                const sortedResults = this._sortResultsByRelevance(query, uniqueResults);
                
                lastSearchResults = sortedResults.slice(0, SEARCH_CONFIG.MAX_RESULTS);
                
                this._displaySearchResults(lastSearchResults, suggestionsDiv, map);
                
                hideSearchNotification();
                
            } catch (error) {
                console.error('Search error:', error);
                showSearchNotification('Search failed. Please try again.', 'error');
                suggestionsDiv.innerHTML = '<div class="search-error">Search failed. Please try again.</div>';
            }
        },
        
        _searchLocal: function(query) {
            const results = [];
            
            // Search in favorites
            searchFavorites.forEach(favorite => {
                const score = fuzzyMatch(query, favorite.display_name);
                if (score >= SEARCH_CONFIG.FUZZY_THRESHOLD) {
                    results.push({
                        ...favorite,
                        source: 'favorite',
                        relevance: score + 0.2 // Boost favorites
                    });
                }
            });
            
            // Search in history
            searchHistory.forEach(historyItem => {
                const score = fuzzyMatch(query, historyItem.display_name);
                if (score >= SEARCH_CONFIG.FUZZY_THRESHOLD) {
                    results.push({
                        ...historyItem,
                        source: 'history',
                        relevance: score + 0.1 // Boost history
                    });
                }
            });
            
            return results;
        },
        
        _searchNominatim: async function(query) {
            const params = new URLSearchParams({
                q: query,
                format: SEARCH_CONFIG.NOMINATIM_API.FORMAT,
                addressdetails: SEARCH_CONFIG.NOMINATIM_API.ADDRESSDETAILS,
                extratags: SEARCH_CONFIG.NOMINATIM_API.EXTRATAGS,
                limit: SEARCH_CONFIG.NOMINATIM_API.LIMIT,
                'accept-language': SEARCH_CONFIG.NOMINATIM_API.LANGUAGE
            });
            
            const response = await fetch(`${SEARCH_CONFIG.NOMINATIM_API.BASE_URL}?${params}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const results = await response.json();
            
            return results.map(result => ({
                ...result,
                source: 'nominatim',
                relevance: fuzzyMatch(query, result.display_name)
            }));
        },
        
        _deduplicateResults: function(results) {
            const seen = new Set();
            return results.filter(result => {
                const key = `${result.lat}_${result.lon}_${result.display_name}`;
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });
        },
        
        _sortResultsByRelevance: function(query, results) {
            return results.sort((a, b) => {
                // First by relevance score
                if (b.relevance !== a.relevance) {
                    return b.relevance - a.relevance;
                }
                
                // Then by source priority (favorites > history > nominatim)
                const sourcePriority = { favorite: 3, history: 2, nominatim: 1 };
                return sourcePriority[b.source] - sourcePriority[a.source];
            });
        },
        
        _displaySearchResults: function(results, suggestionsDiv, map) {
            if (results.length === 0) {
                suggestionsDiv.innerHTML = '<div class="search-no-results">No results found</div>';
                return;
            }
            
            const html = results.map((result, index) => {
                const sourceIcon = this._getSourceIcon(result.source);
                const relevanceBar = this._getRelevanceBar(result.relevance);
                
                return `
                    <div class="search-suggestion" data-index="${index}">
                        <div class="search-result-header">
                            <span class="search-source-icon">${sourceIcon}</span>
                            <span class="search-result-name">${this._highlightMatch(result.display_name, document.querySelector('#search-input').value)}</span>
                            <button class="add-favorite-btn" data-index="${index}" title="Add to favorites">⭐</button>
                        </div>
                        <div class="search-result-details">
                            <span class="search-result-type">${result.type || result.category || 'Place'}</span>
                            ${relevanceBar}
                        </div>
                    </div>
                `;
            }).join('');
            
            suggestionsDiv.innerHTML = html;
            
            // Add click events
            suggestionsDiv.querySelectorAll('.search-suggestion').forEach((suggestion, index) => {
                suggestion.addEventListener('click', () => {
                    this._selectSearchResult(results[index], map);
                });
            });
            
            // Add favorite buttons
            suggestionsDiv.querySelectorAll('.add-favorite-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(button.dataset.index);
                    this._addToFavorites(results[index]);
                });
            });
        },
        
        _getSourceIcon: function(source) {
            const icons = {
                favorite: '⭐',
                history: '🕐',
                nominatim: '🌐'
            };
            return icons[source] || '🔍';
        },
        
        _getRelevanceBar: function(relevance) {
            const percentage = Math.round(relevance * 100);
            const barWidth = Math.round(relevance * 50); // Max 50px width
            return `
                <div class="relevance-bar">
                    <div class="relevance-fill" style="width: ${barWidth}px"></div>
                    <span class="relevance-text">${percentage}%</span>
                </div>
            `;
        },
        
        _highlightMatch: function(text, query) {
            if (!query) return text;
            
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        },
        
        _selectSearchResult: function(result, map) {
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            
            if (isNaN(lat) || isNaN(lng)) {
                showSearchNotification('Invalid location coordinates', 'error');
                return;
            }
            
            // Add to search history
            this._addToHistory(result);
            
            // Zoom to location
            const bounds = result.boundingbox;
            if (bounds && bounds.length === 4) {
                const leafletBounds = L.latLngBounds([
                    [parseFloat(bounds[0]), parseFloat(bounds[2])],
                    [parseFloat(bounds[1]), parseFloat(bounds[3])]
                ]);
                map.fitBounds(leafletBounds, { maxZoom: 16 });
            } else {
                map.setView([lat, lng], 16);
            }
            
            // Add marker for search result
            this._addSearchMarker(map, lat, lng, result);
            
            // Clear search UI
            document.querySelector('#search-input').value = result.display_name;
            document.querySelector('#search-suggestions').innerHTML = '';
            this._hideSearchPanels();
            
            showSearchNotification(`Found: ${result.display_name}`, 'success');
        },
        
        _addSearchMarker: function(map, lat, lng, result) {
            // Remove previous search marker
            if (window.currentSearchMarker) {
                map.removeLayer(window.currentSearchMarker);
            }
            
            // Create new search marker
            window.currentSearchMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'search-result-marker',
                    html: '📍',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            }).addTo(map);
            
            window.currentSearchMarker.bindPopup(`
                <div class="search-result-popup">
                    <h3>${result.display_name}</h3>
                    <p><strong>Type:</strong> ${result.type || result.category || 'Place'}</p>
                    <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                    ${result.address ? `<p><strong>Address:</strong> ${JSON.stringify(result.address)}</p>` : ''}
                </div>
            `).openPopup();
        },
        
        _addToHistory: function(result) {
            // Remove if already exists
            searchHistory = searchHistory.filter(item => 
                item.lat !== result.lat || item.lon !== result.lon
            );
            
            // Add to beginning
            searchHistory.unshift({
                display_name: result.display_name,
                lat: result.lat,
                lon: result.lon,
                type: result.type || result.category,
                timestamp: Date.now()
            });
            
            // Limit history size
            if (searchHistory.length > SEARCH_CONFIG.MAX_HISTORY) {
                searchHistory = searchHistory.slice(0, SEARCH_CONFIG.MAX_HISTORY);
            }
            
            // Save to localStorage
            this._saveSearchHistory();
        },
        
        _addToFavorites: function(result) {
            // Check if already in favorites
            const exists = searchFavorites.some(fav => 
                fav.lat === result.lat && fav.lon === result.lon
            );
            
            if (exists) {
                showSearchNotification('Already in favorites', 'info');
                return;
            }
            
            // Add to favorites
            searchFavorites.unshift({
                display_name: result.display_name,
                lat: result.lat,
                lon: result.lon,
                type: result.type || result.category,
                timestamp: Date.now()
            });
            
            // Limit favorites size
            if (searchFavorites.length > SEARCH_CONFIG.MAX_FAVORITES) {
                searchFavorites = searchFavorites.slice(0, SEARCH_CONFIG.MAX_FAVORITES);
            }
            
            // Save to localStorage
            this._saveSearchFavorites();
            this._updateSearchFavorites();
            
            showSearchNotification('Added to favorites', 'success');
        },
        
        _showSearchPanels: function() {
            document.querySelector('#search-history-panel').style.display = 'block';
            document.querySelector('#search-favorites-panel').style.display = 'block';
        },
        
        _hideSearchPanels: function() {
            document.querySelector('#search-history-panel').style.display = 'none';
            document.querySelector('#search-favorites-panel').style.display = 'none';
        },
        
        _updateSearchHistory: function() {
            const historyList = document.querySelector('#search-history-list');
            if (searchHistory.length === 0) {
                historyList.innerHTML = '<div class="search-empty">No recent searches</div>';
                return;
            }
            
            const html = searchHistory.slice(0, 5).map(item => `
                <div class="search-list-item" data-lat="${item.lat}" data-lng="${item.lon}">
                    <span class="search-item-name">${item.display_name}</span>
                    <span class="search-item-type">${item.type || 'Place'}</span>
                </div>
            `).join('');
            
            historyList.innerHTML = html;
            
            // Add click events
            historyList.querySelectorAll('.search-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const lat = parseFloat(item.dataset.lat);
                    const lng = parseFloat(item.dataset.lng);
                    map.setView([lat, lng], 16);
                    this._hideSearchPanels();
                });
            });
        },
        
        _updateSearchFavorites: function() {
            const favoritesList = document.querySelector('#search-favorites-list');
            if (searchFavorites.length === 0) {
                favoritesList.innerHTML = '<div class="search-empty">No favorites</div>';
                return;
            }
            
            const html = searchFavorites.map(item => `
                <div class="search-list-item" data-lat="${item.lat}" data-lng="${item.lon}">
                    <span class="search-item-name">${item.display_name}</span>
                    <span class="search-item-type">${item.type || 'Place'}</span>
                </div>
            `).join('');
            
            favoritesList.innerHTML = html;
            
            // Add click events
            favoritesList.querySelectorAll('.search-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const lat = parseFloat(item.dataset.lat);
                    const lng = parseFloat(item.dataset.lng);
                    map.setView([lat, lng], 16);
                    this._hideSearchPanels();
                });
            });
        },
        
        _clearSearchHistory: function() {
            searchHistory = [];
            this._saveSearchHistory();
            this._updateSearchHistory();
            showSearchNotification('Search history cleared', 'info');
        },
        
        _clearSearchFavorites: function() {
            searchFavorites = [];
            this._saveSearchFavorites();
            this._updateSearchFavorites();
            showSearchNotification('Favorites cleared', 'info');
        },
        
        _saveSearchHistory: function() {
            try {
                localStorage.setItem(SEARCH_CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify(searchHistory));
            } catch (error) {
                console.warn('Failed to save search history:', error);
            }
        },
        
        _saveSearchFavorites: function() {
            try {
                localStorage.setItem(SEARCH_CONFIG.STORAGE_KEYS.FAVORITES, JSON.stringify(searchFavorites));
            } catch (error) {
                console.warn('Failed to save search favorites:', error);
            }
        }
    });
    
    return new SearchControl({ position: 'topright' });
}

/**
 * Shows search notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 */
function showSearchNotification(message, type = 'info') {
    // Reuse the location notification system
    showLocationNotification(message, type);
}

/**
 * Hides search notification
 */
function hideSearchNotification() {
    const notification = document.getElementById('location_notification');
    if (notification) {
        notification.style.display = 'none';
    }
}

/**
 * Initialize enhanced search functionality
 * @param {object} map - Leaflet map instance
 */
function initializeEnhancedSearch(map) {
    // Load search history and favorites from localStorage
    loadSearchData();
    
    // Create enhanced search control
    const enhancedSearchControl = createEnhancedSearchControl(map);
    map.addControl(enhancedSearchControl);
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+F or Cmd+F to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.querySelector('#search-input');
            if (searchInput) {
                searchInput.focus();
            }
        }
    });
    
    console.log('Enhanced fuzzy search initialized');
    console.log('Keyboard shortcut: Ctrl+F (focus search)');
}

/**
 * Load search data from localStorage
 */
function loadSearchData() {
    try {
        const historyData = localStorage.getItem(SEARCH_CONFIG.STORAGE_KEYS.HISTORY);
        if (historyData) {
            searchHistory = JSON.parse(historyData);
        }
        
        const favoritesData = localStorage.getItem(SEARCH_CONFIG.STORAGE_KEYS.FAVORITES);
        if (favoritesData) {
            searchFavorites = JSON.parse(favoritesData);
        }
        
        console.log(`Loaded ${searchHistory.length} search history items and ${searchFavorites.length} favorites`);
    } catch (error) {
        console.warn('Failed to load search data:', error);
        searchHistory = [];
        searchFavorites = [];
    }
}

/**
 * Get search statistics
 * @returns {object} Search statistics
 */
function getSearchStats() {
    return {
        history: searchHistory.length,
        favorites: searchFavorites.length,
        fuzzyEnabled: fuzzySearchEnabled,
        config: SEARCH_CONFIG
    };
}

/**
 * Clear all search data
 */
function clearAllSearchData() {
    searchHistory = [];
    searchFavorites = [];
    
    try {
        localStorage.removeItem(SEARCH_CONFIG.STORAGE_KEYS.HISTORY);
        localStorage.removeItem(SEARCH_CONFIG.STORAGE_KEYS.FAVORITES);
    } catch (error) {
        console.warn('Failed to clear search data from localStorage:', error);
    }
    
    // Update UI if visible
    const historyList = document.querySelector('#search-history-list');
    const favoritesList = document.querySelector('#search-favorites-list');
    
    if (historyList) {
        historyList.innerHTML = '<div class="search-empty">No recent searches</div>';
    }
    if (favoritesList) {
        favoritesList.innerHTML = '<div class="search-empty">No favorites</div>';
    }
    
    showSearchNotification('All search data cleared', 'info');
}