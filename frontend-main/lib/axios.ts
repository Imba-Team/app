import axios from "axios";

const API_BASE_URL = "https://imba-server.up.railway.app";

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for cookies/sessions
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor - for adding auth tokens, logging, etc.
apiClient.interceptors.request.use(
  (config) => {
    // You can add auth tokens here if needed
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    // Log requests in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[API Request] ${config.method?.toUpperCase()} ${config.url}`
      );
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - for error handling, token refresh, etc.
apiClient.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[API Response] ${response.config.method?.toUpperCase()} ${
          response.config.url
        }`,
        response.status
      );
    }

    return response;
  },
  (error) => {
    // Handle common errors globally
    if (error.response) {
      const { status, data } = error.response;

      // Log errors in development
      if (process.env.NODE_ENV === "development") {
        console.error(`[API Error] ${status}:`, data);
      }

      // Handle specific status codes
      switch (status) {
        case 401:
          // Unauthorized - could redirect to login
          console.error("Unauthorized - please log in");
          // window.location.href = '/login';
          break;
        case 403:
          console.error("Forbidden - you don't have permission");
          break;
        case 404:
          console.error("Resource not found");
          break;
        case 500:
          console.error("Server error - please try again later");
          break;
        default:
          console.error(`Error ${status}: ${data?.message || "Unknown error"}`);
      }
    } else if (error.request) {
      // Request made but no response
      console.error("Network error - no response from server");
    } else {
      // Something else happened
      console.error("Request error:", error.message);
    }

    return Promise.reject(error);
  }
);
