import { Container, Row, Col } from "react-bootstrap";
import { mount } from "../util/browser";

import { StatusCard } from "../components/StatusCard";
import { MainLayout } from "../layouts/main";
import { HelloCard } from "../components/HelloCard";
import { SwaggerCard } from "../components/SwaggerCard";

export default function Page() {
  return (
    <MainLayout title="Hello World">
      <Container>
        <h1>Hello World</h1>
        <p>sups.</p>
        <hr />
        <Row>
          <Col md={6}>
            <StatusCard />
          </Col>
          <Col>
            <HelloCard />
          </Col>
        </Row>
        <br />
        <Row>
          <Col md={12}>
            <SwaggerCard />
          </Col>
        </Row>
      </Container>
    </MainLayout>
  );
}

mount(Page);
