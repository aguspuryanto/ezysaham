import { ScreenerPage } from "@/presentation/features/screener/ScreenerPage";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* Header */}
      {/* <header className="bg-white text-black shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">StockPilot AI</h1>
            <nav>
              <ul className="flex space-x-6">
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">Home</a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">Dashboard</a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">Screener</a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">Watchlist</a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </header> */}

      {/* Content */}
      <main className="flex-1">
        <ScreenerPage />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-100">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm">© 2026 StockPilot AI. All rights reserved.</p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
