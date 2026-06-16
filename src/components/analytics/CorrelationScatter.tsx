import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import type { CorrelationPoint } from '@/lib/analytics';

interface Props {
  title: string;
  data: CorrelationPoint[];
  correlation: number;
  xKey: 'x' | 'y' | 'profit';
  yKey: 'x' | 'y' | 'profit';
  xLabel: string;
  yLabel: string;
}

const corrColor = (c: number) => {
  const a = Math.abs(c);
  if (a > 0.7) return 'hsl(var(--success))';
  if (a > 0.4) return 'hsl(var(--warning))';
  return 'hsl(var(--muted-foreground))';
};

export function CorrelationScatter({ title, data, correlation, xKey, yKey, xLabel, yLabel }: Props) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">r =</span>
          <span className="font-mono text-sm font-bold" style={{ color: corrColor(correlation) }}>
            {correlation.toFixed(3)}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis type="number" dataKey={xKey} name={xLabel} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis type="number" dataKey={yKey} name={yLabel} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <ZAxis range={[40, 40]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltip />} />
          <Scatter
            data={data}
            fill="hsl(var(--primary))"
            fillOpacity={0.6}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
