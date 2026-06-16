import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import type { TimeBucket } from '@/lib/analytics';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  title: string;
  data: TimeBucket[];
  metric?: 'profit' | 'trades';
  height?: number;
  xLabel?: (k: string) => string;
  color?: string;
}

export function TimeBarChart({ title, data, metric = 'profit', height = 220, xLabel, color = 'hsl(var(--primary))' }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const chartMargin = isMobile ? { top: 8, right: 4, bottom: 0, left: -18 } : { top: 8, right: 12, bottom: 0, left: 4 };

  return (
    <div className="glass-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">{title}</h3>
      <ResponsiveContainer width="100%" height={isMobile ? Math.min(height, 210) : height}>
        <BarChart data={data} margin={chartMargin} onMouseLeave={() => setHoverIdx(null)}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="key"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={xLabel}
          />
          <YAxis
            width={isMobile ? 46 : 60}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v) => metric === 'profit' ? `$${v}` : String(v)}
          />
          <Tooltip
            cursor={false}
            content={
              <ChartTooltip
                valueFormatter={(v, name) => name === 'profit' ? `${v >= 0 ? '+' : ''}$${v.toFixed(2)}` : String(v)}
              />
            }
          />
          <Bar
            dataKey={metric}
            radius={[4, 4, 0, 0]}
            onMouseEnter={(_, i) => setHoverIdx(i)}
            isAnimationActive={false}
          >
            {data.map((d, i) => {
              const positive = d.profit >= 0;
              const base = metric === 'profit'
                ? (positive ? 'hsl(var(--success))' : 'hsl(var(--destructive))')
                : color;
              return (
                <Cell
                  key={i}
                  fill={base}
                  fillOpacity={hoverIdx === null ? 0.85 : hoverIdx === i ? 1 : 0.5}
                  style={{ transition: 'fill-opacity 150ms ease' }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
