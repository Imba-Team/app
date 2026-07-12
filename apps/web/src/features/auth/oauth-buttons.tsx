import { Button } from '@/components/ui/button';

// OAuth must hit the real backend origin (not the Vite proxy) because the
// browser needs to follow the 302 chain out to Google and back.
// VITE_BACKEND_ORIGIN → 'http://localhost:9090' in dev.
const BACKEND_ORIGIN =
  import.meta.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:9090';

export function OAuthButtons() {
  const startGoogle = () => {
    window.location.href = `${BACKEND_ORIGIN}/auth/google`;
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" onClick={startGoogle}>
        Continue with Google
      </Button>
      {/* Apple OAuth ships in Sprint 1b (backend AppleStrategy pending). */}
    </div>
  );
}
