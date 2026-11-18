import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OV Credential Assistant',
  description: 'Apply for your student public transport credential',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
