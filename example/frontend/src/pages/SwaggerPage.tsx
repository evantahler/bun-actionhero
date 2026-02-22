import { Card, Col, Row } from "react-bootstrap";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

import { useAuth } from "../hooks/useAuth";
import { API_URL } from "../utils/client";

const requestInterceptor = (req: Record<string, unknown>) => {
  req.credentials = "include";
  return req;
};

export default function SwaggerPage() {
  const { user } = useAuth();

  return (
    <Row className="justify-content-center mt-2">
      <Col lg={12}>
        <Card bg="dark" border="secondary">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">API Documentation</h4>
            {user && (
              <small className="text-muted">Authenticated as {user.name}</small>
            )}
          </Card.Header>
          <Card.Body className="p-0">
            <SwaggerUI
              url={`${API_URL}/api/swagger`}
              requestInterceptor={requestInterceptor}
            />
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
