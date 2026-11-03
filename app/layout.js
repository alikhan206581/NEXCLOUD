
import "./globals.css";

export const metadata = {
  title: "NEXCLOUD | Business Cloud Storage",
  description: "Secure business cloud storage platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
