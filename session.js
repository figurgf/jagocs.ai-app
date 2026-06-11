// services/session.js
// Manajemen session pelanggan: bot mode vs agent mode

// Simpan status per nomor HP
// Format: { "628xxx": { mode: "bot"|"agent", agentId, startedAt, lastActivity } }
const sessions = {};

// Waktu idle sebelum kembali ke bot (ms) — default 30 menit
const IDLE_TIMEOUT = 30 * 60 * 1000;

/**
 * Cek apakah nomor sedang dalam mode agent (diambil alih manusia)
 * @param {string} phone
 * @returns {boolean}
 */
function isAgentMode(phone) {
  const session = sessions[phone];
  if (!session || session.mode !== "agent") return false;

  // Cek apakah sudah timeout idle
  const idleTime = Date.now() - session.lastActivity;
  if (idleTime > IDLE_TIMEOUT) {
    console.log(`[Session] ${phone} kembali ke bot (idle timeout)`);
    setMode(phone, "bot");
    return false;
  }

  return true;
}

/**
 * Set mode session untuk nomor tertentu
 * @param {string} phone
 * @param {"bot"|"agent"} mode
 * @param {string} [agentId]
 */
function setMode(phone, mode, agentId = null) {
  sessions[phone] = {
    mode,
    agentId,
    startedAt: sessions[phone]?.startedAt || new Date().toISOString(),
    lastActivity: Date.now(),
  };
  console.log(`[Session] ${phone} → mode: ${mode}${agentId ? ` (agen: ${agentId})` : ""}`);
}

/**
 * Update waktu aktivitas terakhir
 * @param {string} phone
 */
function touch(phone) {
  if (sessions[phone]) {
    sessions[phone].lastActivity = Date.now();
  }
}

/**
 * Dapatkan semua session aktif
 */
function getAllSessions() {
  return Object.entries(sessions).map(([phone, data]) => ({
    phone,
    ...data,
    idleMinutes: Math.floor((Date.now() - data.lastActivity) / 60000),
  }));
}

/**
 * Reset session (hapus)
 * @param {string} phone
 */
function clearSession(phone) {
  delete sessions[phone];
}

module.exports = { isAgentMode, setMode, touch, getAllSessions, clearSession };
