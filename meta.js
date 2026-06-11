// services/meta.js
// Integrasi Meta WhatsApp Business Cloud API
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const axios = require("axios");

const BASE_URL = `https://graph.facebook.com/${process.env.META_API_VERSION || "v19.0"}`;

/**
 * Kirim pesan teks via Meta Cloud API
 * @param {string} to - Nomor tujuan (628xxx)
 * @param {string} message - Isi pesan
 */
async function sendMessage(to, message) {
  try {
    const url = `${BASE_URL}/${process.env.META_PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: message,
      },
    };

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      },
    });

    console.log(`[Meta] Pesan terkirim ke ${to}:`, response.data);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    console.error("[Meta] Gagal kirim:", error.response?.data || error.message);
    return { success: false, error: error.response?.data?.error?.message || error.message };
  }
}

/**
 * Kirim template message (untuk percakapan yang dimulai bisnis)
 * Template harus sudah disetujui Meta terlebih dahulu
 * @param {string} to
 * @param {string} templateName
 * @param {string} languageCode - contoh: "id" atau "en_US"
 * @param {Array} components - parameter template
 */
async function sendTemplate(to, templateName, languageCode = "id", components = []) {
  try {
    const url = `${BASE_URL}/${process.env.META_PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      },
    });

    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    console.error("[Meta] Gagal kirim template:", error.response?.data || error.message);
    return { success: false, error: error.response?.data?.error?.message || error.message };
  }
}

/**
 * Tandai pesan sebagai sudah dibaca (Read Receipt)
 * @param {string} messageId - ID pesan dari webhook
 */
async function markAsRead(messageId) {
  try {
    const url = `${BASE_URL}/${process.env.META_PHONE_NUMBER_ID}/messages`;

    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        },
      }
    );
  } catch (error) {
    // Non-critical, tidak perlu lempar error
    console.warn("[Meta] Gagal mark as read:", error.message);
  }
}

/**
 * Parse payload webhook dari Meta
 * Meta mengirimkan POST dengan struktur nested:
 * entry[0].changes[0].value.messages[0]
 */
function parseWebhook(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.length) return null;

    const msg = value.messages[0];
    const contact = value.contacts?.[0];

    return {
      phone: msg.from,                              // nomor pengirim
      name: contact?.profile?.name || "Pelanggan", // nama kontak
      message: msg.text?.body || "",               // isi pesan teks
      messageId: msg.id,                            // ID pesan (untuk mark as read)
      timestamp: msg.timestamp,
      type: msg.type,                               // text, image, audio, dll
      source: "meta",
    };
  } catch (e) {
    console.error("[Meta] Gagal parse webhook:", e.message);
    return null;
  }
}

/**
 * Verifikasi webhook dari Meta (GET request)
 * Meta akan kirim GET dengan query params untuk verifikasi
 */
function verifyWebhook(query) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return { valid: true, challenge };
  }
  return { valid: false };
}

module.exports = { sendMessage, sendTemplate, markAsRead, parseWebhook, verifyWebhook };
