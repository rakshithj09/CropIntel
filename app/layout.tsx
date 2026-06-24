import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ui/theme-provider'
import CursorField from '@/components/CursorField'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['400', '600', '700', '800'],
})
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'CropIntel - Field Crop Checks',
  description: 'Check crop leaf photos, save farm areas, and watch nearby crop issue reports.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#eceee7',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        <CursorField />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
