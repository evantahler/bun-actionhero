import { Container } from "react-bootstrap";
import App from "../components/App";
import { MainLayout } from "../layouts/main";

export default function Page() {
  return (
    <MainLayout title="Hello World">
      <Container>
        <h1>Keryx</h1>
        <p>
          <a href="/swagger">View API Endpoints</a>
        </p>
        <hr />
        <App />
      </Container>
    </MainLayout>
  );
}
