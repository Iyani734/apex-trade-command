import { useState } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, RefreshCw, User as UserIcon, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockMode } from '@/hooks/useMockData';
import { userPrefs } from '@/lib/userPrefs';
import { toast } from 'sonner';
import { EASettingsPanel } from '@/components/settings/EASettingsPanel';
import { useAuth } from '@/lib/auth';


export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mockOn, setMockOn] = useState(mockMode.isEnabled());
  const [user, setUser] = useState(() => userPrefs.getUser());
  const [nick, setNick] = useState(user?.nickname || '');

  const handleToggleMock = () => {
    const next = !mockOn;
    mockMode.setEnabled(next);
    setMockOn(next);
    toast.success(`Demo data ${next ? 'enabled' : 'disabled'} — reloading…`);
    setTimeout(() => window.location.reload(), 700);
  };

  const handleSaveNick = () => {
    if (!user || !nick.trim()) return;
    const updated = { ...user, nickname: nick.trim() };
    userPrefs.setUser(updated);
    setUser(updated);
    toast.success('Nickname updated');
  };

  const handleLogout = async () => {
    await signOut();
    userPrefs.clearUser();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage profile, risk, sessions and notifications</p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold">Profile</h3>
        </div>
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border border-border/50"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-lg">
                  {user.nickname.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Nickname</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={handleSaveNick}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 text-xs text-destructive hover:text-destructive/80"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-muted-foreground">You're not signed in.</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Sign in
            </button>
          </div>
        )}
      </motion.div>

      {/* Developer / Demo mode */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-warning" />
          </div>
          <h3 className="font-semibold">Demo Mode</h3>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm">Show sample accounts and trades</p>
            <p className="text-xs text-muted-foreground max-w-xl">
              When ON, the dashboard displays demo data so you can explore the UI without connecting your EA.
              Turn OFF to show only data from your real connected MetaTrader accounts.
            </p>
          </div>
          <button
            onClick={handleToggleMock}
            className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${mockOn ? 'bg-primary' : 'bg-secondary'}`}
            aria-pressed={mockOn}
          >
            <div className={`w-5 h-5 rounded-full bg-background absolute top-0.5 transition-all ${mockOn ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        {mockOn && (
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Reload to apply
          </button>
        )}
      </motion.div>

      <EASettingsPanel />
    </div>
  );
}
