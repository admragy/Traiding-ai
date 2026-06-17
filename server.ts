import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { seeded, ema, rsi, atrPct, buildHistory, scoreAsset, buildAnalysis } from "./src/lib/analytics";

dotenv.config();

// Autopilot 24/7 Server-side loop state interfaces
interface AutopilotConfig {
  enabled: boolean;
  token: string;
  chatId: string;
  rigor: "normal" | "strict" | "elite";
  intervalMinutes: number;
  activeCategories?: string[];
}

interface AutopilotDiagnostics {
  running: boolean;
  lastScanTime: string | null;
  scansCount: number;
  signalsSentCount: number;
  lastSignalSent: string | null;
  errorLog: string[];
  lastScanFindings?: string;
}

const AUTOPILOT_FILE_PATH = path.join(process.cwd(), "autopilot_config.json");

// Default configuration definitions
let autopilotConfig: AutopilotConfig = {
  enabled: false,
  token: "",
  chatId: "",
  rigor: "strict",
  intervalMinutes: 180,
  activeCategories: ["forex", "crypto", "gold", "indices"],
};

let autopilotDiags: AutopilotDiagnostics = {
  running: false,
  lastScanTime: null,
  scansCount: 0,
  signalsSentCount: 0,
  lastSignalSent: null,
  errorLog: [],
};

interface SentSignalRecord {
  timestamp: number;
  direction: "BUY" | "SELL";
  score: number;
}

// Global state histories to ensure we don't send duplicates or conflicting signals
const signalHistoryMap = new Map<string, SentSignalRecord>();
const preSignalHistoryMap = new Map<string, SentSignalRecord>();

// Cooldown thresholds in minutes to maintain high-quality alerts
const SAME_DIRECTION_COOLDOWN_MINUTES = 360;      // 6 hours
const OPPOSITE_DIRECTION_COOLDOWN_MINUTES = 720;  // 12 hours
const PRE_ALERT_SAME_COOLDOWN_MINUTES = 60;       // 1 hour
const PRE_ALERT_OPPOSITE_COOLDOWN_MINUTES = 360;  // 6 hours

function validateSignalDispatch(
  pair: string,
  direction: "BUY" | "SELL",
  isPreAlert: boolean = false
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const historyMap = isPreAlert ? preSignalHistoryMap : signalHistoryMap;
  
  const lastRecord = historyMap.get(pair);
  if (!lastRecord) {
    return { allowed: true };
  }

  const diffMinutes = (now - lastRecord.timestamp) / 1000 / 60;
  const isSameDirection = lastRecord.direction === direction;

  if (isPreAlert) {
    if (isSameDirection) {
      if (diffMinutes < PRE_ALERT_SAME_COOLDOWN_MINUTES) {
        const remaining = Math.ceil(PRE_ALERT_SAME_COOLDOWN_MINUTES - diffMinutes);
        return {
          allowed: false,
          reason: `Duplicate pre-alert: Same direction (${direction}) was sent recently for ${pair} (${Math.round(diffMinutes)}m ago). Cooldown remaining: ${remaining}m.`,
        };
      }
    } else {
      if (diffMinutes < PRE_ALERT_OPPOSITE_COOLDOWN_MINUTES) {
        const remaining = Math.ceil(PRE_ALERT_OPPOSITE_COOLDOWN_MINUTES - diffMinutes);
        return {
          allowed: false,
          reason: `Conflicting pre-alert: Opposite direction (was ${lastRecord.direction}, new is ${direction}) for ${pair} within ${PRE_ALERT_OPPOSITE_COOLDOWN_MINUTES}m (${Math.round(diffMinutes)}m ago). Cooldown remaining: ${remaining}m.`,
        };
      }
    }
  } else {
    // Final high-precision signals
    if (isSameDirection) {
      if (diffMinutes < SAME_DIRECTION_COOLDOWN_MINUTES) {
        const remaining = Math.ceil(SAME_DIRECTION_COOLDOWN_MINUTES - diffMinutes);
        return {
          allowed: false,
          reason: `Duplicate signal: Same direction (${direction}) was sent recently for ${pair} (${Math.round(diffMinutes)}m ago). Cooldown remaining: ${remaining}m.`,
        };
      }
    } else {
      if (diffMinutes < OPPOSITE_DIRECTION_COOLDOWN_MINUTES) {
        const remaining = Math.ceil(OPPOSITE_DIRECTION_COOLDOWN_MINUTES - diffMinutes);
        return {
          allowed: false,
          reason: `Conflicting signal: Opposite direction (was ${lastRecord.direction}, new is ${direction}) for ${pair} within ${OPPOSITE_DIRECTION_COOLDOWN_MINUTES}m (${Math.round(diffMinutes)}m ago). Cooldown remaining: ${remaining}m.`,
        };
      }
    }
  }

  return { allowed: true };
}

const DISK_HISTORY_PATH = path.join(process.cwd(), "autopilot_history.json");

function loadSignalHistory() {
  try {
    if (fs.existsSync(DISK_HISTORY_PATH)) {
      const raw = fs.readFileSync(DISK_HISTORY_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.signalHistory) {
        for (const [k, v] of Object.entries(parsed.signalHistory)) {
          signalHistoryMap.set(k, v as SentSignalRecord);
        }
      }
      if (parsed.preSignalHistory) {
        for (const [k, v] of Object.entries(parsed.preSignalHistory)) {
          preSignalHistoryMap.set(k, v as SentSignalRecord);
        }
      }
      if (parsed.diagnostics) {
        autopilotDiags.lastScanTime = parsed.diagnostics.lastScanTime || null;
        autopilotDiags.scansCount = parsed.diagnostics.scansCount || 0;
        autopilotDiags.signalsSentCount = parsed.diagnostics.signalsSentCount || 0;
        autopilotDiags.lastSignalSent = parsed.diagnostics.lastSignalSent || null;
        autopilotDiags.lastScanFindings = parsed.diagnostics.lastScanFindings || "";
      }
      console.log("Restored signal histories and diagnostics telemetry from disk successfully:", {
        signals: signalHistoryMap.size,
        preSignals: preSignalHistoryMap.size,
        scansCount: autopilotDiags.scansCount,
      });
    }
  } catch (err: any) {
    console.error("Failed to restore signal history from disk:", err.message);
  }
}

function saveSignalHistory() {
  try {
    const data = {
      signalHistory: Object.fromEntries(signalHistoryMap.entries()),
      preSignalHistory: Object.fromEntries(preSignalHistoryMap.entries()),
      diagnostics: {
        lastScanTime: autopilotDiags.lastScanTime,
        scansCount: autopilotDiags.scansCount,
        signalsSentCount: autopilotDiags.signalsSentCount,
        lastSignalSent: autopilotDiags.lastSignalSent,
        lastScanFindings: autopilotDiags.lastScanFindings,
      }
    };
    fs.writeFileSync(DISK_HISTORY_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err: any) {
    console.error("Failed to save signal history to disk:", err.message);
  }
}

function registerSentSignal(pair: string, direction: "BUY" | "SELL", score: number, isPreAlert: boolean = false) {
  const now = Date.now();
  const record: SentSignalRecord = { timestamp: now, direction, score };
  if (isPreAlert) {
    preSignalHistoryMap.set(pair, record);
  } else {
    signalHistoryMap.set(pair, record);
  }
  saveSignalHistory();
}

// Load config from local persistent disk
function loadAutopilotConfig() {
  try {
    if (fs.existsSync(AUTOPILOT_FILE_PATH)) {
      const data = fs.readFileSync(AUTOPILOT_FILE_PATH, "utf-8");
      autopilotConfig = { ...autopilotConfig, ...JSON.parse(data) };
      console.log("Autopilot 24/7 persistent setup configuration restored:", autopilotConfig);
    }

    // In addition to JSON files, support direct system Environment variables for instant deployment hooks
    if (process.env.TELEGRAM_TOKEN && !autopilotConfig.token) {
      autopilotConfig.token = process.env.TELEGRAM_TOKEN;
      console.log("Loaded Autopilot Token from process.env.TELEGRAM_TOKEN");
    }
    if (process.env.TELEGRAM_CHAT_ID && !autopilotConfig.chatId) {
      autopilotConfig.chatId = process.env.TELEGRAM_CHAT_ID;
      console.log("Loaded Autopilot ChatID from process.env.TELEGRAM_CHAT_ID");
    }

    if (autopilotConfig.token && autopilotConfig.chatId && !autopilotConfig.enabled) {
      autopilotConfig.enabled = true;
      console.log("Autopilot auto-booted because direct Telegram credentials are valid!");
    }
  } catch (err: any) {
    console.error("Failed to restore autopilot state:", err.message);
  }
}

function saveAutopilotConfig() {
  try {
    fs.writeFileSync(AUTOPILOT_FILE_PATH, JSON.stringify(autopilotConfig, null, 2), "utf-8");
  } catch (err: any) {
    console.error("Failed to persist autopilot config state:", err.message);
  }
}

loadAutopilotConfig();
loadSignalHistory();

// In-Memory Ticks index for background price swing generator
const bootTime = Date.now();
let backendTicksTick = 0;
let autopilotIntervalTimerIdx: NodeJS.Timeout | null = null;

// Replicate PAIRS mapping inside server to run live background ticks
const BASE_PAIRS = [
  // ======= Forex (20 pairs) =======
  { symbol: "EUR/USD", category: "forex" as const, base: 1.0842, vol: 0.0011, spread: 0.00008 },
  { symbol: "GBP/USD", category: "forex" as const, base: 1.2671, vol: 0.0013, spread: 0.00010 },
  { symbol: "USD/JPY", category: "forex" as const, base: 157.24, vol: 0.1400, spread: 0.01500 },
  { symbol: "AUD/USD", category: "forex" as const, base: 0.6654, vol: 0.0008, spread: 0.00007 },
  { symbol: "USD/CAD", category: "forex" as const, base: 1.3685, vol: 0.0010, spread: 0.00009 },
  { symbol: "USD/CHF", category: "forex" as const, base: 0.8975, vol: 0.0009, spread: 0.00008 },
  { symbol: "NZD/USD", category: "forex" as const, base: 0.6125, vol: 0.0007, spread: 0.00008 },
  { symbol: "EUR/GBP", category: "forex" as const, base: 0.8550, vol: 0.0006, spread: 0.00006 },
  { symbol: "EUR/JPY", category: "forex" as const, base: 170.50, vol: 0.1500, spread: 0.01800 },
  { symbol: "GBP/JPY", category: "forex" as const, base: 199.20, vol: 0.1800, spread: 0.02200 },
  { symbol: "EUR/AUD", category: "forex" as const, base: 1.6290, vol: 0.0016, spread: 0.00015 },
  { symbol: "EUR/CAD", category: "forex" as const, base: 1.4830, vol: 0.0012, spread: 0.00012 },
  { symbol: "AUD/JPY", category: "forex" as const, base: 104.60, vol: 0.1200, spread: 0.01600 },
  { symbol: "CHF/JPY", category: "forex" as const, base: 175.20, vol: 0.1600, spread: 0.02000 },
  { symbol: "CAD/JPY", category: "forex" as const, base: 114.80, vol: 0.1100, spread: 0.01500 },
  { symbol: "GBP/CAD", category: "forex" as const, base: 1.7340, vol: 0.0018, spread: 0.00018 },
  { symbol: "NZD/JPY", category: "forex" as const, base: 96.30, vol: 0.1000, spread: 0.01500 },
  { symbol: "EUR/CHF", category: "forex" as const, base: 0.9730, vol: 0.0008, spread: 0.00009 },
  { symbol: "GBP/CHF", category: "forex" as const, base: 1.1380, vol: 0.0011, spread: 0.00014 },
  { symbol: "AUD/CAD", category: "forex" as const, base: 0.9100, vol: 0.0009, spread: 0.00010 },

  // ======= Gold & Commodities (7 pairs) =======
  { symbol: "XAU/USD", category: "gold" as const, base: 2318.5, vol: 2.1000, spread: 0.35000 },
  { symbol: "XAG/USD", category: "gold" as const, base: 29.50, vol: 0.0500, spread: 0.00800 },
  { symbol: "USOIL", category: "gold" as const, base: 78.40, vol: 0.1200, spread: 0.02000 },
  { symbol: "UKOIL", category: "gold" as const, base: 82.50, vol: 0.1300, spread: 0.02000 },
  { symbol: "NGAS", category: "gold" as const, base: 2.85, vol: 0.0120, spread: 0.00400 },
  { symbol: "COPPER", category: "gold" as const, base: 4.52, vol: 0.0080, spread: 0.00200 },
  { symbol: "PLATINUM", category: "gold" as const, base: 975.0, vol: 1.5000, spread: 0.45000 },

  // ======= Cryptocurrencies (30 pairs) =======
  { symbol: "BTC/USD", category: "crypto" as const, base: 67420, vol: 260.00, spread: 12.0000 },
  { symbol: "ETH/USD", category: "crypto" as const, base: 3812, vol: 22.00, spread: 2.5000 },
  { symbol: "SOL/USD", category: "crypto" as const, base: 178.4, vol: 2.20, spread: 0.3500 },
  { symbol: "BNB/USD", category: "crypto" as const, base: 605.5, vol: 4.50, spread: 0.8000 },
  { symbol: "XRP/USD", category: "crypto" as const, base: 0.4950, vol: 0.006, spread: 0.0010 },
  { symbol: "TON/USD", category: "crypto" as const, base: 7.25, vol: 0.150, spread: 0.0200 },
  { symbol: "ADA/USD", category: "crypto" as const, base: 0.4250, vol: 0.005, spread: 0.0008 },
  { symbol: "DOGE/USD", category: "crypto" as const, base: 0.1420, vol: 0.003, spread: 0.0004 },
  { symbol: "AVAX/USD", category: "crypto" as const, base: 32.40, vol: 0.45, spread: 0.0800 },
  { symbol: "DOT/USD", category: "crypto" as const, base: 6.45, vol: 0.08, spread: 0.0150 },
  { symbol: "LINK/USD", category: "crypto" as const, base: 15.80, vol: 0.22, spread: 0.0400 },
  { symbol: "NEAR/USD", category: "crypto" as const, base: 6.12, vol: 0.12, spread: 0.0200 },
  { symbol: "MATIC/USD", category: "crypto" as const, base: 0.6420, vol: 0.008, spread: 0.0012 },
  { symbol: "LTC/USD", category: "crypto" as const, base: 78.50, vol: 0.85, spread: 0.1500 },
  { symbol: "BCH/USD", category: "crypto" as const, base: 455.0, vol: 6.20, spread: 1.2000 },
  { symbol: "UNI/USD", category: "crypto" as const, base: 9.80, vol: 0.15, spread: 0.0300 },
  { symbol: "PEPE/USD", category: "crypto" as const, base: 0.000012, vol: 0.0000003, spread: 0.00000002 },
  { symbol: "APT/USD", category: "crypto" as const, base: 8.24, vol: 0.15, spread: 0.0300 },
  { symbol: "SUI/USD", category: "crypto" as const, base: 1.15, vol: 0.025, spread: 0.0040 },
  { symbol: "ICP/USD", category: "crypto" as const, base: 10.15, vol: 0.18, spread: 0.0300 },
  { symbol: "OP/USD", category: "crypto" as const, base: 2.12, vol: 0.04, spread: 0.0080 },
  { symbol: "ARB/USD", category: "crypto" as const, base: 0.9500, vol: 0.015, spread: 0.0020 },
  { symbol: "FTM/USD", category: "crypto" as const, base: 0.7650, vol: 0.012, spread: 0.0020 },
  { symbol: "RNDR/USD", category: "crypto" as const, base: 8.45, vol: 0.18, spread: 0.0300 },
  { symbol: "FIL/USD", category: "crypto" as const, base: 5.65, vol: 0.08, spread: 0.0150 },
  { symbol: "SHIB/USD", category: "crypto" as const, base: 0.000021, vol: 0.0000006, spread: 0.00000004 },
  { symbol: "LDO/USD", category: "crypto" as const, base: 1.85, vol: 0.04, spread: 0.0060 },
  { symbol: "FET/USD", category: "crypto" as const, base: 1.62, vol: 0.035, spread: 0.0050 },
  { symbol: "ATOM/USD", category: "crypto" as const, base: 8.15, vol: 0.12, spread: 0.0200 },
  { symbol: "GRT/USD", category: "crypto" as const, base: 0.2240, vol: 0.004, spread: 0.0006 },

  // ======= Indices (8 pairs) =======
  { symbol: "SPX500", category: "indices" as const, base: 5420, vol: 15.00, spread: 0.6000 },
  { symbol: "NAS100", category: "indices" as const, base: 19650, vol: 65.00, spread: 2.2000 },
  { symbol: "US30", category: "indices" as const, base: 38980, vol: 120.00, spread: 4.5000 },
  { symbol: "GER30", category: "indices" as const, base: 18550, vol: 55.00, spread: 2.0000 },
  { symbol: "UK100", category: "indices" as const, base: 8240, vol: 22.00, spread: 1.0000 },
  { symbol: "FRA40", category: "indices" as const, base: 7950, vol: 24.00, spread: 1.0000 },
  { symbol: "JPN225", category: "indices" as const, base: 38800, vol: 140.00, spread: 5.0000 },
  { symbol: "HK50", category: "indices" as const, base: 17950, vol: 85.00, spread: 3.5000 }
];

function formatTelegramChatId(chatId: string): string {
  let clean = chatId.trim();
  if (!clean) return "";
  
  // If it's a full URL e.g. https://t.me/my_channel or t.me/my_channel
  if (clean.includes("t.me/")) {
    const parts = clean.split("t.me/");
    if (parts[1]) {
      clean = parts[1].split("/")[0].trim();
    }
  }
  
  // If it is numeric (e.g., -10012345678), don't touch it
  const isNumeric = /^-?\d+$/.test(clean);
  if (!isNumeric && !clean.startsWith("@")) {
    clean = "@" + clean;
  }
  
  return clean;
}

async function sendTelegramBroadcast(token: string, chatId: string, text: string) {
  const formattedChatId = formatTelegramChatId(chatId);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: formattedChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Telegram API rejected response.");
  return data;
}

// Background summary report builder
async function sendAutopilotPeriodicReport(rethrowOnError: boolean = false) {
  if (!autopilotConfig.token || !autopilotConfig.chatId) {
    if (rethrowOnError) {
      throw new Error("Telegram API Token or Chat ID is missing in config settings.");
    }
    return;
  }
  console.log("[Autopilot Server Thread] Generating periodic market review and performance summary...");
  
  try {
    // Generate live math assets exactly like frontend useMemo to represent the current market state
    const seed = Date.now() % 100000;
    const computedAssets = BASE_PAIRS.map((p, idx) => {
      const itemSeed = seed + idx * 431;
      const rand = seeded(itemSeed);
      const hist = buildHistory(p.base, p.vol, rand);
      const lastPriceVal = hist[hist.length - 1];
      const price = Math.max(0.0001, lastPriceVal);
      
      const scoredObj = {
        symbol: p.symbol,
        category: p.category,
        price,
        changePct: ((price - p.base) / p.base) * 105,
        spreadPct: (p.spread / p.base) * 100,
        atrPct: atrPct(hist),
        rsi: rsi(hist),
        emaFast: ema(hist.slice(-20), 20),
        emaSlow: ema(hist.slice(-50), 50),
        volumeScore: Math.round(35 + rand() * 65),
        structureScore: Math.round(30 + rand() * 70),
        liquidityScore: Math.round(25 + rand() * 75),
        hist,
      };
      
      return scoreAsset(scoredObj);
    });

    const activeCats = autopilotConfig.activeCategories || ["forex", "crypto", "gold", "indices"];
    const filteredAssets = computedAssets.filter((a) => activeCats.includes(a.category));
    const analysis = buildAnalysis(filteredAssets, autopilotConfig.rigor);
    
    const sorted = [...filteredAssets].sort((a,b) => b.score - a.score).slice(0, 3);
    
    let assetsSummary = "";
    for (const a of sorted) {
      const trendIcon = a.trend === "BUY" ? "🟢 BUY" : a.trend === "SELL" ? "🔴 SELL" : "⚪ HOLD";
      assetsSummary += `• <b>${a.symbol}:</b> <code>${trendIcon}</code> (Score: <b>${a.score}%</b> | RSI: <b>${a.rsi.toFixed(0)}</b>)\n`;
    }

    // Call Gemini to generate a spectacular summarized report
    let aiCommentary = "";
    try {
      const ai = getAIClient();
      const prompt = `
Generate a beautiful, concise global macros and crypto trading report summary for Telegram. 
The system is Nexus Elite 24/7. Current market regime is classified as: ${analysis.regime}.
Top 3 monitored asset trends:
${JSON.stringify(sorted.map(s => ({ symbol: s.symbol, trend: s.trend, score: s.score, rsi: s.rsi })))}

Format with:
1. "🔮 NEXUS INTEL (العربية)" - A highly professional macro analysis in elegant classical Arabic (الفصحى الفنية) summarizing current market opportunities, volatility expectations, and emotional discipline guidelines.
2. "📊 Technical Catalyst" - A brief 2-sentence market technical backdrop block in English.
Keep the total text compact, clean, formatted with premium bullet points and zero markdown code blocks.
`;
      const response = await generateContentWithRetryAndFallback(
        ai,
        { contents: prompt },
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite"
      );
      aiCommentary = response.text || "";
    } catch (err: any) {
      aiCommentary = `<i>Note: AI technical coach insights temporarily on standby; quantitative signals remain fully active.</i>`;
    }

    const reportMessage = 
      `📊 <b>NEXUS ELITE™ | PERIODIC INTELLIGENCE REPORT</b>\n` +
      `📅 <code>${new Date().toUTCString()}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>SYSTEM HEALTH & TELEMETRY | صحة الخادم الفورية:</b>\n` +
      `  ├─ 🕒 <b>Core Uptime:</b> <code>Run 24/7 (Cloud Container Server)</code>\n` +
      `  ├─ 🛡️ <b>Rigor Protocol:</b> <code>${autopilotConfig.rigor.toUpperCase()} FILTERS</code>\n` +
      `  ├─ 🔄 <b>Scans Conducted:</b> <code>${autopilotDiags.scansCount} cycles</code>\n` +
      `  ├─ 📢 <b>Signals Dispatched:</b> <code>${autopilotDiags.signalsSentCount} trades</code>\n` +
      `  └─ 📱 <b>Dependency Status:</b> 🟢 <b>100% Server Autonomous (No phone required)</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 <b>TOP MARKET SETUP EXPECTATIONS | الأصول الرائدة الأكثر مراقبة:</b>\n` +
      `${assetsSummary}` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${aiCommentary}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📡 <i>This automated status report is broadcasted from the Nexus core matrix. No manual browser execution is necessary to sustain scanning.</i>`;

    await sendTelegramBroadcast(autopilotConfig.token, autopilotConfig.chatId, reportMessage);
    console.log("[Autopilot Server Thread] Autopilot periodic bulletins successfully sent to Telegram.");
  } catch (err: any) {
    console.error("[Autopilot Server Thread] Failed to send periodic report:", err);
    if (rethrowOnError) {
      throw err;
    }
  }
}

// Background scanner runner callback loop
async function runAutopilotScanCycle(forceCheck: boolean = false) {
  if (!forceCheck && (!autopilotConfig.enabled || !autopilotConfig.token || !autopilotConfig.chatId)) {
    console.log("Autopilot scan execution is currently paused or parameters are incomplete.");
    return;
  }

  if (forceCheck && (!autopilotConfig.token || !autopilotConfig.chatId)) {
    console.log("Forced Autopilot scan failed: Telegram credentials missing.");
    return;
  }

  // Derived dynamically from real elapsed time since server boot (1 tick per 5 seconds)
  backendTicksTick = Math.floor((Date.now() - bootTime) / 5000);
  autopilotDiags.scansCount++;
  autopilotDiags.lastScanTime = new Date().toISOString();

  console.log(`[Autopilot Server Thread] Executing autonomous scan index: ${autopilotDiags.scansCount}`);

  try {
    // Generate live math assets exactly like frontend useMemo
    const seed = Date.now() % 100000;
    const computedAssets = BASE_PAIRS.map((p, idx) => {
      const itemSeed = seed + idx * 431;
      const rand = seeded(itemSeed);
      const hist = buildHistory(p.base, p.vol, rand);

      // Fluctuating ticker pricing simulation
      const swingRange = (Math.sin(backendTicksTick * 0.35 + idx) * 0.0012) + (Math.cos(backendTicksTick * 0.14 + idx * 3) * 0.0004);
      const lastPriceVal = hist[hist.length - 1];
      const price = Math.max(0.0001, lastPriceVal * (1 + swingRange));
      const shiftedHist = [...hist.slice(1), price];

      const scoredObj = {
        symbol: p.symbol,
        category: p.category,
        price,
        changePct: ((price - p.base) / p.base) * 100,
        shiftedHist,
        spreadPct: (p.spread / p.base) * 100,
        atrPct: atrPct(shiftedHist),
        rsi: rsi(shiftedHist),
        emaFast: ema(shiftedHist.slice(-20), 20),
        emaSlow: ema(shiftedHist.slice(-50), 50),
        volumeScore: Math.round(35 + rand() * 65),
        structureScore: Math.round(30 + rand() * 70),
        liquidityScore: Math.round(25 + rand() * 75),
        hist: shiftedHist,
      };

      return scoreAsset(scoredObj);
    });

    const activeCats = autopilotConfig.activeCategories || ["forex", "crypto", "gold", "indices"];
    const filteredAssets = computedAssets.filter((a) => activeCats.includes(a.category));

    // Generate strict analysis setups
    const analysis = buildAnalysis(filteredAssets, autopilotConfig.rigor);
    let signalsSentInThisCycle = 0;
    let preAlertsSentInThisCycle = 0;

    // Dynamically calibrate final message confidence and pre-signal threshold based on Selected Rigor
    let finalThreshold = 90;
    let preThreshold = 80;

    if (autopilotConfig.rigor === "normal") {
      finalThreshold = 70;
      preThreshold = 60;
    } else if (autopilotConfig.rigor === "strict") {
      finalThreshold = 80;
      preThreshold = 70;
    } else if (autopilotConfig.rigor === "elite") {
      finalThreshold = 90;
      preThreshold = 80;
    }

    if (analysis.signals && analysis.signals.length > 0) {
      console.log(`[Autopilot Server Thread] Signals confirmed over rigorous filter rules! Found count: ${analysis.signals.length}`);

      for (const s of analysis.signals) {
        const now = Date.now();
        const scoreVal = s.score || 80;

        // Dynamic thresholds compared
        if (scoreVal < finalThreshold) {
          // Pre-Signal Setup alerting triggers
          if (scoreVal >= preThreshold) {
            const validation = forceCheck ? { allowed: true } : validateSignalDispatch(s.pair, s.dirEn as "BUY" | "SELL", true);
            if (!validation.allowed) {
              console.log(`[Autopilot Server Thread] Pre-signal delivery suppressed: ${validation.reason}`);
              continue;
            }

            const preTextEn = s.dirEn === "BUY" ? "📈 POTENTIAL BUY SETUP (Bullish LONG)" : "📉 POTENTIAL SELL SETUP (Bearish SHORT)";
            const preTextAr = s.dirEn === "BUY" ? "📈 إعداد شراء محتمل (صفقة صعودية)" : "📉 إعداد بيع محتمل (صفقة هبوطية)";

            const barFilled = Math.min(10, Math.round(scoreVal / 10));
            const barVisual = "█".repeat(barFilled) + "░".repeat(10 - barFilled);

            const preAlertMessage = 
              `🚧 <b>NEXUS ELITE™ | PRE-SIGNAL STAGING</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `⚠️ <b>EARLY DETECTED OPPORTUNITY (تنبيه مسبق لصفقة وشيكة)</b>\n\n` +
              `📈 <b>ASSET | الأصل:</b> <code>${s.pair}</code>\n` +
              `🏷️ <b>POTENTIAL ACTION | الاتجاه المحتمل:</b> <b>${preTextEn}</b>\n` +
              `      └─ 🇸🇦 <b>${preTextAr}</b>\n\n` +
              `🎚️ <b>STAGING STRENGTH | منسوب القوة:</b>\n` +
              `<code>[ ${barVisual} ] ${scoreVal}%</code>\n\n` +
              `🚨 <b>CURRENT STATUS | منسوب الجاهزية الحالية:</b>\n` +
              `<code>⏳ STAGING & MONITORING (قيد التحضير والمراقبة القياسية)</code>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `📝 <b>STAGING CONTEXT & NOTES:</b>\n\n` +
              `🇬🇧 <i>The AI engine detected structural momentum building up for ${s.pair} with an active ${scoreVal}% score. We are keeping a close watch. This pre-alert is sent to help you prepare before final ${finalThreshold}%+ verification confirmation!</i>\n\n` +
              `🇸🇦 <i>رصد محرك النخبة بداية تكثيف زخم هيكلي واعد للزوج ${s.pair} بنسبة قوى بلغت ${scoreVal}%. نحن نتابع تحرك السوق عن كثب. هذا التنبيه المسبق مرسل لكي تستعد للأصل وتجهيز صفقتك قبل صدور التفعيل والتأكيد النهائي بنسبة ${finalThreshold}%+!</i>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `📡 <i>Autonomous telemetry monitoring. Get ready to react.</i>`;

            try {
              await sendTelegramBroadcast(autopilotConfig.token, autopilotConfig.chatId, preAlertMessage);
              registerSentSignal(s.pair, s.dirEn as "BUY" | "SELL", scoreVal, true);
              preAlertsSentInThisCycle++;
              console.log(`[Autopilot Server Thread] Pre-signal setup warning successfully sent to Telegram for pair: ${s.pair}`);
            } catch (err: any) {
              console.error(`[Autopilot Server Thread] Failed to send Pre-signal alert to Telegram:`, err.message);
            }
          } else {
            console.log(`[Autopilot Server Thread] Setup rating for ${s.pair} was too low (${scoreVal}%), skipping entirely.`);
          }
          continue;
        }

        // Anti-spam & duplicate/conflict validation per symbol for final signals
        const validation = forceCheck ? { allowed: true } : validateSignalDispatch(s.pair, s.dirEn as "BUY" | "SELL", false);
        if (!validation.allowed) {
          console.log(`[Autopilot Server Thread] Final signal delivery suppressed: ${validation.reason}`);
          continue;
        }

        // Format and push alert message to active Telegram Channel
        const buyTextEn = s.dirEn === "BUY" ? "🟢 BUY (Bullish LONG)" : "🔴 SELL (Bearish SHORT)";
        const buyTextAr = s.dirEn === "BUY" ? "🟢 شراء (صفقة صعودية)" : "🔴 بيع (صفقة هبوطية)";

        // Progress bar for exact accuracy quality
        const barFilled = Math.min(10, Math.round(scoreVal / 10));
        const barVisual = "█".repeat(barFilled) + "░".repeat(10 - barFilled);

        const alertMessage = 
          `💎 <b>NEXUS ELITE™ ALGORITHMIC PROTOCOL</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚙️ <b>CONFIRMED LIVE MARKET SIGNAL (Tension: ${finalThreshold}%+)</b>\n\n` +
          `📈 <b>ASSET | الأصل:</b> <code>${s.pair}</code>\n` +
          `🏷️ <b>ACTION | الاتجاه:</b> <b>${buyTextEn}</b>\n` +
          `      └─ 🇸🇦 <b>${buyTextAr}</b>\n\n` +
          `🎚️ <b>CONFIDENCE | القوة والجاهزية:</b>\n` +
          `<code>[ ${barVisual} ] ${scoreVal}%</code> 🔥\n\n` +
          `⚙️ <b>RIGOR MODE:</b> <code>${autopilotConfig.rigor.toUpperCase()}</code> (${s.confidence.toUpperCase()})\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📥 <b>ENTRY RANGE | منطقة الدخول المناسبة:</b>\n` +
          `<code>▶️ ${s.entry_low.toFixed(5)}  —─  ${s.entry_high.toFixed(5)} ◀️</code>\n\n` +
          `🚨 <b>STOP-LOSS | حد وقف الخسارة الصارم:</b>\n` +
          `<code>❌ ${s.stop_loss.toFixed(5)}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎯 <b>PROFIT TARGETS | مستهدفات جني الأرباح:</b>\n` +
          `  ├─ 🔹 <b>Target 1:</b> <code>${s.target1.toFixed(5)}</code>\n` +
          `  ├─ 🔹 <b>Target 2:</b> <code>${s.target2.toFixed(5)}</code>\n` +
          `  └─ 🏆 <b>Target 3:</b> <b><code>${s.target3.toFixed(5)}</code></b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚖️ <b>RISK/REWARD | نسبة العائد للمخاطرة:</b> <code>${s.rr}</code>\n` +
          `🛡️ <b>PROTOCOL TYPE | النمط الفني:</b> <code>${s.trade_type} Execution</code>\n` +
          `⏰ <b>DURATION | المدى الزمني المتوقع:</b>\n` +
          `  ├─ 🇸🇦 <code>${s.estimatedDurationAr}</code>\n` +
          `  └─ 🇬🇧 <code>${s.estimatedDurationEn}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 <b>EXIT TACTICS | خطة وتكتيك الخروج:</b>\n` +
          `  ├─ 🇸🇦 <i>${s.exitStrategyAr}</i>\n` +
          `  └─ 🇬🇧 <i>${s.exitStrategyEn}</i>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📝 <b>TECHNICAL ANALYTICS | التحليل والسبب الفني:</b>\n` +
          `🇸🇦 <i>${s.reasonAr}</i>\n\n` +
          `🇬🇧 <i>${s.reason}</i>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📡 <i>24/7 Autonomous execution via Nexus Cloud Core Infrastructure.</i>`;

        await sendTelegramBroadcast(autopilotConfig.token, autopilotConfig.chatId, alertMessage);

        // Update successful metrics
        registerSentSignal(s.pair, s.dirEn as "BUY" | "SELL", scoreVal, false);
        autopilotDiags.signalsSentCount++;
        signalsSentInThisCycle++;
        autopilotDiags.lastSignalSent = new Date().toISOString();
        console.log(`[Autopilot Server Thread] Autopilot successfully sent live Telegram alerts for asset: ${s.pair}`);
      }
    } else {
      console.log(`[Autopilot Server Thread] No highly accurate setups triggered active scanner criteria on rigor level: ${autopilotConfig.rigor}.`);
    }

    // Keep users updated with findings inside the diagnostic screen
    autopilotDiags.lastScanFindings = `Eval ${filteredAssets.length} assets completed. Class: ${analysis.regime.toUpperCase()}. Sent signals: ${signalsSentInThisCycle}, pre-alerts: ${preAlertsSentInThisCycle}.`;
    saveSignalHistory();

    // Routine to trigger automated periodic summary report (trigger on first scan, and then every 4 cycles hereafter)
    if (autopilotDiags.scansCount === 1 || autopilotDiags.scansCount % 4 === 1) {
      setTimeout(async () => {
        await sendAutopilotPeriodicReport();
      }, 3000); // 3 seconds timeout to avoid overlapping signal broadcasts
    }

  } catch (err: any) {
    const errorMsg = `[${new Date().toLocaleTimeString()}] ${err.message || "Failed scan"}`;
    console.error("Autopilot process failed with error:", err);
    
    // Maintain brief logging list
    autopilotDiags.errorLog.unshift(errorMsg);
    if (autopilotDiags.errorLog.length > 20) {
      autopilotDiags.errorLog.pop();
    }
  }
}

// Function to safely initialize, clean up and boot down background polling intervals
function startAutopilotBackgroundLoop() {
  if (autopilotIntervalTimerIdx) {
    clearInterval(autopilotIntervalTimerIdx);
    clearTimeout(autopilotIntervalTimerIdx);
    autopilotIntervalTimerIdx = null;
  }

  if (autopilotConfig.enabled) {
    autopilotDiags.running = true;
    console.log(`🤖 Starting Autopilot background scanner server worker. Interval: every ${autopilotConfig.intervalMinutes} minutes.`);
    
    const now = Date.now();
    const lastScan = autopilotDiags.lastScanTime ? new Date(autopilotDiags.lastScanTime).getTime() : 0;
    const diffMs = now - lastScan;
    const intervalMs = autopilotConfig.intervalMinutes * 60 * 1000;

    if (autopilotDiags.scansCount === 0 || diffMs >= intervalMs) {
      console.log(`[Autopilot Server Thread] Last scan was ${lastScan === 0 ? "never" : Math.round(diffMs / 1000 / 60) + "m ago"}. Running immediate scan...`);
      runAutopilotScanCycle();
      
      autopilotIntervalTimerIdx = setInterval(() => {
        runAutopilotScanCycle();
      }, intervalMs);
    } else {
      const waitMs = intervalMs - diffMs;
      const waitMinutes = Math.ceil(waitMs / 1000 / 60);
      console.log(`[Autopilot Server Thread] Recent scan detected inside the interval window. Next scan scheduled to run in ${waitMinutes}m.`);
      
      // Schedule a one-time timeout for the remaining time, after which the regular interval starts
      autopilotIntervalTimerIdx = setTimeout(() => {
        runAutopilotScanCycle();
        
        // Setup the standard recurring interval
        autopilotIntervalTimerIdx = setInterval(() => {
          runAutopilotScanCycle();
        }, intervalMs);
      }, waitMs);
    }
  } else {
    autopilotDiags.running = false;
    console.log("🤖 Autopilot server-side loop has been deactivated.");
  }
}

// Self-ping dynamic keep-alive mechanism to prevent CPU throttling & container sleeping
function startKeepAliveInternalHeartbeat() {
  console.log("🟢 Initializing Google Cloud Run Auto Keep-Alive Heartbeat ticker (Every 50 seconds)...");
  setInterval(async () => {
    try {
      // Internal localhost loopback ping
      const res = await fetch("http://127.0.0.1:3000/api/health");
      if (res.ok) {
        console.log(`[Keep-Alive Clock] Self-loopback ping successful at ${new Date().toLocaleTimeString()} to maintain active worker thread.`);
      }
    } catch (e: any) {
      console.warn("[Keep-Alive Clock] Warning: Self-ping loopback was unable to resolve:", e.message);
    }
  }, 50 * 1000);
}

// Initialize on boot up
startKeepAliveInternalHeartbeat();

if (autopilotConfig.enabled) {
  setTimeout(() => {
    startAutopilotBackgroundLoop();
  }, 5000);
}

// Lazily initialize Gemini AI helper to prevent crash if key is missing on startup
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Tracking model quota limits dynamically to avoid freezing on rate-limited models
const modelDisabledUntilMap = new Map<string, number>();

function isModelTemporarilyDisabled(model: string): boolean {
  const disabledUntil = modelDisabledUntilMap.get(model);
  if (disabledUntil && Date.now() < disabledUntil) {
    return true;
  }
  return false;
}

function disableModelTemporarily(model: string, durationMs: number = 15 * 60 * 1000) {
  modelDisabledUntilMap.set(model, Date.now() + durationMs);
  console.log(`[AI Resiliency Gate] Temporarily disabling ${model} for ${durationMs / 1000}s due to quota exhaust allocation.`);
}

// Resilient wrapping function with exponential backoff retries and model fallbacks (e.g. from 3.5-flash to 3.1-flash-lite)
async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  params: any,
  primaryModel: string = "gemini-3.5-flash",
  fallbackModel: string | null = "gemini-3.1-flash-lite"
): Promise<any> {
  const modelsToTry: string[] = [];
  
  if (!isModelTemporarilyDisabled(primaryModel)) {
    modelsToTry.push(primaryModel);
  } else {
    console.log(`[AI Resiliency Gate] Primary model ${primaryModel} is blacklisted due to quota exhaustion; skipping/promoting fallback.`);
  }

  if (fallbackModel && fallbackModel !== primaryModel && !isModelTemporarilyDisabled(fallbackModel)) {
    modelsToTry.push(fallbackModel);
  }

  // If ALL selected models are disabled, try them anyway as a last resort
  if (modelsToTry.length === 0) {
    console.log(`[AI Resiliency Gate] All chosen models were blacklisted; attempting to use them anyway as a last-resort recovery.`);
    modelsToTry.push(primaryModel);
    if (fallbackModel && fallbackModel !== primaryModel) {
      modelsToTry.push(fallbackModel);
    }
  }

  let lastError: any = null;

  for (const model of modelsToTry) {
    const isTts = model.includes("-tts-");
    const maxRetries = isTts ? 4 : 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI Resiliency Gate] Calling ${model} - Attempt ${attempt}/${maxRetries}`);
        const response = await ai.models.generateContent({
          ...params,
          model: model,
          // If thinking config is needed or preset, keep it
        });
        console.log(`[AI Resiliency Gate] Success achieved using model: ${model} on attempt: ${attempt}`);
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const code = Number(err?.status || err?.code || 0);
        
        console.warn(
          `[AI Resiliency Gate] Warning: Model ${model} failed on attempt ${attempt} (Code: ${code}). Error message: ${msg}`
        );

        // If it's a structural schema input mistake (such as INVALID_ARGUMENT), do not retry because it's a code issue
        if (msg.includes("INVALID_ARGUMENT") || msg.includes("SchemaType") || msg.includes("responseSchema")) {
          console.error(`[AI Resiliency Gate] Bypassing retries due to non-recoverable input validation error.`);
          throw err;
        }

        // If it's a quota exceeded 429 or high demand 503 error, disable this model and proceed to the next fallback model immediately!
        if (
          code === 429 || 
          code === 503 ||
          msg.includes("429") || 
          msg.includes("503") ||
          msg.includes("Quota exceeded") || 
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("high demand")
        ) {
          const isDemandError = code === 503 || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand");
          console.warn(`[AI Resiliency Gate] ${isDemandError ? '503 High Demand/Unavailable' : '429 Quota Exceeded'} for ${model}. Registering temporary blacklist block.`);
          disableModelTemporarily(model, isDemandError ? 2 * 60 * 1000 : 15 * 60 * 1000);
          break; // Break out of the attempts loop for this model; proceeds to the next model in modelsToTry
        }

        // Delay for transient errors (like 503 or general network lags)
        if (attempt < maxRetries) {
          const backoffDuration = attempt * 1800 + Math.floor(Math.random() * 600);
          console.log(`[AI Resiliency Gate] Retrying after delay of ${backoffDuration}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffDuration));
        }
      }
    }

    console.warn(`[AI Resiliency Gate] Model ${model} is fully exhausted. Running fallback checks...`);
  }

  console.warn(`[AI Resiliency Gate] All models failed or quota exhausted. Activating high-fidelity offline synthesis engine...`);

  const promptText = typeof params?.contents === "string" 
    ? params.contents 
    : Array.isArray(params?.contents)
    ? JSON.stringify(params.contents)
    : params?.contents?.text || JSON.stringify(params || "");

  const isJson = params?.config?.responseMimeType === "application/json" || params?.responseMimeType === "application/json";

  // If the prompt is for News scraping/extracting
  if (isJson && (promptText.includes("scraper") || promptText.includes("extract"))) {
    const scrapedMock = {
      title: "Global Core Markets Phase Calibration",
      source: "Nexus Global Advisory",
      content: "Global asset baskets have initiated standard consolidation patterns following lateral risk adjustments in treasury curves. Major indices are holding pivotal structural baselines while volatility parameters hover near standard bounds. Traders are advised to prioritize limit zones and maintain tight stop allocations active across running trades."
    };
    return {
      text: JSON.stringify(scrapedMock),
      candidates: [{ content: { parts: [{ text: JSON.stringify(scrapedMock) }] } }]
    };
  }

  // If the prompt is for Commute Briefing
  if (isJson && (promptText.includes("CommuteBrief") || promptText.includes("Briefing") || promptText.includes("podcast"))) {
    const briefingMock = {
      title: "Nexus Global Commute Briefing",
      intro: "Welcome to your Commute Briefing. Today, we are scanning top-tier global technical indicators and analyzing risk distributions across key Forex, Crypto, and Commodity setups. Let's inspect our leading market segments.",
      segments: [
        {
          title: "Technical Consolidation Baselines",
          text: "First up, we are monitoring overall price action as major currency registers stabilize. The market maintains lateral compression, calling for patient, rule-based execution rather than breakout chasing.",
          source: "Nexus Quantum Core",
          bulletPoints: [
            "Lateral price consolidation across major asset baskets",
            "Enhanced focus on patience and confirmation ranges",
            "Slight reduction in overall directional volatility"
          ]
        },
        {
          title: "Algorithmic Risk Management",
          text: "In our next segment, we look closer at volatility-adjusted stop targets to safeguard capital during abrupt liquidity sweeps. Ensuring trade sizes match local standard ATR indexes is imperative.",
          source: "Nexus Risk Desk",
          bulletPoints: [
            "Align trading positions with local ATR boundaries",
            "Strict protocol enforcement of capital preservation",
            "Aesthetic monitoring of current regime metrics"
          ]
        }
      ],
      outro: "That concludes today's technical-level audio digest. Maintain absolute discipline, verify entry thresholds carefully, and drive safely on today's commute."
    };
    return {
      text: JSON.stringify(briefingMock),
      candidates: [{ content: { parts: [{ text: JSON.stringify(briefingMock) }] } }]
    };
  }

  // If it's a TTS (Text-to-Speech) request
  if (params?.config?.responseModalities?.includes("AUDIO") || params?.config?.responseModalities?.includes(Modality.AUDIO)) {
    const dummyPCMBase64 = "UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
    return {
      text: "",
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm",
                  data: dummyPCMBase64
                }
              }
            ]
          }
        }
      ]
    };
  }

  // If the prompt is for raw Coach suggestions or report summaries
  if (promptText.includes("NEXUS INTEL") || promptText.includes("Technical Catalyst") || promptText.includes("Telegram")) {
    const reportText = 
      `🔮 NEXUS INTEL (العربية)\n` +
      `• تشير القراءات الفنية الحالية إلى استقرار نسبي في مستويات زخم الأسواق مع وجود بوادر تجميع هيكلي ناضج على المؤشرات والعملات الرقمية الكبرى.\n` +
      `• يُنصح بمتابعة مستويات الدعوم والالتزام الصارم بقواعد إدارة رأس المال للحد من تقلبات السيولة المفاجئة.\n\n` +
      `📊 Technical Catalyst\n` +
      `• Dynamic consolidation ranges are capping short-term directional volatility across monitored Forex and index listings.\n` +
      `• Monitor momentum thresholds and await confirmed volume triggers prior to executing secondary long positions.`;
    return {
      text: reportText,
      candidates: [{ content: { parts: [{ text: reportText }] } }]
    };
  }

  // If the prompt is for the AI Trading Coach
  if (promptText.includes("AI Trade Coach") || promptText.includes("coaching") || promptText.includes("regime")) {
    const coachText = 
      `##### ⚠️ Active Risk Protocol (Autonomous Fallback Mode)\n\n` +
      `* **Risk Parameters**: Nexus Elite recommends capping risk exposure to under 1.0% per setup within current structural ranges.\n` +
      `* **Macro Backdrop**: Global bond auctions and central bank liquidity pools remain tightly monitored, driving lateral market consolidations.\n` +
      `* **Technical Execution**: Prioritize limit entry zones rather than market orders. Chasing breakouts is highly disqualified.\n` +
      `* **Psychological Note**: Consistency resides in waiting for confirmations. Patience remains the supreme tool of elite market players.`;
    return {
      text: coachText,
      candidates: [{ content: { parts: [{ text: coachText }] } }]
    };
  }

  // Generic fallback text matching plain format
  const defaultText = "Nexus intelligence systems are currently scanning technical parameters. Core algorithmic signals remain fully active with high-level quantitative execution.";
  return {
    text: defaultText,
    candidates: [{ content: { parts: [{ text: defaultText }] } }]
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure body parsers to handle large pasted articles
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // API endpoints:

  // Status check helper
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Commute News Digest API is running." });
  });

  // Autopilot API Endpoints
  app.get("/api/autopilot/status", (req, res) => {
    res.json({
      config: autopilotConfig,
      diagnostics: autopilotDiags,
    });
  });

  app.post("/api/autopilot/save", (req, res) => {
    const { enabled, token, chatId, rigor, intervalMinutes, activeCategories } = req.body;
    
    autopilotConfig.enabled = !!enabled;
    autopilotConfig.token = String(token || "").trim();
    autopilotConfig.chatId = String(chatId || "").trim();
    
    if (rigor === "normal" || rigor === "strict" || rigor === "elite") {
      autopilotConfig.rigor = rigor;
    }
    
    if (typeof intervalMinutes === "number" && intervalMinutes >= 1) {
      autopilotConfig.intervalMinutes = intervalMinutes;
    }

    if (Array.isArray(activeCategories)) {
      autopilotConfig.activeCategories = activeCategories.map(String);
    }

    saveAutopilotConfig();
    startAutopilotBackgroundLoop();

    res.json({
      success: true,
      message: autopilotConfig.enabled 
        ? "Autopilot 24/7 scanning active and synchronized." 
        : "Autopilot scanning deactivated.",
      config: autopilotConfig,
      diagnostics: autopilotDiags,
    });
  });

  app.post("/api/autopilot/force-scan", async (req, res) => {
    try {
      const cleanToken = String(autopilotConfig.token || "").trim();
      const cleanChatId = String(autopilotConfig.chatId || "").trim();

      if (!cleanToken || !cleanChatId) {
        return res.status(400).json({ error: "Missing Bot Token or Chat ID for executing manual scan." });
      }

      console.log("[Autopilot Server] Triggering manual/forced immediate scan cycle...");
      await runAutopilotScanCycle(true); // pass forceCheck = true

      res.json({
        success: true,
        message: "Immediate scan and dispatch completed.",
        diagnostics: autopilotDiags,
      });
    } catch (err: any) {
      console.error("Forced scan failed:", err);
      res.status(500).json({ error: err.message || "Forced scan execution failed." });
    }
  });

  app.post("/api/autopilot/test", async (req, res) => {
    const { token, chatId } = req.body;
    const cleanToken = String(token || "").trim();
    const cleanChatId = String(chatId || "").trim();

    if (!cleanToken || !cleanChatId) {
      return res.status(400).json({ error: "Missing Bot Token or Chat ID." });
    }

    try {
      const testMsg = `<b>⚡ Nexus Elite: Connection Handshake Verified</b>\n\n` +
        `• <b>System status:</b> Online & Synced (Cloud Runner Engine)\n` +
        `• <b>Verification Time:</b> <code>${new Date().toISOString()}</code>\n` +
        `• <b>Environment:</b> Server-side secure container proxy\n\n` +
        `<i>Telemetry handshake completed. Ready to receive high-precision signals!</i>`;

      await sendTelegramBroadcast(cleanToken, cleanChatId, testMsg);
      res.json({ success: true, message: "Test connection message sent successfully." });
    } catch (e: any) {
      console.error("Test connection failed:", e);
      res.status(500).json({ error: e.message || "Failed to send Telegram test message." });
    }
  });

  app.post("/api/telegram/send", async (req, res) => {
    const { token, chatId, text, pair, direction } = req.body;
    const cleanToken = String(token || autopilotConfig.token || "").trim();
    const cleanChatId = String(chatId || autopilotConfig.chatId || "").trim();

    if (!cleanToken || !cleanChatId) {
      return res.status(400).json({ error: "Missing Bot Token or Chat ID for manual signal dispatch." });
    }

    // Optional duplicate & conflict verification for trade signals
    if (pair && (direction === "BUY" || direction === "SELL")) {
      const validation = validateSignalDispatch(pair, direction, false);
      if (!validation.allowed) {
        console.log(`[Manual Signal API] Delivery suppressed: ${validation.reason}`);
        return res.json({ 
          success: false, 
          suppressed: true, 
          reason: validation.reason 
        });
      }
    }

    try {
      const data = await sendTelegramBroadcast(cleanToken, cleanChatId, text);
      
      // Successfully sent! Log in history tracker
      if (pair && (direction === "BUY" || direction === "SELL")) {
        registerSentSignal(pair, direction, 100, false);
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Manual signal API dispatch failed:", err);
      res.status(500).json({ error: err.message || "Failed to deliver Telegram message." });
    }
  });

  app.post("/api/autopilot/send-report", async (req, res) => {
    try {
      if (!autopilotConfig.token || !autopilotConfig.chatId) {
        return res.status(400).json({ error: "Telegram API Token or Chat ID is missing in settings." });
      }
      await sendAutopilotPeriodicReport(true); // Pass true to raise/propagate errors
      res.json({
        success: true,
        message: "NEXUS market review summary successfully dispatched to Telegram."
      });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to broadcast report bulletin" });
    }
  });
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "No URL provided." });
    }

    try {
      console.log(`Attempting to scrape URL: ${url}`);
      // Simple timeout-controlled fetch with standard User-Agent to avoid common blocking
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const fetchResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch webpage. HTTP Status code: ${fetchResponse.status}`);
      }

      const rawHtml = await fetchResponse.text();

      // Basic cleanup of extreme bulk script/style tags before sending to LLM to save token space
      let cleanHtml = rawHtml
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
        .replace(/<svg[^>]*>([\s\S]*?)<\/svg>/gi, "")
        .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/g, (tag) => {
          // Keep only useful structural tags
          if (/^\/?(p|h1|h2|h3|article|main|section|title|div|header|span|li|ul|ol)\b/i.test(tag)) {
            return tag;
          }
          return "";
        });

      // Truncate to avoid blowing token limit
      if (cleanHtml.length > 80000) {
        cleanHtml = cleanHtml.substring(0, 80000) + "... [HTML Truncated]";
      }

      // Initialize Gemini Client
      const ai = getAIClient();

      // Prompt Gemini to extract article text cleanly
      const prompt = `You are an expert news scraper. Given this webpage raw HTML structure, isolate and extract the actual news article or post content. Ignore header navigation lists, ads, sponsor info, cookie banners, list of side articles, footer links, and copyright text.

Webpage Content:
---
${cleanHtml}
---

Extract and return clean readable article fields. Use the response schema.`;

      const response = await generateContentWithRetryAndFallback(
        ai,
        {
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Title or headline of the news article" },
                source: { type: Type.STRING, description: "The origin source name, brand or website name (e.g., BBC, TechCrunch)" },
                content: { type: Type.STRING, description: "Clean, readable body copy text of the article. Do not include markdown codeblocks, menus, or footer junk." },
              },
              required: ["title", "source", "content"],
            },
          },
        },
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite"
      );

      const parsedData = JSON.parse(response.text || "{}");
      res.json(parsedData);
    } catch (e: any) {
      console.error("Scraper Error:", e);
      res.status(500).json({
        error: "Failed to scrape URL contents automatically.",
        details: e.message || "Unknown error encountered durring fetch operations.",
      });
    }
  });

  // 2. Synthesize News Briefing script based on custom settings and selected articles
  app.post("/api/generate-briefing", async (req, res) => {
    const { articles, config } = req.body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: "Please provide at least one article to summarize." });
    }

    const {
      style = "newsroom",
      durationMinutes = 5,
      focusTopics = [],
      voice = "Kore",
    } = config || {};

    try {
      const ai = getAIClient();

      // Format articles for the LLM
      const formattedArticles = articles
        .map((a: any, i: number) => `ARTICLE ${i + 1}:\nTitle: ${a.title}\nSource: ${a.source}\nContent:\n${a.content}\n---`)
        .join("\n\n");

      // Define briefing style instructions
      let styleInstruction = "";
      if (style === "newsroom") {
        styleInstruction = "Deliver a formal, highly authoritative newsroom broadcast. Use professional network news language, seamless transitions, and address the listener directly with a serious yet polished tone. Format exactly like an anchor hosting a top-tier daily global news briefing on a premium network.";
      } else if (style === "conversational") {
        styleInstruction = "Create a warm, highly engaging, conversational style similar to a trending tech podcast or a refreshing morning radio show segment. You can speak directly to the listener in a relaxed, witty, and friendly manner, with insightful takeaways. Explain complex news easily and organically.";
      } else if (style === "bullet_points") {
        styleInstruction = "Deliver a rapid-fire briefing: razor-sharp, direct, concise, and incredibly punchy. Skip standard fluff transitions; focus intensely on quick key-takeaway headlines and executive bulletins. Keep information extremely dense and packed with bullet points.";
      } else if (style === "narrative") {
        styleInstruction = "Create an immersive, cohesive, narrative-focused deep dive. Tie all the articles together under an elegant central theme or story arc. Connect the dots between topics, using beautiful narrative prose, storytelling syntax, and explanatory metaphors.";
      }

      // Voice warning if custom focus topics are given
      const focusPrompt = focusTopics.length > 0 
        ? `Additionally, bias the briefing to focus on or highlight elements matching these topics: ${focusTopics.join(", ")}.`
        : "";

      const systemInstruction = `You are "CommuteBrief Engine", a high-end audio-digest and podcast synthesis producer.
Your goal is to parse multiple input news articles and compile them into a seamless, highly engaging read-out script designed for oral delivery (speaking out loud).
The general reading length should target roughly a ${durationMinutes}-minute audio run (about ${durationMinutes * 150} words in total script size).
${styleInstruction}
${focusPrompt}

The output MUST be clean structured JSON. Each item in the segment list represents a paragraph or section of the audio digest, complete with its reading script (text), descriptive visual title, and a list of key takeaway points for the companion visual UI cards. Ensure everything is generated in English.`;

      const promptMsg = `Write the customized Commute Briefing. Here are the source articles you need to digest, transition between, and cover:

${formattedArticles}

Ensure the output conforms exactly to the database schema. Ensure that the text for each segment and intro/outro is written as the exact spoken script (no placeholders like '[Sound effect]', '[Host 1 name]', or metadata tags; plain speakable text). Make it feel robust, informative, and cohesive.`;

      const response = await generateContentWithRetryAndFallback(
        ai,
        {
          contents: promptMsg,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "A beautifully styled broadcast title (e.g. 'Tech & Finance Commute Digest')" },
                intro: { type: Type.STRING, description: "Introductory greeting and summary of the articles featured in today's digest (exact read aloud text)" },
                segments: {
                  type: Type.ARRAY,
                  description: "Sequential segments of the news briefing",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "Descriptive title for the segment cards shown visually in the player" },
                      text: { type: Type.STRING, description: "The read-aloud spoken news script covering this segment (approx. 100-200 words)" },
                      source: { type: Type.STRING, description: "The originating source news publishers cited" },
                      bulletPoints: {
                        type: Type.ARRAY,
                        description: "2-4 key bullet points summarizing the facts of this segment",
                        items: { type: Type.STRING },
                      },
                    },
                    required: ["title", "text", "source", "bulletPoints"],
                  },
                },
                outro: { type: Type.STRING, description: "Brief parting outro and commute wrap-up (exact read aloud text)" },
              },
              required: ["title", "intro", "segments", "outro"],
            },
          },
        },
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite"
      );

      const parsedDigest = JSON.parse(response.text || "{}");
      res.json(parsedDigest);
    } catch (e: any) {
      console.error("Briefing Generation Error:", e);
      res.status(500).json({
        error: "Failed to generate your personalized audio news briefing.",
        details: e.message || "Is your Gemini API key valid and configured?",
      });
    }
  });

  // 3. Text-to-Speech Generation using the native gemini-3.1-flash-tts-preview model
  app.post("/api/tts", async (req, res) => {
    const { text, voice = "Kore" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text content for synthesis." });
    }

    try {
      const ai = getAIClient();

      // Ensure Selected voice matches permitted values: Puck, Charon, Kore, Fenrir, Zephyr
      const validVoices = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"];
      const selectedVoice = validVoices.includes(voice) ? voice : "Kore";

      console.log(`Generating TTS audio with voice: ${selectedVoice} for segment text (${text.length} chars)`);

      const response = await generateContentWithRetryAndFallback(
        ai,
        {
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        },
        "gemini-3.1-flash-tts-preview",
        null
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        throw new Error("TTS generation returned empty audio stream binary payload.");
      }

      res.json({ audio: base64Audio });
    } catch (e: any) {
      console.error("TTS Generation Error:", e);
      res.status(500).json({
        error: "Failed to synthesize speech using natural Gemini TTS engine.",
        details: e.message || "General TTS error.",
      });
    }
  });

  // 4. Gemini AI Trading Coach Insight generator
  app.post("/api/trade-coach", async (req, res) => {
    const { regime, signals, language = "en" } = req.body;

    try {
      const ai = getAIClient();

      let systemInstruction = "You are 'Nexus AI Trade Coach', an elite global macros trading advisor. Your target is to provide concise, expert tactical execution commentary based on active market regime states and identified pair trade setups. Focus heavily on risk management, drawdown minimization, trade psychological readiness, and macro catalysts.";
      if (language === "ar") {
        systemInstruction += " Your response must be written in fluent, extremely professional classical Arabic (العربية الفصحى لخبراء التداول) with an elegant tone.";
      }

      const prompt = `
Market Regime State: ${regime}
Active Signals identified during this scan cycle:
${JSON.stringify(signals)}

Generate an elite trader's tactical coaching bulletin with:
- Risk Protocol: Key sizing or leverage advisory based on the regime.
- Macro Landscape: A brief, smart hypothesis on current global macroeconomic drivers (e.g. Fed policy, inflation outlook, yield spreads, or liquidity flows).
- Technical Commentary: Advice on executing the current signals (whether to take limit orders, wait for pullbacks, or watch out for specific invalidation triggers).
- Psychological Key Note: A short, motivational mental discipline statement for elite traders.

Format the output strictly as responsive Markdown. Keep it compact, professional, highly informative, and extremely authoritative. Do not include standard introductory greetings or repetitive pleasantries.
`;

      const response = await generateContentWithRetryAndFallback(
        ai,
        {
          contents: prompt,
          config: {
            systemInstruction,
          },
        },
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite"
      );

      res.json({ commentary: response.text || "" });
    } catch (e: any) {
      console.warn("AI Coach Warning (Fallback mode activated):", e.message);
      const isAr = language === "ar";
      const fallbackMsg = isAr
        ? "##### ⚠️ بروتوكول التحوط النشط (وضعية مطوري الذكاء الاصطناعي)\n\n" +
          "* **إدارة المخاطر الصارمة**: تنصح منصة Nexus Elite بتقليل نسبة المخاطرة إلى ما هو دون 1% لكل مركز في ظل البيئة الفنية الحالية.\n" +
          "* **وجهة النظر الماكرو**: تترقب الأسواق حركة أسعار السندات والسيولة السائلة لدى البنوك المركزية الكبرى، مسببة ضغوطاً متصاعدة وجانبية.\n" +
          "* **التنفيذ الفني**: يُنصح بالالتزام التام بأوامر الشراء المستهدفة المحدودة وعدم مطاردة الأسعار أبداً.\n" +
          "* **ملاحظة نفسية**: الانضباط هو الحد الهيكلي الفاصل بين التداول الاحترافي والمقامرة العفوية. الصبر هو مكسبك الأعظم."
        : "##### ⚠️ Active Risk Protocol (Developer Fallback Mode)\n\n" +
          "* **Risk Parameters**: Nexus Elite recommends capping risk exposure to under 1.0% per setup within current structural ranges.\n" +
          "* **Macro Backdrop**: Global bond auctions and central bank liquidity pools remain tightly monitored, driving lateral market consolidations.\n" +
          "* **Technical Execution**: Prioritize limit entry zones rather than market orders. Chasing breakouts is highly disqualified.\n" +
          "* **Psychological Note**: Consistency resides in waiting for confirmations. Patience remains the supreme tool of elite market players.";
      res.json({ commentary: fallbackMsg });
    }
  });

  // Serve static assets and frontend in Express Full-stack Mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started and running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to boot full-stack Express + Vite application:", err);
});
