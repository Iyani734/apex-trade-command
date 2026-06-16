/**
 * Themed tooltip used across all analytics charts.
 * Replaces the default white Recharts box.
 *
 * Props are typed loosely because recharts' generic TooltipProps don't
 * expose `payload`/`label` cleanly when used as a custom content component.
 */
interface TooltipPayloadItem {
  value?: number | string;
  name?: string | number;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueFormatter?: (v: number, name: string) => string;
  labelFormatter?: (l: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 backdrop-blur-md px-3 py-2 shadow-xl text-xs">
      {label !== undefined && (
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-mono">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 font-mono">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color || 'hsl(var(--primary))' }}
          />
          <span className="text-muted-foreground">{String(p.name ?? '')}:</span>
          <span className="font-semibold text-foreground">
            {valueFormatter
              ? valueFormatter(Number(p.value), String(p.name ?? ''))
              : String(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
