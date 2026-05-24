import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { AuthProvider } from "@/lib/context/auth-context";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});


export const metadata: Metadata = {
  title: "CIA Portal",
  description: "Platform asesmen karakter santri",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased min-h-screen`}
    >
      <body className="w-full bg-white min-h-screen flex flex-col relative m-0 p-0">
        <LayoutWrapper>
          <AuthProvider>
            {children}
          </AuthProvider>
        </LayoutWrapper>
      </body>
    </html>
  );
}
