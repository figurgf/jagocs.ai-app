import { BACKEND_URL, ANTHROPIC_API_URL } from "./config.js";
import { useState, useRef, useEffect } from "react";

// ─── PALETTE ───────────────────────────────────────────────────────
const C = {
  primary: "#1A56DB", primaryDark: "#1044B2", primaryLight: "#EEF3FF",
  accent: "#0EA5E9", success: "#10B981", warning: "#F59E0B",
  danger: "#EF4444", wa: "#25D366",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0",
  gray400: "#94A3B8", gray600: "#475569", gray800: "#1E293B", white: "#FFFFFF",
};

// ─── FONNTE API ─────────────────────────────────────────────────────
// Fonnte API: https://api.fonnte.com/send
// Webhook incoming: POST ke URL webhook kamu → { sender, message, name, device, timestamp }
async function fonnteSend(token, target, message) {
  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ target, message, typing: true, delay: 1 })
    });
    return await res.json();
  } catch (e) {
    return { status: false, reason: e.message };
  }
}

// ─── META CLOUD API ──────────────────────────────────────────────────
// Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp
async function metaSend(accessToken, phoneNumberId, to, message) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      }
    );
    const data = await res.json();
    if (data.messages) return { status: true, id: data.messages[0]?.id };
    return { status: false, reason: data.error?.message || JSON.stringify(data) };
  } catch (e) {
    return { status: false, reason: e.message };
  }
}

// ─── MOCK DATA ──────────────────────────────────────────────────────
const AGENTS = [
  { id: 1, name: "Siti Rahayu", avatar: "SR", status: "online" },
  { id: 2, name: "Budi Santoso", avatar: "BS", status: "online" },
  { id: 3, name: "Dewi Lestari", avatar: "DL", status: "busy" },
  { id: 4, name: "Andi Wijaya", avatar: "AW", status: "offline" },
];

const INIT_CONVERSATIONS = [
  {
    id: 1, name: "Rina Kusuma", phone: "6281234567890", channel: "WhatsApp",
    status: "bot", assignedTo: null, unread: 2,
    lastMsg: "Berapa harga produk X?", lastTime: "10:32", tag: "Calon Pembeli",
    messages: [
      { role: "customer", content: "Halo, saya mau tanya soal produk X", time: "10:30" },
      { role: "bot", content: "Halo Rina! 👋 Ada yang bisa saya bantu?", time: "10:30" },
      { role: "customer", content: "Berapa harga produk X?", time: "10:32" },
    ],
    profile: { totalOrder: 0, totalSpend: 0, joinDate: "Juni 2026", notes: "Tertarik produk X" }
  },
  {
    id: 2, name: "Hendra Gunawan", phone: "6282198765432", channel: "WhatsApp",
    status: "agent", assignedTo: 1, unread: 0,
    lastMsg: "Oke, saya tunggu konfirmasinya", lastTime: "10:15", tag: "Pelanggan Aktif",
    messages: [
      { role: "customer", content: "Pesanan saya sudah dikirim belum?", time: "10:10" },
      { role: "agent", content: "Halo Pak Hendra, pesanan Anda sudah dalam proses pengiriman!", time: "10:12" },
      { role: "customer", content: "Oke, saya tunggu konfirmasinya", time: "10:15" },
    ],
    profile: { totalOrder: 12, totalSpend: 4800000, joinDate: "Maret 2025", notes: "Pelanggan setia" }
  },
];

const DEFAULT_SYSTEM = `Kamu adalah CS AI yang ramah dan profesional untuk bisnis e-commerce Indonesia.
- Jawab pertanyaan produk, harga, stok, dan pengiriman
- Tangani komplain dengan empati
- Arahkan ke promo yang relevan
- Jika terlalu kompleks, sarankan bicara dengan agen manusia
Gunakan bahasa Indonesia yang sopan dan hangat.`;

// ─── HELPERS ────────────────────────────────────────────────────────
function now() { return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }

function Avatar({ initials, size = 36, color = C.primary, status }) {
  return (
    <div style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: size * 0.35
      }}>{initials}</div>
      {status && <div style={{
        position: "absolute", bottom: 1, right: 1,
        width: size * 0.28, height: size * 0.28, borderRadius: "50%",
        background: status === "online" ? C.success : status === "busy" ? C.warning : C.gray400,
        border: "2px solid white"
      }} />}
    </div>
  );
}

function Badge({ label, color = C.primary }) {
  return <span style={{ background: color + "18", color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>{label}</span>;
}

function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, background: C.gray800, color: "#fff",
      padding: "12px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 9999, display: "flex", gap: 10, alignItems: "center"
    }}>
      <span>{msg}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
    </div>
  );
}

// ─── SIDEBAR ────────────────────────────────────────────────────────
function Sidebar({ active, setActive }) {
  const items = [
    { id: "inbox", icon: "💬", label: "Inbox" },
    { id: "crm", icon: "👥", label: "CRM" },
    { id: "agents", icon: "🎧", label: "Agen" },
    { id: "analytics", icon: "📊", label: "Analitik" },
    { id: "fonnte", icon: "⚡", label: "Fonnte" },
    { id: "meta", icon: "🟢", label: "Meta API" },
    { id: "settings", icon: "⚙️", label: "Setting" },
  ];
  return (
    <div style={{ width: 64, background: C.gray800, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 2, flexShrink: 0 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 14, fontWeight: 800, color: "#fff" }}>C</div>
      {items.map(item => (
        <button key={item.id} onClick={() => setActive(item.id)} title={item.label}
          style={{
            width: 48, height: 48, borderRadius: 12, border: "none", cursor: "pointer",
            background: active === item.id ? C.primary : "transparent",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2
          }}>
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          <span style={{ fontSize: 9, color: active === item.id ? "#fff" : C.gray400, fontWeight: 600 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── CONV LIST ───────────────────────────────────────────────────────
function ConvList({ convs, selected, setSelected, filter, setFilter }) {
  const tabs = ["Semua", "Bot", "Agen", "Selesai"];
  const list = convs.filter(c =>
    filter === "Semua" ? true :
    filter === "Bot" ? c.status === "bot" :
    filter === "Agen" ? c.status === "agent" :
    c.status === "resolved"
  );
  return (
    <div style={{ width: 272, borderRight: `1px solid ${C.gray200}`, display: "flex", flexDirection: "column", background: C.white, flexShrink: 0 }}>
      <div style={{ padding: "14px 12px 10px", borderBottom: `1px solid ${C.gray200}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800, marginBottom: 8 }}>Percakapan</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tabs.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "3px 10px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
              background: filter === f ? C.primary : C.gray100,
              color: filter === f ? "#fff" : C.gray600,
            }}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {list.map(conv => (
          <div key={conv.id} onClick={() => setSelected(conv.id)}
            style={{
              padding: "11px 12px", cursor: "pointer", borderBottom: `1px solid ${C.gray100}`,
              background: selected === conv.id ? C.primaryLight : "transparent",
              borderLeft: selected === conv.id ? `3px solid ${C.primary}` : "3px solid transparent",
            }}>
            <div style={{ display: "flex", gap: 9 }}>
              <div style={{ position: "relative" }}>
                <Avatar initials={conv.name.split(" ").map(n => n[0]).join("").slice(0,2)} size={36}
                  color={conv.status === "resolved" ? C.gray400 : C.primary} />
                <span style={{ position: "absolute", bottom: -2, right: -2, fontSize: 11 }}>
                  {conv.channel === "WhatsApp" ? "📱" : "🌐"}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: C.gray800 }}>{conv.name}</span>
                  <span style={{ fontSize: 11, color: C.gray400 }}>{conv.lastTime}</span>
                </div>
                <div style={{ fontSize: 12, color: C.gray600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150, marginTop: 1 }}>{conv.lastMsg}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, alignItems: "center" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 10,
                    background: conv.status === "bot" ? C.accent + "18" : conv.status === "agent" ? C.success + "18" : C.gray200,
                    color: conv.status === "bot" ? C.accent : conv.status === "agent" ? C.success : C.gray400
                  }}>
                    {conv.status === "bot" ? "🤖 Bot" : conv.status === "agent" ? "👤 Agen" : "✓ Selesai"}
                  </span>
                  {conv.unread > 0 && (
                    <span style={{ background: C.danger, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 6px" }}>{conv.unread}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CHAT PANEL ──────────────────────────────────────────────────────
function ChatPanel({ conv, onUpdate, agents, systemPrompt, fonnteToken, metaConfig, toast }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conv?.messages, loading]);

  if (!conv) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.gray50 }}>
      <div style={{ textAlign: "center", color: C.gray400 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
        <div style={{ fontWeight: 600 }}>Pilih percakapan</div>
      </div>
    </div>
  );

  async function getAIReply(userMsg, history) {
    const messages = [
      ...history.filter(m => m.role !== "bot" || history.indexOf(m) > 0).map(m => ({
        role: m.role === "customer" ? "user" : "assistant",
        content: m.content
      })),
      { role: "user", content: userMsg }
    ];
    const res = await fetch("ANTHROPIC_API_URL", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: systemPrompt, messages })
    });
    const data = await res.json();
    return data.content?.map(b => b.text || "").join("") || "Maaf, tidak ada respons.";
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const isAgent = conv.status === "agent";
    const msgRole = isAgent ? "agent" : "customer";
    const newMsg = { role: msgRole, content: text, time: now() };
    const updated = [...conv.messages, newMsg];
    onUpdate(conv.id, { messages: updated, lastMsg: text, lastTime: now(), unread: 0 });

    if (isAgent && conv.channel === "WhatsApp") {
      setLoading(true);
      // Kirim via Fonnte jika token tersedia
      if (fonnteToken) {
        const result = await fonnteSet(fonnteToken, conv.phone, text);
        setLoading(false);
        if (result.status) toast("✅ Pesan terkirim via Fonnte!");
        else toast("⚠️ Fonnte gagal: " + (result.reason || "error"));
      }
      // Kirim via Meta Cloud API jika dikonfigurasi
      else if (metaConfig?.accessToken && metaConfig?.phoneNumberId) {
        const result = await metaSend(metaConfig.accessToken, metaConfig.phoneNumberId, conv.phone, text);
        setLoading(false);
        if (result.status) toast("✅ Pesan terkirim via Meta WA API!");
        else toast("⚠️ Meta API gagal: " + (result.reason || "error"));
      } else {
        setLoading(false);
      }
    }

    if (conv.status === "bot") {
      setLoading(true);
      try {
        const reply = await getAIReply(text, conv.messages);
        const botMsg = { role: "bot", content: reply, time: now() };
        const withBot = [...updated, botMsg];
        onUpdate(conv.id, { messages: withBot, lastMsg: reply, lastTime: now() });

        // Jika ada token Fonnte, kirim balasan bot ke WA
        if (fonnteToken && conv.channel === "WhatsApp") {
          await fonnteSet(fonnteToken, conv.phone, reply);
        }
        // Atau via Meta API
        else if (metaConfig?.accessToken && metaConfig?.phoneNumberId && conv.channel === "WhatsApp") {
          await metaSend(metaConfig.accessToken, metaConfig.phoneNumberId, conv.phone, reply);
        }
      } catch { }
      setLoading(false);
    }
  }

  // wrapper agar tidak typo
  async function fonnteSet(token, phone, msg) {
    return await fonnteSend(token, phone, msg);
  }

  const agent = agents.find(a => a.id === conv.assignedTo);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.white, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "11px 16px", borderBottom: `1px solid ${C.gray200}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar initials={conv.name.split(" ").map(n => n[0]).join("").slice(0,2)} size={36} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800 }}>{conv.name}</div>
            <div style={{ fontSize: 11, color: C.gray400 }}>
              {conv.channel === "WhatsApp" && <span style={{ color: C.wa, fontWeight: 600 }}>📱 WA </span>}
              {conv.phone} {agent && `· ${agent.name}`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {conv.status === "bot" && (
            <button onClick={() => onUpdate(conv.id, { status: "agent", assignedTo: 1 })}
              style={{ background: C.warning, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              👤 Ambil Alih
            </button>
          )}
          {conv.status === "agent" && (
            <button onClick={() => onUpdate(conv.id, { status: "resolved" })}
              style={{ background: C.success, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              ✓ Selesaikan
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", background: "#f0f2f5", display: "flex", flexDirection: "column", gap: 6 }}>
        {conv.messages.map((msg, i) => {
          const isCustomer = msg.role === "customer";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isCustomer ? "flex-start" : "flex-end", alignItems: "flex-end", gap: 7 }}>
              {isCustomer && <Avatar initials={conv.name.split(" ").map(n => n[0]).join("").slice(0,2)} size={26} />}
              <div style={{ maxWidth: "68%" }}>
                {!isCustomer && (
                  <div style={{ fontSize: 10, color: C.gray400, textAlign: "right", marginBottom: 2 }}>
                    {msg.role === "bot" ? "🤖 CS AI" : `👤 ${agent?.name || "Agen"}`}
                  </div>
                )}
                <div style={{
                  padding: "8px 12px",
                  borderRadius: isCustomer ? "0 12px 12px 12px" : "12px 0 12px 12px",
                  background: isCustomer ? C.white : msg.role === "bot" ? "#d9fdd3" : C.primary,
                  color: isCustomer ? C.gray800 : msg.role === "bot" ? "#075e54" : "#fff",
                  fontSize: 13, lineHeight: 1.6,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word"
                }}>{msg.content}</div>
                <div style={{ fontSize: 10, color: C.gray400, marginTop: 2, textAlign: isCustomer ? "left" : "right" }}>{msg.time}</div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ background: "#d9fdd3", padding: "10px 14px", borderRadius: "12px 0 12px 12px", display: "flex", gap: 4 }}>
              {[0,1,2].map(i => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#075e54", display: "inline-block", animation: "bounce 1.2s infinite", animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {conv.status !== "resolved" ? (
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.gray200}`, display: "flex", gap: 8, background: C.white, flexShrink: 0 }}>
          {conv.status === "bot" && (
            <div style={{ fontSize: 11, color: C.accent, alignSelf: "center", fontWeight: 600, background: C.accent + "15", padding: "4px 8px", borderRadius: 8, whiteSpace: "nowrap" }}>
              Mode simulasi
            </div>
          )}
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder={conv.status === "bot" ? "Simulasi pesan pelanggan..." : "Balas sebagai agen..."}
            style={{ flex: 1, padding: "9px 14px", borderRadius: 24, border: `1.5px solid ${C.gray200}`, fontSize: 13, outline: "none", background: C.gray50 }} />
          <button onClick={handleSend} disabled={!input.trim() || loading}
            style={{
              width: 38, height: 38, borderRadius: "50%", border: "none", flexShrink: 0,
              background: input.trim() && !loading ? C.primary : C.gray200, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      ) : (
        <div style={{ padding: 10, textAlign: "center", background: C.gray50, borderTop: `1px solid ${C.gray200}`, fontSize: 13, color: C.gray400 }}>
          ✓ Percakapan telah diselesaikan
        </div>
      )}
    </div>
  );
}

// ─── CRM PANEL ───────────────────────────────────────────────────────
function CRMPanel({ conv }) {
  if (!conv) return <div style={{ width: 240, borderLeft: `1px solid ${C.gray200}`, background: C.gray50, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ textAlign: "center", color: C.gray400, fontSize: 13 }}>Pilih percakapan</div></div>;
  const p = conv.profile;
  return (
    <div style={{ width: 240, borderLeft: `1px solid ${C.gray200}`, background: C.white, overflowY: "auto", flexShrink: 0 }}>
      <div style={{ padding: 14, borderBottom: `1px solid ${C.gray100}`, textAlign: "center" }}>
        <Avatar initials={conv.name.split(" ").map(n => n[0]).join("").slice(0,2)} size={50} />
        <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800, marginTop: 8 }}>{conv.name}</div>
        <div style={{ fontSize: 11, color: C.gray400 }}>{conv.phone}</div>
        <div style={{ marginTop: 6 }}><Badge label={conv.tag} /></div>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Statistik</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Order", value: p.totalOrder },
            { label: "Belanja", value: `Rp ${(p.totalSpend/1000).toFixed(0)}rb` },
            { label: "Sejak", value: p.joinDate },
            { label: "Channel", value: conv.channel },
          ].map(s => (
            <div key={s.label} style={{ background: C.gray50, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: C.gray400 }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.gray800, marginTop: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Catatan</div>
          <div style={{ background: C.gray50, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.gray600, lineHeight: 1.6 }}>{p.notes}</div>
        </div>
      </div>
    </div>
  );
}

// ─── FONNTE SETTINGS TAB ─────────────────────────────────────────────
function FonnteTab({ token, setToken, toast }) {
  const [input, setInput] = useState(token);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("https://yourserver.com/webhook/fonnte");

  async function testConnection() {
    if (!input.trim() || !testPhone.trim()) { toast("⚠️ Isi token dan nomor tujuan dulu"); return; }
    setTesting(true);
    const result = await fonnteSet(input, testPhone, "✅ Test koneksi dari CS AI Platform berhasil!");
    setTesting(false);
    if (result.status) { toast("✅ Pesan test berhasil dikirim!"); setToken(input); }
    else toast("❌ Gagal: " + (result.reason || JSON.stringify(result)));
  }

  async function fonnteSet(t, phone, msg) {
    return await fonnteS(t, phone, msg);
  }

  async function fonnteS(t, phone, msg) {
    try {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: t },
        body: JSON.stringify({ target: phone, message: msg, typing: true, delay: 1 })
      });
      return await res.json();
    } catch (e) { return { status: false, reason: e.message }; }
  }

  function saveToken() { setToken(input); toast("✅ Token Fonnte tersimpan!"); }

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", background: C.gray50 }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: C.gray800, marginBottom: 4 }}>⚡ Integrasi Fonnte</div>
      <div style={{ fontSize: 13, color: C.gray400, marginBottom: 20 }}>Hubungkan platform ini dengan WhatsApp via Fonnte API</div>

      {/* Step 1 */}
      <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 16, maxWidth: 580 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>1</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800 }}>Daftar & Dapatkan Token Fonnte</div>
            <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>Buat akun di fonnte.com → hubungkan nomor WhatsApp → salin token API</div>
          </div>
        </div>
        <a href="https://fonnte.com" target="_blank" rel="noreferrer"
          style={{ display: "inline-block", background: C.primary, color: "#fff", padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          🔗 Buka fonnte.com →
        </a>
      </div>

      {/* Step 2 — Token */}
      <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 16, maxWidth: 580 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>2</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800 }}>Masukkan Token API Fonnte</div>
        </div>
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Paste token Fonnte di sini..."
          type="password"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.gray200}`, fontSize: 13, outline: "none", boxSizing: "border-box", background: C.gray50 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={saveToken} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            💾 Simpan Token
          </button>
          {token && <span style={{ color: C.success, fontSize: 13, fontWeight: 600, alignSelf: "center" }}>✓ Token aktif</span>}
        </div>
      </div>

      {/* Step 3 — Test */}
      <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 16, maxWidth: 580 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>3</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800 }}>Test Kirim Pesan</div>
        </div>
        <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
          placeholder="Nomor tujuan (contoh: 6281234567890)"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.gray200}`, fontSize: 13, outline: "none", boxSizing: "border-box", background: C.gray50, marginBottom: 10 }} />
        <button onClick={testConnection} disabled={testing}
          style={{ background: C.wa, color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          {testing ? "Mengirim..." : "📤 Kirim Test WA"}
        </button>
      </div>

      {/* Step 4 — Webhook */}
      <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", maxWidth: 580 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>4</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800 }}>Setup Webhook (Terima Pesan Masuk)</div>
            <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>Pasang URL ini di Dashboard Fonnte → Device → Edit → Webhook URL</div>
          </div>
        </div>
        <div style={{ background: C.gray50, borderRadius: 10, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: C.primary, wordBreak: "break-all", marginBottom: 10 }}>
          {webhookUrl}
        </div>
        <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
          placeholder="URL webhook server kamu"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.gray200}`, fontSize: 13, outline: "none", boxSizing: "border-box", background: C.gray50, marginBottom: 10 }} />
        <div style={{ background: C.primaryLight, borderRadius: 10, padding: 12, fontSize: 12, color: C.primary, lineHeight: 1.7 }}>
          <b>📋 Payload webhook dari Fonnte:</b><br />
          <code style={{ fontSize: 11 }}>{"{ sender, message, name, device, timestamp }"}</code><br /><br />
          <b>Alur kerja:</b><br />
          1. Pelanggan kirim WA → Fonnte terima<br />
          2. Fonnte POST ke webhook URL kamu<br />
          3. Server kamu proses dengan AI → kirim balasan via <code>api.fonnte.com/send</code>
        </div>
      </div>
    </div>
  );
}

// ─── ANALYTICS TAB ───────────────────────────────────────────────────
function AnalyticsTab({ convs }) {
  const total = convs.length;
  const bot = convs.filter(c => c.status === "bot").length;
  const agent = convs.filter(c => c.status === "agent").length;
  const resolved = convs.filter(c => c.status === "resolved").length;
  const botRate = total ? Math.round((bot / total) * 100) : 0;

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", background: C.gray50 }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: C.gray800, marginBottom: 20 }}>📊 Analitik</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Chat", value: total, icon: "💬", color: C.primary },
          { label: "Handled Bot", value: bot, icon: "🤖", color: C.accent },
          { label: "Handled Agen", value: agent, icon: "👤", color: C.warning },
          { label: "Resolved", value: resolved, icon: "✅", color: C.success },
        ].map(s => (
          <div key={s.label} style={{ background: C.white, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 26 }}>{s.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.gray600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: C.white, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", maxWidth: 500 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800, marginBottom: 12 }}>Tingkat Otomasi Bot</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, height: 10, background: C.gray100, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${botRate}%`, height: "100%", background: `linear-gradient(90deg,${C.primary},${C.accent})`, borderRadius: 6 }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: C.primary }}>{botRate}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── AGENTS TAB ──────────────────────────────────────────────────────
function AgentsTab({ agents, convs }) {
  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", background: C.gray50 }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: C.gray800, marginBottom: 20 }}>🎧 Tim CS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 14 }}>
        {agents.map(a => {
          const active = convs.filter(c => c.assignedTo === a.id && c.status !== "resolved").length;
          const done = convs.filter(c => c.assignedTo === a.id && c.status === "resolved").length;
          return (
            <div key={a.id} style={{ background: C.white, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <Avatar initials={a.avatar} size={42} status={a.status} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800 }}>{a.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: a.status === "online" ? C.success : a.status === "busy" ? C.warning : C.gray400 }}>
                    {a.status === "online" ? "● Online" : a.status === "busy" ? "● Sibuk" : "○ Offline"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-around" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.primary }}>{active}</div>
                  <div style={{ fontSize: 11, color: C.gray400 }}>Aktif</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.success }}>{done}</div>
                  <div style={{ fontSize: 11, color: C.gray400 }}>Selesai</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CRM LIST ────────────────────────────────────────────────────────
function CRMListTab({ convs }) {
  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", background: C.gray50 }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: C.gray800, marginBottom: 20 }}>👥 Database Pelanggan</div>
      <div style={{ background: C.white, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
              {["Nama", "No. HP", "Channel", "Tag", "Order", "Belanja", "Status"].map(h => (
                <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 700, color: C.gray600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {convs.map(c => (
              <tr key={c.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar initials={c.name.split(" ").map(n => n[0]).join("").slice(0,2)} size={28} />
                    <span style={{ fontWeight: 600, color: C.gray800 }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ padding: "11px 14px", color: C.gray600 }}>{c.phone}</td>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{ color: c.channel === "WhatsApp" ? C.wa : C.primary, fontWeight: 600 }}>
                    {c.channel === "WhatsApp" ? "📱" : "🌐"} {c.channel}
                  </span>
                </td>
                <td style={{ padding: "11px 14px" }}><Badge label={c.tag} /></td>
                <td style={{ padding: "11px 14px", fontWeight: 700, color: C.gray800 }}>{c.profile.totalOrder}</td>
                <td style={{ padding: "11px 14px", color: C.gray800 }}>Rp {c.profile.totalSpend.toLocaleString("id-ID")}</td>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                    background: c.status === "bot" ? C.accent + "18" : c.status === "agent" ? C.success + "18" : C.gray100,
                    color: c.status === "bot" ? C.accent : c.status === "agent" ? C.success : C.gray400
                  }}>
                    {c.status === "bot" ? "🤖 Bot" : c.status === "agent" ? "👤 Agen" : "✓ Selesai"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ────────────────────────────────────────────────────
function SettingsTab({ systemPrompt, setSystemPrompt, toast }) {
  const [val, setVal] = useState(systemPrompt);
  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", background: C.gray50 }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: C.gray800, marginBottom: 20 }}>⚙️ Pengaturan</div>
      <div style={{ background: C.white, borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", maxWidth: 580 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800, marginBottom: 4 }}>🤖 Persona CS AI</div>
        <div style={{ fontSize: 12, color: C.gray400, marginBottom: 10 }}>Atur cara bot menjawab pelanggan, informasi produk, dan instruksi khusus.</div>
        <textarea value={val} onChange={e => setVal(e.target.value)} rows={10}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.7, resize: "vertical", fontFamily: "inherit", background: C.gray50, boxSizing: "border-box" }} />
        <button onClick={() => { setSystemPrompt(val); toast("✅ Persona tersimpan!"); }}
          style={{ marginTop: 10, background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          Simpan
        </button>
      </div>
    </div>
  );
}

// ─── META CLOUD API TAB ──────────────────────────────────────────────
function MetaTab({ config, setConfig, toast }) {
  const [form, setForm] = useState({
    accessToken: config.accessToken || "",
    phoneNumberId: config.phoneNumberId || "",
    wabaId: config.wabaId || "",
    verifyToken: config.verifyToken || "my_verify_token_123",
    webhookUrl: config.webhookUrl || "https://yourserver.com/webhook/meta",
  });
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  function update(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function save() {
    setConfig(form);
    toast("✅ Konfigurasi Meta API tersimpan!");
  }

  async function testSend() {
    if (!form.accessToken || !form.phoneNumberId || !testPhone) {
      toast("⚠️ Isi Access Token, Phone Number ID, dan nomor tujuan dulu"); return;
    }
    setTesting(true);
    const result = await metaSend(form.accessToken, form.phoneNumberId, testPhone, "✅ Test koneksi Meta WhatsApp Business API berhasil dari CS AI Platform!");
    setTesting(false);
    if (result.status) { toast("✅ Pesan test berhasil dikirim!"); setConfig(form); }
    else toast("❌ Gagal: " + (result.reason || "Error tidak diketahui"));
  }

  const stepStyle = {
    background: C.white, borderRadius: 16, padding: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 16, maxWidth: 600
  };
  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1.5px solid ${C.gray200}`, fontSize: 13, outline: "none",
    background: C.gray50, boxSizing: "border-box", color: C.gray800,
    marginBottom: 10, fontFamily: "inherit"
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 4, display: "block" };

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", background: C.gray50 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🟢</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.gray800 }}>WhatsApp Business API (Meta)</div>
          <div style={{ fontSize: 13, color: C.gray400 }}>Integrasi langsung via Meta Cloud API — resmi, tanpa perantara BSP</div>
        </div>
      </div>

      {/* Comparison badge */}
      <div style={{ display: "flex", gap: 10, margin: "16px 0", flexWrap: "wrap" }}>
        {[
          { label: "✅ Centang Biru", color: C.success },
          { label: "✅ Tanpa BSP", color: C.success },
          { label: "💰 Bayar per Percakapan", color: C.warning },
          { label: "🔧 Butuh Server HTTPS", color: C.accent },
        ].map(b => (
          <span key={b.label} style={{ background: b.color + "18", color: b.color, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>{b.label}</span>
        ))}
      </div>

      {/* Step 1 */}
      <div style={stepStyle}>
        <StepHeader n={1} title="Buat Meta App & Aktifkan WhatsApp" />
        <div style={{ fontSize: 13, color: C.gray600, lineHeight: 1.8, marginBottom: 12 }}>
          1. Buka <b>developers.facebook.com</b> → <b>My Apps → Create App</b><br />
          2. Pilih tipe <b>"Business"</b><br />
          3. Di dashboard app → <b>Add Product → WhatsApp → Set Up</b><br />
          4. Hubungkan ke <b>Meta Business Manager</b> kamu
        </div>
        <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1877F2", color: "#fff", padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          🔗 Buka Meta Developers →
        </a>
      </div>

      {/* Step 2 */}
      <div style={stepStyle}>
        <StepHeader n={2} title="Tambah Nomor & Generate System Token" />
        <div style={{ fontSize: 13, color: C.gray600, lineHeight: 1.8, marginBottom: 14 }}>
          1. Di app dashboard → <b>WhatsApp → API Setup → Add Phone Number</b><br />
          2. Verifikasi nomor via SMS/suara<br />
          3. Tambahkan <b>metode pembayaran</b> (wajib untuk produksi)<br />
          4. Buka <b>Business Settings → Users → System Users</b><br />
          5. Buat System User → Generate Token dengan permission <code>whatsapp_business_messaging</code>
        </div>
        <div style={{ background: "#FEF3C7", borderRadius: 10, padding: 12, fontSize: 12, color: "#92400E" }}>
          ⚠️ <b>Token temporary hanya berlaku 24 jam.</b> Gunakan System User Token agar permanen (atau s.d. 60 hari).
        </div>
      </div>

      {/* Step 3 — Credentials */}
      <div style={stepStyle}>
        <StepHeader n={3} title="Masukkan Kredensial API" />

        <label style={labelStyle}>Access Token (System User Token)</label>
        <input value={form.accessToken} onChange={e => update("accessToken", e.target.value)}
          placeholder="EAAG..." type="password" style={inputStyle} />

        <label style={labelStyle}>Phone Number ID</label>
        <input value={form.phoneNumberId} onChange={e => update("phoneNumberId", e.target.value)}
          placeholder="Contoh: 123456789012345"
          style={inputStyle} />
        <div style={{ fontSize: 11, color: C.gray400, marginTop: -8, marginBottom: 10 }}>
          Temukan di: WhatsApp → API Setup → Phone Number ID
        </div>

        <label style={labelStyle}>WhatsApp Business Account ID (WABA ID)</label>
        <input value={form.wabaId} onChange={e => update("wabaId", e.target.value)}
          placeholder="Contoh: 987654321098765"
          style={inputStyle} />
        <div style={{ fontSize: 11, color: C.gray400, marginTop: -8, marginBottom: 14 }}>
          Temukan di: WhatsApp Manager → Business Account ID
        </div>

        <button onClick={save} style={{
          background: C.primary, color: "#fff", border: "none", borderRadius: 10,
          padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13
        }}>💾 Simpan Konfigurasi</button>
        {config.accessToken && (
          <span style={{ marginLeft: 12, color: C.success, fontSize: 13, fontWeight: 600 }}>✓ Tersimpan & Aktif</span>
        )}
      </div>

      {/* Step 4 — Test */}
      <div style={stepStyle}>
        <StepHeader n={4} title="Test Kirim Pesan" />
        <label style={labelStyle}>Nomor Tujuan (format internasional)</label>
        <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
          placeholder="Contoh: 6281234567890"
          style={inputStyle} />
        <button onClick={testSend} disabled={testing} style={{
          background: "#25D366", color: "#fff", border: "none", borderRadius: 10,
          padding: "9px 20px", cursor: testing ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13
        }}>
          {testing ? "⏳ Mengirim..." : "📤 Kirim Test WA"}
        </button>
        <div style={{ marginTop: 10, fontSize: 12, color: C.gray400 }}>
          Pastikan nomor tujuan sudah pernah mengirim pesan ke nomor bisnis kamu terlebih dahulu (dalam 24 jam terakhir) untuk non-template message.
        </div>
      </div>

      {/* Step 5 — Webhook */}
      <div style={stepStyle}>
        <StepHeader n={5} title="Setup Webhook (Terima Pesan Masuk)" />
        <div style={{ fontSize: 13, color: C.gray600, lineHeight: 1.8, marginBottom: 12 }}>
          Di <b>Meta App Dashboard → WhatsApp → Configuration → Webhook</b>:<br />
          1. Klik <b>Edit</b> → masukkan <b>Callback URL</b> dan <b>Verify Token</b><br />
          2. Subscribe ke event: <code>messages</code>, <code>message_deliveries</code>, <code>message_reads</code>
        </div>

        <label style={labelStyle}>Callback URL (server kamu)</label>
        <input value={form.webhookUrl} onChange={e => update("webhookUrl", e.target.value)}
          style={{ ...inputStyle }} />

        <label style={labelStyle}>Verify Token (bebas, harus sama dengan di server)</label>
        <input value={form.verifyToken} onChange={e => update("verifyToken", e.target.value)}
          style={inputStyle} />

        <div style={{ background: C.primaryLight, borderRadius: 10, padding: 14, fontSize: 12, color: C.primary, lineHeight: 1.8 }}>
          <b>📋 Struktur payload webhook Meta:</b><br />
          <code style={{ fontSize: 11 }}>{"entry[0].changes[0].value.messages[0]"}</code><br /><br />
          <b>Field penting:</b><br />
          • <code>from</code> — nomor pengirim (628xxx)<br />
          • <code>text.body</code> — isi pesan<br />
          • <code>timestamp</code> — waktu pesan<br />
          • <code>id</code> — message ID untuk mark as read<br /><br />
          <b>Mark as Read (balas otomatis):</b> POST ke<br />
          <code style={{ fontSize: 10, wordBreak: "break-all" }}>
            https://graph.facebook.com/v19.0/{"{phoneNumberId}"}/messages
          </code><br />
          dengan body: <code>{"{ status: 'read', message_id: '...' }"}</code>
        </div>
      </div>

      {/* Pricing info */}
      <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", maxWidth: 600 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800, marginBottom: 12 }}>💰 Estimasi Biaya Percakapan</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { type: "User-Initiated (Indonesia)", price: "~$0.017 / percakapan" },
            { type: "Business-Initiated Marketing", price: "~$0.073 / percakapan" },
            { type: "Business-Initiated Utility", price: "~$0.014 / percakapan" },
            { type: "1000 percakapan/bulan", price: "≈ Rp 250rb–1.2 juta" },
          ].map(r => (
            <div key={r.type} style={{ background: C.gray50, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: C.gray400, marginBottom: 2 }}>{r.type}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.gray800 }}>{r.price}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.gray400, marginTop: 10 }}>
          * 1.000 percakapan pertama per bulan GRATIS. Harga bervariasi per negara & tipe percakapan.
        </div>
      </div>
    </div>
  );
}

function StepHeader({ n, title }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{n}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: C.gray800 }}>{title}</div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("inbox");
  const [convs, setConvs] = useState(INIT_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState(1);
  const [filter, setFilter] = useState("Semua");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
  const [fonnteToken, setFonnteToken] = useState("");
  const [metaConfig, setMetaConfig] = useState({ accessToken: "", phoneNumberId: "", wabaId: "", verifyToken: "my_verify_token_123", webhookUrl: "https://yourserver.com/webhook/meta" });
  const [toastMsg, setToastMsg] = useState("");

  function updateConv(id, updates) {
    setConvs(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  const selected = convs.find(c => c.id === selectedId) || null;
  const totalUnread = convs.reduce((s, c) => s + c.unread, 0);

  const tabLabel = { inbox: "💬 Inbox", crm: "👥 CRM", agents: "🎧 Tim CS", analytics: "📊 Analitik", fonnte: "⚡ Fonnte API", meta: "🟢 Meta WA API", settings: "⚙️ Pengaturan" };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif", overflow: "hidden" }}>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}} *{box-sizing:border-box}`}</style>
      <Sidebar active={tab} setActive={setTab} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ height: 50, background: C.white, borderBottom: `1px solid ${C.gray200}`, display: "flex", alignItems: "center", padding: "0 18px", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.gray800, display: "flex", alignItems: "center", gap: 8 }}>
            {tabLabel[tab]}
            {tab === "inbox" && totalUnread > 0 && (
              <span style={{ background: C.danger, color: "#fff", fontSize: 11, borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>{totalUnread}</span>
            )}
            {fonnteToken && tab === "inbox" && (
              <span style={{ background: "#25D36620", color: "#25D366", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>⚡ Fonnte</span>
            )}
            {metaConfig?.accessToken && tab === "inbox" && (
              <span style={{ background: "#25D36620", color: "#25D366", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>🟢 Meta API</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.gray400 }}>{AGENTS.filter(a => a.status === "online").length} agen online</div>
            <Avatar initials="AD" size={30} color={C.primaryDark} />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {tab === "inbox" && (
            <>
              <ConvList convs={convs} selected={selectedId} setSelected={setSelectedId} filter={filter} setFilter={setFilter} />
              <ChatPanel conv={selected} onUpdate={updateConv} agents={AGENTS} systemPrompt={systemPrompt} fonnteToken={fonnteToken} metaConfig={metaConfig} toast={setToastMsg} />
              <CRMPanel conv={selected} />
            </>
          )}
          {tab === "crm" && <CRMListTab convs={convs} />}
          {tab === "agents" && <AgentsTab agents={AGENTS} convs={convs} />}
          {tab === "analytics" && <AnalyticsTab convs={convs} />}
          {tab === "fonnte" && <FonnteTab token={fonnteToken} setToken={setFonnteToken} toast={setToastMsg} />}
          {tab === "meta" && <MetaTab config={metaConfig} setConfig={setMetaConfig} toast={setToastMsg} />}
          {tab === "settings" && <SettingsTab systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt} toast={setToastMsg} />}
        </div>
      </div>
      <Toast msg={toastMsg} onClose={() => setToastMsg("")} />
    </div>
  );
}
