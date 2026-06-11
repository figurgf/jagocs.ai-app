require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fonnte = require("./fonnte");
const meta = require("./meta");
const handler = require("./handler");
const session = require("./session");
const claude = require("./claude");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — izinkan frontend Vercel
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.path !== "/health") {
    console.log(`[${new Date().toLocaleTimeString("id-ID")}] ${req.method} ${req.path}`);
  }
  next();
});

// ── Webhook Fonnte ──────────────────────────────
app.post("/webhook/fonnte", async (req, res) => {
  res.status(200).json({ status: "ok" });
  try {
    const incoming = fonnte.parseWebhook(req.body);
    if (!incoming.phone || !incoming.message) return;
    await handler.handleIncomingMessage(incoming, async (phone, message) => {
      await fonnte.sendMessage(phone, message);
    });
  } catch (e) { console.error("[Fonnte]", e.message); }
});

// ── Webhook Meta ────────────────────────────────
app.get("/webhook/meta", (req, res) => {
  const { valid, challenge } = meta.verifyWebhook(req.query);
  if (valid) { console.log("[Meta] Webhook verified ✓"); res.status(200).send(challenge); }
  else res.status(403).json({ error: "Verification failed" });
});

app.post("/webhook/meta", async (req, res) => {
  res.status(200).json({ status: "ok" });
  try {
    if (req.body.entry?.[0]?.changes?.[0]?.value?.statuses) return;
    const incoming = meta.parseWebhook(req.body);
    if (!incoming?.message) return;
    if (incoming.messageId) await meta.markAsRead(incoming.messageId);
    await handler.handleIncomingMessage(incoming, async (phone, message) => {
      await meta.sendMessage(phone, message);
    });
  } catch (e) { console.error("[Meta]", e.message); }
});

// ── Internal API ────────────────────────────────
app.get("/api/sessions", (req, res) => {
  res.json({ sessions: session.getAllSessions(), aiSessions: claude.getActiveSessions() });
});

app.post("/api/send", async (req, res) => {
  const { phone, message, provider = "fonnte" } = req.body;
  if (!phone || !message) return res.status(400).json({ error: "phone dan message wajib diisi" });
  const result = provider === "meta"
    ? await meta.sendMessage(phone, message)
    : await fonnte.sendMessage(phone, message);
  res.json(result);
});

app.post("/api/takeover", (req, res) => {
  const { phone, agentId } = req.body;
  if (!phone) return res.status(400).json({ error: "phone wajib diisi" });
  session.setMode(phone, "agent", agentId || "manual");
  res.json({ success: true });
});

app.post("/api/release", (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone wajib diisi" });
  session.setMode(phone, "bot");
  claude.resetHistory(phone);
  res.json({ success: true });
});

app.post("/api/reset", (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone wajib diisi" });
  claude.resetHistory(phone);
  res.json({ success: true });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()) + "s",
    timestamp: new Date().toISOString(),
    config: {
      fonnte: !!process.env.FONNTE_TOKEN,
      meta: !!process.env.META_ACCESS_TOKEN,
      claude: !!process.env.ANTHROPIC_API_KEY,
    },
  });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`\n🚀 CS AI Backend — port ${PORT}`);
  console.log(`   Fonnte:  ${process.env.FONNTE_TOKEN ? "✅" : "❌"}`);
  console.log(`   Meta:    ${process.env.META_ACCESS_TOKEN ? "✅" : "❌"}`);
  console.log(`   Claude:  ${process.env.ANTHROPIC_API_KEY ? "✅" : "❌"}\n`);
});
