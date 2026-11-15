import { useId } from 'react';
import { cn } from '../cn';

/**
 * Aura — the Mediaura.ai assistant patients talk to before their visit. An original, friendly face in
 * the brand green with a saffron "aura" ring (calm, clinical-but-warm, spec §8). She only listens and
 * asks questions; she never diagnoses or advises (golden rules 1–2), so her look stays gentle, not
 * "doctor-like" (no white coat, no stethoscope).
 *
 * `talking` animates the mouth (while a reply is on its way). Motion is turned off for people who ask
 * their device for reduced motion (global rule in tokens.css).
 */
export function AuraAvatar({ size = 40, talking = false, label, className }: { size?: number; talking?: boolean; label?: string; className?: string }) {
  const shine = `aura-shine-${useId().replace(/:/g, '')}`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0', talking && 'aura-talking', className)}
    >
      {/* the aura: two soft saffron rings */}
      <g className="aura-halo">
        <circle cx="32" cy="32" r="30" fill="none" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="32" cy="32" r="27" fill="none" stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="3 4" />
      </g>
      {/* face */}
      <circle cx="32" cy="32" r="23" fill="var(--brand)" />
      <circle cx="32" cy="32" r="23" fill={`url(#${shine})`} />
      <defs>
        <radialGradient id={shine} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* a small leaf-like tuft: growth, care */}
      <path d="M32 9.5c3.6 1.4 5.2 4.3 4.6 7.6-3.4-.2-5.9-2.4-4.6-7.6Z" fill="var(--accent)" />
      {/* cheeks */}
      <circle cx="21.5" cy="37" r="3.2" fill="#ffb4a2" fillOpacity="0.55" />
      <circle cx="42.5" cy="37" r="3.2" fill="#ffb4a2" fillOpacity="0.55" />
      {/* eyes */}
      <g className="aura-eyes" fill="#ffffff">
        <ellipse cx="25" cy="30" rx="3" ry="3.6" />
        <ellipse cx="39" cy="30" rx="3" ry="3.6" />
        <circle cx="26" cy="29" r="1" fill="var(--brand-deep, #084d3a)" />
        <circle cx="40" cy="29" r="1" fill="var(--brand-deep, #084d3a)" />
      </g>
      {/* mouth: a soft smile; opens a little while talking */}
      <path className="aura-mouth" d="M26.5 39.5c3.2 3.4 7.8 3.4 11 0" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
