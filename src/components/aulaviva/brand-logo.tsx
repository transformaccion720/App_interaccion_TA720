// Marca de la plataforma: logo "Transform Acción 720".
// `dark` indica que va sobre fondo oscuro (usa la variante con texto blanco).
export function BrandLogo({
  dark = false,
  className = 'h-9 w-auto',
  alt = 'Transform Acción 720',
}: {
  dark?: boolean
  className?: string
  alt?: string
}) {
  return (
     
    <img
      src={dark ? '/logo-white.png' : '/logo.png'}
      alt={alt}
      className={`${className} select-none`}
      draggable={false}
    />
  )
}
