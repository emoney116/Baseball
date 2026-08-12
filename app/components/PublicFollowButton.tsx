"use client";

import { Heart, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type PublicFollowButtonProps = {
  organizationId?: string;
  teamId?: string;
  label?: string;
  compact?: boolean;
  locked?: boolean;
  lockedLabel?: string;
};

export function PublicFollowButton({ organizationId, teamId, label = "Follow", compact = false, locked = false, lockedLabel = "Included with your access" }: PublicFollowButtonProps) {
  const [state, setState] = useState<"checking" | "signed-out" | "idle" | "saving">("checking");
  const [followed, setFollowed] = useState(false);
  const [message, setMessage] = useState("");
  const targetKey = useMemo(() => `${organizationId ?? "orgless"}:${teamId ?? "org"}`, [organizationId, teamId]);

  useEffect(() => {
    if (locked) return;
    let active = true;
    async function loadFollowState() {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!active) return;
        if (!userData.user) {
          setState("signed-out");
          setFollowed(false);
          return;
        }

        let query = supabase.from("profile_follows").select("id").eq("profile_id", userData.user.id).limit(1);
        if (teamId) {
          query = query.eq("team_id", teamId).is("organization_id", null);
        } else if (organizationId) {
          query = query.eq("organization_id", organizationId).is("team_id", null);
        } else {
          query = query.is("organization_id", null).is("team_id", null);
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (!active) return;
        setFollowed(Boolean(data));
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
  }, [targetKey, organizationId, teamId, locked]);

  if (locked) {
    return (
      <span className="public-follow-wrap">
        <span
          className={`public-follow-button public-follow-button--locked ${compact ? "public-follow-button--compact" : ""}`}
          aria-label={lockedLabel}
          title={lockedLabel}
        >
          <Lock size={15} aria-hidden="true" />
          {!compact && "Joined"}
        </span>
      </span>
    );
  }

  async function toggleFollow() {
    if (state === "signed-out") {
      setMessage("Sign in to follow.");
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
        if (teamId) {
          query = query.eq("team_id", teamId).is("organization_id", null);
        } else if (organizationId) {
          query = query.eq("organization_id", organizationId).is("team_id", null);
        } else {
          query = query.is("organization_id", null).is("team_id", null);
        }
        const { error } = await query;
        if (error) throw error;
        if (organizationId && !teamId) {
          await supabase
            .from("profile_follow_exclusions")
            .delete()
            .eq("profile_id", userData.user.id)
            .eq("organization_id", organizationId);
        }
        setFollowed(false);
      } else {
        const { error } = await supabase.from("profile_follows").insert({
          profile_id: userData.user.id,
          organization_id: teamId ? null : organizationId ?? null,
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
        title={ariaLabel}
      >
        <Heart size={15} aria-hidden="true" fill={followed ? "currentColor" : "none"} />
        {buttonText}
      </button>
      {message && <small className="public-follow-message">{message}</small>}
    </span>
  );
}
