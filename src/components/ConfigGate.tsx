"use client";
import { configMissing } from "@/lib/data";

/** Blocks the app with a clear message if a production build has no Supabase configuration. */
export default function ConfigGate({ children }: { children: React.ReactNode }) {
  if (!configMissing) return <>{children}</>;
  return (
    <div className="page">
      <h1>Setup required</h1>
      <p className="sub">This deployment is missing its backend configuration.</p>
      <div className="panel">
        Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your hosting
        environment, then redeploy.
      </div>
    </div>
  );
}
