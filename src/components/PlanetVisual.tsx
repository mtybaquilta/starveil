export function PlanetVisual() {
  return (
    <div className="w-full h-36 bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden">
      <div
        className="w-24 h-24 rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #3b82f6, #1e40af, #0f172a)',
          boxShadow: '0 0 40px rgba(59, 130, 246, 0.3), inset -10px -10px 20px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  )
}
