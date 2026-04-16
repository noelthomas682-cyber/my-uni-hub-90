import { useNavigate, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Users, Megaphone, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { icon: Home, label: 'Home', path: '/home' },
  { icon: CalendarDays, label: 'Plan', path: '/plan' },
  { icon: Users, label: 'Social', path: '/social' },
  { icon: Megaphone, label: 'Bulletin', path: '/bulletin' },
  { icon: User, label: 'Me', path: '/me' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/80 backdrop-blur-xl border-t border-border/40 z-50 safe-area-bottom">
      <div className="flex justify-around py-2 px-1">
        {tabs.map((tab) => {
          const active = location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px]",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {active && (
                <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
