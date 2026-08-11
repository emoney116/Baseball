"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type PublicFollowButtonProps = {
  organizationId?: string;
  teamId?: string;
  label?: string;
  compact?: boolean;
};

export function PublicFollowButton({ organizationId, teamId, label = "Follow", compact = false }: PublicFollowButtonProps) {
  const [state, setState] = useState<"checking" | "signed-out" | "idle" | "saving">("checking");
  const [followed, setFollowed] = useState(false);
  const [inherited, setInherited] = useState(false);
  const [message, setMessage] = useState("");
  const targetKey = useMemo(() => `${organizationId ?? "orgless"}:${teamId ?? "org"}`, [organizationId, teamId]);

  useEffect(() => {
    let active = true;
    async function loadFollowState() {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!active) return;
        if (!userData.user) {
          setState("signed-out");
          setFollowed(false);
          setInherited(false);
          return;
        }

        const checks = [];
        if (teamId) {
          checks.push(
            supabase
              .from("profile_follows")
              .select("id")
              .eq("profile_id", userData.user.id)
              .eq("team_id", teamId)
              .limit(1)
              .maybeSingle(),
          );
        }
        if (organizationId) {
          checks.push(
            supabase
              .from("profile_follows")
              .select("id")
              .eq("profile_id", userData.user.id)
              .eq("organization_id", organizationId)
              .is("team_id", null)
              .limit(1)
              .maybeSingle(),
          );
        }

        const results = await Promise.all(checks);
        if (!active) return;
        const teamFollow = teamId ? Boolean(results[0]?.data) : false;
        const organizationFollow = organizationId ? Boolean(results[teamId ? 1 : 0]?.data) : false;
        setFollowed(teamFollow || organizationFollow);
        setInherited(Boolean(teamId && organizationFollow && !teamFollow));
        setState("idle");
      } catch {
        if (!active) return;
        setState("idle");
      }
    }

    void loadFollowState();
    return () => {
      active = false;
    };
  }, [targetKey, organizationId, teamId]);

  async function toggleFollow() {
    if (state === "signed-out") {
      setMessage("Sign in to follow.");
      window.setTimeout(() => setMessage(""), 2200);
      return;
    }
    if (inherited) {
      setMessage("Followed through the organization.");
      window.setTimeout(() => setMessage(""), 2200);
      return;
    }

    setState("saving");
    setMessage("");
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setState("signed-out");
        setMessage("Sign in to follow.");
        return;
      }

      if (followed) {
        let query = supabase.from("profile_follows").delete().eq("profile_id", userData.user.id);
        query = teamId ? query.eq("team_id", teamId) : query.is("team_id", null);
        query = organizationId ? query.eq("organization_id", organizationId) : query.is("organization_id", null);
        const { error } = await query;
        if (error) throw error;
        setFollowed(false);
      } else {
        const { error } = await supabase.from("profile_follows").insert({
          profile_id: userData.user.id,
          organization_id: organizationId ?? null,
          team_id: teamId ?? null,
        });
        if (error && error.code !== "23505") throw error;
        setFollowed(true);
      }
      setState("idle");
    } catch (error) {
      setState("idle");
      setMessage(error instanceof Error ? error.message : "Follow update failed.");
      window.setTimeout(() => setMessage(""), 3200);
    }
  }

  const buttonText = followed ? (compact ? "" : "Following") : compact ? "" : label;
  const ariaLabel = followed ? "Unfollow" : label;

  return (
    <span className="public-follow-wrap">
      <button
        className={`public-follow-button ${compact ? "public-follow-button--compact" : ""} ${followed ? "public-follow-button--active" : ""}`}
        type="button"
        onClick={toggleFollow}
        disabled={state === "checking" || state === "saving"}
        aria-label={ariaLabel}
        title={inherited ? "Followed through the organization" : ariaLabel}
      >
        <Heart size={15} aria-hidden="true" fill={followed ? "currentColor" : "none"} />
        {buttonText}
      </button>
      {message && <small className="public-follow-message">{message}</small>}
    </span>
  );
}
