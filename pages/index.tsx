import ReactDOM from "react-dom/client";

import { StatusCard } from "../components/StatusCard";
import { MainLayout } from "../layouts/main";
import { Container } from "react-bootstrap";

const Page = () => {
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
};

ReactDOM.createRoot(document as any).render(<Page />);
