import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
  accent?: 'primary' | 'accent' | 'success' | 'destructive' | 'warning';
}

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
};

export function MetricKPI({ title, value, subtitle, icon: Icon, trend, delay = 0, accent = 'primary' }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="glass-card-hover p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{title}</p>
          <p className={cn(
            'font-mono text-lg font-bold mt-1 tracking-tight truncate',
            trend === 'up' && 'profit-positive',
            trend === 'down' && 'profit-negative',
            !trend && 'text-foreground'
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] mt-0.5 font-mono text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', ACCENT[accent])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
}
