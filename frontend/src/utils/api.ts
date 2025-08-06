// API utility functions for handling base URL configuration

export const apiCall = async (endpoint: string, options?: RequestInit): Promise<Response> => {
    // Use relative URLs - Vercel will handle the proxy configuration
    return fetch(endpoint, {
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