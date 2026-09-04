import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="empty-state">
      <div className="emoji">🧭</div>
      <h2>Page not found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link className="btn btn-primary" to="/">
        Back to shop
      </Link>
    </div>
  );
}
