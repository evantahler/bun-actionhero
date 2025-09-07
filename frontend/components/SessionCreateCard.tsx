import React from "react";
import { Button, Form } from "react-bootstrap";
import type { SessionCreate } from "../types/backend/actions/session";
import type { ActionResponse } from "../types/backend/api";
import { wrappedFetch } from "../utils/client";
import type { AppUser } from "./App";

export const SessionCreateCard = ({
  setUser,
  setSuccessMessage,
  setErrorMessage,
}: {
  setUser: React.Dispatch<React.SetStateAction<AppUser>>;
  setSuccessMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
}) => {
  async function handleForm(event: React.SyntheticEvent) {
    event.preventDefault();

    const target = event.target as typeof event.target & {
      email: { value: string };
      password: { value: string };
    };

    const body = new FormData();
    body.append("email", target.email.value);
    body.append("password", target.password.value);
    const response = await wrappedFetch<ActionResponse<SessionCreate>>(
      "/session",
      {
        method: "PUT",
        body,
      },
      (error) => {
        setErrorMessage(error.message);
      },
    );

    if (response) {
      setSuccessMessage(`Welcome back, ${response.user.name}!`);
      setUser(response.user);
    }
  }

  return (
    <div>
      <Form onSubmit={handleForm}>
        <Form.Group className="mb-3" controlId="email">
          <Form.Label>Email</Form.Label>
          <Form.Control type="text" placeholder="Enter Email Address" />
        </Form.Group>

        <Form.Group className="mb-3" controlId="password">
          <Form.Label>Password</Form.Label>
          <Form.Control type="password" placeholder="Enter Password" />
        </Form.Group>

        <Button variant="primary" type="submit">
          Submit
        </Button>
      </Form>
    </div>
  );
};
