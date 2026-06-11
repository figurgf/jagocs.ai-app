// src/config.js
// Ganti VITE_BACKEND_URL di .env.local dengan URL Railway kamu setelah deploy

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
