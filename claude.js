// services/claude.js
// Integrasi Anthropic Claude AI untuk auto-reply

const axios = require("axios");

// In-memory conversation history per nomor HP
// Format: { "628xxx": [{ role, content }, ...] }
const conversationHistory = {};
const MAX_HISTORY = 10; // maksimum pesan yang disimpan per user

/**
 * Dapatkan balasan AI dari Claude
 * @param {string} phone - Nomor pengirim (628xxx)
 * @param {string} message - Pesan masuk
 * @param {string} systemPrompt - Instruksi bot
 * @returns {Promise<string>} - Balasan dari AI
 */
async function getAIReply(phone, message, systemPrompt) {
  // Inisialisasi history jika belum ada
  if (!conversationHistory[phone]) {
    conversationHistory[phone] = [];
  }

  // Tambahkan pesan user ke history
  conversationHistory[phone].push({ role: "user", content: message });

  // Batasi history agar tidak terlalu panjang
  if (conversationHistory[phone].length > MAX_HISTORY * 2) {
    conversationHistory[phone] = conversationHistory[phone].slice(-MAX_HISTORY * 2);
  }

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: conversationHistory[phone],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
      }
    );

    const reply = response.data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Simpan balasan AI ke history
    conversationHistory[phone].push({ role: "assistant", content: reply });

    return reply;
  } catch (error) {
    console.error("[Claude] Error:", error.response?.data || error.message);
    return "Maaf, terjadi gangguan. Silakan coba beberapa saat lagi.";
  }
}

/**
 * Reset riwayat percakapan untuk nomor tertentu
 * @param {string} phone
 */
function resetHistory(phone) {
  delete conversationHistory[phone];
  console.log(`[Claude] History direset untuk ${phone}`);
}

/**
 * Ambil semua active sessions (untuk debugging)
 */
function getActiveSessions() {
  return Object.keys(conversationHistory).map((phone) => ({
    phone,
    messageCount: conversationHistory[phone].length,
  }));
}

module.exports = { getAIReply, resetHistory, getActiveSessions };
