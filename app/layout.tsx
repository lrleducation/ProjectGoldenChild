import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Golden Child",
  description:
    "Raising awareness of childhood cancer, recognising children and families, and building a community that remembers every journey.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
