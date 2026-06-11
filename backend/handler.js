// services/handler.js
// Core logic: proses pesan masuk, putuskan bot/agent, kirim balasan

const claude = require("./claude");
const session = require("./session");

// Keyword untuk trigger handover ke agen
const AGENT_KEYWORDS = ["agen", "agent", "manusia", "cs", "customer service", "bicara dengan orang"];
// Keyword untuk kembali ke bot
const BOT_KEYWORDS = ["bot", "otomatis", "mulai ulang", "restart"];
// Keyword reset percakapan
const RESET_KEYWORDS = ["reset", "mulai lagi", "clear", "hapus riwayat"];

/**
 * Proses pesan masuk dan kembalikan balasan (jika ada)
 * @param {object} incoming - { phone, name, message, messageId, source }
 * @param {Function} sendFn - Fungsi kirim pesan: async (phone, text) => {}
 * @returns {Promise<void>}
 */
async function handleIncomingMessage(incoming, sendFn) {
  const { phone, name, message, source } = incoming;
  const msgLower = message.toLowerCase().trim();

  console.log(`\n[${source?.toUpperCase()}] Pesan masuk dari ${name} (${phone}): "${message}"`);

  // Update aktivitas session
  session.touch(phone);

  // ── Cek keyword reset ─────────────────────────────────────────────
  if (RESET_KEYWORDS.some((k) => msgLower.includes(k))) {
    claude.resetHistory(phone);
    session.setMode(phone, "bot");
    await sendFn(phone, "🔄 Percakapan direset. Halo kembali! Ada yang bisa saya bantu?");
    return;
  }

  // ── Cek keyword kembali ke bot ────────────────────────────────────
  if (BOT_KEYWORDS.some((k) => msgLower.includes(k)) && session.isAgentMode(phone)) {
    session.setMode(phone, "bot");
    await sendFn(phone, "🤖 Anda sekarang kembali dilayani oleh CS AI. Ada yang bisa saya bantu?");
    return;
  }

  // ── Cek apakah sedang mode agent ─────────────────────────────────
  if (session.isAgentMode(phone)) {
    // Pesan diteruskan ke dashboard agen — TIDAK dibalas otomatis oleh bot
    console.log(`[Handler] ${phone} dalam mode AGENT — pesan diteruskan ke dashboard`);
    // Di sini bisa tambahkan notifikasi ke dashboard via websocket/webhook
    return;
  }

  // ── Mode Bot: cek keyword handover ───────────────────────────────
  if (AGENT_KEYWORDS.some((k) => msgLower.includes(k))) {
    session.setMode(phone, "agent");
    await sendFn(
      phone,
      "👤 Baik, saya akan menghubungkan Anda dengan agen CS kami.\n\n" +
      "Mohon tunggu sebentar, agen kami akan segera merespons. " +
      "Rata-rata waktu tunggu: 2-5 menit.\n\n" +
      "Ketik *bot* kapan saja jika ingin kembali ke CS AI."
    );
    // TODO: Kirim notifikasi ke tim agen (email, push notification, dll)
    return;
  }

  // ── Mode Bot: auto-reply dengan Claude AI ─────────────────────────
  const systemPrompt = process.env.AI_SYSTEM_PROMPT ||
    "Kamu adalah CS AI yang ramah dan profesional. Jawab pertanyaan pelanggan dengan sopan dalam Bahasa Indonesia.";

  console.log(`[Handler] ${phone} → AI processing...`);
  const reply = await claude.getAIReply(phone, message, systemPrompt);

  await sendFn(phone, reply);
  console.log(`[Handler] Balasan terkirim ke ${phone}: "${reply.substring(0, 60)}..."`);
}

module.exports = { handleIncomingMessage };
