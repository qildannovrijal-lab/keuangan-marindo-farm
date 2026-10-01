import type { Metadata } from "next";
import { FarmDataProvider } from "@/lib/farm-data";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://keuangan-marindo-farm.vercel.app"),
  title: {
    default: "Keuangan Marindo Farm",
    template: "%s | Keuangan Marindo Farm",
  },
  description: "Pencatatan keuangan peternakan yang sederhana dan rapi.",
  icons: {
    icon: "/marindo-farm-mark.png",
    apple: "/marindo-farm-mark.png",
  },
  openGraph: {
    title: "Keuangan Marindo Farm",
    description: "Pencatatan keuangan peternakan yang sederhana dan rapi.",
    images: [{ url: "/marindo-farm-logo.png", width: 1254, height: 1254, alt: "Logo Marindo Farm" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">
        <FarmDataProvider>{children}</FarmDataProvider>
      </body>
    </html>
  );
}
