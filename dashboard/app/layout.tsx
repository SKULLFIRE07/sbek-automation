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
            marginLeft: 220,
            minHeight: "100vh",
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "20px" }}>{children}</div>
        </main>
      </body>
    </html>
  );
}
