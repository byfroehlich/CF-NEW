import { useId } from 'react'

export default function MalaraLogo({ height = 36, variant = 'color', iconOnly = false }) {
  const uid = useId().replace(/:/g, '')
  const ICON_W = 108
  const FULL_W = 420
  const vbW = iconOnly ? ICON_W : FULL_W
  const w = Math.round(height * (vbW / 112))
  const gradId = `ml-grad-${uid}`
  const isWhite = variant === 'white'
  const stroke = isWhite ? '#ffffff' : `url(#${gradId})`

  // Stadium/pill shape: cap radius r=12, straight half h=29 → height=82, width=24
  // Smooth path: straight sides connect tangentially with semicircular caps
  const pill = 'M 12,-29 L 12,29 A 12,12 0 0 1 -12,29 L -12,-29 A 12,12 0 0 0 12,-29 Z'

  return (
    <svg
      width={w}
      height={height}
      viewBox={`0 0 ${vbW} 112`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Malara"
    >
      <defs>
        {!isWhite && (
          <linearGradient id={gradId} x1="0" y1="0" x2={vbW} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#4A3BE8" />
            <stop offset="50%"  stopColor="#B820CC" />
            <stop offset="100%" stopColor="#EC1878" />
          </linearGradient>
        )}
      </defs>
      <path d={pill} stroke={stroke} strokeWidth="10.5" transform="translate(38,56) rotate(-20)" />
      <path d={pill} stroke={stroke} strokeWidth="10.5" transform="translate(70,56) rotate(20)" />
      {!iconOnly && (
        <text
          x="122" y="82"
          fontFamily="'Poppins','Nunito','Inter',system-ui,sans-serif"
          fontSize="74" fontWeight="800" letterSpacing="-2"
          fill={stroke}
        >Malara</text>
      )}
    </svg>
  )
}
