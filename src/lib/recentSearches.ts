/**
 * Recent Searches Utility
 * Manages localStorage for recently searched clients
 */

const STORAGE_KEY = 'recent_client_searches';
const MAX_RECENT_SEARCHES = 10;

export interface RecentSearchItem {
    id: number;
    client_code: string;
    full_name: string;
    phone: string | null;
    searched_at: string; // ISO string
}

/**
 * Get all recent searches from localStorage
 * Returns empty array if localStorage is unavailable or data is corrupted
 */
export function getRecentSearches(): RecentSearchItem[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];

        // Validate structure
        return parsed.filter((item): item is RecentSearchItem => {
            return (
                typeof item === 'object' &&
                item !== null &&
                typeof item.id === 'number' &&
                typeof item.client_code === 'string' &&
                typeof item.full_name === 'string' &&
                typeof item.searched_at === 'string'
            );
        });
    } catch (error) {
        console.error('Failed to load recent searches:', error);
        return [];
    }
}

/**
 * Add a client to recent searches
 * - Moves to top if already exists
 * - Limits to MAX_RECENT_SEARCHES items
 * - Handles localStorage errors gracefully
 */
export function addRecentSearch(client: Omit<RecentSearchItem, 'searched_at'>): void {
    try {
        const recent = getRecentSearches();

        // Remove if already exists
        const filtered = recent.filter((item) => item.id !== client.id);

        // Add to top with current timestamp
        const updated: RecentSearchItem[] = [
            {
                ...client,
                searched_at: new Date().toISOString(),
            },
            ...filtered,
        ].slice(0, MAX_RECENT_SEARCHES);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Failed to save recent search:', error);
    }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear recent searches:', error);
    }
}
