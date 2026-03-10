import { useState, useEffect } from "react";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";

const SETTINGS_STORAGE_KEY = "caredata_facility_settings";

const DEFAULT_SETTINGS = {
  avatar: "",
  firstName: "",
  lastName: "",
  jobTitle: "",
  facilityName: "",
  facilityType: "",
  facilityRegistration: "",
  abn: "",
  street: "",
  suburb: "",
  state: "",
  postcode: "",
  bedCapacity: "",
  contactEmail: "",
  contactPhone: "",
  emergencyContact: "",
  delegatedContact: "",
  afterHoursContact: "",
};

const FACILITY_TYPES = [
  { value: "", label: "— Select type —" },
  { value: "residential", label: "Residential Aged Care" },
  { value: "day_centre", label: "Day Centre" },
  { value: "respite", label: "Respite Care" },
  { value: "home_care", label: "Home Care" },
  { value: "other", label: "Other" },
];

export default function SettingPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...parsed }));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSaved(false);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev) => ({ ...prev, avatar: reader.result }));
        setSaved(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Failed to save settings.");
    }
  };

  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/3177/3177440.png";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        <MyDataSidebar activePage="Settings" />

        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 text-center">
            User & Facility Settings
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Manage your personal details, facility information, and contact preferences.
          </p>

          {/* User Profile */}
          <div className="flex items-center gap-10 mb-10">
            <div className="flex flex-col items-center justify-center">
              <img
                src={settings.avatar || defaultAvatar}
                alt="User Avatar"
                className="w-28 h-28 rounded-full border-4 border-gray-200 shadow-sm object-cover"
              />
              <label className="mt-3 text-sm text-orange-600 font-medium cursor-pointer hover:underline">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                Change Avatar
              </label>
            </div>
            <div className="flex flex-col justify-center space-y-4 flex-1 max-w-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    name="firstName"
                    value={settings.firstName}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    name="lastName"
                    value={settings.lastName}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title / Role</label>
                <input
                  name="jobTitle"
                  value={settings.jobTitle}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. Facility Manager, Care Coordinator"
                />
              </div>
            </div>
          </div>

          {/* Facility Information */}
          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Facility Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
                <input
                  name="facilityName"
                  value={settings.facilityName}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter facility name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Type</label>
                <select
                  name="facilityType"
                  value={settings.facilityType}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                >
                  {FACILITY_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration / Accreditation Number
                </label>
                <input
                  name="facilityRegistration"
                  value={settings.facilityRegistration}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. ACFA number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ABN</label>
                <input
                  name="abn"
                  value={settings.abn}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="11 digits"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bed / Capacity</label>
                <input
                  name="bedCapacity"
                  type="number"
                  min="1"
                  value={settings.bedCapacity}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Number of beds or places"
                />
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  name="street"
                  value={settings.street}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Street address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
                <input
                  name="suburb"
                  value={settings.suburb}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Suburb"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    name="state"
                    value={settings.state}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. NSW"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                  <input
                    name="postcode"
                    value={settings.postcode}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                    placeholder="Postcode"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  name="contactEmail"
                  type="email"
                  value={settings.contactEmail}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Primary contact email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  name="contactPhone"
                  type="tel"
                  value={settings.contactPhone}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Primary phone"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact (24/7)</label>
                <input
                  name="emergencyContact"
                  type="tel"
                  value={settings.emergencyContact}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="For incidents / urgent matters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delegated / Backup Contact</label>
                <input
                  name="delegatedContact"
                  value={settings.delegatedContact}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="When manager unavailable"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">After-Hours Contact</label>
                <input
                  name="afterHoursContact"
                  type="tel"
                  value={settings.afterHoursContact}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Phone or contact for after-hours"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-center items-center gap-4 mt-10">
            <button
              onClick={handleSave}
              className="bg-orange-500 text-white px-6 py-2 rounded-md font-medium hover:bg-orange-600 transition"
            >
              Save Settings
            </button>
            {saved && (
              <span className="text-green-600 text-sm font-medium">Settings saved successfully.</span>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
