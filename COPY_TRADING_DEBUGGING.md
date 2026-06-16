# Copy Trading Debugging Guide

This file is for technical debugging of the TradeVault Pro copy-trading flow.

## Current symptom seen in preview

- The frontend is repeatedly logging: `[Socket.io] connect_error websocket error`
- The frontend defaults to:
  - `VITE_API_URL = http://127.0.0.1:3000/api`
  - `VITE_WS_URL` derived from that same local server if not set

That means the copy-trading UI can only work when the frontend can actually reach the server on port `3000` and the Socket.io endpoint on that same host.

## Most likely failure points

### 1) Frontend cannot reach the backend at all

Check this first.

- `GET /api/health`
- Socket.io connection to the server root host (normally `http://127.0.0.1:3000`)

If the UI is running from a hosted preview but the backend is only running on your own machine, the preview cannot talk to `127.0.0.1:3000` unless that backend is available from the same environment.

### 2) The pair exists in UI, but both accounts were not registered on the server

The server contract requires both accounts to be known before pair creation succeeds.

Check:

- `GET /api/accounts`

Expected:

- master account exists
- slave account exists
- both accounts have already connected at least once

### 3) The pair is stored, but the slave EA is not actually polling copy events

Check:

- `GET /api/copy/pairs`
- `GET /api/debug`

Expected:

- the pair appears as active
- the slave account diagnosis is OK
- the slave EA is polling queue/commands regularly

### 4) The slave EA is not configured as a real slave

In the slave EA inputs, verify:

- `EARole = SLAVE`
- `MasterAccountId = <master MT5 account number>`

If these are wrong, the slave will never drain the queue even if the frontend creates the pair successfully.

### 5) Master pushes are working, but trade replication is blocked later in the chain

Check these endpoints:

- `GET /api/copy/queue-stats`
- `GET /api/copy/latency`

Interpretation:

- `queue depth rising` + slave online = slave is not processing fast enough
- `no latency samples` = slave is not ACKing copy events back through `/ea/result`
- `depth stays 0 even when master opens/closes trades` = server is not generating events from master diffs

## End-to-end expected flow

1. **Master EA** pushes live positions to `POST /ea/live` every ~200 ms.
2. **Server** diffs the previous and current master positions.
3. Server creates `OPEN`, `MODIFY`, or `CLOSE` events per slave queue.
4. **Slave EA** polls `GET /ea/copy-queue/:masterAccountId` every ~100 ms.
5. Slave executes the event locally.
6. Slave reports result to `POST /ea/result`.
7. Server updates latency stats and queue state.

If any one of those steps fails, copy trading fails.

## Quick technical checklist

Run these in order against the backend:

### A. Backend alive

```bash
curl http://127.0.0.1:3000/api/health
```

Expected:

- response is `200`
- version matches `4.1.0`

### B. Accounts registered

```bash
curl http://127.0.0.1:3000/api/accounts
```

Expected:

- both master and slave accounts are present

### C. Pair exists

```bash
curl http://127.0.0.1:3000/api/copy/pairs
```

Expected pair shape:

```json
{
  "masterAccountId": "12345678",
  "slaveAccountId": "87654321",
  "lotMultiplier": 1,
  "copySL": true,
  "copyTP": true,
  "active": true
}
```

### D. Slave queue health

```bash
curl http://127.0.0.1:3000/api/copy/queue-stats
```

Watch for:

- `depth > 0` after master activity
- `depth` should drop again quickly if slave is healthy

### E. Latency health

```bash
curl http://127.0.0.1:3000/api/copy/latency
```

Expected:

- the slave account has sample data after copy events are processed

### F. EA diagnosis

```bash
curl http://127.0.0.1:3000/api/debug
```

Expected:

- both accounts show healthy status
- recent live pushes
- slave polling is visible

## What the frontend expects from the backend

### List pairs

`GET /api/copy/pairs`

Must return:

```json
{
  "pairs": [
    {
      "masterAccountId": "12345678",
      "slaveAccountId": "87654321",
      "lotMultiplier": 1,
      "copySL": true,
      "copyTP": true,
      "active": true,
      "createdAt": "2025-04-21T10:00:00.000Z",
      "latency": null
    }
  ]
}
```

### Create pair

`POST /api/copy/pairs`

Must accept:

```json
{
  "masterAccountId": "12345678",
  "slaveAccountId": "87654321",
  "lotMultiplier": 1,
  "copySL": true,
  "copyTP": true
}
```

### Update pair

`PUT /api/copy/pairs/:slaveAccountId`

Patch-style payload, e.g.:

```json
{
  "active": false,
  "lotMultiplier": 2.5,
  "copySL": false
}
```

### Delete pair

`DELETE /api/copy/pairs/:slaveAccountId`

## Common reasons it still fails

### Pair creation returns 400

Likely causes:

- master and slave are the same account
- one account has never connected to the backend
- payload shape does not match the contract

### Pair creation succeeds, but no copied trades appear

Likely causes:

- slave EA is not set to `SLAVE`
- slave `MasterAccountId` is wrong
- slave queue polling is not running
- master `/ea/live` pushes are not arriving
- queue overflow occurred and sync path is not recovering

### UI still shows no live updates

Likely causes:

- websocket endpoint is unreachable
- backend is not exposed to the same environment as the frontend
- Socket.io is blocked or misconfigured

## Recommended order of investigation

1. Confirm `/api/health` is reachable.
2. Confirm websocket connectivity.
3. Confirm both accounts appear in `/api/accounts`.
4. Confirm the pair appears in `/api/copy/pairs`.
5. Open a trade on master.
6. Watch `/api/copy/queue-stats`.
7. Watch `/api/copy/latency`.
8. If queue grows but slave does nothing, inspect slave EA config and logs.
9. If queue never grows, inspect master `/ea/live` pushes and server diff logic.

## Current practical conclusion

Based on the preview logs, the first thing to verify is backend reachability from the running frontend, because the repeated Socket.io `connect_error` means the live transport layer is already failing before the full copy-trading experience can be trusted.