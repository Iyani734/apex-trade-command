# TradeVault Pro — User Guide

## 🚀 Getting Started

### Prerequisites
- MetaTrader 4 or MetaTrader 5 terminal installed
- TradeVault EA file (.ex4 or .ex5)
- TradeVault Backend server running
- Modern web browser (Chrome, Edge, Firefox)

---

## 📡 How to Connect Your MetaTrader Account

### Step 1: Install the EA

1. Open your MetaTrader terminal
2. Navigate to `File → Open Data Folder`
3. Go to `MQL4/Experts/` (MT4) or `MQL5/Experts/` (MT5)
4. Copy the TradeVault EA file into this folder
5. Restart MetaTrader or right-click the Navigator panel → Refresh

### Step 2: Configure MetaTrader Settings

1. Go to `Tools → Options → Expert Advisors`
2. Enable the following:
   - ☑️ **Allow automated trading**
   - ☑️ **Allow DLL imports**
   - ☑️ **Allow WebRequest for listed URL** (add your backend URL)
3. Click OK

### Step 3: Attach EA to a Chart

1. Open any chart (e.g., EURUSD)
2. Drag the TradeVault EA from the Navigator panel onto the chart
3. In the EA settings, configure:
   - **Account ID**: Your unique account identifier (e.g., `10047832`)
   - **File prefix**: Leave default or customize
4. Ensure the "Auto Trading" button in the toolbar is **enabled** (green)

### Step 4: Verify File Communication

The EA creates these files in the MetaTrader shared folder:
- `trade_data_<ACCOUNT_ID>.json` — Full trading data
- `status_<ACCOUNT_ID>.json` — Heartbeat/status
- `result_<ACCOUNT_ID>.json` — Command execution results

The backend writes:
- `commands_<ACCOUNT_ID>.json` — Instructions for the EA

Ensure the backend has access to the same shared folder.

### Step 5: Start the Backend

```bash
cd tradevault-backend
npm install
npm start
```

The server starts on `http://localhost:3001` by default.

### Step 6: Connect via Dashboard

1. Open the TradeVault Pro dashboard in your browser
2. Navigate to **Connect Account** (sidebar footer or `/connect`)
3. Enter your **Account ID**
4. Optionally set the file path
5. Select role: **STANDALONE**, **MASTER**, or **SLAVE**
6. Click **Connect Account**
7. Wait for confirmation

---

## 📊 Using the Dashboard

### Dashboard (`/dashboard`)
- View **Balance**, **Equity**, **Daily P&L**, and **Drawdown** at a glance
- Monitor EA status (online/offline, latency, trading state)
- See **Equity Curve** and **Drawdown Curve** charts
- Quick overview of open positions

### Trades (`/trades`)
- View all open positions with real-time profit
- **Actions available:**
  - Close trade
  - Set breakeven
  - Trailing stop
  - Modify SL/TP
- All actions are sent as commands to the EA via the backend

### Analytics (`/analytics`)
- Comprehensive performance metrics: Win Rate, Profit Factor, Avg R:R, Expectancy
- Equity and Drawdown curves
- Performance by **session**, **symbol**, and **day of week**
- Full trade history table

### Trade Journal (`/journal`)
- Document your trade reasoning
- Tag by **strategy** and **emotion**
- Filter entries by strategy or emotion
- Track correlation between emotions and performance

### Copy Trading (`/copy`)
- View active copy configurations
- Master → Slave relationship display
- Configure lot multiplier, fixed lots, SL/TP copying

### Accounts (`/accounts`)
- Manage all connected accounts
- Switch active account
- View status, balance, broker, and role
- Delete or reconfigure accounts

### Command Center (`/commands`)
- Full audit trail of all commands sent
- Execution status (success/failed/pending)
- Latency tracking

### Settings (`/settings`)
- **Risk Management**: Max drawdown, daily loss limits, equity protection
- **Session Filters**: Enable/disable trading by session
- **Copy Trading**: Default multipliers and sync settings
- **Notifications**: Configure alerts

---

## 🔧 Troubleshooting

### EA Shows Offline
1. Check if MetaTrader is running
2. Verify "Auto Trading" is enabled (green button)
3. Check the EA is attached to a chart
4. Verify the `status_<ID>.json` file is being updated
5. Restart the EA if needed

### Commands Not Executing
1. Check the backend is running
2. Verify file paths match between EA and backend
3. Check `commands_<ID>.json` is being written
4. Check `result_<ID>.json` for error messages
5. Review the Command Center page for failed commands

### Copy Trading Not Working
1. Verify both MASTER and SLAVE accounts are online
2. Check copy config is set to ACTIVE
3. Ensure lot multiplier is > 0
4. Check the EA status on both accounts
5. Review copy map in EA status

### Connection Issues
1. Ensure backend URL is correct in `.env`
2. Check WebSocket connection status (sidebar indicator)
3. Try refreshing the page
4. Check browser console for errors
5. Verify the backend is reachable: `curl http://localhost:3001/api/health`

---

## 📁 File Structure

```
src/
├── components/          # Reusable UI components
│   ├── AppSidebar.tsx   # Main navigation
│   ├── TopBar.tsx       # Top status bar
│   ├── KPICard.tsx      # Metric display cards
│   └── DashboardLayout.tsx
├── pages/               # Route pages
│   ├── DashboardPage.tsx
│   ├── TradesPage.tsx
│   ├── AnalyticsPage.tsx
│   ├── JournalPage.tsx
│   ├── CopyPage.tsx
│   ├── AccountsPage.tsx
│   ├── CommandsPage.tsx
│   ├── SettingsPage.tsx
│   └── ConnectPage.tsx
├── store/               # Zustand state management
│   └── tradingStore.ts
├── services/            # API and data
│   ├── api.ts           # REST API client
│   └── mockData.ts      # Demo data
└── hooks/               # Custom hooks
    ├── useWebSocket.ts  # Real-time updates
    └── useMockData.ts   # Demo data loader
```

---

## 🔌 Connecting to Your Backend

To connect to your real backend instead of demo data:

1. Create a `.env` file:
```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
```

2. Restart the development server
3. The WebSocket hook will auto-connect and receive real-time updates

---

## ⚡ Real-Time Events

The WebSocket receives these events:
- **INIT** — Initial full data load
- **FULL_UPDATE** — Complete data refresh
- **STATUS_UPDATE** — EA heartbeat and status
- **COMMAND_RESULT** — Command execution feedback

All events automatically update the Zustand store and UI.
