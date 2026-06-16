import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, delay = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card-hover p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className={`kpi-value mt-1 ${
            trend === 'up' ? 'profit-positive' : trend === 'down' ? 'profit-negative' : 'text-foreground'
          }`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-xs mt-1 font-mono ${
              trend === 'up' ? 'profit-positive' : trend === 'down' ? 'profit-negative' : 'text-muted-foreground'
            }`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}
