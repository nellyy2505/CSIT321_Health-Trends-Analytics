import axios from "axios";

const envBase = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
export const API_BASE_URL = envBase;

function clearAuthAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

export const api = axios.create({
  baseURL: envBase,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthAndRedirect();
    }
    return Promise.reject(error);
  }
);

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

export const getCurrentUser = async (token) => {
  const response = await axios.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const analyzeHealthScanImages = async (files) => {
  const fileList = Array.isArray(files) ? files : [files];
  const formData = new FormData();
  fileList.forEach((file) => formData.append("images", file));
  const response = await api.post("/health-scan/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getMyData = async () => {
  const response = await api.get("/mydata");
  return response.data;
};

export const saveMyData = async (data) => {
  const response = await api.put("/mydata", data);
  return response.data;
};

export const getRecommendations = async () => {
  const response = await api.get("/mydata/recommendations");
  return response.data;
};

export const getSettings = async () => {
  const response = await api.get("/mydata/settings");
  return response.data;
};

export const saveSettings = async (settings) => {
  const response = await api.put("/mydata/settings", settings);
  return response.data;
};

export const uploadAndAnalyzeCSV = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/upload-csv/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getUploadHistory = async () => {
  const response = await api.get("/upload-csv/history");
  return response.data;
};

export const getUploadById = async (uploadId) => {
  const response = await api.get(`/upload-csv/history/${uploadId}`);
  return response.data;
};

export const deleteUpload = async (uploadId) => {
  const response = await api.delete(`/upload-csv/history/${uploadId}`);
  return response.data;
};

export const clearUploadHistory = async () => {
  const response = await api.delete("/upload-csv/history");
  return response.data;
};

export const getDashboardCSVData = async (uploadId) => {
  const response = await api.post("/upload-csv/dashboard", { uploadId });
  return response.data;
};

export const getHealthScanHistory = async () => {
  const response = await api.get("/health-scan/history");
  return response.data;
};

export const deleteHealthScan = async (scanId) => {
  const response = await api.delete(`/health-scan/history/${scanId}`);
  return response.data;
};

export const clearHealthScanHistory = async () => {
  const response = await api.delete("/health-scan/history");
  return response.data;
};

export const getCareJourneyPatients = async (uploadId = null) => {
  const params = uploadId ? { upload_id: uploadId } : {};
  const response = await api.get("/care-journey/patients", { params });
  return response.data;
};

export const updateCareJourneyPatient = async (uploadId, residentId, { name, risk, timeline }) => {
  const response = await api.put(`/care-journey/patients/${uploadId}/${residentId}`, {
    name,
    risk,
    timeline,
  });
  return response.data;
}
