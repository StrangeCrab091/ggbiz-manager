import axios from 'axios';

const apiService = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

apiService.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export default apiService;
