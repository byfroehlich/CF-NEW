const CONFIG = {
  open:        { label: 'Offen',      classes: 'bg-red-50 text-red-700 border-red-200' },
  in_progress: { label: 'In Arbeit',  classes: 'bg-orange-50 text-orange-700 border-orange-200' },
  delivered:   { label: 'Geliefert',  classes: 'bg-green-50 text-green-700 border-green-200' },
  confirmed:   { label: 'Bestätigt',  classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  carried:     { label: '↩ Übertrag', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
}

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.open
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}
