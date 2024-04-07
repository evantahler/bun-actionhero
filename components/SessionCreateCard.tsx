import { Button, Form } from "react-bootstrap";
import type { ActionResponse } from "../api";
import type { SessionCreate } from "../actions/session";
import React, { useState } from "react";

export const SessionCard = () => {
  const [success, setSuccess] = useState<string>();
  const [error, setError] = useState<string>();

  async function handleForm(event: React.SyntheticEvent) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const target = event.target as typeof event.target & {
      email: { value: string };
      password: { value: string };
    };

    const body = new FormData();
    body.append("email", target.email.value);
    body.append("password", target.password.value);
    const response = (await fetch("/api/session", {
      method: "put",
      body,
    }).then((res) => res.json())) as ActionResponse<SessionCreate>;

    if (response.error) {
      setError(response.error.message);
    } else {
      setSuccess(`Welcome ${response.user.name}!`);
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

      <br />
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
    </div>
  );
};
