import planetVisualImg from '../assets/planets.png'

export function PlanetVisual() {
  return (
    <div className="w-full rounded-xl flex items-center justify-center relative overflow-hidden">
      {planetVisualImg && (
        <img src={planetVisualImg} alt="" className="rounded object-cover opacity-80" />
      )}
    </div>
  )
}
