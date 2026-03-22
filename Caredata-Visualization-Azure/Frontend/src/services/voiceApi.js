/**
 * Voice Biomarker API service.
 * Nurse endpoints use the shared `api` axios instance (nurse JWT).
 * Resident endpoints use a separate instance with resident_token.
 */
import axios from "axios";
import { api, API_BASE_URL } from "./api";

// ---------- Resident axios instance ----------
const residentApi = axios.create({ baseURL: API_BASE_URL });
residentApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("resident_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- Link management (nurse auth) ----------

export const generateVoiceLink = (residentId, facilityId = "default") =>
  api.post("/api/voice/links", { resident_id: residentId, facility_id: facilityId }).then((r) => r.data);

export const generateVoiceLinksBatch = (residentIds, facilityId = "default") =>
  api.post("/api/voice/links/batch", { resident_ids: residentIds, facility_id: facilityId }).then((r) => r.data);

// ---------- Link validation (public) ----------

export const validateVoiceLink = (token) =>
  axios.get(`${API_BASE_URL}/api/voice/links/${token}`).then((r) => r.data);

// ---------- Resident auth ----------

export const registerResident = (token, displayName, password) =>
  axios
    .post(`${API_BASE_URL}/api/voice/residents/register`, {
      token,
      display_name: displayName,
      password,
    })
    .then((r) => r.data);

export const loginResident = (residentId, password) =>
  axios
    .post(`${API_BASE_URL}/api/voice/residents/login`, {
      resident_id: residentId,
      password,
    })
    .then((r) => r.data);

// ---------- Recordings (resident auth) ----------

export const uploadRecording = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return residentApi
    .post("/api/voice/recordings", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const listRecordings = () =>
  residentApi.get("/api/voice/recordings").then((r) => r.data);

export const deleteRecording = (id) =>
  residentApi.delete(`/api/voice/recordings/${id}`).then((r) => r.data);

// ---------- Prompts (public) ----------

export const getRandomPrompt = () =>
  axios.get(`${API_BASE_URL}/api/voice/prompts/random`).then((r) => r.data);

// ---------- Analysis & alerts (nurse auth) ----------

export const getVoiceAnalysis = (residentId) =>
  api.get(`/api/voice/analysis/${residentId}`).then((r) => r.data);

export const getVoiceHistory = (residentId) =>
  api.get(`/api/voice/analysis/${residentId}/history`).then((r) => r.data);

export const getVoiceAlerts = () =>
  api.get("/api/voice/alerts").then((r) => r.data);

export const acknowledgeAlert = (analysisId) =>
  api.put(`/api/voice/alerts/${analysisId}/acknowledge`).then((r) => r.data);

// ---------- Facility / residents list (nurse auth) ----------

export const getVoiceFacilitySummary = () =>
  api.get("/api/voice/facility/summary").then((r) => r.data);

export const getVoiceResidents = () =>
  api.get("/api/voice/residents").then((r) => r.data);
