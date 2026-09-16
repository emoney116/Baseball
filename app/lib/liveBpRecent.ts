import type { BpContext } from './liveBp.ts';

export type BpRecentEvidence = {
  pitch_type?: string | null;
  velocity?: number | null;
  exit_velocity_mph?: number | null;
  action?: string | null;
  live_bp_context?: BpContext | null;
};

export function formatBpRecent(event?: BpRecentEvidence) {
  if (!event) return '';
  return [event.pitch_type,
    event.velocity != null ? `${event.velocity} mph` : '',
    event.live_bp_context?.result ?? event.action,
    event.live_bp_context?.battedBallType,
    event.exit_velocity_mph != null ? `${event.exit_velocity_mph} EV` : '',
  ].filter(Boolean).join(' · ');
}
