import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { loginTutor } from '@/lib/binding/actions/tutorActions';
import { writeStoredSession, resetSessionHeartbeat } from '@/utils/session';
import type { StoredSession } from '@/types/session';
import { SiteLayout } from '@/components/layout/SiteLayout';

export default function TutorLoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = await loginTutor({
        email: email.trim().toLowerCase(),
        password
      });
      const session: StoredSession = {
        accessToken: payload.session?.accessToken,
        accessTokenExpiresAt: payload.session?.accessTokenExpiresAt,
        refreshToken: payload.session?.refreshToken,
        refreshTokenExpiresAt: payload.session?.refreshTokenExpiresAt,
        sessionId: payload.session?.sessionId,
        role: payload.user?.role,
        userId: payload.user?.id,
        email: payload.user?.email,
        fullName: payload.user?.fullName
      };
      writeStoredSession(session);
      resetSessionHeartbeat();
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: payload.user?.id,
          email: payload.user?.email,
          fullName: payload.user?.fullName,
          role: payload.user?.role,
          tutorId: payload.user?.tutorId,
          displayName: payload.user?.displayName
        })
      );
      localStorage.setItem('isAuthenticated', 'true');
      toast({ title: 'Welcome back', description: 'Tutor session active' });
      setLocation('/tutors');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error?.message ?? 'Invalid credentials'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SiteLayout>
      <div className="max-w-lg mx-auto py-10 px-4">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Tutor login</CardTitle>
            <p className="text-sm text-muted-foreground">Access your courses, enrollments, and learner progress.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Login as tutor'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Admins can also use this login; access is role-gated on the server.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
