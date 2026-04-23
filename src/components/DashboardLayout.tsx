import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from './BottomNav';

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setOnboardingComplete(data?.onboarding_complete === true);
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
  
  if (!onboardingComplete && location.state?.fromOnboarding !== true) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="app-container">
        <main className="pb-24 min-h-screen">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}