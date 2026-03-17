import axios from "axios";
import { fetchAuthSession } from "aws-amplify/auth";
import { isCognitoEnabled } from "../config/amplify";

// In dev, if API is external (AWS etc.), use /api so Vite proxy avoids CORS (no env flag needed)
const envBase = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const isDevExternal =
  import.meta.env.DEV &&
  envBase &&
  (envBase.includes("amazonaws.com") || envBase.startsWith("https://"));
const API_BASE_FOR_REQUESTS = isDevExternal ? "/api" : envBase;

function clearAuthAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

export const API_BASE_URL = API_BASE_FOR_REQUESTS;
export const api = axios.create({
  baseURL: API_BASE_FOR_REQUESTS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token to every request when user is logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 (e.g. expired token): try to refresh Cognito session and retry once; else redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401) return Promise.reject(error);

    if (!originalRequest.__tokenRefreshRetried && isCognitoEnabled()) {
      originalRequest.__tokenRefreshRetried = true;
      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        const newToken = session.tokens?.idToken?.toString();
        if (newToken) {
          localStorage.setItem("token", newToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api.request(originalRequest);
        }
      } catch (_) {
        // Refresh failed (e.g. refresh token expired)
      }
    }
    clearAuthAndRedirect();
    return Promise.reject(error);
  }
);

// --- Register ---
export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

// --- Login ---
export const loginUser = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

// --- Get User Infor ---
export const getCurrentUser = async (token) => {
  const response = await axios.get(`${API_BASE_FOR_REQUESTS}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

// --- Health Scan: upload 1–5 images, get structured health data from ChatGPT ---
export const analyzeHealthScanImages = async (files) => {
  const fileList = Array.isArray(files) ? files : [files];
  const url = `${api.defaults.baseURL}/health-scan/analyze`;
  console.log("[Health Scan] Sending request to API:", {
    url,
    method: "POST",
    imageCount: fileList.length,
    note: "Prompt is sent by the backend; check server/Lambda logs for '[Health Scan] Prompt sent'.",
  });
  const formData = new FormData();
  fileList.forEach((file) => formData.append("images", file));
  const response = await api.post("/health-scan/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

/** Get stored My Data for current user (DynamoDB). */
export const getMyData = async () => {
  const response = await api.get("/mydata");
  return response.data;
};

/** Save My Data for current user (DynamoDB). */
export const saveMyData = async (data) => {
  const response = await api.put("/mydata", data);
  return response.data;
};

/** Get AI-generated recommendations (what to do, diet, risks) from stored My Data. */
export const getRecommendations = async () => {
  const response = await api.get("/mydata/recommendations");
  return response.data;
};

/** Get user/facility settings (persists across devices). */
export const getSettings = async () => {
  const response = await api.get("/mydata/settings");
  return response.data;
};

/** Save user/facility settings. */
export const saveSettings = async (settings) => {
  const response = await api.put("/mydata/settings", settings);
  return response.data;
};

// --- Upload CSV (facility data) ---
/** Upload CSV file; backend analyzes with ChatGPT and stores in history. Returns { uploadId, filename, analysis }. */
export const uploadAndAnalyzeCSV = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/upload-csv/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

/** List CSV upload history for current user. */
export const getUploadHistory = async () => {
  const response = await api.get("/upload-csv/history");
  return response.data;
};

/** Get one upload by id (includes analysis). */
export const getUploadById = async (uploadId) => {
  const response = await api.get(`/upload-csv/history/${uploadId}`);
  return response.data;
};

/** Delete one upload. */
export const deleteUpload = async (uploadId) => {
  const response = await api.delete(`/upload-csv/history/${uploadId}`);
  return response.data;
};

/** Clear all upload history. */
export const clearUploadHistory = async () => {
  const response = await api.delete("/upload-csv/history");
  return response.data;
};

/** Get dashboard data (trend charts + recommendations) for a CSV upload. */
export const getDashboardCSVData = async (uploadId) => {
  const response = await api.post("/upload-csv/dashboard", { uploadId });
  return response.data;
};

// --- Health Scan history (for Uploaded History page) ---
/** List Health Scan history for current user. */
export const getHealthScanHistory = async () => {
  const response = await api.get("/health-scan/history");
  return response.data;
};

/** Delete one Health Scan record. */
export const deleteHealthScan = async (scanId) => {
  const response = await api.delete(`/health-scan/history/${scanId}`);
  return response.data;
};

/** Clear all Health Scan history. */
export const clearHealthScanHistory = async () => {
  const response = await api.delete("/health-scan/history");
  return response.data;
};

// --- Care Journey (from CSV uploads) ---
/** List patients with care journey data from facility CSV uploads. */
export const getCareJourneyPatients = async (uploadId = null) => {
  const params = uploadId ? { upload_id: uploadId } : {};
  const response = await api.get("/care-journey/patients", { params });
  return response.data;
};

/** Update a patient's care journey (name, risk, timeline). */
export const updateCareJourneyPatient = async (uploadId, residentId, { name, risk, timeline }) => {
  const response = await api.put(`/care-journey/patients/${uploadId}/${residentId}`, {
    name,
    risk,
    timeline,
  });
  return response.data;
};
