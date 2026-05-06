export default function VolunteersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-gray-200 rounded-lg" />
        <div className="h-9 w-32 bg-orange-200 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 max-w-sm bg-gray-100 rounded-lg" />
        <div className="h-9 w-36 bg-gray-100 rounded-lg" />
        <div className="h-9 w-36 bg-gray-100 rounded-lg" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 w-20 bg-gray-200 rounded" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-b border-gray-50 px-5 py-3.5 flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <div className="h-4 w-32 bg-gray-100 rounded" />
            <div className="h-4 w-48 bg-gray-100 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
