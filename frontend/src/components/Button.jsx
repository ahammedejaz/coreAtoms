export default function Button({ className = "", variant = "primary", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 transform active:scale-[0.98]";

  const styles = {
    primary:
      "bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 text-slate-900 hover:from-gray-400 hover:to-gray-400 hover:-translate-y-0.5 premium-card",
    outline:
      "border border-gray-200 bg-white text-slate-900 hover:bg-gray-50 hover:-translate-y-0.5 premium-card",
    ghost:
      "bg-transparent text-slate-900 hover:bg-gray-100",
  };

  return (
    <button
      className={`${base} ${styles[variant] || styles.primary} ${className}`}
      {...props}
    />
  );
}
