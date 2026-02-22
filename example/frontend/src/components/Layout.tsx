import { Container, Nav, Navbar } from "react-bootstrap";
import { Link, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="md" className="mb-4">
        <Container>
          <Navbar.Brand as={Link} to="/">
            Keryx
          </Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse>
            <Nav className="me-auto" activeKey={location.pathname}>
              <Nav.Link as={Link} to="/status" eventKey="/status">
                Status
              </Nav.Link>
              <Nav.Link as={Link} to="/swagger" eventKey="/swagger">
                API
              </Nav.Link>
              {user && (
                <Nav.Link as={Link} to="/chat" eventKey="/chat">
                  Chat
                </Nav.Link>
              )}
            </Nav>
            <Nav>
              {user ? (
                <>
                  <Navbar.Text className="me-3">
                    Signed in as <strong>{user.name}</strong>
                  </Navbar.Text>
                  <Nav.Link onClick={() => signOut()}>Sign out</Nav.Link>
                </>
              ) : (
                <>
                  <Nav.Link as={Link} to="/sign-in">
                    Sign in
                  </Nav.Link>
                  <Nav.Link as={Link} to="/sign-up">
                    Sign up
                  </Nav.Link>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container>
        <Outlet />
      </Container>
    </>
  );
}
