import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { Toaster } from '@/components/ui/toaster'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'CRM Мастер | Telegram Mini App',
  description: 'Система записи клиентов для мастеров и клиентов',
  generator: 'v0.app',
  icons: {
    icon: '/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#22c55e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Script id="telegram-webapp-ready" strategy="afterInteractive">
          {`
            (function () {
              var attempts = 0;
              function markReady() {
                var tg = window.Telegram && window.Telegram.WebApp;
                if (!tg) {
                  attempts += 1;
                  if (attempts < 60) {
                    window.setTimeout(markReady, 250);
                  }
                  return;
                }
                try { tg.ready(); } catch (e) {}
                try { tg.expand(); } catch (e) {}
              }
              markReady();
            })();
          `}
        </Script>
        {children}
        <Toaster />
        <Analytics/>
      </body>
    </html>
  )
}
