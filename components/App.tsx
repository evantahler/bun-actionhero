import { Row, Col } from "react-bootstrap";
import { StatusCard } from "./StatusCard";
import { SessionCreateCard } from "./SessionCreateCard";
import { SignUpCard } from "./SignUpCard";
import { useState } from "react";
import type { ActionResponse } from "../api";
import type { SessionCreate } from "../actions/session";
import InfoBar from "./InfoBar";
import ChatCard from "./ChatCard";

export type AppUser = ActionResponse<SessionCreate>["user"] | null;

export default function App() {
  const [user, setUser] = useState<AppUser>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            <ChatCard
              user={user}
              setSuccessMessage={setSuccessMessage}
              setErrorMessage={setErrorMessage}
            />
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
