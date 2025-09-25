import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { LeadPilotLogo } from "@/components/ui/LeadPilotLogo";

export function Sidebar() {
  const [location] = useLocation();
  
  const { data: usage } = useQuery<{tier: string, current_usage: number, limit: number, remaining: number}>({
    queryKey: ["http://localhost:8800/api/subscriptions/usage"],
  });

  const navItems = [
    { href: "/", label: "Dashboard", icon: "fas fa-chart-pie" },
    { href: "/leads", label: "Leads", icon: "fas fa-users" },
    { href: "/email-campaigns", label: "Email Campaigns", icon: "fas fa-envelope" },
    { href: "/pricing", label: "Pricing", icon: "fas fa-credit-card" },
    { href: "/activity", label: "Activity Logs", icon: "fas fa-history" },
  ];

  return (
    <aside
      className="sidebar bg-white/80 border-r border-border p-6 shadow-xl"
      style={{ boxShadow: '0 0 32px 0 rgba(0, 212, 255, 0.25), 0 2px 8px rgba(0,0,0,0.08)', backdropFilter: 'blur(12px)' }}
      data-testid="sidebar"
    >
      <div className="flex items-center gap-4 mb-10">
        <LeadPilotLogo size={40} />
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <a
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-base font-semibold rounded-lg transition-all duration-150",
                location === item.href
                  ? "bg-cyan-200/80 text-cyan-900 shadow-md ring-2 ring-cyan-400"
                  : "text-gray-500 hover:text-cyan-700 hover:bg-cyan-100/60 hover:shadow"
              )}
              style={location === item.href ? { boxShadow: '0 0 12px 0 rgba(0, 212, 255, 0.25)' } : {}}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <i className={`${item.icon} text-lg`}></i>
              {item.label}
            </a>
          </Link>
        ))}
      </nav>

      {usage && (
        <div className="mt-10 p-5 bg-cyan-50 rounded-xl shadow" style={{ boxShadow: '0 0 16px 0 rgba(0, 212, 255, 0.15)' }} data-testid="usage-widget">
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-bold capitalize text-cyan-700" data-testid="text-plan-name">
              {usage.tier} Plan
            </span>
            <span className="text-xs text-cyan-900 font-semibold" data-testid="text-usage-current">
              {usage.current_usage}/{usage.limit}
            </span>
          </div>
          <div className="w-full bg-cyan-100 rounded-full h-2">
            <div 
              className="bg-cyan-400 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(100, (usage.current_usage / usage.limit) * 100)}%` }}
              data-testid="progress-usage"
            ></div>
          </div>
          <p className="text-xs text-cyan-700 mt-2 font-medium" data-testid="text-remaining-leads">
            {usage.remaining} leads remaining this month
          </p>
        </div>
      )}
    </aside>
  );
}
