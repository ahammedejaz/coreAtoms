export default function Footer() {
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-neutral-500 flex items-center justify-between">
        <span>© {new Date().getFullYear()} Core Atoms. All rights reserved.</span>
        <span>Built with React + Tailwind</span>
      </div>
    </footer>
  );
}
