import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { emoji: '🏠', label: 'HOME', path: '/home' },
  { emoji: '📅', label: 'PLAN', path: '/plan' },
  { emoji: '👥', label: 'SOCIAL', path: '/social' },
  { emoji: '📌', label: 'BULLETIN', path: '/bulletin' },
  { emoji: '⚙️', label: 'ME', path: '/me' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 z-50 safe-area-bottom">
      <div className="flex justify-around py-2 px-1">
        {tabs.map((tab) => {
          const active = location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px]',
                active ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              )}
            >
              <span className="text-xl leading-none">{tab.emoji}</span>
              <span className={cn(
                'text-[9px] font-bold tracking-wider mt-0.5',
                active ? 'text-primary' : 'text-muted-foreground'
              )}>
                {tab.label}
              </span>
              {active && (
                <div className="w-4 h-0.5 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}