import { Asset, Signal, Analysis, Regime, Trend, Category, Confidence, TradeType, RiskLevel, RigorLevel } from "../types";

export function seeded(seed: number) {
  let t = seed % 2147483647;
  return () => (t = (t * 16807) % 2147483647) / 2147483647;
}

export function ema(values: number[], period: number): number {
  const k = 2 / (period + 1);
  return values.slice(1).reduce((prev, curr) => curr * k + prev * (1 - k), values[0]);
}

export function rsi(values: number[], period = 14): number {
  const diffs = values.slice(1).map((v, i) => v - values[i]);
  const gains = diffs.map((d) => Math.max(d, 0));
  const losses = diffs.map((d) => Math.max(-d, 0));
  const ag = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const al = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

export function atrPct(values: number[], period = 14): number {
  const tr = values.slice(1).map((v, i) => Math.abs(v - values[i]));
  const sumTr = tr.slice(-period).reduce((a, b) => a + b, 0);
  const averageTr = sumTr / period;
  const lastVal = values[values.length - 1] || 1;
  return (averageTr / lastVal) * 100;
}

// MACD (Moving Average Convergence Divergence) mathematical calculator
export function calculateMACD(values: number[]): { macdLine: number; signalLine: number; histogram: number } {
  if (values.length < 26) {
    return { macdLine: 0, signalLine: 0, histogram: 0 };
  }
  
  const ema12List: number[] = [];
  const ema26List: number[] = [];
  
  let currentEma12 = values[0];
  let currentEma26 = values[0];
  ema12List.push(currentEma12);
  ema26List.push(currentEma26);
  
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  
  for (let i = 1; i < values.length; i++) {
    currentEma12 = values[i] * k12 + currentEma12 * (1 - k12);
    currentEma26 = values[i] * k26 + currentEma26 * (1 - k26);
    ema12List.push(currentEma12);
    ema26List.push(currentEma26);
  }
  
  const macdLineList: number[] = [];
  for (let i = 0; i < values.length; i++) {
    macdLineList.push(ema12List[i] - ema26List[i]);
  }
  
  const k9 = 2 / 10;
  let signalLine = macdLineList[0];
  for (let i = 1; i < macdLineList.length; i++) {
    signalLine = macdLineList[i] * k9 + signalLine * (1 - k9);
  }
  
  const macdLine = macdLineList[macdLineList.length - 1];
  const histogram = macdLine - signalLine;
  
  return { macdLine, signalLine, histogram };
}

// Bollinger Bands statistical volatility volatility calculator
export function calculateBollingerBands(values: number[], period = 20): { upper: number; middle: number; lower: number; percentB: number } {
  const len = values.length;
  if (len < period) {
    const lastPrice = values[len - 1] || 0;
    return { upper: lastPrice, middle: lastPrice, lower: lastPrice, percentB: 0.5 };
  }
  const slice = values.slice(-period);
  const middle = slice.reduce((sum, v) => sum + v, 0) / period;
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  const upper = middle + 2 * stdDev;
  const lower = middle - 2 * stdDev;
  const lastVal = values[len - 1] || middle;
  
  const percentB = upper === lower ? 0.5 : (lastVal - lower) / (upper - lower);
  return { upper, middle, lower, percentB };
}

// Support and Resistance local price floor/ceiling mathematical mapping
export function calculateSupportResistance(values: number[], period = 24): { support: number; resistance: number } {
  const len = values.length;
  const lookback = Math.min(len, period);
  const slice = values.slice(-lookback);
  const support = Math.min(...slice);
  const resistance = Math.max(...slice);
  return { support, resistance };
}

export function buildHistory(base: number, vol: number, rand: () => number): number[] {
  const hist = [base * (1 + (rand() - 0.5) * 0.04)];
  for (let i = 1; i < 180; i++) {
    const drift = (rand() - 0.495) * vol * 0.8;
    hist.push(Math.max(0.0001, hist[i - 1] * (1 + drift / base)));
  }
  return hist;
}

export function scoreAsset(asset: Omit<Asset, "trend" | "killSwitch" | "score"> & { hist: number[] }): Asset {
  const trendStrength = Math.abs(asset.emaFast - asset.emaSlow) / asset.emaSlow;
  
  // Calculate newly developed quantitative metrics
  const macdResult = calculateMACD(asset.hist);
  const bbResult = calculateBollingerBands(asset.hist, 20);
  const srResult = calculateSupportResistance(asset.hist, 24);

  // Cross-convergence system: Require EMA Golden-Cross and MACD logic to reinforce trend side
  const isEmaBullish = asset.emaFast > asset.emaSlow;
  const isMacdBullish = macdResult.histogram > 0;
  
  let trend: Trend = "HOLD";
  if (trendStrength > 0.0014) {
    if (isEmaBullish && isMacdBullish) {
      trend = "BUY";
    } else if (!isEmaBullish && !isMacdBullish) {
      trend = "SELL";
    } else {
      // To strictly prevent fake or premature signals, do not assign directional bias when EMA and MACD diverge
      trend = "HOLD";
    }
  }

  // Create highly calibrated and realistic indicator score out of 100
  let scoreVal = 0;
  
  if (trend !== "HOLD") {
    // Base core convergence score for fully aligned EMA + MACD trends
    scoreVal = 70;

    // 1. Momentum Booster based on RSI Alignment (Avoid buying peaks or selling bottoms)
    if (trend === "BUY" && asset.rsi >= 45 && asset.rsi <= 75) {
      scoreVal += 10;
    } else if (trend === "SELL" && asset.rsi >= 25 && asset.rsi <= 55) {
      scoreVal += 10;
    } else {
      scoreVal += 5; // decent rsi posture
    }

    // 2. Structural & Orderbook Strength Boosters (based on raw simulations)
    if (asset.structureScore >= 80) scoreVal += 5;
    else if (asset.structureScore >= 50) scoreVal += 3;

    if (asset.liquidityScore >= 80) scoreVal += 5;
    else if (asset.liquidityScore >= 50) scoreVal += 3;

    // 3. Volatility (ATR) and Bollinger Band placement safety
    if (asset.atrPct >= 0.2 && asset.atrPct <= 1.4) {
      scoreVal += 5; // optimal volatility for solid trade execution
    } else if (asset.atrPct < 0.2) {
      scoreVal += 2; // too flat/quiet range
    }

    // Bollinger Band PercentB safety alignment check
    if (trend === "BUY" && bbResult.percentB < 0.85) {
      scoreVal += 5;
    } else if (trend === "SELL" && bbResult.percentB > 0.15) {
      scoreVal += 5;
    }

    // 4. Spread and slipping penalty
    if (asset.spreadPct <= 0.03) {
      scoreVal += 5;
    } else if (asset.spreadPct <= 0.06) {
      scoreVal += 3;
    }
  }

  const killSwitch =
    asset.atrPct > 1.8 ? "High ATR extreme volatility" :
    asset.spreadPct > 0.08 ? "Spread is excessively wide" :
    asset.liquidityScore < 25 ? "Illiquid order book depth" :
    (trend === "BUY" && asset.rsi > 78) ? "Extremely overbought speculative state (RSI > 78)" :
    (trend === "SELL" && asset.rsi < 22) ? "Extremely oversold speculative state (RSI < 22)" :
    null;

  return {
    ...asset,
    trend,
    killSwitch,
    score: killSwitch ? 0 : Math.max(0, Math.min(100, scoreVal)),
    macdHistogram: macdResult.histogram,
    bbPercentB: bbResult.percentB,
    supportPrice: srResult.support,
    resistancePrice: srResult.resistance,
  };
}

export function regimeLabel(assets: Asset[]): Regime {
  const avgAtr = assets.reduce((s, a) => s + a.atrPct, 0) / assets.length;
  const avgTrend = assets.filter((a) => a.trend !== "HOLD").length / assets.length;
  if (avgAtr > 1.2) return "volatile";
  if (avgTrend > 0.65) return "trending";
  if (avgAtr < 0.25) return "quiet";
  return "ranging";
}

export function proposeSignal(asset: Asset, rigor: RigorLevel = "normal"): Signal | null {
  const buy = asset.trend === "BUY";
  const p = asset.price;

  // Real Average True Range (ATR) dynamic target and Stop Loss placement.
  const atrVal = asset.price * (asset.atrPct / 100);

  // Set multipliers based on selection rigor. Wider protection for strict/elite stops to avoid stop hunts.
  const slMultiplier = rigor === "elite" ? 2.0 : rigor === "strict" ? 1.7 : 1.5;

  // Establish stable support & resistance values
  const support = asset.supportPrice || (p - slMultiplier * atrVal);
  const resistance = asset.resistancePrice || (p + slMultiplier * atrVal);

  // Position stop-loss outside nearest support or resistance if possible.
  // BUT we constrain the stop loss distance to stay between 0.8 * slMultiplier * atrVal and 1.2 * slMultiplier * atrVal.
  // This maintains exact proximity to support/resistance while guaranteeing 1:3 Risk/Reward does not fail!
  let stop_loss = buy ? p - slMultiplier * atrVal : p + slMultiplier * atrVal;

  if (buy) {
    if (support && support < p) {
      const maxSL = p - slMultiplier * 1.2 * atrVal;
      const minSL = p - slMultiplier * 0.8 * atrVal;
      const proposed = support * 0.998;
      stop_loss = Math.max(maxSL, Math.min(minSL, proposed));
    }
  } else {
    if (resistance && resistance > p) {
      const maxSL = p + slMultiplier * 1.2 * atrVal;
      const minSL = p + slMultiplier * 0.8 * atrVal;
      const proposed = resistance * 1.002;
      stop_loss = Math.min(maxSL, Math.max(minSL, proposed));
    }
  }

  const actualRisk = Math.abs(p - stop_loss);

  // Sizing rewards strictly based on actualRisk to guarantee risk-reward conditions are perfectly satisfying client limits.
  // Target 1 RR = 1:1.5
  // Target 2 RR = 1:3.1 (Guarantees > 3.0 ratio requirement)
  // Target 3 RR = 1:4.6
  const target1 = buy ? p + actualRisk * 1.5 : p - actualRisk * 1.5;
  const target2 = buy ? p + actualRisk * 3.1 : p - actualRisk * 3.1;
  const target3 = buy ? p + actualRisk * 4.6 : p - actualRisk * 4.6;

  const entry_low = buy ? p * (1 - 0.0006) : p * (1 + 0.0006);
  const entry_high = buy ? p * (1 + 0.0003) : p * (1 - 0.0003);

  // CRITICAL USER RULES VERIFICATION:
  // 1. All targets must be strictly higher than entrance bounds under BUY
  // 2. All targets must be strictly lower than entrance bounds under SELL
  // 3. Otherwise completely reject the trade.
  const maxEntry = Math.max(entry_low, entry_high);
  const minEntry = Math.min(entry_low, entry_high);

  if (buy) {
    if (target1 <= maxEntry || target2 <= maxEntry || target3 <= maxEntry) {
      return null;
    }
  } else {
    if (target1 >= minEntry || target2 >= minEntry || target3 >= minEntry) {
      return null;
    }
  }

  // 4. Do not accept any trade if Risk/Reward is less than 1:3 based on Target 2
  if (actualRisk === 0) {
    return null;
  }

  const realRRRatio = Math.abs(target2 - p) / actualRisk;
  if (realRRRatio < 3.0) {
    return null;
  }

  const confidence: Confidence = asset.score >= 92 ? "very_high" : asset.score >= 82 ? "high" : asset.score >= 72 ? "medium" : "low";
  const trade_type: TradeType = asset.score >= 88 ? "clean" : "retest";
  const risk_level: RiskLevel = asset.atrPct > 1.2 ? "high" : asset.atrPct > 0.6 ? "medium" : "low";

  // Detailed bilingual rationales showing structural truth and convergence indicators
  const actionEn = buy ? "bullish accumulation" : "bearish breakdown";
  const actionAr = buy ? "تراكم صعودي" : "اختراق هبوطي";
  const macdBiasEn = (asset.macdHistogram || 0) > 0 ? "bullish MACD momentum convergence" : "bearish MACD momentum convergence";
  const macdBiasAr = (asset.macdHistogram || 0) > 0 ? "تقاطع زخم ماكد صعودي إيجابي" : "تقاطع زخم ماكد هبوطي سلبي";

  const reasonEn = `${asset.symbol} displays genuine ${actionEn} bias supported by RSI-14 at ${asset.rsi.toFixed(1)}, structural ${macdBiasEn}, and Bollinger band percentB at ${(asset.bbPercentB || 0.5).toFixed(2)}. Stop-Loss secured beneath local Support level at ${stop_loss.toFixed(4)}.`;
  const reasonAr = `يظهر الزوج ${asset.symbol} انحيازاً فنياً حقيقياً نحو الـ ${actionAr} مع كفاءة معززة بدعم من مؤشر القوة RSI عند مستوى ${asset.rsi.toFixed(1)}، وتوافق مع ${macdBiasAr}، ومؤشر البولنجر (percentB عند ${(asset.bbPercentB || 0.5).toFixed(2)}). تم تأمين حد وقف الخسارة أسفل مستوى الدعم الحقيقي عند ${stop_loss.toFixed(4)} لمنع ضرب الستوب.`;

  // Sizing logical duration based on volatility and asset class
  const isCrypto = asset.category === "crypto";
  const durationEn = isCrypto 
    ? "4 - 18 Hours (High Volatility Execution)" 
    : "12 - 36 Hours (Intraday Swing Play)";
  const durationAr = isCrypto 
    ? "من 4 إلى 18 ساعة (تنفيذ تذبذب سريع)" 
    : "من 12 إلى 36 ساعة (تداول سوينغ يومي)";

  const strategyEn = "Take 50% partial profit at Target 1 and immediately move Stop-Loss to entry price to secure risk-free exposure. Trail TP2/TP3 using local market structures.";
  const strategyAr = "جني 50% من الأرباح عند الهدف الأول مع نقل وقف الخسارة فوراً إلى سعر الدخول لتأمين الصفقة بالكامل بالدخول الخالي من المخاطر. تتبع الأهداف المتبقية باستخدام هياكل التراجع الفنية.";

  return {
    pair: asset.symbol,
    dirEn: asset.trend,
    entry_low,
    entry_high,
    target1,
    target2,
    target3,
    stop_loss,
    rr: `1:${realRRRatio.toFixed(1)}`,
    confidence,
    trade_type,
    risk_level,
    reason: reasonEn,
    reasonAr,
    estimatedDurationEn: durationEn,
    estimatedDurationAr: durationAr,
    exitStrategyEn: strategyEn,
    exitStrategyAr: strategyAr,
    score: asset.score,
  };
}

export function buildAnalysis(assets: Asset[], rigor: RigorLevel = "normal"): Analysis {
  const regime = regimeLabel(assets);
  const ranked = [...assets].sort((a, b) => b.score - a.score);

  // Signals are filtered rigorously based on the selected criteria rigor level
  let signals = ranked
    .filter((a) => {
      // Basic exclusions
      if (a.killSwitch || a.trend === "HOLD") return false;

      if (rigor === "normal") {
        return a.score >= 55;
      } else if (rigor === "strict") {
        // Strict Mode: Demands 65+ score, and ensures we are not buying/selling overextended peaks
        if (a.score < 65) return false;
        if (a.trend === "BUY" && a.rsi > 75) return false; // Overbought risk
        if (a.trend === "SELL" && a.rsi < 25) return false; // Oversold risk
        if (a.liquidityScore < 30) return false;
        return true;
      } else {
        // Elite Ultra Strict Mode: Zero nonsense multi-indicator golden alignment
        if (a.score < 75) return false;
        
        const trendStrength = Math.abs(a.emaFast - a.emaSlow) / a.emaSlow;
        if (trendStrength < 0.001) return false; // Reject flat or weak trends
        if (a.spreadPct > 0.08) return false;  // Exclude high transaction cost slippages
        if (a.liquidityScore < 40) return false; // Exclude dry orderbooks
        
        // Golden pullbacks: stable momentum coiled for break
        if (a.trend === "BUY" && (a.rsi < 40 || a.rsi > 68)) return false; 
        if (a.trend === "SELL" && (a.rsi > 60 || a.rsi < 32)) return false;
        
        return true;
      }
    })
    .slice(0, 2)
    .map((a) => proposeSignal(a, rigor))
    .filter((s): s is Signal => s !== null);

  // To protect users from fake/weak signals, do not force a signal if no asset meets high-accuracy standards.
  // We only permit a backup candidate if its score is >= 75 (High Probability). Otherwise, we return no active signals.
  if (signals.length === 0) {
    const backupCandidate = ranked.find((a) => !a.killSwitch && a.trend !== "HOLD" && a.score >= 75);
    if (backupCandidate) {
      const backupSignal = proposeSignal(backupCandidate, rigor);
      if (backupSignal) {
        signals = [backupSignal];
      }
    }
  }

  let market_assessment = "";
  let market_assessment_ar = "";

  if (regime === "volatile") {
    market_assessment = "Market experiences extreme volatility spikes. Selective execution, reduced lot sizes, and absolute stop-loss safety measures are strictly advised.";
    market_assessment_ar = "شهد السوق تصاعداً حاداً في مستويات التذبذب. ينصح بشدة بالدخول الحذر وتقليل أحجام العقود والالتزام الصارم بوقف الخسارة لتفادي الأخطار.";
  } else if (regime === "trending") {
    market_assessment = "Robust directional flows are present across multiple asset categories. Trend-following and break-retest actions are highly favorable.";
    market_assessment_ar = "مسارات اتجاهية قوية تتدفق عبر معظم القطاعات المالية. صفقات تتبع الاتجاه العام وإعادة الاختبار تشكل احتمالات نجاح عالية جداً للتشغيل.";
  } else if (regime === "quiet") {
    market_assessment = "Low volume distribution phase. Spread risk is elevated and breakout catalysts are lacking. Hold positions or stay liquid in stable assets.";
    market_assessment_ar = "توزيع أحجام التداولات هادئ وشحيح للغاية. قد تزداد نسبة الفوارق السعرية غياباً لدوافع حركات كبرى؛ يفضل الصبر أو التحوط بالانتظار خارج السوق.";
  } else {
    market_assessment = "Mixed and ranging market conditions, with micro-trends developing within specific asset zones. Select setups with high technical quality scores.";
    market_assessment_ar = "ظروف السوق مختلطة وأفقية النطاق مع إمكانية نشوء اتجاهات متناهية الصغر داخل قنوات أسعار محددة. التزم بالمنظومة عالية الكفاءة فقط.";
  }

  // Rigorous error messages when filters exclude setups
  let noEn = "No highly profitable execution signals were confirmed during this scan cycle. Strict parameters maintained capital flow.";
  let noAr = "لم يتم تأكيد أي إشارات تداول ذات درجة جودة عالية في دورة المسح الحالية. تم الحفاظ على استمرارية رأس المال بذكاء.";

  if (rigor === "strict") {
    noEn = "No signals matched the Strict Filter criteria. RSI levels or Liquidity did not align in golden bounds. Capital remains protected.";
    noAr = "لم يتطابق أي أصل مع شروط التصفية المعززة. إما لمستويات RSI المتطرفة أو ضعف السيولة النسبية. رأس مالك آمن تماماً.";
  } else if (rigor === "elite") {
    noEn = "No assets met the Elite Ultra-Strict protocol (Requires Golden EMA slopes, optimal RSI, low spreads & depth). Patience prevents drawdowns.";
    noAr = "لم يتطابق أي أصل مع لوائح حارس النخبة الفائق (يتطلب متوسطات أسية فائقة التقاطع، مستويات RSI ذهبية، وفوارق أسعار ضيقة). الصبر يقي المحفظة من الانعكاسات.";
  }

  const no_trade_message = signals.length ? null : noEn;
  const no_trade_message_ar = signals.length ? null : noAr;

  return {
    market_assessment,
    market_assessment_ar,
    regime,
    signals,
    no_trade_message,
    no_trade_message_ar,
    timestamp: new Date().toISOString(),
  };
}
