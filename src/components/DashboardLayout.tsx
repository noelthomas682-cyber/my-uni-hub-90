import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from './BottomNav';
import FeedbackButton from './FeedbackButton';

// Cache onboarding status in memory so it survives re-renders
const onboardingCache = new Map<string, boolean>();

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    user ? (onboardingCache.get(user.id) ?? null) : null
  );

  useEffect(() => {
    if (!user) return;

    // Already cached — no DB call needed
    if (onboardingCache.has(user.id)) {
      setOnboardingComplete(onboardingCache.get(user.id)!);
      return;
    }

    supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const complete = data?.onboarding_complete === true;
        onboardingCache.set(user.id, complete);
        setOnboardingComplete(complete);
      });
  }, [user]);

  if (loading || (user && onboardingComplete === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!onboardingComplete) return <Navigate to="/onboarding" replace />;

  return (
    <div className="bg-background min-h-screen">
      <div className="app-container">
        <main className="pb-24 min-h-screen">
          <Outlet />
        </main>
        <BottomNav />
        <FeedbackButton />
      </div>
    </div>
  );
}