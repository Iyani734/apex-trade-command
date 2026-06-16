/**
 * TradeVault Pro — Backend Server v2.0.0
 *
 * Upgrades from v1:
 *  • Multi-account manager (master/slave registry)
 *  • Command dispatcher (server → EA via commands.json)
 *  • Copy trading orchestration (lot scaling, deduplication)
 *  • Risk manager API (remote pause/resume)
 *  • EA status monitor (heartbeat, online/offline detection)
 *  • Trade command result acknowledgement
 *  • Extended REST API for dashboard control
 *  • News event scheduling (optional)
 *  • Enhanced WebSocket events
 */

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const http    = require('http');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  PORT: 3001,
  STORAGE_DIR:         path.join(__dirname, 'data'),
  JOURNAL_FILE:        path.join(__dirname, 'data', 'journal.json'),
  EQUITY_HISTORY_FILE: path.join(__dirname, 'data', 'equity_history.json'),
  INSIGHTS_FILE:       path.join(__dirname, 'data', 'insights.json'),
  ACCOUNTS_FILE:       path.join(__dirname, 'data', 'accounts.json'),
  NEWS_FILE:           path.join(__dirname, 'data', 'news_events.json'),
  COMMAND_LOG_FILE:    path.join(__dirname, 'data', 'command_log.json'),
  POLL_INTERVAL_MS:    1500,
  EA_OFFLINE_THRESHOLD_S: 30,
  API_KEY: process.env.API_KEY || 'tradevault-local-key',
};

// ─── Initialize storage ───────────────────────────────────────────────────────
if (!fs.existsSync(CONFIG.STORAGE_DIR)) fs.mkdirSync(CONFIG.STORAGE_DIR, { recursive: true });

const initFile = (p, d) => { if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(d, null, 2)); };
initFile(CONFIG.JOURNAL_FILE,        { entries: [] });
initFile(CONFIG.EQUITY_HISTORY_FILE, { snapshots: [] });
initFile(CONFIG.INSIGHTS_FILE,       { generated_at: null, insights: [] });
initFile(CONFIG.ACCOUNTS_FILE,       { accounts: [] });
initFile(CONFIG.NEWS_FILE,           { events: [] });
initFile(CONFIG.COMMAND_LOG_FILE,    { commands: [] });

// ─── State ────────────────────────────────────────────────────────────────────
const g_accounts = new Map();
let   g_wsClients = new Set();

class AccountState {
  constructor(accountId, config = {}) {
    this.accountId      = accountId;
    this.config         = {
      alias:          config.alias      || accountId,
      role:           config.role       || 'STANDALONE',
      masterAccountId:config.masterAccountId || null,
      lotMultiplier:  config.lotMultiplier   || 1.0,
      useFixedLot:    config.useFixedLot     || false,
      fixedLotSize:   config.fixedLotSize    || 0.01,
      copySL:         config.copySL          !== false,
      copyTP:         config.copyTP          !== false,
      dataFile:       config.dataFile || path.join(__dirname, 'data', `trade_data_${accountId}.json`),
      commandFile:    config.commandFile || path.join(__dirname, 'data', `commands_${accountId}.json`),
      statusFile:     config.statusFile  || path.join(__dirname, 'data', `status_${accountId}.json`),
      resultFile:     config.resultFile  || path.join(__dirname, 'data', `result_${accountId}.json`),
    };
    this.rawData        = null;
    this.processedData  = null;
    this.eaStatus       = null;
    this.lastSeen       = null;
    this.online         = false;
    this.lastFileHash   = '';
    this.pendingCommands= new Map();
  }
}

// ─── App Setup ────────────────────────────────────────────────────────────────
const app    = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// ─── WebSocket ────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  g_wsClients.add(ws);
  console.log(`[WS] Client connected. Total: ${g_wsClients.size}`);
  const snapshot = buildMultiAccountSnapshot();
  ws.send(JSON.stringify({ type: 'INIT', data: snapshot, timestamp: Date.now() }));
  ws.on('close', () => { g_wsClients.delete(ws); });
  ws.on('error', () => { g_wsClients.delete(ws); });
});

const broadcast = (type, data, accountId = null) => {
  const msg = JSON.stringify({ type, data, accountId, timestamp: Date.now() });
  g_wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
};

// ─── Account Registration ──────────────────────────────────────────────────────
const registerAccount = (accountId, config = {}) => {
  if (!g_accounts.has(accountId)) {
    const state = new AccountState(accountId, config);
    g_accounts.set(accountId, state);
    startAccountWatcher(state);
    console.log(`[Account] Registered: ${accountId} (${config.role || 'STANDALONE'})`);
  } else {
    const state = g_accounts.get(accountId);
    Object.assign(state.config, config);
  }
  persistAccountRegistry();
};

const loadAccountRegistry = () => {
  const store = loadJSON(CONFIG.ACCOUNTS_FILE);
  (store.accounts || []).forEach(acc => {
    registerAccount(acc.accountId, acc.config);
  });
};

const persistAccountRegistry = () => {
  const accounts = [];
  g_accounts.forEach((state, id) => {
    accounts.push({ accountId: id, config: state.config });
  });
  saveJSON(CONFIG.ACCOUNTS_FILE, { accounts });
};

// ─── File Watcher per Account ─────────────────────────────────────────────────
const startAccountWatcher = (state) => {
  const poll = () => {
    const raw = readAccountData(state);
    if (raw) {
      state.rawData       = raw;
      state.processedData = processData(raw, state.accountId);
      state.lastSeen      = Date.now();
      state.online        = true;
      broadcast('FULL_UPDATE', state.processedData, state.accountId);
      if (state.config.role === 'MASTER') {
        dispatchCopyTrades(state);
      }
    }
    const status = readStatusFile(state);
    if (status) {
      state.eaStatus = status;
      broadcast('STATUS_UPDATE', { accountId: state.accountId, status }, state.accountId);
    }
    checkCommandResult(state);
    if (state.lastSeen && (Date.now() - state.lastSeen) > CONFIG.EA_OFFLINE_THRESHOLD_S * 1000) {
      if (state.online) {
        state.online = false;
        broadcast('EA_OFFLINE', { accountId: state.accountId }, state.accountId);
        console.log(`[Account] ${state.accountId} went offline`);
      }
    }
  };
  poll();
  setInterval(poll, CONFIG.POLL_INTERVAL_MS);
  if (fs.existsSync(state.config.dataFile)) {
    chokidar.watch(state.config.dataFile, { usePolling: false }).on('change', () => {
      setTimeout(poll, 100);
    });
  }
};

const readAccountData = (state) => {
  try {
    const file = state.config.dataFile;
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return null;
    const hash = raw.length + raw.slice(-50);
    if (hash === state.lastFileHash) return null;
    state.lastFileHash = hash;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

const readStatusFile = (state) => {
  try {
    const file = state.config.statusFile;
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
};

// ─── Command Dispatcher ───────────────────────────────────────────────────────
const sendCommand = (accountId, command) => {
  const state = g_accounts.get(accountId);
  if (!state) return { error: `Account ${accountId} not registered` };
  const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fullCommand = {
    command_id: commandId,
    account_id: accountId,
    timestamp:  Math.floor(Date.now() / 1000),
    ...command,
  };
  try {
    fs.writeFileSync(state.config.commandFile, JSON.stringify(fullCommand, null, 2));
  } catch (e) {
    return { error: 'Failed to write command file: ' + e.message };
  }
  logCommand(fullCommand);
  console.log(`[CMD] → ${accountId}: ${command.action} (${commandId})`);
  return { success: true, command_id: commandId, command: fullCommand };
};

const checkCommandResult = (state) => {
  try {
    const file = state.config.resultFile;
    if (!fs.existsSync(file)) return;
    const raw = fs.readFileSync(file, 'utf8');
    const result = JSON.parse(raw);
    if (result.command_id && state.pendingCommands.has(result.command_id)) {
      broadcast('COMMAND_RESULT', { accountId: state.accountId, result }, state.accountId);
      state.pendingCommands.delete(result.command_id);
    }
  } catch {}
};

const logCommand = (cmd) => {
  const store = loadJSON(CONFIG.COMMAND_LOG_FILE);
  const commands = store.commands || [];
  commands.unshift({ ...cmd, logged_at: Date.now() });
  if (commands.length > 500) commands.splice(500);
  saveJSON(CONFIG.COMMAND_LOG_FILE, { commands });
};

// ─── Copy Trading Orchestration ───────────────────────────────────────────────
const g_copyTradesSent = new Set();

const dispatchCopyTrades = (masterState) => {
  const openPositions = masterState.processedData?.open_positions || [];
  const masterAccId   = masterState.accountId;
  g_accounts.forEach((slaveState, slaveId) => {
    if (slaveState.config.role !== 'SLAVE') return;
    if (slaveState.config.masterAccountId !== masterAccId) return;
    if (!slaveState.online) return;
    openPositions.forEach(pos => {
      const dedupeKey = `${masterAccId}_${pos.ticket}`;
      if (g_copyTradesSent.has(dedupeKey)) return;
      if (pos.is_copy_trade) return;
      let slaveLots;
      if (slaveState.config.useFixedLot) {
        slaveLots = slaveState.config.fixedLotSize;
      } else {
        slaveLots = parseFloat((pos.lots * slaveState.config.lotMultiplier).toFixed(2));
      }
      slaveLots = Math.max(0.01, slaveLots);
      const command = {
        action:        'OPEN_TRADE',
        symbol:        pos.symbol,
        order_type:    pos.type === 'BUY' ? 'MARKET_BUY' : 'MARKET_SELL',
        lots:          slaveLots,
        sl:            slaveState.config.copySL ? pos.sl : 0,
        tp:            slaveState.config.copyTP ? pos.tp : 0,
        magic_offset:  1000,
        master_ticket: String(pos.ticket),
        comment:       `TV_COPY|M:${masterAccId}|T:${pos.ticket}`,
      };
      sendCommand(slaveId, command);
      g_copyTradesSent.add(dedupeKey);
      console.log(`[Copy] Master ${masterAccId} → Slave ${slaveId}: ${pos.symbol} ${pos.type} ${slaveLots}L`);
    });
    const masterTickets = new Set(openPositions.map(p => String(p.ticket)));
    const slavePositions = slaveState.processedData?.open_positions || [];
    slavePositions.forEach(slavePos => {
      if (!slavePos.is_copy_trade) return;
      if (!slavePos.master_ticket) return;
      const masterTicket = slavePos.master_ticket;
      if (!masterTickets.has(masterTicket)) {
        console.log(`[Copy] Master closed ${masterTicket} → closing slave ${slavePos.ticket}`);
        sendCommand(slaveId, {
          action: 'CLOSE_TRADE',
          ticket: String(slavePos.ticket),
        });
        g_copyTradesSent.delete(`${masterAccId}_${masterTicket}`);
      }
    });
  });
};

// ─── Data Processing Pipeline ─────────────────────────────────────────────────
const processData = (raw, accountId) => {
  if (!raw) return null;
  const history      = raw.trade_history || [];
  const openPositions= raw.open_positions || [];
  const account      = raw.account || {};
  const meta         = raw.meta || {};
  const journal        = loadJSON(CONFIG.JOURNAL_FILE);
  const coreAnalytics  = computeCoreAnalytics(history);
  const equityCurve    = buildEquityCurve(history, account.balance);
  const sessionStats   = computeSessionStats(history);
  const symbolStats    = computeSymbolStats(history);
  const dowStats       = computeDayOfWeekStats(history);
  const streakData     = computeStreakData(history);
  const periodReturns  = computePeriodReturns(history);
  const drawdownCurve  = buildDrawdownCurve(history, account.balance);
  const tradeDistrib   = buildTradeDistribution(history);
  const enrichedHistory= enrichHistoryWithJournal(history, journal.entries || []);
  const insights       = generateInsights({ history, sessionStats, symbolStats, coreAnalytics, dowStats, streakData, account });
  persistEquitySnapshot(accountId, account);
  saveJSON(CONFIG.INSIGHTS_FILE, { generated_at: Date.now(), insights });
  const accountConfig = g_accounts.get(accountId)?.config || {};
  const state         = g_accounts.get(accountId);
  return {
    meta: {
      ...meta,
      account_config: {
        role:            accountConfig.role || 'STANDALONE',
        master_account:  accountConfig.masterAccountId || null,
        lot_multiplier:  accountConfig.lotMultiplier || 1.0,
        copy_sl:         accountConfig.copySL,
        copy_tp:         accountConfig.copyTP,
      },
    },
    account,
    open_positions:  openPositions,
    pending_orders:  raw.pending_orders || [],
    trade_history:   enrichedHistory,
    analytics: {
      ...coreAnalytics,
      equity_curve:       equityCurve,
      drawdown_curve:     drawdownCurve,
      session_stats:      sessionStats,
      symbol_stats:       symbolStats,
      day_of_week_stats:  dowStats,
      streak_data:        streakData,
      period_returns:     periodReturns,
      trade_distribution: tradeDistrib,
    },
    insights,
    symbols:          raw.symbols || [],
    risk_config:      raw.risk_config || {},
    copy_config:      raw.copy_config || {},
    journal_pending:  getPendingJournalEntries(openPositions, journal.entries || []),
    ea_status:        state?.eaStatus || null,
    server_meta: {
      processed_at:      Date.now(),
      data_age_seconds:  meta.timestamp ? Math.floor(Date.now() / 1000) - meta.timestamp : 0,
      ws_clients:        g_wsClients.size,
      ea_online:         state?.online || false,
    },
  };
};

// ─── Analytics ────────────────────────────────────────────────────────────────
const computeCoreAnalytics = (history) => {
  if (!history.length) return getEmptyAnalytics();
  let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0;
  let bestTrade = null, worstTrade = null;
  let totalPips = 0, totalDuration = 0, totalRR = 0, rrCount = 0;
  for (const t of history) {
    const p = t.net_profit;
    if (p > 0) { wins++; grossProfit += p; if (!bestTrade || p > bestTrade.net_profit) bestTrade = t; }
    else { losses++; grossLoss += Math.abs(p); if (!worstTrade || p < worstTrade.net_profit) worstTrade = t; }
    totalPips     += t.pips || 0;
    totalDuration += t.duration_minutes || 0;
    if (t.risk_reward && t.risk_reward > 0) { totalRR += t.risk_reward; rrCount++; }
  }
  const total = history.length;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss= losses > 0 ? grossLoss / losses : 0;
  return {
    total_trades: total, wins, losses,
    win_rate: +((wins / total) * 100).toFixed(2),
    gross_profit: +grossProfit.toFixed(2), gross_loss: +grossLoss.toFixed(2),
    net_profit: +(grossProfit - grossLoss).toFixed(2),
    profit_factor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(4) : 0,
    expectancy: +((grossProfit - grossLoss) / total).toFixed(2),
    avg_win: +avgWin.toFixed(2), avg_loss: +avgLoss.toFixed(2),
    risk_reward_ratio: avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : 0,
    avg_rr_planned: rrCount > 0 ? +(totalRR / rrCount).toFixed(2) : 0,
    avg_pips: total > 0 ? +(totalPips / total).toFixed(1) : 0,
    avg_duration_minutes: total > 0 ? Math.round(totalDuration / total) : 0,
    best_trade: bestTrade, worst_trade: worstTrade,
  };
};

const buildEquityCurve = (history, currentBalance) => {
  if (!history.length) return [];
  const sorted = [...history].sort((a, b) => a.exit_time - b.exit_time);
  let cumulative = 0;
  return sorted.map((t, i) => {
    cumulative += t.net_profit || 0;
    return {
      index: i + 1,
      timestamp: (t.exit_time || 0) * 1000,
      timestamp_human: t.exit_time_human || '',
      balance: +((currentBalance || 0) - (sorted.slice(-1)[0]?.net_profit || 0) + cumulative).toFixed(2),
      profit: +(t.net_profit || 0).toFixed(2),
      symbol: t.symbol, is_win: t.is_win,
      cumulative_profit: +cumulative.toFixed(2),
    };
  });
};

const buildDrawdownCurve = (history, currentBalance) => {
  const curve = buildEquityCurve(history, currentBalance);
  let peak = curve[0]?.balance || 0;
  return curve.map(p => {
    if (p.balance > peak) peak = p.balance;
    const dd    = peak > 0 ? ((peak - p.balance) / peak) * 100 : 0;
    const ddAbs = peak - p.balance;
    return { ...p, peak: +peak.toFixed(2), drawdown_pct: +dd.toFixed(4), drawdown_abs: +ddAbs.toFixed(2) };
  });
};

const computeSessionStats = (history) => {
  const sessions = {};
  for (const t of history) {
    const s = t.session || 'Off-Hours';
    if (!sessions[s]) sessions[s] = { session: s, trades: 0, wins: 0, losses: 0, gross_profit: 0, gross_loss: 0, net_profit: 0 };
    sessions[s].trades++;
    const p = t.net_profit || 0;
    if (p > 0) { sessions[s].wins++; sessions[s].gross_profit += p; }
    else { sessions[s].losses++; sessions[s].gross_loss += Math.abs(p); }
    sessions[s].net_profit += p;
  }
  return Object.values(sessions).map(s => ({
    ...s,
    gross_profit: +s.gross_profit.toFixed(2), gross_loss: +s.gross_loss.toFixed(2),
    net_profit: +s.net_profit.toFixed(2),
    win_rate: s.trades > 0 ? +((s.wins / s.trades) * 100).toFixed(2) : 0,
    profit_factor: s.gross_loss > 0 ? +(s.gross_profit / s.gross_loss).toFixed(4) : 0,
  })).sort((a, b) => b.net_profit - a.net_profit);
};

const computeSymbolStats = (history) => {
  const symbols = {};
  for (const t of history) {
    const s = t.symbol;
    if (!symbols[s]) symbols[s] = { symbol: s, trades: 0, wins: 0, losses: 0, gross_profit: 0, gross_loss: 0, net_profit: 0, total_pips: 0 };
    symbols[s].trades++;
    const p = t.net_profit || 0;
    if (p > 0) { symbols[s].wins++; symbols[s].gross_profit += p; }
    else { symbols[s].losses++; symbols[s].gross_loss += Math.abs(p); }
    symbols[s].net_profit += p;
    symbols[s].total_pips += t.pips || 0;
  }
  return Object.values(symbols).map(s => ({
    ...s,
    gross_profit: +s.gross_profit.toFixed(2), gross_loss: +s.gross_loss.toFixed(2),
    net_profit: +s.net_profit.toFixed(2),
    win_rate: s.trades > 0 ? +((s.wins / s.trades) * 100).toFixed(2) : 0,
    avg_pips: s.trades > 0 ? +(s.total_pips / s.trades).toFixed(1) : 0,
    profit_factor: s.gross_loss > 0 ? +(s.gross_profit / s.gross_loss).toFixed(4) : 0,
  })).sort((a, b) => b.net_profit - a.net_profit);
};

const computeDayOfWeekStats = (history) => {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const stats = {};
  days.forEach(d => { stats[d] = { day: d, trades: 0, wins: 0, losses: 0, net_profit: 0 }; });
  for (const t of history) {
    const d = t.day_of_week;
    if (!stats[d]) continue;
    stats[d].trades++;
    const p = t.net_profit || 0;
    if (p > 0) stats[d].wins++; else stats[d].losses++;
    stats[d].net_profit += p;
  }
  return days.map(d => ({
    ...stats[d],
    net_profit: +stats[d].net_profit.toFixed(2),
    win_rate: stats[d].trades > 0 ? +((stats[d].wins / stats[d].trades) * 100).toFixed(2) : 0,
  }));
};

const computeStreakData = (history) => {
  const sorted = [...history].sort((a, b) => a.exit_time - b.exit_time);
  if (!sorted.length) return { streaks: [], max_win_streak: 0, max_loss_streak: 0, current_streak: null };
  const streaks = [];
  let curType = null, curCount = 0, curProfit = 0, curStart = 0;
  let maxWin = 0, maxLoss = 0;
  for (const t of sorted) {
    const type = t.is_win ? 'win' : 'loss';
    if (type !== curType) {
      if (curCount > 0) streaks.push({ type: curType, count: curCount, profit: +curProfit.toFixed(2), start: curStart });
      curType = type; curCount = 1; curProfit = t.net_profit || 0; curStart = t.exit_time;
    } else {
      curCount++; curProfit += t.net_profit || 0;
    }
    if (type === 'win' && curCount > maxWin) maxWin = curCount;
    if (type === 'loss' && curCount > maxLoss) maxLoss = curCount;
  }
  if (curCount > 0) streaks.push({ type: curType, count: curCount, profit: +curProfit.toFixed(2), start: curStart });
  return { streaks: streaks.slice(-20), max_win_streak: maxWin, max_loss_streak: maxLoss, current_streak: streaks.length > 0 ? streaks[streaks.length - 1] : null };
};

const computePeriodReturns = (history) => {
  const monthly = {}, weekly = {};
  for (const t of history) {
    const d = new Date((t.exit_time || 0) * 1000);
    const mKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    const wKey = getISOWeek(d);
    if (!monthly[mKey]) monthly[mKey] = { period: mKey, profit: 0, trades: 0, wins: 0 };
    if (!weekly[wKey])  weekly[wKey]  = { period: wKey, profit: 0, trades: 0, wins: 0 };
    monthly[mKey].profit += t.net_profit || 0; monthly[mKey].trades++; if (t.is_win) monthly[mKey].wins++;
    weekly[wKey].profit += t.net_profit || 0; weekly[wKey].trades++; if (t.is_win) weekly[wKey].wins++;
  }
  const toArr = (obj) => Object.values(obj).map(p => ({
    ...p, profit: +p.profit.toFixed(2),
    win_rate: p.trades > 0 ? +((p.wins / p.trades) * 100).toFixed(2) : 0,
  })).sort((a, b) => a.period.localeCompare(b.period));
  return { monthly: toArr(monthly), weekly: toArr(weekly) };
};

const buildTradeDistribution = (history) => {
  const buckets = [
    { label: 'Big Win (>100)', count: 0 }, { label: 'Win (20-100)', count: 0 },
    { label: 'Small Win (0-20)', count: 0 }, { label: 'Small Loss (0-20)', count: 0 },
    { label: 'Loss (20-100)', count: 0 }, { label: 'Big Loss (>100)', count: 0 },
  ];
  for (const t of history) {
    const p = t.net_profit || 0;
    if (p > 100) buckets[0].count++; else if (p > 20) buckets[1].count++;
    else if (p > 0) buckets[2].count++; else if (p > -20) buckets[3].count++;
    else if (p > -100) buckets[4].count++; else buckets[5].count++;
  }
  return buckets;
};

const generateInsights = ({ history, sessionStats, symbolStats, coreAnalytics, dowStats, streakData, account }) => {
  const insights = [];
  const ts = Date.now();
  if (sessionStats.length > 0) {
    const best = sessionStats[0]; const worst = sessionStats[sessionStats.length - 1];
    insights.push({ id: `session_best_${ts}`, type: 'session_best', severity: 'success', message: `Best session: ${best.session} — $${best.net_profit} net (${best.win_rate}% WR)`, context: { session: best.session }, generated_at: ts });
    if (worst.net_profit < -100) insights.push({ id: `session_avoid_${ts}`, type: 'session_avoid', severity: 'warning', message: `Avoid ${worst.session}: $${worst.net_profit} net loss`, context: { session: worst.session }, generated_at: ts });
  }
  if (symbolStats.length > 0) {
    const best = symbolStats[0]; const worst = symbolStats[symbolStats.length - 1];
    insights.push({ id: `sym_best_${ts}`, type: 'symbol_best', severity: 'success', message: `Top symbol: ${best.symbol} — $${best.net_profit} net (${best.win_rate}% WR)`, context: { symbol: best.symbol }, generated_at: ts });
    if (worst.net_profit < -100) insights.push({ id: `sym_avoid_${ts}`, type: 'symbol_avoid', severity: 'warning', message: `${worst.symbol} is draining your account: $${worst.net_profit} net`, context: { symbol: worst.symbol }, generated_at: ts });
  }
  const a = coreAnalytics;
  if (a.win_rate > 60) insights.push({ id: `wr_high_${ts}`, type: 'win_rate_high', severity: 'success', message: `Win rate is strong at ${a.win_rate}%`, generated_at: ts });
  if (a.win_rate < 40 && a.total_trades > 10) insights.push({ id: `wr_low_${ts}`, type: 'win_rate_low', severity: 'danger', message: `Win rate is low at ${a.win_rate}%. Review your entries.`, generated_at: ts });
  if (a.profit_factor >= 2) insights.push({ id: `pf_exc_${ts}`, type: 'pf_excellent', severity: 'success', message: `Excellent profit factor: ${a.profit_factor}`, generated_at: ts });
  if (a.profit_factor > 0 && a.profit_factor < 1) insights.push({ id: `pf_neg_${ts}`, type: 'pf_negative', severity: 'danger', message: `Profit factor below 1.0 (${a.profit_factor}) — losing strategy`, generated_at: ts });
  const dd = account.current_drawdown_pct || 0;
  if (dd > 15) insights.push({ id: `dd_high_${ts}`, type: 'drawdown_high', severity: 'danger', message: `High drawdown: ${dd.toFixed(2)}%`, generated_at: ts });
  else if (dd > 8) insights.push({ id: `dd_mod_${ts}`, type: 'drawdown_moderate', severity: 'warning', message: `Moderate drawdown: ${dd.toFixed(2)}%`, generated_at: ts });
  const streak = streakData.current_streak;
  if (streak?.type === 'loss' && streak.count >= 3) insights.push({ id: `streak_${ts}`, type: 'consec_losses', severity: 'warning', message: `On a ${streak.count}-trade losing streak. Consider reducing size.`, generated_at: ts });
  if (a.avg_duration_minutes < 10 && a.total_trades > 5) insights.push({ id: `scalper_${ts}`, type: 'scalper_detected', severity: 'info', message: `Scalping style detected (avg ${a.avg_duration_minutes}min holds)`, generated_at: ts });
  if (a.avg_duration_minutes > 720 && a.total_trades > 5) insights.push({ id: `swing_${ts}`, type: 'swing_detected', severity: 'info', message: `Swing trading style detected (avg ${Math.round(a.avg_duration_minutes / 60)}h holds)`, generated_at: ts });
  if (dowStats.length > 0) {
    const bestDay = [...dowStats].sort((a, b) => b.net_profit - a.net_profit)[0];
    insights.push({ id: `bestday_${ts}`, type: 'best_day', severity: 'info', message: `Best day: ${bestDay.day} with $${bestDay.net_profit} avg profit`, generated_at: ts });
  }
  return insights;
};

// ─── Journal Helpers ──────────────────────────────────────────────────────────
const enrichHistoryWithJournal = (history, journalEntries) => {
  const jMap = {};
  for (const e of journalEntries) jMap[String(e.ticket)] = e;
  return history.map(t => ({ ...t, journal: jMap[String(t.deal_ticket)] || jMap[String(t.position_id)] || null }));
};

const getPendingJournalEntries = (openPositions, journalEntries) => {
  const journaledTickets = new Set(journalEntries.map(e => String(e.ticket)));
  return openPositions.filter(p => !journaledTickets.has(String(p.ticket)));
};

// ─── Equity Persistence ───────────────────────────────────────────────────────
const persistEquitySnapshot = (accountId, account) => {
  const store = loadJSON(CONFIG.EQUITY_HISTORY_FILE);
  const snapshots = store.snapshots || [];
  const last = snapshots[snapshots.length - 1];
  if (last && last.balance === account.balance && last.equity === account.equity) return;
  snapshots.push({ account_id: accountId, timestamp: Math.floor(Date.now() / 1000), timestamp_ms: Date.now(), balance: account.balance, equity: account.equity, profit: account.profit, drawdown_pct: account.current_drawdown_pct });
  if (snapshots.length > 10000) snapshots.splice(0, snapshots.length - 10000);
  saveJSON(CONFIG.EQUITY_HISTORY_FILE, { snapshots });
};

// ─── Multi-Account Snapshot ───────────────────────────────────────────────────
const buildMultiAccountSnapshot = () => {
  const result = {};
  g_accounts.forEach((state, id) => {
    result[id] = { accountId: id, config: state.config, online: state.online, lastSeen: state.lastSeen, data: state.processedData, eaStatus: state.eaStatus };
  });
  return result;
};

// ─── REST API ─────────────────────────────────────────────────────────────────
const getAccountState = (req, res) => {
  const accountId = req.params.accountId || req.query.accountId;
  if (!accountId) { res.status(400).json({ error: 'accountId required' }); return null; }
  const state = g_accounts.get(accountId);
  if (!state) { res.status(404).json({ error: `Account ${accountId} not found` }); return null; }
  return state;
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', accounts: g_accounts.size, timestamp: Date.now() });
});

app.get('/api/accounts', (req, res) => { res.json(buildMultiAccountSnapshot()); });

app.post('/api/accounts/register', (req, res) => {
  const { accountId, config } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  registerAccount(accountId, config || {});
  res.json({ success: true, accountId });
});

app.put('/api/accounts/:accountId/config', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  Object.assign(state.config, req.body); persistAccountRegistry();
  res.json({ success: true, config: state.config });
});

app.delete('/api/accounts/:accountId', (req, res) => {
  const { accountId } = req.params;
  if (!g_accounts.has(accountId)) return res.status(404).json({ error: 'Account not found' });
  g_accounts.delete(accountId); persistAccountRegistry();
  res.json({ success: true });
});

app.get('/api/accounts/:accountId/dashboard', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  if (!state.processedData) return res.status(503).json({ error: 'No data yet — is the EA running?' });
  res.json(state.processedData);
});

app.get('/api/accounts/:accountId/status', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json({ online: state.online, lastSeen: state.lastSeen, eaStatus: state.eaStatus });
});

app.get('/api/accounts/:accountId/positions', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(state.processedData?.open_positions || []);
});

app.get('/api/accounts/:accountId/history', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  let history = state.processedData?.trade_history || [];
  const { symbol, session, day, limit = 100, offset = 0 } = req.query;
  if (symbol)  history = history.filter(t => t.symbol === symbol);
  if (session) history = history.filter(t => t.session === session);
  if (day)     history = history.filter(t => t.day_of_week === day);
  const sorted = [...history].sort((a, b) => b.exit_time - a.exit_time);
  res.json({ total: sorted.length, data: sorted.slice(+offset, +offset + +limit) });
});

app.get('/api/accounts/:accountId/analytics', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(state.processedData?.analytics || {});
});

app.post('/api/accounts/:accountId/command', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  const result = sendCommand(req.params.accountId, req.body);
  if (result.error) return res.status(500).json(result);
  res.json(result);
});

app.post('/api/accounts/:accountId/open', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'OPEN_TRADE', ...req.body }));
});

app.post('/api/accounts/:accountId/close/:ticket', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'CLOSE_TRADE', ticket: req.params.ticket }));
});

app.post('/api/accounts/:accountId/close-all', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'CLOSE_ALL' }));
});

app.post('/api/accounts/:accountId/modify/:ticket', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'MODIFY_TRADE', ticket: req.params.ticket, ...req.body }));
});

app.post('/api/accounts/:accountId/partial-close/:ticket', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'PARTIAL_CLOSE', ticket: req.params.ticket, ...req.body }));
});

app.post('/api/accounts/:accountId/pause', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'PAUSE_TRADING' }));
});

app.post('/api/accounts/:accountId/resume', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'RESUME_TRADING' }));
});

app.post('/api/accounts/:accountId/breakeven/:ticket', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'SET_BREAKEVEN', ticket: req.params.ticket }));
});

app.post('/api/accounts/:accountId/trail/:ticket', (req, res) => {
  const state = getAccountState(req, res); if (!state) return;
  res.json(sendCommand(req.params.accountId, { action: 'TRAIL_STOP', ticket: req.params.ticket, sl: req.body.trail_pips }));
});

app.get('/api/commands', (req, res) => {
  const store = loadJSON(CONFIG.COMMAND_LOG_FILE);
  const { limit = 50 } = req.query;
  res.json({ commands: (store.commands || []).slice(0, +limit) });
});

app.get('/api/copy/pairs', (req, res) => {
  const pairs = [];
  g_accounts.forEach((state, id) => {
    if (state.config.role === 'SLAVE') {
      pairs.push({ slave: id, master: state.config.masterAccountId, lot_multiplier: state.config.lotMultiplier, use_fixed_lot: state.config.useFixedLot, fixed_lot_size: state.config.fixedLotSize, copy_sl: state.config.copySL, copy_tp: state.config.copyTP });
    }
  });
  res.json({ pairs });
});

app.post('/api/copy/pairs', (req, res) => {
  const { masterAccountId, slaveAccountId, lotMultiplier, useFixedLot, fixedLotSize, copySL, copyTP } = req.body;
  if (!masterAccountId || !slaveAccountId) return res.status(400).json({ error: 'masterAccountId and slaveAccountId required' });
  if (!g_accounts.has(masterAccountId)) return res.status(404).json({ error: `Master account ${masterAccountId} not registered` });
  if (!g_accounts.has(slaveAccountId))  return res.status(404).json({ error: `Slave account ${slaveAccountId} not registered` });
  const slaveState = g_accounts.get(slaveAccountId);
  slaveState.config.role = 'SLAVE'; slaveState.config.masterAccountId = masterAccountId;
  if (lotMultiplier !== undefined) slaveState.config.lotMultiplier = lotMultiplier;
  if (useFixedLot !== undefined)   slaveState.config.useFixedLot   = useFixedLot;
  if (fixedLotSize !== undefined)  slaveState.config.fixedLotSize  = fixedLotSize;
  if (copySL !== undefined)        slaveState.config.copySL         = copySL;
  if (copyTP !== undefined)        slaveState.config.copyTP         = copyTP;
  const masterState = g_accounts.get(masterAccountId); masterState.config.role = 'MASTER';
  persistAccountRegistry();
  res.json({ success: true, pair: { master: masterAccountId, slave: slaveAccountId, config: slaveState.config } });
});

app.delete('/api/copy/pairs/:slaveAccountId', (req, res) => {
  const state = g_accounts.get(req.params.slaveAccountId);
  if (!state) return res.status(404).json({ error: 'Slave account not found' });
  state.config.role = 'STANDALONE'; state.config.masterAccountId = null;
  persistAccountRegistry();
  res.json({ success: true });
});

app.get('/api/journal', (req, res) => {
  const journal = loadJSON(CONFIG.JOURNAL_FILE);
  const { symbol, strategy, limit = 50, offset = 0 } = req.query;
  let entries = journal.entries || [];
  if (symbol)   entries = entries.filter(e => e.symbol === symbol);
  if (strategy) entries = entries.filter(e => e.strategy_tag === strategy);
  const sorted = [...entries].sort((a, b) => b.created_at - a.created_at);
  res.json({ total: sorted.length, data: sorted.slice(+offset, +offset + +limit) });
});

app.post('/api/journal', (req, res) => {
  const { ticket, symbol, reason, strategy_tag, confidence, notes } = req.body;
  if (!ticket) return res.status(400).json({ error: 'ticket required' });
  const journal = loadJSON(CONFIG.JOURNAL_FILE);
  const entries = journal.entries || [];
  const idx = entries.findIndex(e => String(e.ticket) === String(ticket));
  const entry = { id: idx >= 0 ? entries[idx].id : `j_${Date.now()}`, ticket: String(ticket), symbol: symbol || '', reason: reason || '', strategy_tag: strategy_tag || '', confidence: confidence || null, notes: notes || '', created_at: idx >= 0 ? entries[idx].created_at : Date.now(), updated_at: Date.now() };
  if (idx >= 0) entries[idx] = entry; else entries.push(entry);
  saveJSON(CONFIG.JOURNAL_FILE, { entries });
  g_accounts.forEach((state) => { if (state.rawData) state.processedData = processData(state.rawData, state.accountId); });
  broadcast('JOURNAL_UPDATE', { entry });
  res.json({ success: true, entry });
});

app.delete('/api/journal/:ticket', (req, res) => {
  const journal = loadJSON(CONFIG.JOURNAL_FILE);
  journal.entries = (journal.entries || []).filter(e => String(e.ticket) !== req.params.ticket);
  saveJSON(CONFIG.JOURNAL_FILE, journal);
  res.json({ success: true });
});

app.get('/api/dashboard', (req, res) => {
  const first = g_accounts.values().next().value;
  if (!first?.processedData) return res.status(503).json({ error: 'No data. Register an account and ensure EA is running.' });
  res.json(first.processedData);
});

app.get('/api/positions',   (req, res) => { const s = g_accounts.values().next().value; res.json(s?.processedData?.open_positions || []); });
app.get('/api/analytics',   (req, res) => { const s = g_accounts.values().next().value; res.json(s?.processedData?.analytics || {}); });
app.get('/api/insights',    (req, res) => { const s = g_accounts.values().next().value; res.json(s?.processedData?.insights || []); });
app.get('/api/equity-curve',(req, res) => { const s = g_accounts.values().next().value; res.json(s?.processedData?.analytics?.equity_curve || []); });
app.get('/api/equity-history',(req,res)=> { res.json(loadJSON(CONFIG.EQUITY_HISTORY_FILE).snapshots || []); });

// ─── Utility ──────────────────────────────────────────────────────────────────
const loadJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } };
const saveJSON = (p, d) => { fs.writeFileSync(p, JSON.stringify(d, null, 2)); };
const getEmptyAnalytics = () => ({
  total_trades: 0, wins: 0, losses: 0, win_rate: 0, gross_profit: 0, gross_loss: 0, net_profit: 0,
  profit_factor: 0, expectancy: 0, avg_win: 0, avg_loss: 0, risk_reward_ratio: 0, avg_rr_planned: 0,
  avg_pips: 0, avg_duration_minutes: 0, best_trade: null, worst_trade: null,
});

const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dn = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dn);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil(((d - ys) / 86400000 + 1) / 7)).padStart(2, '0')}`;
};

// ─── Startup ──────────────────────────────────────────────────────────────────
loadAccountRegistry();

const defaultTradeJson = process.env.TRADE_JSON || path.join(__dirname, 'data', 'trade_data.json');
if (g_accounts.size === 0) {
  registerAccount('default', {
    alias: 'Main Account', role: 'STANDALONE', dataFile: defaultTradeJson,
    commandFile: path.join(__dirname, 'data', 'commands_default.json'),
    statusFile:  path.join(__dirname, 'data', 'status_default.json'),
    resultFile:  path.join(__dirname, 'data', 'result_default.json'),
  });
}

server.listen(CONFIG.PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      TradeVault Pro — Backend Server v2.0.0     ║');
  console.log('║  Multi-Account | Copy Trading | Command Engine   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  REST API:       http://localhost:${CONFIG.PORT}/api/dashboard`);
  console.log(`  WebSocket:      ws://localhost:${CONFIG.PORT}`);
  console.log(`  Accounts API:   http://localhost:${CONFIG.PORT}/api/accounts`);
  console.log(`  Copy Pairs:     http://localhost:${CONFIG.PORT}/api/copy/pairs`);
  console.log(`  Registered:     ${g_accounts.size} account(s)`);
  console.log('');
});

module.exports = app;
