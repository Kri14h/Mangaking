import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Manga Reader",
  description: "Read your manga offline",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#000", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}