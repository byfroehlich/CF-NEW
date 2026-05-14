import { useId } from 'react'

export default function MalaraLogo({ height = 36, variant = 'color', iconOnly = false }) {
  const uid = useId().replace(/:/g, '')
  const ICON_W = 108
  const FULL_W = 430
  const vbW = iconOnly ? ICON_W : FULL_W
  const w = Math.round(height * (vbW / 112))
  const gradId = `ml-grad-${uid}`
  const isWhite = variant === 'white'
  const stroke = isWhite ? '#ffffff' : `url(#${gradId})`

  return (
    <svg width={w} height={height} viewBox={`0 0 ${vbW} 112`} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Malara">
      <defs>
        {!isWhite && (
          <linearGradient id={gradId} x1="0" y1="0" x2={vbW} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#4A3BE8" />
            <stop offset="50%"  stopColor="#B820CC" />
            <stop offset="100%" stopColor="#EC1878" />
          </linearGradient>
        )}
      </defs>
      {/* Left loop — traced from reference */}
      <path
        fill="none"
        stroke={stroke}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 36,13 C 58,7 78,30 68,56 C 58,80 54,92 51,96 C 26,92 6,72 10,54 C 14,36 18,17 36,13 Z"
      />
      {/* Right loop — traced from reference */}
      <path
        fill="none"
        stroke={stroke}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 72,13 C 92,9 104,38 98,56 C 92,74 68,94 54,96 C 52,92 34,78 40,56 C 46,34 56,15 72,13 Z"
      />
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
