import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Mail, Lock, User, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1].includes('.')) return null;
  return parts[1].toLowerCase();
}

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detectedUni, setDetectedUni] = useState<{ name: string; domain: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [domainInvalid, setDomainInvalid] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;

  const lookupDomain = useCallback(async (emailValue: string) => {
    const domain = extractDomain(emailValue);
    if (!domain) {
      setDetectedUni(null);
      setDomainInvalid(false);
      setLookupDone(false);
      return;
    }
    setLookingUp(true);
    setDetectedUni(null);
    setDomainInvalid(false);
    const { data } = await supabase
      .from('university_registry')
      .select('name, domain')
      .eq('domain', domain)
      .eq('is_active', true)
      .maybeSingle();
    setLookingUp(false);
    setLookupDone(true);
    if (data) {
      setDetectedUni({ name: data.name, domain: data.domain });
      setDomainInvalid(false);
    } else {
      setDetectedUni(null);
      setDomainInvalid(true);
    }
  }, []);

  useEffect(() => {
    if (!isSignUp) return;
    const domain = extractDomain(email);
    if (!domain) {
      setDetectedUni(null);
      setDomainInvalid(false);
      setLookupDone(false);
      return;
    }
    const timer = setTimeout(() => lookupDomain(email), 600);
    return () => clearTimeout(timer);
  }, [email, isSignUp, lookupDomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignUp && !detectedUni) {
      toast({
        title: 'University email required',
        description: domainInvalid
          ? "We don't recognise your university yet. Contact us to get added."
          : 'Please enter your full university email address.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = isSignUp
      ? await signUp(email, password, fullName)
      : await signIn(email, password);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setSubmitting(false);
    } else if (isSignUp) {
      toast({ title: 'Check your email', description: 'We sent you a confirmation link.' });
      navigate('/onboarding');
    } else {
      // Sign in success — navigate immediately
      navigate('/home', { replace: true });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Rute</h1>
            <p className="text-sm text-muted-foreground">Student Schedule Hub</p>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{isSignUp ? 'Create Account' : 'Welcome Back'}</CardTitle>
            <CardDescription>
              {isSignUp ? 'Sign up with your university email' : 'Sign in to access your schedule'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">University Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                  {isSignUp && lookingUp && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                  {isSignUp && detectedUni && !lookingUp && (
                    <CheckCircle2 className="absolute right-3 top-3 w-4 h-4 text-primary" />
                  )}
                </div>

                {isSignUp && detectedUni && (
                  <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <p className="text-xs text-primary font-medium">✓ {detectedUni.name}</p>
                  </div>
                )}
                {isSignUp && domainInvalid && !lookingUp && lookupDone && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                    <p className="text-xs text-destructive">
                      We don't recognise this university yet.{' '}
                      <a href="mailto:hello@rute.app" className="underline">Contact us to get added.</a>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || (isSignUp && (lookingUp || !detectedUni))}
              >
                {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </Button>

              {isSignUp && !detectedUni && !domainInvalid && !lookingUp && (
                <p className="text-xs text-muted-foreground text-center">
                  Enter your university email to continue
                </p>
              )}
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setDetectedUni(null);
                  setDomainInvalid(false);
                  setLookupDone(false);
                }}
                className="text-sm text-primary hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}