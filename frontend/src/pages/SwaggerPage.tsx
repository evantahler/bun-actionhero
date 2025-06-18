import { Container, Row, Col } from "react-bootstrap";
import { SwaggerCard } from "../components/SwaggerCard";

export default function SwaggerPage() {
  return (
    <Container>
      <Row>
        <Col md={12}>
          <SwaggerCard />
        </Col>
      </Row>
    </Container>
  );
}
