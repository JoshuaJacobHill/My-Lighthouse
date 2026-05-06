export default function VolunteerLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-56 bg-gray-200 rounded-lg" />
          <div className="h-4 w-40 bg-gray-100 rounded mt-1" />
        </div>
        <div className="h-6 w-20 bg-orange-100 rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="h-3 w-28 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-6 w-40 bg-gray-200 rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 flex gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-52 bg-gray-100 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
