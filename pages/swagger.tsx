import { Container, Row, Col } from "react-bootstrap";
import { mount } from "../util/browser";
import { SwaggerLayout } from "../layouts/swagger";
import { SwaggerCard } from "../components/SwaggerCard";

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

mount(Page);
