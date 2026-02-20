import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7fa]">
      <Navbar />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}
