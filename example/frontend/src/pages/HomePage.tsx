import { Button, Card, Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <Row className="justify-content-center mt-4">
      <Col md={8} lg={6}>
        <Card bg="dark" border="secondary" className="text-center">
          <Card.Body className="py-5">
            <h1 className="mb-3">Keryx</h1>
            <p className="text-muted mb-4">
              The messenger of the gods. A modern TypeScript framework built on
              Bun for realtime AI, CLI, and web applications.
            </p>
            {user ? (
              <Button as={Link as never} to="/chat" variant="primary" size="lg">
                Open Chat
              </Button>
            ) : (
              <div className="d-flex gap-3 justify-content-center">
                <Button
                  as={Link as never}
                  to="/sign-in"
                  variant="primary"
                  size="lg"
                >
                  Sign In
                </Button>
                <Button
                  as={Link as never}
                  to="/sign-up"
                  variant="outline-light"
                  size="lg"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
