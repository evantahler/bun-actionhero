import { Button, Form } from "react-bootstrap";
import type { ActionResponse } from "../api";
import type { Hello } from "../actions/hello";
import { useState } from "react";

export const HelloCard = () => {
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function handleForm(event: React.SyntheticEvent) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);

    const target = event.target as typeof event.target & {
      name: { value: string };
    };
    const name = target.name.value;
    const body = new FormData();
    body.append("name", name);
    const response = (await fetch("/api/hello", { method: "post", body }).then(
      (res) => res.json(),
    )) as ActionResponse<Hello>;

    if (response.error) {
      setError(response.error.message);
    } else {
      setMessage(response.message);
    }
  }

  return (
    <div>
      <Form onSubmit={handleForm}>
        <Form.Group className="mb-3" controlId="name">
          <Form.Label>Name</Form.Label>
          <Form.Control type="text" placeholder="Enter name" />
        </Form.Group>

        <Button variant="primary" type="submit">
          Submit
        </Button>
      </Form>

      <br />
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
    </div>
  );
};
