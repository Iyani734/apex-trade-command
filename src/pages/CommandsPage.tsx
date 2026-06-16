import { motion } from 'framer-motion';
import { useTradingStore } from '@/store/tradingStore';
import { CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { confirmDialog } from '@/components/ConfirmDialog';

export default function CommandsPage() {
  const commands = useTradingStore((s) => s.commands);
  const clearCommands = useTradingStore((s) => s.clearCommands);
  const deleteCommand = useTradingStore((s) => s.deleteCommand);
  const account = useTradingStore((s) => s.accounts.find((a) => a.id === s.activeAccountId));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Commands sent to <span className="text-primary font-mono">{account?.alias || '— no account selected —'}</span>
            {' · '}{commands.length} entr{commands.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        {commands.length > 0 && (
          <button
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Clear command history?',
                description: `This removes all ${commands.length} entries for ${account?.alias}. Other accounts are unaffected.`,
                destructive: true,
                confirmLabel: 'Clear',
              });
              if (ok) clearCommands();
            }}
            className="px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-colors"
          >
            Clear all
          </button>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
        <div className="space-y-3 p-3 md:hidden">
          {commands.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No commands yet - they'll be saved here automatically.
            </div>
          )}
          {commands.map((cmd) => (
            <div key={cmd.id} className="rounded-lg border border-border/40 bg-secondary/15 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {cmd.status === 'success' ? <CheckCircle className="w-4 h-4 text-success" /> :
                     cmd.status === 'failed' ? <XCircle className="w-4 h-4 text-destructive" /> :
                     <Clock className="w-4 h-4 text-warning animate-pulse" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-semibold">{cmd.type}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(cmd.sentAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteCommand(cmd.id)}
                  title="Delete entry"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-3 rounded-md bg-background/40 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">Payload</div>
                <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                  {JSON.stringify(cmd.payload, null, 2)}
                </pre>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono">{cmd.latency ? `${cmd.latency}ms` : '-'}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-xs text-muted-foreground/60 uppercase tracking-wider bg-secondary/20">
              <th className="text-left py-3 px-4 w-12">Status</th>
              <th className="text-left py-3 px-4">Command</th>
              <th className="text-left py-3 px-4">Payload</th>
              <th className="text-right py-3 px-4">Latency</th>
              <th className="text-right py-3 px-4">Sent At</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {commands.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No commands yet — they'll be saved here automatically.</td></tr>
            )}
            {commands.map((cmd) => (
              <tr key={cmd.id} className="border-t border-border/30 hover:bg-secondary/10 transition-colors">
                <td className="py-3 px-4">
                  {cmd.status === 'success' ? <CheckCircle className="w-4 h-4 text-success" /> :
                   cmd.status === 'failed' ? <XCircle className="w-4 h-4 text-destructive" /> :
                   <Clock className="w-4 h-4 text-warning animate-pulse" />}
                </td>
                <td className="py-3 px-4 font-mono font-semibold">{cmd.type}</td>
                <td className="py-3 px-4 font-mono text-xs text-muted-foreground truncate max-w-md">{JSON.stringify(cmd.payload)}</td>
                <td className="py-3 px-4 text-right font-mono">{cmd.latency ? `${cmd.latency}ms` : '—'}</td>
                <td className="py-3 px-4 text-right text-muted-foreground text-xs">{new Date(cmd.sentAt).toLocaleString()}</td>
                <td className="py-3 px-2">
                  <button
                    onClick={() => deleteCommand(cmd.id)}
                    title="Delete entry"
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </motion.div>
    </div>
  );
}
