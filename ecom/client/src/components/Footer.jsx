export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>© {new Date().getFullYear()} ShopVerse. Demo store — no real orders.</span>
        <span>React + Express · Caching &amp; scaling planned for phase 2</span>
      </div>
    </footer>
  );
}
