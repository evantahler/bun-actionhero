import { Routes, Route, Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import { MainLayout } from "./layouts/main";
import { SwaggerLayout } from "./layouts/swagger";
import HomePage from "./pages/HomePage";
import SwaggerPage from "./pages/SwaggerPage";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <MainLayout title="Hello World">
            <Container>
              <h1>Bun Actionhero</h1>
              <p>
                <Link to="/swagger">View API Endpoints</Link>
              </p>
              <hr />
              <HomePage />
            </Container>
          </MainLayout>
        }
      />
      <Route
        path="/swagger"
        element={
          <SwaggerLayout title="API Endpoints">
            <SwaggerPage />
          </SwaggerLayout>
        }
      />
    </Routes>
  );
}

export default App;
