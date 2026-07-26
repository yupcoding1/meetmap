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
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

export function MeetMapApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-slate-600">Loading MeetMap…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthPage authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword} showPassword={showPassword} setShowPassword={setShowPassword} handleAuth={handleAuth} authMessage={authMessage} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
              M
            </div>
            <h1 className="text-xl font-bold text-slate-900">MeetMap</h1>
          </div>
          <button
            onClick={handleSignOut}
            type="button"
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Create plan form */}
          <form onSubmit={handleCreatePlan} className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Create a plan</h2>
                <p className="mt-2 text-slate-600">
                  Share what you're planning and let people join your adventure.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label htmlFor="venue" className="block text-sm font-medium text-slate-900">
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
                    <label htmlFor="activity" className="block text-sm font-medium text-slate-900">
                      Activity
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
                    <label htmlFor="spots" className="block text-sm font-medium text-slate-900">
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
                  <label htmlFor="datetime" className="block text-sm font-medium text-slate-900">
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
                  <label htmlFor="description" className="block text-sm font-medium text-slate-900">
                    Description
                  </label>
                  <textarea
                    id="description"
                    className={`mt-2 min-h-28 resize-none ${inputClass}`}
                    placeholder="Tell people what you're planning..."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </div>

              {formMessage && (
                <div className={`mt-6 rounded-lg p-4 text-sm ${
                  formMessage.includes("error") || formMessage.includes("Error")
                    ? "bg-red-50 text-red-700"
                    : "bg-green-50 text-green-700"
                }`}>
                  {formMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-8 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create plan"}
              </button>
            </div>
          </form>

          {/* Plans feed */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Plans feed</h2>
              <p className="mt-1 text-sm text-slate-600">Latest plans in your area</p>

              <div className="mt-6 space-y-4">
                {plans.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                    No plans yet. Create one to get started!
                  </div>
                ) : (
                  plans.map((plan) => (
                    <article key={plan.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">{plan.venue_name}</h3>
                        <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                          {plan.activity_type}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        {new Date(plan.scheduled_at).toLocaleDateString()}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {plan.description || "No description"}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        {plan.spots_filled}/{plan.spots_total} spots
                      </p>
                    </article>
                  ))
                )}
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
}: AuthPageProps) {
  const isSignup = authMode === "signup";

  return (
    <main className="min-h-screen bg-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Left side - hero/branding */}
        <section className="relative hidden lg:block lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 text-white font-bold text-lg">
                M
              </div>
              <h2 className="mt-12 text-4xl font-bold text-white">
                Create local plans and meet people nearby.
              </h2>
              <p className="mt-4 text-lg text-blue-100">
                Get matched with people in your area, discover new venues, and create unforgettable memories together.
              </p>
            </div>

            <div className="space-y-4 text-blue-100">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  ✓
                </div>
                <span>Join vibrant communities in your city</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  ✓
                </div>
                <span>Find plans tailored to your interests</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  ✓
                </div>
                <span>Connect with people who share your passions</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right side - form */}
        <section className="flex w-full flex-1 items-center justify-center px-4 py-12 sm:px-8 lg:w-1/2">
          <div className="w-full max-w-sm">
            {/* Mobile brand */}
            <div className="mb-8 flex items-center gap-2 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
                M
              </div>
              <span className="text-xl font-bold text-slate-900">MeetMap</span>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">
                {isSignup ? "Join MeetMap" : "Welcome back"}
              </h1>
              <p className="mt-2 text-slate-600">
                {isSignup
                  ? "Create an account to start planning with people near you."
                  : "Log in to see your plans and discover new meetups."}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="mb-8 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`rounded-md py-2.5 text-sm font-semibold transition-all ${
                  isSignup
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-md py-2.5 text-sm font-semibold transition-all ${
                  !isSignup
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Log in
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-900">
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
                  <label htmlFor="password" className="block text-sm font-medium text-slate-900">
                    Password
                  </label>
                  {!isSignup && (
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-600 hover:underline"
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
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
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
                <label className="flex items-start gap-2.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    I agree to the{" "}
                    <a href="#" className="font-medium text-blue-600 hover:underline">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="font-medium text-blue-600 hover:underline">
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
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
                }`}>
                  {authMessage}
                </div>
              )}

              <button
                type="submit"
                className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
              >
                {isSignup ? "Create account" : "Log in"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                or continue with
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                <GoogleIcon />
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                <AppleIcon />
                Apple
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-slate-600">
              {isSignup ? "Already have an account? " : "New to MeetMap? "}
              <button
                type="button"
                onClick={() => setAuthMode(isSignup ? "login" : "signup")}
                className="font-semibold text-blue-600 hover:underline"
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
