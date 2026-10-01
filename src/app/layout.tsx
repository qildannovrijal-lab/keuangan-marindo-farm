import type { Metadata } from "next";
import { FarmDataProvider } from "@/lib/farm-data";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Keuangan Marindo Farm",
    template: "%s | Keuangan Marindo Farm",
  },
  description: "Pencatatan keuangan peternakan yang sederhana dan rapi.",
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
