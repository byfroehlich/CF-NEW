import { useId } from 'react'

export default function MalaraLogo({ height = 36, variant = 'color', iconOnly = false }) {
  const uid = useId().replace(/:/g, '')
  const ICON_W = 108
  const FULL_W = 420
  const vbW = iconOnly ? ICON_W : FULL_W
  const aspect = vbW / 112
  const w = Math.round(height * aspect)
  const gradId = `ml-grad-${uid}`
  const isWhite = variant === 'white'
  return (
    <svg width={w} height={height} viewBox={`0 0 ${vbW} 112`} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Malara">
      <defs>
        {!isWhite && (
          <linearGradient id={gradId} x1="0" y1="0" x2={vbW} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7B28E8" />
            <stop offset="50%" stopColor="#C026D3" />
            <stop offset="100%" stopColor="#EC1E85" />
          </linearGradient>
        )}
      </defs>
      <ellipse cx="38" cy="58" rx="20" ry="41"
        stroke={isWhite ? '#ffffff' : `url(#${gradId})`}
        strokeWidth="10.5" strokeLinecap="round"
        transform="rotate(-18 38 58)" />
      <ellipse cx="70" cy="58" rx="20" ry="41"
        stroke={isWhite ? '#ffffff' : `url(#${gradId})`}
        strokeWidth="10.5" strokeLinecap="round"
        transform="rotate(18 70 58)" />
      {!iconOnly && (
        <text x="122" y="82"
          fontFamily="'Poppins','Nunito','Inter',system-ui,sans-serif"
          fontSize="74" fontWeight="800" letterSpacing="-2"
          fill={isWhite ? '#ffffff' : `url(#${gradId})`}>
          Malara
        </text>
      )}
    </svg>
  )
}
