import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------- Fechas (es-CO) ----------

// "9 nov 2026"
const FMT_DATE = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" })
// "9 nov 2026, 10:00 a. m."
const FMT_DATETIME = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

/** Fecha corta en español: «9 nov 2026». */
export function formatDateES(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return "—"
  return FMT_DATE.format(d)
}

/** Fecha y hora en español: «9 nov 2026, 10:00 a. m.» */
export function formatDateTimeES(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return "—"
  return FMT_DATETIME.format(d)
}

/** ISO → valor para <input type="datetime-local"> en la zona horaria local. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Valor de <input type="datetime-local"> → ISO (null si viene vacío o inválido). */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
