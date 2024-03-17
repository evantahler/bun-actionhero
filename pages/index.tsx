import { StatusCard } from "../components/StatusCard";
import { MainLayout } from "../layouts/main";
import { Container } from "react-bootstrap";

export const Page = () => (
  <MainLayout title="Hello World">
    <Container>
      <h1>Hello World</h1>
      <p>sups.</p>
      <hr />
      <StatusCard />
    </Container>
    {/* <div>

    </div> */}
  </MainLayout>
);
