import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  BookOpen,
  Copy,
  Users,
  Terminal,
  Settings,
  Link2,
  Bell,
  Calendar,
  Newspaper,
  Calculator,
  Database,
  Activity,
  // Target,
  // GitBranch,
  Users as UsersIcon,
  LifeBuoy,
  BadgeDollarSign,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTradingStore } from "@/store/tradingStore";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Trades", url: "/trades", icon: TrendingUp },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "News", url: "/news", icon: Newspaper },
  { title: "Journal", url: "/journal", icon: BookOpen },
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Calculator", url: "/calculator", icon: Calculator },
];

const insightsNav = [
  { title: "Strength Meter", url: "/strength", icon: Activity },
  // { title: "Correlation", url: "/correlation", icon: GitBranch },
  { title: "Sentiment", url: "/sentiment", icon: UsersIcon },
  // { title: "Plan & Goals", url: "/plan", icon: Target },
];

const systemNav = [
  { title: "Copy Trading", url: "/copy", icon: Copy },
  { title: "Accounts", url: "/accounts", icon: Users },
  { title: "Data & Export", url: "/data", icon: Database },
  { title: "Commands", url: "/commands", icon: Terminal },
  { title: "Support", url: "/support", icon: LifeBuoy },
  { title: "Pricing", url: "/pricing", icon: BadgeDollarSign },
  { title: "Settings", url: "/settings", icon: Settings },
];

/*
 * Ads are disabled for now. Keep this sidebar broker ad code parked for later.
const EXNESS_SIDEBAR_AD_URL = 'https://one.exnessonelink.com/intl/en/a/fhc3i952hn';
const SIDEBAR_AD_ROTATE_MS = 3 * 60 * 1000;
const exnessSidebarAds = [
  {
    src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Take_control_1200x1200.png',
    alt: 'Exness take control',
  },
  {
    src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Choose_Better_Forex_Conditions_v2320x480px.png',
    alt: 'Exness better forex conditions',
  },
  {
    src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Trade_Gold_v2_628x1200px.png',
    alt: 'Exness trade gold',
  },
  {
    src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_GLOBAL_GOOGLE_C1_PRODUCTSUP_C2_T1_INSTANTW_SMOOTHEST_T2_PERFORMANCE_D-3-13_STATIC_320x480.jpg',
    alt: 'Exness instant withdrawals',
  },
  {
    src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_GLOBAL_GOOGLE_C1_PRODUCTSUP_C2_T1_NBP_NEVERZERO_T2_PERFORMANCE_D-3-13_STATIC_628x1200.jpg',
    alt: 'Exness never zero',
  },
  {
    src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_MENA_GOOGLE_C1_BB2_C2_T1_FSECURITY_BADBROKERS_T2_CONSIDERATION_D-6-3_STATIC_320x480.jpg',
    alt: 'Exness account security',
  },
  {
    src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_GLOBAL_GOOGLE_C1_PRODUCTSUP_C2_T1_ZEROSTOP_ZEROSOL_T2_PERFORMANCE_D-3-13_STATIC_320x480.jpg',
    alt: 'Exness zero stop out',
  },
  {
    src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_GLOBAL_C1_PRODUCTSUP_C2_T1_EXECUTION_3X_T2_PERFORMANCE_D-3-13_STATIC_320x480_Q4_2025.jpg',
    alt: 'Exness fast execution',
  },
] as const;

function pickInitialSidebarAd() {
  try {
    const stored = sessionStorage.getItem('forexAnalyzer.sidebarAdIndex');
    if (stored) {
      const parsed = Number(stored);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < exnessSidebarAds.length) return parsed;
    }
    const next = Math.floor(Math.random() * exnessSidebarAds.length);
    sessionStorage.setItem('forexAnalyzer.sidebarAdIndex', String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * exnessSidebarAds.length);
  }
}

function SidebarBrokerAd({ collapsed }: { collapsed: boolean }) {
  const [index, setIndex] = useState(pickInitialSidebarAd);
  const ad = exnessSidebarAds[index] || exnessSidebarAds[0];

  useEffect(() => {
    if (collapsed) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % exnessSidebarAds.length;
        try {
          sessionStorage.setItem('forexAnalyzer.sidebarAdIndex', String(next));
        } catch {}
        return next;
      });
    }, SIDEBAR_AD_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [collapsed]);

  if (collapsed) return null;

  return (
    <a
      href={EXNESS_SIDEBAR_AD_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Open Exness broker offer"
      className="block h-full max-h-[22rem] min-h-0 w-full max-w-[15rem] overflow-hidden rounded-lg transition-opacity hover:opacity-95"
    >
      <img
        key={ad.src}
        src={ad.src}
        alt={ad.alt}
        referrerPolicy="no-referrer"
        className="h-full w-full animate-in fade-in slide-in-from-right-3 duration-700 object-cover object-top"
      />
    </a>
  );
}
*/

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { supportAgent, license } = useAuth();
  const collapsed = state === "collapsed";
  const accounts = useTradingStore((s) => s.accounts);
  const activeId = useTradingStore((s) => s.activeAccountId);
  const activeOnline =
    accounts.find((a) => a.id === activeId)?.status === "ONLINE";
  const freeAccountLimit = license?.freeAccountLimit || 3;
  const needsPaidForNextAccount = Boolean(!license?.paid && accounts.length >= freeAccountLimit);
  const connectLabel = needsPaidForNextAccount ? "Connect Paid Version" : "Connect Account";

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const resolvedSystemNav = systemNav.map((item) =>
    item.title === "Support"
      ? { ...item, url: supportAgent ? "/support-admin" : "/support" }
      : item
  );

  const renderItem = (item: {
    title: string;
    url: string;
    icon: typeof LayoutDashboard;
  }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        tooltip={collapsed ? item.title : undefined}
        className={cn(collapsed && "mx-auto h-10 w-10 p-0")}
      >
        <NavLink
          to={item.url}
          end
          onClick={closeMobileSidebar}
          className={cn(
            "flex items-center transition-colors hover:bg-secondary/50",
            collapsed
              ? "mx-auto h-10 w-10 justify-center rounded-xl p-0"
              : "px-2"
          )}
          activeClassName={
            collapsed
              ? "bg-primary/10 text-primary"
              : "bg-primary/10 text-primary border-l-2 border-primary"
          }
        >
          <item.icon className={cn(collapsed ? "h-5 w-5" : "mr-2 h-4 w-4")} />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className={cn("p-4", collapsed && "px-0")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>

          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold tracking-tight text-foreground">
                ForexAnalyzer
              </h1>
              <p className="text-[10px] text-primary font-mono uppercase tracking-widest">
                Pro
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Trading
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{mainNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Insights
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{insightsNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              System
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{resolvedSystemNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("p-3", collapsed && "items-center px-0")}>
        {collapsed ? (
          <NavLink
            to="/connect"
            onClick={closeMobileSidebar}
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary/50 hover:text-primary transition-colors"
            activeClassName="bg-primary/10 text-primary"
            title={connectLabel}
          >
            <Link2 className="h-5 w-5" />
          </NavLink>
        ) : (
          <NavLink
            to="/connect"
            onClick={closeMobileSidebar}
            className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
            activeClassName="bg-primary/20 text-primary"
          >
            <Link2 className="w-4 h-4" />
            {connectLabel}
          </NavLink>
        )}

        <div className={cn("flex items-center gap-2 mt-2", collapsed && "justify-center")}>
          <div
            className={`w-2 h-2 rounded-full ${
              activeOnline ? "bg-success animate-pulse-glow" : "bg-destructive"
            }`}
          />
          {!collapsed && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {activeOnline ? "LIVE" : "OFFLINE"}
            </span>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
