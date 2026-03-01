import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata = {
  title: "SBEK Dashboard",
  description: "SBEK Automation Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: "#0C0D0B", margin: 0 }}>
        <Sidebar />
        <main
          style={{
            marginLeft: 260,
            minHeight: "100vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "32px 40px",
              maxWidth: 1400,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
