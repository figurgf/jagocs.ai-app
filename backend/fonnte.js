// services/fonnte.js
// Integrasi Fonnte WhatsApp Gateway API

const axios = require("axios");

const FONNTE_API = "https://api.fonnte.com";

/**
 * Kirim pesan WhatsApp via Fonnte
 * @param {string} target - Nomor tujuan (628xxx)
 * @param {string} message - Isi pesan
 * @param {object} options - Opsi tambahan (delay, typing, dll)
 */
async function sendMessage(target, message, options = {}) {
  try {
    const payload = {
      target,
      message,
      typing: options.typing !== false, // default: tampilkan typing indicator
      delay: options.delay ?? 1,        // default: delay 1 detik
      ...options,
    };

    const response = await axios.post(`${FONNTE_API}/send`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.FONNTE_TOKEN,
      },
    });

    console.log(`[Fonnte] Pesan terkirim ke ${target}:`, response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("[Fonnte] Gagal kirim:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Kirim typing indicator ke nomor tertentu
 * @param {string} target
 */
async function sendTyping(target) {
  return sendMessage(target, "...", { typing: true, delay: 0 });
}

/**
 * Parse payload webhook dari Fonnte
 * Fonnte mengirimkan POST dengan body:
 * { device, sender, message, name, location, timestamp, inboxid }
 */
function parseWebhook(body) {
  return {
    phone: body.sender,       // nomor pengirim (628xxx)
    name: body.name || "Pelanggan",
    message: body.message,
    device: body.device,
    timestamp: body.timestamp,
    inboxId: body.inboxid,
    source: "fonnte",
  };
}

module.exports = { sendMessage, sendTyping, parseWebhook };
