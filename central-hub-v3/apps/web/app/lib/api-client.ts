/**
 * API Client
 * Axios instance with interceptors for auth and error handling
 */

import axios from 'axios';
import { useAuthStore } from '@/app/stores/auth-store';

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const tokens = useAuthStore.getState().tokens;
    if (tokens?.access) {
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const authStore = useAuthStore.getState();
        await authStore.refreshToken();
        
        // Retry the original request with new token
        const newTokens = authStore.tokens;
        if (newTokens?.access) {
          originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// API helper functions
export const api = {
  // Services
  services: {
    list: () => apiClient.get('/services'),
    get: (id: string) => apiClient.get(`/services/${id}`),
    create: (data: unknown) => apiClient.post('/services', data),
    update: (id: string, data: unknown) => apiClient.patch(`/services/${id}`, data),
    delete: (id: string) => apiClient.delete(`/services/${id}`),
    sync: () => apiClient.post('/services/sync'),
    deploy: (id: string) => apiClient.post(`/services/${id}/deploy`),
    restart: (id: string) => apiClient.post(`/services/${id}/restart`),
  },
  
  // Variables
  variables: {
    list: (serviceId: string) => apiClient.get(`/services/${serviceId}/variables`),
    create: (serviceId: string, data: unknown) => 
      apiClient.post(`/services/${serviceId}/variables`, data),
    update: (serviceId: string, variableId: string, data: unknown) => 
      apiClient.patch(`/services/${serviceId}/variables/${variableId}`, data),
    delete: (serviceId: string, variableId: string) => 
      apiClient.delete(`/services/${serviceId}/variables/${variableId}`),
    bulkUpdate: (serviceId: string, variables: Record<string, string>) => 
      apiClient.post(`/services/${serviceId}/variables/bulk`, { variables }),
  },
  
  // Deployments
  deployments: {
    list: (serviceId: string) => apiClient.get(`/services/${serviceId}/deployments`),
    get: (serviceId: string, deploymentId: string) => 
      apiClient.get(`/services/${serviceId}/deployments/${deploymentId}`),
    logs: (serviceId: string, deploymentId: string) => 
      apiClient.get(`/services/${serviceId}/deployments/${deploymentId}/logs`),
  },
  
  // AI
  ai: {
    analyze: (serviceId: string) => apiClient.get(`/ai/analyze/${serviceId}`),
    predict: (serviceId: string, hours = 24) => 
      apiClient.get(`/ai/predict/${serviceId}?hours=${hours}`),
    insights: (serviceId: string) => apiClient.get(`/ai/insights/${serviceId}`),
    chat: (message: string) => apiClient.post('/ai/chat', { message }),
  },
};
