cat > tailwind.config.js << 'EOF'
/** Tailwind v4: config is optional (CSS-first), but we keep this for future customizations. */
export default {
    content: ["./index.html", "./src/**/*.{js,jsx}"],
    theme: { extend: {} },
    plugins: [],
}
EOF