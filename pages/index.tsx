import { Container } from "react-bootstrap";

import { StatusCard } from "../components/StatusCard";
import { MainLayout } from "../layouts/main";
import { mount } from "../util/browser";

export default function Page() {
  return (
    <MainLayout title="Hello World">
      <Container>
        <h1>Hello World</h1>
        <p>sups.</p>
        <hr />
        <StatusCard />
      </Container>
    </MainLayout>
  );
}

mount(Page);
