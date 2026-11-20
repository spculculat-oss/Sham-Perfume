import React, { useId } from 'react';

export type LuxuryPortalIconSize = 'xs' | 'sm' | 'md' | 'lg';

interface LuxuryPortalIconProps {
  portalId: string;
  size?: LuxuryPortalIconSize;
  active?: boolean;
  className?: string;
}

type PaletteSpec = {
  bgFrom: string;
  bgTo: string;
  ring: string;
  glow: string;
  primaryA: string;
  primaryB: string;
  secondaryA: string;
  secondaryB: string;
};

const PALETTES: Record<string, PaletteSpec> = {
  portal_concentration: {
    bgFrom: '#291d12',
    bgTo: '#120d09',
    ring: 'rgba(245, 158, 11, 0.55)',
    glow: 'rgba(245, 158, 11, 0.28)',
    primaryA: '#fde68a',
    primaryB: '#d97706',
    secondaryA: '#fef3c7',
    secondaryB: '#92400e',
  },
  portal_news: {
    bgFrom: '#2b160c',
    bgTo: '#140b07',
    ring: 'rgba(249, 115, 22, 0.55)',
    glow: 'rgba(249, 115, 22, 0.28)',
    primaryA: '#fdba74',
    primaryB: '#ea580c',
    secondaryA: '#fde68a',
    secondaryB: '#9a3412',
  },
  portal_world_perfumes: {
    bgFrom: '#29200b',
    bgTo: '#140f06',
    ring: 'rgba(234, 179, 8, 0.6)',
    glow: 'rgba(234, 179, 8, 0.3)',
    primaryA: '#fef08a',
    primaryB: '#ca8a04',
    secondaryA: '#fffbeb',
    secondaryB: '#a16207',
  },
  portal_raw_materials: {
    bgFrom: '#0c241c',
    bgTo: '#071410',
    ring: 'rgba(16, 185, 129, 0.55)',
    glow: 'rgba(16, 185, 129, 0.28)',
    primaryA: '#6ee7b7',
    primaryB: '#059669',
    secondaryA: '#fde68a',
    secondaryB: '#047857',
  },
  portal_pyramid: {
    bgFrom: '#2b1219',
    bgTo: '#14090d',
    ring: 'rgba(244, 63, 94, 0.55)',
    glow: 'rgba(244, 63, 94, 0.28)',
    primaryA: '#fda4af',
    primaryB: '#e11d48',
    secondaryA: '#fde68a',
    secondaryB: '#d97706',
  },
  portal_alcohol: {
    bgFrom: '#0b222c',
    bgTo: '#071319',
    ring: 'rgba(6, 182, 212, 0.55)',
    glow: 'rgba(6, 182, 212, 0.28)',
    primaryA: '#67e8f9',
    primaryB: '#0891b2',
    secondaryA: '#e0f2fe',
    secondaryB: '#0e7490',
  },
  portal_costing: {
    bgFrom: '#0d2618',
    bgTo: '#07150d',
    ring: 'rgba(34, 197, 94, 0.55)',
    glow: 'rgba(34, 197, 94, 0.28)',
    primaryA: '#86efac',
    primaryB: '#16a34a',
    secondaryA: '#fde68a',
    secondaryB: '#ca8a04',
  },
  portal_master_ai: {
    bgFrom: '#0c2520',
    bgTo: '#071411',
    ring: 'rgba(52, 211, 153, 0.58)',
    glow: 'rgba(52, 211, 153, 0.3)',
    primaryA: '#a7f3d0',
    primaryB: '#10b981',
    secondaryA: '#fde68a',
    secondaryB: '#d97706',
  },
  portal_library: {
    bgFrom: '#261a11',
    bgTo: '#140e09',
    ring: 'rgba(217, 119, 6, 0.55)',
    glow: 'rgba(217, 119, 6, 0.26)',
    primaryA: '#fcd34d',
    primaryB: '#b45309',
    secondaryA: '#fef3c7',
    secondaryB: '#78350f',
  },
  portal_guide: {
    bgFrom: '#27121b',
    bgTo: '#14090e',
    ring: 'rgba(225, 29, 72, 0.52)',
    glow: 'rgba(225, 29, 72, 0.26)',
    primaryA: '#fda4af',
    primaryB: '#be123c',
    secondaryA: '#fde68a',
    secondaryB: '#d97706',
  },
  portal_maceration_simulator: {
    bgFrom: '#281c0f',
    bgTo: '#140e07',
    ring: 'rgba(245, 158, 11, 0.58)',
    glow: 'rgba(245, 158, 11, 0.3)',
    primaryA: '#fde68a',
    primaryB: '#b45309',
    secondaryA: '#fed7aa',
    secondaryB: '#7c2d12',
  },
  portal_country: {
    bgFrom: '#0d2424',
    bgTo: '#071414',
    ring: 'rgba(20, 184, 166, 0.55)',
    glow: 'rgba(20, 184, 166, 0.28)',
    primaryA: '#5eead4',
    primaryB: '#0d9488',
    secondaryA: '#fde68a',
    secondaryB: '#d97706',
  },
  portal_privacy: {
    bgFrom: '#0d231d',
    bgTo: '#07130f',
    ring: 'rgba(16, 185, 129, 0.55)',
    glow: 'rgba(16, 185, 129, 0.26)',
    primaryA: '#6ee7b7',
    primaryB: '#047857',
    secondaryA: '#fde68a',
    secondaryB: '#a16207',
  },
  portal_store: {
    bgFrom: '#2b180b',
    bgTo: '#160c05',
    ring: 'rgba(251, 146, 60, 0.6)',
    glow: 'rgba(251, 146, 60, 0.3)',
    primaryA: '#fed7aa',
    primaryB: '#ea580c',
    secondaryA: '#fef08a',
    secondaryB: '#d97706',
  },
};

const SIZE_CLASSES: Record<LuxuryPortalIconSize, { box: string; svg: string; radius: string }> = {
  xs: { box: 'w-6 h-6', svg: 'w-4 h-4', radius: 'rounded-lg' },
  sm: { box: 'w-8 h-8', svg: 'w-5 h-5', radius: 'rounded-xl' },
  md: { box: 'w-11 h-11', svg: 'w-7 h-7', radius: 'rounded-2xl' },
  lg: { box: 'w-14 h-14', svg: 'w-9 h-9', radius: 'rounded-2xl' },
};

export const LuxuryPortalIcon: React.FC<LuxuryPortalIconProps> = ({
  portalId,
  size = 'lg',
  active = false,
  className = '',
}) => {
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '');
  const p = PALETTES[portalId] || PALETTES.portal_concentration;
  const s = SIZE_CLASSES[size];

  const gradPrimary = `lpi-p-${uid}`;
  const gradSecondary = `lpi-s-${uid}`;
  const gradHalo = `lpi-h-${uid}`;

  const renderArtwork = () => {
    switch (portalId) {
      case 'portal_concentration':
        // Faceted Crystal Flacon with Amber Elixir & Atomizer Crown
        return (
          <g>
            <path
              d="M25 11h14v5H25z"
              fill={`url(#${gradSecondary})`}
              stroke="#fef3c7"
              strokeWidth="1.2"
            />
            <rect
              x="27"
              y="16"
              width="10"
              height="4.5"
              rx="1.5"
              fill={`url(#${gradPrimary})`}
            />
            <path
              d="M21 22.5c0-1.4 1.1-2.5 2.5-2.5h17c1.4 0 2.5 1.1 2.5 2.5l4.5 9.5v17c0 3.3-2.7 6-6 6H22.5c-3.3 0-6-2.7-6-6V32l4.5-9.5z"
              fill="rgba(255,255,255,0.08)"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <path
              d="M19.5 36.5h25V48c0 2.5-2 4.5-4.5 4.5H24c-2.5 0-4.5-2-4.5-4.5V36.5z"
              fill={`url(#${gradPrimary})`}
              opacity="0.9"
            />
            <rect
              x="24.5"
              y="31"
              width="15"
              height="10"
              rx="2"
              fill="#1c1917"
              stroke={`url(#${gradSecondary})`}
              strokeWidth="1.2"
            />
            <path d="M28 36h8" stroke="#fde68a" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M49 14l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="#fef08a" />
          </g>
        );

      case 'portal_news':
        // Illuminated Armillary Dispatch Globe & Signal Arcs
        return (
          <g>
            <circle
              cx="32"
              cy="33"
              r="16"
              fill="rgba(255,255,255,0.06)"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="2"
            />
            <ellipse
              cx="32"
              cy="33"
              rx="7.5"
              ry="16"
              fill="none"
              stroke={`url(#${gradSecondary})`}
              strokeWidth="1.5"
            />
            <path
              d="M16.5 33h31M19 25.5h26M19 40.5h26"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="1.35"
              opacity="0.85"
            />
            <path
              d="M19 14c7-5.5 19-5.5 26 0"
              fill="none"
              stroke="#fde68a"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="46" cy="17" r="3.5" fill={`url(#${gradPrimary})`} stroke="#fffbeb" strokeWidth="1" />
          </g>
        );

      case 'portal_world_perfumes':
        // Imperial Jeweled Crown over Diamond Drop
        return (
          <g>
            <path
              d="M13 38L17 20l10 9 5-13 5 13 10-9 4 18H13z"
              fill={`url(#${gradPrimary})`}
              stroke="#fef9c3"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <rect
              x="14"
              y="40.5"
              width="36"
              height="6"
              rx="2.5"
              fill={`url(#${gradSecondary})`}
              stroke="#fef08a"
              strokeWidth="1.2"
            />
            <circle cx="32" cy="12" r="2.6" fill="#fef9c3" />
            <circle cx="16.5" cy="17" r="2.2" fill="#fde68a" />
            <circle cx="47.5" cy="17" r="2.2" fill="#fde68a" />
            <path d="M32 27l3.5 4.5L32 36l-3.5-4.5z" fill="#fffbeb" />
          </g>
        );

      case 'portal_raw_materials':
        // Botanical Oud Leaf & Golden Essential Oil Droplet
        return (
          <g>
            <path
              d="M17 47c0-18 11-30 29-31-1 18-13 30-29 31z"
              fill={`url(#${gradPrimary})`}
              fillOpacity="0.85"
              stroke="#d1fae5"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M17 47C25 38 33 30 43 20"
              stroke="#ecfdf5"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M44 33c3.8 5.2 6.5 8.8 6.5 12.2a6.5 6.5 0 11-13 0c0-3.4 2.7-7 6.5-12.2z"
              fill={`url(#${gradSecondary})`}
              stroke="#fef3c7"
              strokeWidth="1.5"
            />
          </g>
        );

      case 'portal_pyramid':
        // Three-Tiered Architectural Fragrance Pyramid
        return (
          <g>
            <path
              d="M32 11l9 13H23l9-13z"
              fill={`url(#${gradSecondary})`}
              stroke="#fef3c7"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M20.5 27.5h23l5.5 9.5H15l5.5-9.5z"
              fill={`url(#${gradPrimary})`}
              stroke="#ffe4e6"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M13 40.5h38l5.5 10.5h-49L13 40.5z"
              fill={`url(#${gradSecondary})`}
              opacity="0.92"
              stroke="#fde68a"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="18.5" r="2" fill="#fffbeb" />
          </g>
        );

      case 'portal_alcohol':
        // Graduated Crystal Erlenmeyer Flask & Purity Bubbles
        return (
          <g>
            <path
              d="M26 12h12v4H26z"
              fill={`url(#${gradSecondary})`}
              stroke="#e0f2fe"
              strokeWidth="1.3"
            />
            <path
              d="M27.5 16v9.5L15 47.5c-1.1 2 .3 4.5 2.6 4.5h28.8c2.3 0 3.7-2.5 2.6-4.5L36.5 25.5V16"
              fill="rgba(255,255,255,0.07)"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <path
              d="M20.5 38.5h23l4.2 7.5c.6 1.1-.2 2.5-1.5 2.5H17.8c-1.3 0-2.1-1.4-1.5-2.5l4.2-7.5z"
              fill={`url(#${gradPrimary})`}
              opacity="0.9"
            />
            <circle cx="28" cy="43.5" r="2" fill="#ecfeff" />
            <circle cx="36.5" cy="41.5" r="1.4" fill="#ecfeff" />
            <path d="M30 23h4M29 27h6" stroke="#bae6fd" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        );

      case 'portal_costing':
        // Golden Treasury Apothecary Scale & Coin Medallion
        return (
          <g>
            <path
              d="M32 13v34M22 50h20"
              stroke={`url(#${gradSecondary})`}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M15 22h34"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path d="M16 22l-4.5 12h9L16 22z" fill="none" stroke="#bbf7d0" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M10.5 34c0 3 2.5 5 5.5 5s5.5-2 5.5-5h-11z" fill={`url(#${gradPrimary})`} />
            <path d="M48 22l-4.5 12h9L48 22z" fill="none" stroke="#fde68a" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M42.5 34c0 3 2.5 5 5.5 5s5.5-2 5.5-5h-11z" fill={`url(#${gradSecondary})`} />
            <circle cx="32" cy="13" r="3" fill="#fef08a" />
          </g>
        );

      case 'portal_master_ai':
        // Ornate Alchemical Astrolabe & Guiding Star Core
        return (
          <g>
            <circle
              cx="32"
              cy="32"
              r="18"
              fill="none"
              stroke={`url(#${gradSecondary})`}
              strokeWidth="1.8"
              strokeDasharray="4 3"
            />
            <circle
              cx="32"
              cy="32"
              r="13"
              fill="rgba(16,185,129,0.12)"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="1.8"
            />
            <path
              d="M32 14l3.8 14.2L50 32l-14.2 3.8L32 50l-3.8-14.2L14 32l14.2-3.8z"
              fill={`url(#${gradPrimary})`}
              stroke="#ecfdf5"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="32" r="3.6" fill="#fef3c7" />
          </g>
        );

      case 'portal_library':
        // Gilded Formula Ledger with Golden Ribbon Bookmark & Seal
        return (
          <g>
            <rect
              x="16"
              y="13"
              width="32"
              height="38"
              rx="4"
              fill={`url(#${gradPrimary})`}
              fillOpacity="0.22"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="2"
            />
            <path d="M22 13v38" stroke={`url(#${gradSecondary})`} strokeWidth="2.2" />
            <path
              d="M36 13v16l3.5-3 3.5 3V13"
              fill={`url(#${gradPrimary})`}
              stroke="#fef3c7"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M27 32h14M27 38h11" stroke="#fde68a" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="41" cy="44" r="4" fill={`url(#${gradSecondary})`} stroke="#fef3c7" strokeWidth="1.2" />
          </g>
        );

      case 'portal_guide':
        // Cold Maceration Glass Decanter & Shield Crest
        return (
          <g>
            <path
              d="M27 12h10v6l9 13.5c2 3 2.5 6.8 1.2 10.2C45.7 46 41.3 50 36 50H28c-5.3 0-9.7-4-11.2-8.3-1.3-3.4-.8-7.2 1.2-10.2L27 18v-6z"
              fill="rgba(255,255,255,0.08)"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <path
              d="M19.5 37.5c0 5.5 5 9.5 12.5 9.5s12.5-4 12.5-9.5H19.5z"
              fill={`url(#${gradPrimary})`}
              opacity="0.9"
            />
            <path d="M32 23v9M27.5 27.5h9" stroke="#fef3c7" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        );

      case 'portal_maceration_simulator':
        // Golden Brass & Crystal Hourglass
        return (
          <g>
            <path
              d="M18 13h28M18 51h28"
              stroke={`url(#${gradSecondary})`}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M21 15c0 9 7 14 11 17-4 3-11 8-11 17h22c0-9-7-14-11-17 4-3 11-8 11-17H21z"
              fill="rgba(255,255,255,0.08)"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M24.5 47h15c-1.5-5-5.5-7.5-7.5-9-2 1.5-6 4-7.5 9z" fill={`url(#${gradPrimary})`} />
            <path d="M25.5 19h13c-1.2 4-4.8 6.5-6.5 7.5-1.7-1-5.3-3.5-6.5-7.5z" fill={`url(#${gradSecondary})`} opacity="0.85" />
          </g>
        );

      case 'portal_country':
        // Gilded Compass Rose & Meridian Pin
        return (
          <g>
            <circle
              cx="32"
              cy="32"
              r="18"
              fill="rgba(20,184,166,0.12)"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="1.9"
            />
            <path
              d="M32 14l4.5 13.5L50 32l-13.5 4.5L32 50l-4.5-13.5L14 32l13.5-4.5z"
              fill={`url(#${gradSecondary})`}
              stroke="#fef3c7"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <polygon points="32,19 36,32 32,30 28,32" fill={`url(#${gradPrimary})`} />
            <circle cx="32" cy="32" r="3" fill="#fffbeb" />
          </g>
        );

      case 'portal_privacy':
        // Obsidian Vault Shield with Golden Keyhole Emblem
        return (
          <g>
            <path
              d="M32 11l17 6.5v13.5c0 11.2-7.3 19.6-17 23-9.7-3.4-17-11.8-17-23V17.5L32 11z"
              fill={`url(#${gradPrimary})`}
              fillOpacity="0.22"
              stroke={`url(#${gradPrimary})`}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M32 16l12 4.6v9.8c0 8-5.1 14.1-12 16.8-6.9-2.7-12-8.8-12-16.8v-9.8L32 16z"
              fill="none"
              stroke={`url(#${gradSecondary})`}
              strokeWidth="1.4"
            />
            <circle cx="32" cy="29" r="4" fill={`url(#${gradSecondary})`} />
            <path d="M30 32.5h4l1 7.5h-6l1-7.5z" fill={`url(#${gradSecondary})`} />
          </g>
        );

      case 'portal_store':
      default:
        // Luxury Coffret Ribbon Box & Perfume Crest
        return (
          <g>
            <rect
              x="14"
              y="26"
              width="36"
              height="24"
              rx="4"
              fill={`url(#${gradPrimary})`}
              fillOpacity="0.88"
              stroke="#fef3c7"
              strokeWidth="1.6"
            />
            <rect
              x="11.5"
              y="20"
              width="41"
              height="8"
              rx="2.5"
              fill={`url(#${gradSecondary})`}
              stroke="#fef08a"
              strokeWidth="1.5"
            />
            <path d="M32 20v30" stroke="#fef9c3" strokeWidth="2.4" />
            <path
              d="M32 20c-3.5-5.5-9.5-6.5-11-3.2-1.5 3.3 4.5 3.2 11 3.2zm0 0c3.5-5.5 9.5-6.5 11-3.2 1.5 3.3-4.5 3.2-11 3.2z"
              fill="#fde68a"
              stroke="#92400e"
              strokeWidth="1.2"
            />
          </g>
        );
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none transition-transform duration-300 group-hover:scale-105 ${s.box} ${s.radius} ${className}`}
      style={{
        background: `linear-gradient(145deg, ${p.bgFrom}, ${p.bgTo})`,
        border: `1.5px solid ${p.ring}`,
        boxShadow: active
          ? `0 0 0 2px ${p.glow}, 0 8px 20px -4px ${p.glow}`
          : `0 6px 16px -6px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.14)`,
      }}
    >
      {/* Subtle inner gold hairline frame for medium/large medallions */}
      {(size === 'md' || size === 'lg') && (
        <span
          className={`pointer-events-none absolute inset-[3px] ${s.radius} border border-amber-200/15`}
        />
      )}

      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={`relative z-10 ${s.svg} drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradPrimary} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={p.primaryA} />
            <stop offset="100%" stopColor={p.primaryB} />
          </linearGradient>
          <linearGradient id={gradSecondary} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={p.secondaryA} />
            <stop offset="100%" stopColor={p.secondaryB} />
          </linearGradient>
          <radialGradient id={gradHalo} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.primaryA} stopOpacity="0.22" />
            <stop offset="100%" stopColor={p.primaryB} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="32" cy="32" r="24" fill={`url(#${gradHalo})`} />
        {renderArtwork()}
      </svg>
    </div>
  );
};
