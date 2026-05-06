export default function RosterLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-24 bg-gray-200 rounded-lg" />
          <div className="h-4 w-40 bg-gray-100 rounded mt-1" />
        </div>
        <div className="h-9 w-24 bg-orange-200 rounded-lg" />
      </div>
      {/* Controls */}
      <div className="flex gap-3">
        <div className="h-9 w-36 bg-gray-200 rounded-lg" />
        <div className="h-9 w-40 bg-gray-200 rounded-lg" />
      </div>
      {/* Nav */}
      <div className="flex gap-2">
        <div className="h-9 w-32 bg-gray-100 rounded-lg" />
        <div className="h-9 w-24 bg-orange-100 rounded-lg" />
        <div className="h-9 w-32 bg-gray-100 rounded-lg" />
      </div>
      {/* Day cards */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
            <div className="h-5 w-32 bg-gray-200 rounded" />
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="h-4 w-48 bg-gray-100 rounded" />
            <div className="h-4 w-64 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
