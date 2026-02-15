import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SPZ WebXR Viewer',
  description: 'Quest-friendly WebXR viewer for SPZ gaussian splat files.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
