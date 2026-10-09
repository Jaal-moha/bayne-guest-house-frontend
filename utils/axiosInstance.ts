// src/utils/axiosInstance.ts
import axios from 'axios';
import Router from 'next/router';
import { CHANGE_PASSWORD_PATH } from '@/lib/permissions';

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001',
});

// Attach token on every request from browser
axiosInstance.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('token');
    if (t) config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(undefined, (error) => {
  if (
    typeof window !== 'undefined' &&
    error?.response?.status === 403 &&
    error.response.data?.code === 'PASSWORD_CHANGE_REQUIRED' &&
    Router.pathname !== CHANGE_PASSWORD_PATH
  ) {
    Router.replace(CHANGE_PASSWORD_PATH);
  }
  return Promise.reject(error);
});

export default axiosInstance;
