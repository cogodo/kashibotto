// API utility functions for handling base URL configuration

// Determine the API base URL based on environment
const API_BASE_URL = import.meta.env.PROD
    ? 'https://kashibotto.onrender.com' // Updated Render URL
    : '';

export const apiCall = async (endpoint: string, options?: RequestInit): Promise<Response> => {
    const url = API_BASE_URL + endpoint;
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
};

export const searchSongs = async (query: string): Promise<any> => {
    const response = await apiCall(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error('Failed to search songs');
    }
    return response.json();
};

export const getLyrics = async (song: string): Promise<{ lyrics: string }> => {
    const response = await apiCall(`/api/lyrics?song=${encodeURIComponent(song)}`);
    if (!response.ok) {
        throw new Error('Failed to fetch lyrics');
    }
    return response.json();
};

export const processLyrics = async (lyrics: string): Promise<any> => {
    const response = await apiCall('/api/process', {
        method: 'POST',
        body: JSON.stringify({ lyrics }),
    });
    if (!response.ok) {
        throw new Error('Failed to process lyrics');
    }
    return response.json();
}; 