import MotionProvider from "@/components/motion/MotionProvider";
import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
export const metadata: Metadata = {
  title: "ATL / Out — Your week, out in the city",
  description:
    "Explore Downtown, Midtown and Georgia Tech. Make a plan worth getting out for.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="day">
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
