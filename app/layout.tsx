/**
 * app/layout.tsx
 *
 * Root layout — wraps every page in the app.
 *
 * Responsibilities:
 *   1. Font loading — five font families are loaded via next/font and injected
 *      as CSS custom properties (--font-din-rounded, --font-nunito, etc.) so
 *      SettingsDropdown can switch between them at runtime without a page reload.
 *
 *   2. Flash-of-unstyled-font prevention — `appearanceScript` is inlined into
 *      <head> as a blocking script. It reads localStorage before React hydrates
 *      and applies the user's saved font family and scale to <html> immediately,
 *      eliminating visible layout shifts on load.
 *
 *   3. Global providers — <AuthProvider> (Supabase auth state) wraps children
 *      inside <LayoutWrapper> (session history tracker + layout mode selector).
 *
 *   4. Metadata — sets the browser tab title and page description.
 */
import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Geist_Mono, Nunito, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/context/auth-context";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import "./globals.css";

const dinRounded = localFont({
  src: [
    {
      path: "./fonts/DIN Next Rounded LT W01 Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/DIN Next Rounded LT W04 Medium.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-din-rounded",
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CIA Portal",
  description: "Platform asesmen karakter santri",
};

const appearanceScript = `
(() => {
  try {
    const root = document.documentElement;
    const font = window.localStorage.getItem("cia:font-family");
    const scale = window.localStorage.getItem("cia:font-scale");
    const allowedFonts = ["din", "nunito", "jakarta", "atkinson"];
    const fontMap = {
      din: "var(--font-din-rounded), var(--font-nunito), sans-serif",
      nunito: "var(--font-nunito), var(--font-din-rounded), sans-serif",
      jakarta: "var(--font-plus-jakarta), var(--font-din-rounded), sans-serif",
      atkinson: "var(--font-atkinson), var(--font-din-rounded), sans-serif"
    };
    const parsedScale = scale !== null ? Number(scale) : NaN;
    const selectedFont = allowedFonts.includes(font || "") ? font : "din";
    const selectedFamily = fontMap[selectedFont];

    root.dataset.fontFamily = selectedFont;
    root.style.setProperty("--app-font-family", selectedFamily);
    root.style.setProperty("--font-sans", selectedFamily);
    root.style.setProperty("--font-serif", selectedFamily);

    if (Number.isFinite(parsedScale) && parsedScale >= 0.9 && parsedScale <= 1.18) {
      root.style.setProperty("--app-font-scale", String(parsedScale));
    }

    if (document.body) {
      document.body.style.fontFamily = "var(--app-font-family)";
      if (Number.isFinite(parsedScale) && parsedScale >= 0.9 && parsedScale <= 1.18) {
        document.body.style.zoom = String(parsedScale);
      }
    }
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${dinRounded.variable} ${nunito.variable} ${plusJakarta.variable} ${atkinson.variable} ${geistMono.variable} antialiased min-h-screen`}
    >
      <body className={`${dinRounded.className} w-full bg-white min-h-screen flex flex-col relative m-0 p-0`}>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
        <LayoutWrapper>
          <AuthProvider>
            {children}
          </AuthProvider>
        </LayoutWrapper>
      </body>
    </html>
  );
}
