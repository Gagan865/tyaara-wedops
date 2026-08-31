import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Tyaara — The Tales Of Wedding',
  description: 'Tyaara — the wedding-planning workspace built for Indian weddings.'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FBF8F1] text-slate-900 antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
