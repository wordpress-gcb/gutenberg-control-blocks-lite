import './globals.css';

export const metadata = {
  title: 'GCB Lite Component Server',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
