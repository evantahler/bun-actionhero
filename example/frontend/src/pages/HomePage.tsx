import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="keryx-hero">
      <img src="/images/hearald.svg" alt="Keryx" className="hero-icon" />
      <h1>Keryx</h1>
      <p className="lead">
        The messenger of the gods. A modern TypeScript framework built on Bun
        for realtime AI, CLI, and web applications.
      </p>
      {user ? (
        <Button as={Link as never} to="/chat" variant="primary" size="lg">
          Open Chat
        </Button>
      ) : (
        <div className="d-flex gap-3 justify-content-center">
          <Button as={Link as never} to="/sign-in" variant="primary" size="lg">
            Sign In
          </Button>
          <Button
            as={Link as never}
            to="/sign-up"
            variant="outline-primary"
            size="lg"
          >
            Sign Up
          </Button>
        </div>
      )}
    </div>
  );
}
