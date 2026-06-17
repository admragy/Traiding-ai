export type Category = "all" | "forex" | "crypto" | "gold" | "indices";
export type Trend = "BUY" | "SELL" | "HOLD";
export type Regime = "trending" | "ranging" | "volatile" | "quiet";
export type Confidence = "low" | "medium" | "high" | "very_high";
export type TradeType = "clean" | "aggressive" | "retest";
export type RiskLevel = "low" | "medium" | "high";
export type RigorLevel = "normal" | "strict" | "elite";

export interface Asset {
  symbol: string;
  category: "forex" | "crypto" | "gold" | "indices";
  price: number;
  changePct: number;
  spreadPct: number;
  atrPct: number;
  rsi: number;
  emaFast: number;
  emaSlow: number;
  volumeScore: number;
  structureScore: number;
  liquidityScore: number;
  trend: Trend;
  killSwitch: string | null;
  score: number;
  hist: number[];
  macdHistogram?: number;
  bbPercentB?: number;
  supportPrice?: number;
  resistancePrice?: number;
  orderBookImbalance?: number;
  volumeClusterIntensity?: number;
  fibLevels?: { swingHigh: number; swingLow: number; fib382: number; fib500: number; fib618: number; fib786: number };
  ensembleVotes?: string[];
}

export interface Signal {
  pair: string;
  dirEn: Trend;
  entry_low: number;
  entry_high: number;
  target1: number;
  target2: number;
  target3: number;
  stop_loss: number;
  rr: string;
  confidence: Confidence;
  trade_type: TradeType;
  risk_level: RiskLevel;
  reason: string;
  reasonAr?: string;
  estimatedDurationEn: string;
  estimatedDurationAr: string;
  exitStrategyEn: string;
  exitStrategyAr: string;
  score: number;
  orderBookImbalance?: number;
  volumeClusterIntensity?: number;
  fibLevels?: { swingHigh: number; swingLow: number; fib382: number; fib500: number; fib618: number; fib786: number };
  ensembleVotes?: string[];
}

export interface Analysis {
  market_assessment: string;
  market_assessment_ar: string;
  regime: Regime;
  signals: Signal[];
  no_trade_message: string | null;
  no_trade_message_ar: string | null;
  timestamp: string;
}

export interface TelegramConfig {
  token: string;
  chatId: string;
  autoSend: boolean;
}

export type ThemeType = "carbon" | "matrix" | "amber" | "light";

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  createdAt: string;
  theme: ThemeType;
  selectedCategory: "all" | Category;
  focusedSymbols: string[];
  focusOnlyMode: boolean;
  activeCategories: Exclude<Category, "all">[];
  rigor: RigorLevel;
  language: "en" | "ar";
}

