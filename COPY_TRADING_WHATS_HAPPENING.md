# Copy Trading — What Is Happening And What You Should Check

This file explains the copy-trading system in plain language.

## What is supposed to happen

Your system has three parts:

1. **Master account EA** — the account you trade on
2. **Server** — the middleman that watches the master and creates copy events
3. **Slave account EA** — the account that receives and executes the copied trades

The frontend does **not** copy trades by itself. The frontend only:

- creates the master/slave pair
- updates the pair settings
- shows queue and latency health
- lets you pause, resume, or remove the pair

The real copying is done by the **server + EAs**.

## What happens when copy trading works correctly

### When you open a trade on the master

1. The master EA sends its latest open positions to the server.
2. The server notices there is a new master trade.
3. The server creates an `OPEN` event for the slave.
4. The slave EA polls the server and receives that event.
5. The slave EA opens the matching trade.

### When you modify SL or TP on the master

1. The master EA pushes fresh data.
2. The server compares the new trade with the previous one.
3. If SL or TP changed, the server creates a `MODIFY` event.
4. The slave EA receives that event and updates the slave trade.

### When you close the trade on the master

1. The master trade disappears from the next live push.
2. The server sees it is gone.
3. The server creates a `CLOSE` event immediately.
4. The slave EA receives that event and closes the matching slave trade.

## What you should check first

### 1) Is the server reachable?

If the frontend cannot reach the server, nothing else in copy trading will work.

Check:

- the backend is running on port `3000`
- `/api/health` works
- websocket connectivity works

If the page is running in a hosted preview but your server is only on your own local machine, the page may fail to talk to it.

### 2) Did both accounts connect at least once?

The server must already know about both accounts.

Check:

- `/api/accounts`

You should see:

- the master account
- the slave account

If one of them is missing, pair creation or copying will fail.

### 3) Did you actually create a copy pair?

Check:

- `/api/copy/pairs`

You should see:

- the master account ID
- the slave account ID
- `active: true`

If the pair is missing, the system has nothing to copy.

### 4) Is the slave EA configured properly?

On the slave EA, make sure:

- `EARole = SLAVE`
- `MasterAccountId = your master account number`

This is one of the most important checks.

If this is wrong, the slave will not poll the copy queue correctly.

### 5) Is the slave actually polling copy events?

The slave should keep polling the copy queue roughly every 100 ms.

If the slave stops polling:

- queue depth may grow
- latency may remain empty
- trades will never appear on the slave

## What the page is trying to show you

### Pair card

Shows:

- who is the master
- who is the slave
- whether the pair is active or paused
- lot multiplier
- whether SL and TP are copied

### Latency badge

Shows how quickly the slave is receiving and acknowledging copy events.

- **Fast** = good
- **Normal** = acceptable
- **Slow** = the chain is delayed
- **No data** = no successful round-trip has been measured yet

### Queue stats

This tells you whether events are building up faster than the slave can process them.

If queue depth stays high, the slave side needs attention.

## How to think about failures

### If the UI cannot load pairs

Usually means:

- backend is unreachable
- endpoint is missing
- payload/response shape does not match the contract

### If the UI loads pairs but trades do not copy

Usually means:

- the slave EA is not configured as a slave
- the slave is not polling the queue
- the master is not pushing live updates
- the queue is blocked or not being acknowledged

### If closes do not propagate

Usually means:

- the server did not generate the `CLOSE` event
- the slave did not process the `CLOSE` event
- the ticket mapping on the slave side is broken after restart/reconnect

## Best order to check things

1. Confirm server is up.
2. Confirm frontend can reach it.
3. Confirm both accounts are known.
4. Confirm pair exists.
5. Confirm slave EA role and master ID.
6. Open one small test trade on master.
7. Watch queue stats.
8. Watch latency.
9. Confirm the trade appears on slave.
10. Close the master trade and confirm slave closes too.

## What matters most right now

Right now, the most important thing to verify is that the frontend and websocket can actually reach the backend, because repeated socket connection errors mean the system can fail before the pair flow is even fully exercised.