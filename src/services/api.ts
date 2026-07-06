// API service configuration and base instances
export const API_BASE_URL = '/api';

// Placeholder for future API integration
export const api = {
  get: async (url: string) => {
    const response = await fetch(`${API_BASE_URL}${url}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return response.json();
  },
};
