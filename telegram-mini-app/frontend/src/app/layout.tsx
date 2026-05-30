import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'CRM Мастер | Telegram Mini App',
  description: 'Система записи клиентов для мастеров и клиентов',
  generator: 'v0.app',
  icons: {
    icon: '/apple-icon.png',
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
