import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type ProfileRoleRow = {
  role: 'admin' | 'user';
};

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const verifyAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!session) {
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle<ProfileRoleRow>();

      if (!isMounted) return;

      if (requireAdmin && (!profile || profile.role !== 'admin')) {
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }

      setIsAuthorized(!profileError);
      setIsChecking(false);
    };

    void verifyAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) return;

      if (!session) {
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle<ProfileRoleRow>();

      if (!isMounted) return;

      if (requireAdmin && (!profile || profile.role !== 'admin')) {
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }

      setIsAuthorized(!error);
      setIsChecking(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [requireAdmin]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-400" />
          <p className="text-sm text-slate-300">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    if (requireAdmin) {
      return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
