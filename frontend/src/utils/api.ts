// API utility functions for handling base URL configuration

// Determine the API base URL based on environment
const API_BASE_URL = import.meta.env.PROD === true
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

export const getLyrics = async (song: string, artist?: string): Promise<{ lyrics: string }> => {
    const params = new URLSearchParams();
    params.append('song', song);
    if (artist) {
        params.append('artist', artist);
    }
    const response = await apiCall(`/api/lyrics?${params.toString()}`);
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