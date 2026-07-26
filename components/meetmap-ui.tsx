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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>Loading MeetMap…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e3a8a,_#020617_70%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/30 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">MeetMap</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Create local plans and meet people nearby.
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-300">
              This MVP starts with the core loop: authenticate, save a plan, and discover it in a simple feed.
            </p>
          </div>
          {!session ? (
            <div className="flex gap-2">
              <button
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  authMode === "sign-in" ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-200"
                }`}
                onClick={() => setAuthMode("sign-in")}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  authMode === "sign-up" ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-200"
                }`}
                onClick={() => setAuthMode("sign-up")}
                type="button"
              >
                Sign up
              </button>
            </div>
          ) : (
            <button
              className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200"
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
          )}
        </header>

        {!session ? (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
              <h2 className="text-2xl font-semibold">Start with a simple account</h2>
              <p className="mt-3 text-slate-300">
                The first milestone is a working auth flow and a plan creation form connected to your database.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-400">
                <li>• Supabase handles authentication and the plan feed</li>
                <li>• Google Places powers venue search</li>
                <li>• The next step is a map view and join requests</li>
              </ul>
            </div>

            <form onSubmit={handleAuth} className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-semibold">
                {authMode === "sign-in" ? "Welcome back" : "Create your account"}
              </h2>
              <div className="mt-6 space-y-4">
                <label className="block text-sm text-slate-300">
                  Email
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none ring-0"
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    required
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Password
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none ring-0"
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    required
                  />
                </label>
              </div>
              {authMessage ? <p className="mt-4 text-sm text-cyan-300">{authMessage}</p> : null}
              <button className="mt-6 w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400" type="submit">
                {authMode === "sign-in" ? "Sign in" : "Create account"}
              </button>
            </form>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <form onSubmit={handleCreatePlan} className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">New plan</p>
                  <h2 className="mt-2 text-2xl font-semibold">Create a plan in one minute</h2>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block text-sm text-slate-300">
                  Venue search
                  <input
                    ref={venueInputRef}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none ring-0"
                    placeholder="Search for a cafe, park, or venue"
                    value={venueName}
                    onChange={(event) => setVenueName(event.target.value)}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Activity
                    <select
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none ring-0"
                      value={activityType}
                      onChange={(event) => setActivityType(event.target.value)}
                    >
                      {activityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm text-slate-300">
                    Spots
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none ring-0"
                      min={1}
                      max={20}
                      type="number"
                      value={spotsTotal}
                      onChange={(event) => setSpotsTotal(Number(event.target.value))}
                    />
                  </label>
                </div>

                <label className="block text-sm text-slate-300">
                  Date and time
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none ring-0"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    required
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Notes
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none ring-0"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell people what you're planning"
                  />
                </label>
              </div>

              {formMessage ? <p className="mt-4 text-sm text-cyan-300">{formMessage}</p> : null}
              <button className="mt-6 w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400" type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create plan"}
              </button>
            </form>

            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Plans feed</p>
                  <h2 className="mt-2 text-2xl font-semibold">Latest nearby plans</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {plans.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                    No plans yet. Your first one will appear here.
                  </div>
                ) : (
                  plans.map((plan) => (
                    <article key={plan.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-100">{plan.venue_name}</h3>
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-300">
                          {plan.activity_type}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        {plan.description || "No description yet"}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{new Date(plan.scheduled_at).toLocaleString()}</span>
                        <span>{plan.spots_filled}/{plan.spots_total} spots filled</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
