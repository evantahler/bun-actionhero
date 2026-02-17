import { Col, Container, Row } from "react-bootstrap";
import { SwaggerCard } from "../components/SwaggerCard";
import { SwaggerLayout } from "../layouts/swagger";

export default function Page() {
  return (
    <SwaggerLayout title="API Endpoints">
      <Container>
        <Row>
          <Col md={12}>
            <SwaggerCard />
          </Col>
        </Row>
      </Container>
    </SwaggerLayout>
  );
}
