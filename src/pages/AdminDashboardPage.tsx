import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AdminDashboardPage() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-300">Admin panel</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Dashboard</h1>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Question bank</p>
            <h2 className="mt-3 text-3xl font-bold text-white">128</h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Active learners</p>
            <h2 className="mt-3 text-3xl font-bold text-white">42</h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Average score</p>
            <h2 className="mt-3 text-3xl font-bold text-white">87%</h2>
          </div>
        </div>
      </div>
    </div>
  );
}
