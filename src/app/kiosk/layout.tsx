export const metadata = {
  title: 'Volunteer Kiosk | Lighthouse Care',
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
