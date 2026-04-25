App · TSX
Copy

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import DashboardLayout from "./components/DashboardLayout";
import HomePage from "./pages/HomePage";
import PlanPage from "./pages/PlanPage";
import SocialPage from "./pages/SocialPage";
import BulletinPage from "./pages/BulletinPage";
import MePage from "./pages/MePage";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import LmsSettings from "./pages/LmsSettings";
import ChatPage from "./pages/ChatPage";
import TeamHubPage from "./pages/TeamHubPage";
import TeamHubPage from "./pages/TeamHubPage";
 
const queryClient = new QueryClient();
 
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<DashboardLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/social" element={<SocialPage />} />
              <Route path="/team/:teamId" element={<TeamHubPage />} />
              <Route path="/bulletin" element={<BulletinPage />} />
              <Route path="/me" element={<MePage />} />
              <Route path="/lms-settings" element={<LmsSettings />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/team/:teamId" element={<TeamHubPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
 
export default App;