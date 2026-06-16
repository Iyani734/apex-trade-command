# Alert System — Server & EA Integration Guide

This document describes the changes required on the **TradeVault server (`server.cjs`)** and the **MetaTrader Expert Advisor (EA)** so the frontend Alert System works end-to-end.

---

## 1. Overview of the Flow

```
Frontend (React)
   │  user creates / edits / deletes alert
   ▼
POST /api/alerts/:accountId          ──►  server.cjs writes alerts_<accountId>.json
                                          to the EA's MQL Files folder
                                                     │
                                                     ▼
                                          EA reads alerts_<accountId>.json
                                          on every tick (or every N seconds)
                                                     │
                                                     ▼
                                          EA evaluates each alert against live price
                                          (bid / ask / spread / time)
                                                     │
                                                     ▼
                                          When triggered:
                                            - EA writes triggered_alerts.json
                                            - server.cjs reads it & pushes via WS
                                            - Frontend shows toast + sound + history
```

---

## 2. Frontend Contract (already implemented)

The frontend posts the **full list** of alerts for an account on every change
(create / edit / delete / enable-disable). The EA should always treat the file
as the source of truth and replace its in-memory list on each read.

### Endpoint
`POST /api/alerts/:accountId`

### Body
```json
{
  "alerts": [
    {
      "id": "uuid-string",
      "symbol": "EURUSD",
      "condition": "price_above",   // see list below
      "value": 1.0850,
      "enabled": true,
      "note": "Resistance break",
      "createdAt": "2025-01-15T10:00:00Z",
      "triggerOnce": true            // if true, EA disables it after firing
    }
  ]
}
```

### Conditions the EA must support
| condition          | meaning                                       |
|--------------------|-----------------------------------------------|
| `price_above`      | bid >= value                                  |
| `price_below`      | bid <= value                                  |
| `spread_above`     | (ask - bid) in points >= value                |
| `daily_change_pct` | %change since daily open >= value (abs)       |
| `time_at`          | server time reaches HH:MM (value as "14:30")  |

> Add more later — keep the `condition` field as a string so it's extensible.

---

## 3. Required Changes — `server.cjs`

### 3.1 Add an in-memory store + disk persistence
```js
// near the top
const ALERTS_DIR = path.join(MT_FILES_DIR, 'alerts');   // create folder if missing
fs.mkdirSync(ALERTS_DIR, { recursive: true });
```

### 3.2 New endpoints
```js
// GET — frontend hydrates on load
app.get('/api/alerts/:accountId', (req, res) => {
  const file = path.join(ALERTS_DIR, `alerts_${req.params.accountId}.json`);
  if (!fs.existsSync(file)) return res.json({ alerts: [] });
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

// POST — frontend pushes the FULL list (replace semantics)
app.post('/api/alerts/:accountId', (req, res) => {
  const { alerts } = req.body;
  if (!Array.isArray(alerts)) return res.status(400).json({ error: 'alerts must be an array' });

  const file = path.join(ALERTS_DIR, `alerts_${req.params.accountId}.json`);
  fs.writeFileSync(file, JSON.stringify({ alerts, updatedAt: new Date().toISOString() }, null, 2));

  // ALSO copy to the EA's MQL Files folder for that account
  const eaFile = path.join(getEAFilesDir(req.params.accountId), `alerts_${req.params.accountId}.json`);
  fs.writeFileSync(eaFile, JSON.stringify({ alerts }, null, 2));

  res.json({ ok: true, count: alerts.length });
});
```

### 3.3 Watch for triggered alerts (EA → server)
The EA writes `triggered_alerts_<accountId>.json` whenever an alert fires.
The server should watch this file and broadcast over WebSocket.

```js
// chokidar or fs.watch
chokidar.watch(path.join(EA_FILES_DIR, 'triggered_alerts_*.json')).on('change', (file) => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const accountId = file.match(/triggered_alerts_(.+)\.json/)[1];

  // broadcast to connected WS clients
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify({
        type: 'alert_triggered',
        accountId,
        payload: data    // { alertId, symbol, condition, value, price, triggeredAt }
      }));
    }
  });

  // optionally clear the file so the EA can write again
  fs.writeFileSync(file, JSON.stringify({ triggered: [] }));
});
```

### 3.4 Handle "symbol not in Market Watch"
When the EA cannot find a symbol (per EA v3.1 behaviour), it writes
`missing_symbols_<accountId>.json`. The server should:

1. Read the file, broadcast `{ type: 'symbol_missing', symbol, accountId }` over WS.
2. The frontend shows a toast: *"EURGBP not in Market Watch — please add it in MT5"*.

---

## 4. Required Changes — Expert Advisor (MQL5/MQL4)

### 4.1 New file the EA must READ on every tick (or every 1s)
`MQL5/Files/alerts_<accountId>.json`

```mql5
// pseudo-code
void OnTick() {
   static datetime lastCheck = 0;
   if (TimeCurrent() - lastCheck < 1) return;   // throttle to 1s
   lastCheck = TimeCurrent();

   string json = ReadFile("alerts_" + AccountIdStr + ".json");
   CJAVal alerts;
   alerts.Deserialize(json);

   for (int i = 0; i < alerts["alerts"].Size(); i++) {
      CJAVal a = alerts["alerts"][i];
      if (!a["enabled"].ToBool()) continue;

      string sym = a["symbol"].ToStr();

      // Ensure symbol is selected in Market Watch
      if (!SymbolSelect(sym, true)) {
         WriteMissingSymbol(sym);     // -> missing_symbols_<id>.json
         continue;
      }

      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      string cond = a["condition"].ToStr();
      double val  = a["value"].ToDbl();

      bool fired = false;
      if (cond == "price_above" && bid >= val) fired = true;
      else if (cond == "price_below" && bid <= val) fired = true;
      else if (cond == "spread_above") {
         double spreadPts = (ask - bid) / SymbolInfoDouble(sym, SYMBOL_POINT);
         if (spreadPts >= val) fired = true;
      }
      // ... add other conditions

      if (fired) {
         WriteTriggered(a["id"].ToStr(), sym, cond, val, bid);
         if (a["triggerOnce"].ToBool()) {
            // mark disabled locally; server will replace list on next push
         }
      }
   }
}
```

### 4.2 New file the EA must WRITE when an alert fires
`MQL5/Files/triggered_alerts_<accountId>.json`

```json
{
  "triggered": [
    {
      "alertId": "uuid-string",
      "symbol": "EURUSD",
      "condition": "price_above",
      "value": 1.0850,
      "price": 1.08503,
      "triggeredAt": "2025-01-15T14:23:11Z"
    }
  ]
}
```

> **Append, don't overwrite** if multiple alerts can fire in the same tick.
> The server clears the file after broadcasting.

### 4.3 New file the EA writes when a symbol is unknown
`MQL5/Files/missing_symbols_<accountId>.json`

```json
{
  "missing": [
    { "symbol": "EURGBP", "requestedAt": "2025-01-15T14:25:00Z" }
  ]
}
```

The EA should also attempt `SymbolSelect(symbol, true)` automatically — if MT5
has the symbol available but not in Market Watch, this adds it. Only report as
"missing" when `SymbolSelect` returns false.

---

## 5. WebSocket Messages (server → frontend)

Add these new message types to your existing WS protocol:

```json
{ "type": "alert_triggered", "accountId": "1234", "payload": { ... } }
{ "type": "symbol_missing",  "accountId": "1234", "symbol": "EURGBP" }
```

The frontend already listens for these — no further frontend work needed.

---

## 6. Testing Checklist

- [ ] `POST /api/alerts/:accountId` writes `alerts_<id>.json` to the EA folder
- [ ] EA reads the file within 1–2 seconds of being written
- [ ] Setting `price_above` with current bid above value fires immediately
- [ ] Triggered alert reaches the frontend via WS within 2 seconds
- [ ] Disabled alerts (`enabled: false`) are NOT evaluated
- [ ] Unknown symbol triggers `symbol_missing` toast in the UI
- [ ] Deleting an alert in the UI removes it from `alerts_<id>.json`
- [ ] Multiple accounts each get their own `alerts_<accountId>.json` file
- [ ] EA survives a malformed JSON file (logs error, keeps last good list)

---

## 7. File Locations Summary

| File                                        | Writer    | Reader    | Purpose                           |
|---------------------------------------------|-----------|-----------|-----------------------------------|
| `alerts_<accountId>.json`                   | server    | EA        | Active alert definitions          |
| `triggered_alerts_<accountId>.json`         | EA        | server    | Alerts that just fired            |
| `missing_symbols_<accountId>.json`          | EA        | server    | Symbols not in Market Watch       |

All files live in the EA's `MQL5/Files/` (or `MQL4/Files/`) directory.

---

## 8. Other server endpoints added by Phase 2/3

Add these alongside the alerts work:

```js
// PUT /api/copy/pairs/:slaveAccountId  — update lotMult / copySL / copyTP / active
app.put('/api/copy/pairs/:slaveAccountId', (req, res) => {
  const { slaveAccountId } = req.params;
  const { lotMultiplier, copySL, copyTP, active } = req.body;
  const pair = copyPairs.find((p) => p.slaveAccountId === slaveAccountId);
  if (!pair) return res.status(404).json({ error: 'pair not found' });
  if (lotMultiplier !== undefined) pair.lotMultiplier = lotMultiplier;
  if (copySL !== undefined) pair.copySL = copySL;
  if (copyTP !== undefined) pair.copyTP = copyTP;
  if (active !== undefined) pair.active = active;   // EA must skip copying when false
  saveCopyPairs();
  res.json({ ok: true, pair });
});
```

The frontend already calls `POST /api/accounts/:id/resume` after activating
a pair — no change needed there.

For **close-propagation**, the frontend calls the existing
`POST /api/accounts/:id/close-all` on both master and slave back-to-back.
If you want EA-driven propagation instead, have the master EA write a
`master_closed_<id>.json` event that the server forwards as a `close-all`
command to every linked slave automatically.
