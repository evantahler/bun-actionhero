import { Container } from "react-bootstrap";
import { MainLayout } from "../layouts/main";
import App from "../components/App";

export default function Page() {
  return (
    <MainLayout title="Hello World">
      <Container>
        <h1>Hello World</h1>
        <p>
          <a href="/swagger">View API Endpoints</a>
        </p>
        <hr />
        <App />
      </Container>
    </MainLayout>
  );
}
