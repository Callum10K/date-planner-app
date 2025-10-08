import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Define the metadata for the application (Server Component feature)
export const metadata: Metadata = {
  title: 'Kuromi Gothic Trip Planner',
  description: 'An exclusive, cute-punk trip itinerary planner for Admin and Trusted users.',
  keywords: ['Kuromi', 'Sanrio', 'Trip Planner', 'Gothic', 'Next.js'],
  viewport: 'width=device-width, initial-scale=1.0',
};

// The Root Layout component wraps the entire application.
// It applies the base styles (Tailwind dark background) and structure.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Load Inter font from Google Fonts */}
        <link 
            href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" 
            rel="stylesheet" 
        />
        {/*
          NOTE: In a real Vercel environment, Tailwind CSS compilation 
          is handled by the build process, so we don't need the CDN script here.
        */}
      </head>
      {/* Apply the base dark theme background to the body */}
      <body className="bg-gray-900 text-white font-inter">
        {children}
      </body>
    </html>
  );
}

