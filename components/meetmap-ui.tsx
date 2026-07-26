"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Session = Awaited<
  ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>["auth"]["getSession"]>
>["data"]["session"];

type PlanRecord = {
  id: string;
  venue_name: string;
  activity_type: string;
  scheduled_at: string;
  description: string | null;
  spots_total: number;
  spots_filled: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
};

const activityOptions = [
  "coffee",
  "gaming",
  "study",
  "sports",
  "food",
  "hiking",
  "music",
  "networking",
];

const inputClass =
  "h-11 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 dark:bg-[var(--card)]";

// Icon components
function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17.9 17.9 0 0 1-3.2 4.1M6.1 6.1A17.7 17.7 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 3.4-.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-3l-3.9-3c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.2 6.8 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.9c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9-.7 0-1.9-.9-3.1-.8-1.6 0-3 .9-3.9 2.4-1.6 2.9-.4 7.1 1.2 9.4.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8ZM14 5.4c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z" />
    </svg>
  );
}

function Sun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function Moon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function MeetMapApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [activityType, setActivityType] = useState(activityOptions[0]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [spotsTotal, setSpotsTotal] = useState(4);
  const [description, setDescription] = useState("");
  const [placeInfo, setPlaceInfo] = useState<{
    placeId: string;
    venueName: string;
    lat: number;
    lng: number;
  } | null>(null);
  const venueInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setLoading(false);
      setAuthMessage("Add your Supabase URL and anon key to continue.");
      return;
    }

    // Initialize dark mode from localStorage
    const storedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = storedTheme ? storedTheme === "dark" : prefersDark;
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const authSubscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => authSubscription.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchPlans = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        setFormMessage(error.message);
        return;
      }

      setPlans(data ?? []);
    };

    fetchPlans();
  }, [session]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !venueInputRef.current) return;

    const loader = new (Loader as any)({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    loader.load().then(() => {
      if (!venueInputRef.current) return;

      const googleMaps = (window as Window & typeof globalThis & { google?: any }).google;
      if (!googleMaps?.maps?.places) return;

      const autocomplete = new googleMaps.maps.places.Autocomplete(
        venueInputRef.current,
        {
          types: ["establishment"],
          fields: ["place_id", "name", "geometry", "formatted_address"],
        }
      );

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const location = place.geometry?.location;

        if (!location) return;

        const nextPlace = {
          placeId: place.place_id ?? "",
          venueName: place.name ?? venueInputRef.current?.value ?? "",
          lat: location.lat(),
          lng: location.lng(),
        };

        setPlaceInfo(nextPlace);
        setVenueName(nextPlace.venueName);
      });
    });
  }, []);

  const ensureProfile = async (supabase: NonNullable<ReturnType<typeof getSupabaseClient>>, userId: string) => {
    const username = authEmail.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 20) || "meetmap-user";

    await supabase.from("profiles").upsert(
      {
        id: userId,
        username,
        bio: "New to MeetMap",
      },
      { onConflict: "id" }
    );
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthMessage("Missing Supabase environment variables.");
      return;
    }

    setLoading(true);

    const { data, error } =
      authMode === "signup"
        ? await supabase.auth.signUp({ email: authEmail, password: authPassword })
        : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });

    if (error) {
      setAuthMessage(error.message);
      setLoading(false);
      return;
    }

    if (authMode === "signup" && data.user && !data.session) {
      setAuthMessage("Check your inbox to confirm the email before signing in.");
      setLoading(false);
      return;
    }

    if (data.session?.user?.id) {
      await ensureProfile(supabase, data.session.user.id);
    }

    setSession(data.session);
    setLoading(false);
  };

  const handleCreatePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    const user = session?.user;

    if (!supabase || !user) {
      setFormMessage("You need to sign in before creating a plan.");
      return;
    }

    if (!venueName || !scheduledAt) {
      setFormMessage("Choose a venue name and a date/time before saving your plan.");
      return;
    }

    setSubmitting(true);
    setFormMessage(null);

    const { data, error } = await supabase
      .from("plans")
      .insert({
        creator_id: user.id,
        venue_name: venueName,
        venue_place_id: placeInfo?.placeId ?? null,
        latitude: placeInfo?.lat ?? null,
        longitude: placeInfo?.lng ?? null,
        activity_type: activityType,
        scheduled_at: new Date(scheduledAt).toISOString(),
        spots_total: spotsTotal,
        spots_filled: 1,
        description,
        status: "open",
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setFormMessage(error.message);
      return;
    }

    setFormMessage("Plan created — it is now visible in your feed.");
    setVenueName("");
    setActivityType(activityOptions[0]);
    setScheduledAt("");
    setSpotsTotal(4);
    setDescription("");
    setPlaceInfo(null);
    if (venueInputRef.current) venueInputRef.current.value = "";
    setPlans((current) => [data, ...current]);
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  };

  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem("theme", newIsDark ? "dark" : "light");
    if (newIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">Loading MeetMap…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthPage authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword} showPassword={showPassword} setShowPassword={setShowPassword} handleAuth={handleAuth} authMessage={authMessage} isDark={isDark} toggleDarkMode={toggleDarkMode} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 text-[var(--primary-foreground)] font-bold text-lg">
              M
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">MeetMap</h1>
              <p className="text-xs text-[var(--muted-foreground)]">Your local plans</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 transition hover:bg-[var(--muted)]"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <Sun />
              ) : (
                <Moon />
              )}
            </button>
            <button
              onClick={handleSignOut}
              type="button"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
              What's your next move?
            </h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              Create a plan, share the details, and let your community join.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* Create plan form */}
            <form onSubmit={handleCreatePlan} className="space-y-6">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-[var(--foreground)]">Create a plan</h3>
                  <p className="mt-2 text-[var(--muted-foreground)]">
                    Tell people about your meetup
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="venue" className="block text-sm font-semibold text-[var(--foreground)]">
                      Venue search
                    </label>
                    <input
                      ref={venueInputRef}
                      id="venue"
                      type="text"
                      className={`mt-2 ${inputClass}`}
                      placeholder="Search for a cafe, park, or venue"
                      value={venueName}
                      onChange={(event) => setVenueName(event.target.value)}
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="activity" className="block text-sm font-semibold text-[var(--foreground)]">
                        Activity type
                      </label>
                      <select
                        id="activity"
                        className={`mt-2 ${inputClass}`}
                        value={activityType}
                        onChange={(event) => setActivityType(event.target.value)}
                      >
                        {activityOptions.map((option) => (
                          <option key={option} value={option}>
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="spots" className="block text-sm font-semibold text-[var(--foreground)]">
                        Total spots
                      </label>
                      <input
                        id="spots"
                        type="number"
                        min={1}
                        max={20}
                        className={`mt-2 ${inputClass}`}
                        value={spotsTotal}
                        onChange={(event) => setSpotsTotal(Number(event.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="datetime" className="block text-sm font-semibold text-[var(--foreground)]">
                      Date and time
                    </label>
                    <input
                      id="datetime"
                      type="datetime-local"
                      className={`mt-2 ${inputClass}`}
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-[var(--foreground)]">
                      Tell us about it
                    </label>
                    <textarea
                      id="description"
                      className={`mt-2 min-h-32 resize-none ${inputClass}`}
                      placeholder="What's the vibe? What should people bring? Any details they should know?"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                </div>

                {formMessage && (
                  <div className={`mt-6 rounded-lg p-4 text-sm font-medium ${
                    formMessage.includes("error") || formMessage.includes("Error")
                      ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                      : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  }`}>
                    {formMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-8 w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create plan"}
                </button>
              </div>
            </form>

            {/* Plans feed sidebar */}
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sticky top-8">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[var(--foreground)]">Latest plans</h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {plans.length} plan{plans.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {plans.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--muted-foreground)]">
                      <p>No plans yet.</p>
                      <p className="text-xs">Create one to get started!</p>
                    </div>
                  ) : (
                    plans.map((plan) => (
                      <article key={plan.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 hover:border-[var(--primary)] transition">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-[var(--foreground)] line-clamp-1 text-sm">
                            {plan.venue_name}
                          </h4>
                          <span className="inline-block rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                            {plan.activity_type}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {new Date(plan.scheduled_at).toLocaleDateString()}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                          {plan.description || "No description"}
                        </p>
                        <p className="mt-2 text-xs font-medium text-[var(--foreground)]">
                          {plan.spots_filled}/{plan.spots_total} spots
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

interface AuthPageProps {
  authMode: "signup" | "login";
  setAuthMode: (mode: "signup" | "login") => void;
  authEmail: string;
  setAuthEmail: (email: string) => void;
  authPassword: string;
  setAuthPassword: (password: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  handleAuth: (e: React.FormEvent) => void;
  authMessage: string | null;
  isDark: boolean;
  toggleDarkMode: () => void;
}

function AuthPage({
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  showPassword,
  setShowPassword,
  handleAuth,
  authMessage,
  isDark,
  toggleDarkMode,
}: AuthPageProps) {
  const isSignup = authMode === "signup";

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Header for mobile */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-4 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 text-[var(--primary-foreground)] font-bold">
              M
            </div>
            <span className="font-bold text-[var(--foreground)]">MeetMap</span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 transition hover:bg-[var(--muted)]"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun /> : <Moon />}
          </button>
        </div>

        {/* Left side - hero/branding */}
        <section className="relative hidden lg:block lg:w-1/2 bg-gradient-to-br from-[var(--primary)] via-[var(--primary)]/95 to-[var(--primary)]/90 p-12 text-[var(--primary-foreground)]">
          <div className="absolute top-8 right-8 lg:hidden">
            <button
              onClick={toggleDarkMode}
              className="rounded-lg bg-[var(--primary-foreground)]/20 p-2 transition hover:bg-[var(--primary-foreground)]/30"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun /> : <Moon />}
            </button>
          </div>

          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--primary-foreground)]/20 font-bold text-lg">
                M
              </div>
              <h2 className="mt-12 text-4xl font-bold leading-tight">
                Create local plans and meet people nearby.
              </h2>
              <p className="mt-4 text-lg opacity-90">
                Get matched with people in your area, discover new venues, and create unforgettable memories together.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-foreground)]/20">
                  ✓
                </div>
                <span className="text-sm">Join vibrant communities in your city</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-foreground)]/20">
                  ✓
                </div>
                <span className="text-sm">Find plans tailored to your interests</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-foreground)]/20">
                  ✓
                </div>
                <span className="text-sm">Connect with people who share your passions</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right side - form */}
        <section className="flex w-full flex-1 items-center justify-center px-4 py-12 sm:px-8 lg:w-1/2 bg-[var(--background)]">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[var(--foreground)]">
                {isSignup ? "Join MeetMap" : "Welcome back"}
              </h1>
              <p className="mt-2 text-[var(--muted-foreground)]">
                {isSignup
                  ? "Create an account to start planning with people near you."
                  : "Log in to see your plans and discover new meetups."}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="mb-8 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1">
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`rounded-md py-2.5 text-sm font-semibold transition-all ${
                  isSignup
                    ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-md py-2.5 text-sm font-semibold transition-all ${
                  !isSignup
                    ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Log in
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)]">
                    Password
                  </label>
                  {!isSignup && (
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative mt-2">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    placeholder={isSignup ? "Create a password" : "Your password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {showPassword ? (
                      <EyeOff />
                    ) : (
                      <Eye />
                    )}
                  </button>
                </div>
              </div>

              {isSignup && (
                <label className="flex items-start gap-2.5 text-sm text-[var(--muted-foreground)]">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 h-4 w-4 rounded border-[var(--border)]"
                  />
                  <span>
                    I agree to the{" "}
                    <a href="#" className="font-medium text-[var(--primary)] hover:underline">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="font-medium text-[var(--primary)] hover:underline">
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
              )}

              {authMessage && (
                <div className={`rounded-lg p-3 text-sm ${
                  authMessage.toLowerCase().includes("error") || 
                  authMessage.toLowerCase().includes("failed") ||
                  authMessage.toLowerCase().includes("invalid")
                    ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                    : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                }`}>
                  {authMessage}
                </div>
              )}

              <button
                type="submit"
                className="mt-6 w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
              >
                {isSignup ? "Create account" : "Log in"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                or continue with
              </span>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                <GoogleIcon />
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                <AppleIcon />
                Apple
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-[var(--muted-foreground)]">
              {isSignup ? "Already have an account? " : "New to MeetMap? "}
              <button
                type="button"
                onClick={() => setAuthMode(isSignup ? "login" : "signup")}
                className="font-semibold text-[var(--primary)] hover:underline"
              >
                {isSignup ? "Log in" : "Create account"}
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
