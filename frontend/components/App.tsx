import { useEffect, useState } from "react";
import { Button, Col, Row, Table } from "react-bootstrap";
import type { UserView } from "../types/backend/actions/user";
import type { ActionResponse } from "../types/backend/api";
import { wrappedFetch } from "../utils/client";
import ChatCard from "./ChatCard";
import InfoBar from "./InfoBar";
import { SessionCreateCard } from "./SessionCreateCard";
import { SignUpCard } from "./SignUpCard";
import { StatusCard } from "./StatusCard";

export type AppUser = ActionResponse<UserView>["user"] | null;

export default function App() {
  const [user, setUser] = useState<AppUser>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrateUser();
  }, []);

  async function hydrateUser() {
    try {
      const response = await wrappedFetch<ActionResponse<UserView>>("/user");
      setSuccessMessage(`Welcome back, ${response.user.name}!`);
      setUser(response.user);
    } catch (error) {
      setUser(null);
    }
  }

  async function handleLogout() {
    try {
      await wrappedFetch("/session", { method: "DELETE" });
      setUser(null);
      setSuccessMessage("You have been logged out successfully");
    } catch (error) {
      setErrorMessage("Failed to log out");
    }
  }

  return (
    <>
      <Row>
        <Col>
          <InfoBar
            variant="success"
            message={successMessage}
            updateMessage={setSuccessMessage}
          />
          <InfoBar
            variant="danger"
            message={errorMessage}
            updateMessage={setErrorMessage}
          />
        </Col>
      </Row>

      <Row>
        <Col md={4}>
          <StatusCard />
        </Col>
        <Col>
          {user ? (
            <>
              <Table>
                <tbody>
                  <tr>
                    <td className="text-start">Signed in as {user.name}</td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={handleLogout}
                      >
                        Sign out
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </Table>

              <ChatCard
                user={user}
                setSuccessMessage={setSuccessMessage}
                setErrorMessage={setErrorMessage}
              />
            </>
          ) : (
            <Row>
              <Col>
                <h2>Sign In</h2>
                <SessionCreateCard
                  setUser={setUser}
                  setSuccessMessage={setSuccessMessage}
                  setErrorMessage={setErrorMessage}
                />
              </Col>
              <Col md={1}>Or</Col>
              <Col>
                <h2>Sign Up</h2>
                <SignUpCard
                  setUser={setUser}
                  setSuccessMessage={setSuccessMessage}
                  setErrorMessage={setErrorMessage}
                />
              </Col>
            </Row>
          )}
        </Col>
      </Row>
    </>
  );
}
