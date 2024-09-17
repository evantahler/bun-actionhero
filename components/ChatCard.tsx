import { Row, Col, Form, Button, Table } from "react-bootstrap";
import type { AppUser } from "./App";
import type { ActionResponse } from "../api";
import type { MessageCrete, MessagesList } from "../actions/message";
import { useEffect, useState } from "react";

export default function ChatCard({
  user,
  setSuccessMessage,
  setErrorMessage,
}: {
  user: AppUser;
  setSuccessMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const [messages, setMessages] = useState<
    ActionResponse<MessagesList>["messages"]
  >([]);

  let ws: WebSocket;
  function connect() {
    ws = new WebSocket("");

    // Connection opened
    ws.addEventListener("open", (event) => {
      ws.send("Hello Server!");
    });

    // Listen for messages
    ws.addEventListener("message", (event) => {
      console.log("Message from server ", event.data);
    });
  }

  async function sendMessage(event: React.SyntheticEvent) {
    event.preventDefault();

    const target = event.target as typeof event.target & {
      body: { value: string };
    };

    const body = new FormData();
    body.append("body", target.body.value);
    const response = (await fetch("/api/message", {
      method: "put",
      body,
    }).then((res) => res.json())) as ActionResponse<MessageCrete>;

    if (response.error) {
      setErrorMessage(response.error.message);
    } else {
      //@ts-ignore
      event.target.reset();
      loadMessages();
    }
  }

  async function loadMessages() {
    const response = (await fetch("/api/messages/list").then((res) =>
      res.json(),
    )) as ActionResponse<MessagesList>;

    if (response.error) {
      setErrorMessage(response.error.message);
    }
    setMessages(response.messages);
  }

  useEffect(() => {
    connect();
    loadMessages();
    // setInterval(loadMessages, 5000);
  }, []);

  return (
    <>
      <Row>
        <Col>
          <Form onSubmit={sendMessage}>
            <Form.Group className="mb-3" controlId="body">
              <Form.Label>Message</Form.Label>
              <Form.Control type="text" placeholder="Message" />
            </Form.Group>

            <Button variant="primary" type="submit">
              Send
            </Button>
          </Form>
        </Col>
      </Row>

      <hr />

      <Row>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Who</th>
              <th>When</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr key={message.id}>
                <td>{message.user_name}</td>
                <td>{formatDate(message.createdAt)}</td>
                <td>{message.body}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Row>
    </>
  );
}

function formatDate(t: number) {
  const d = new Date(t);
  const s =
    d.getUTCFullYear() +
    "-" +
    ("00" + (d.getUTCMonth() + 1)).slice(-2) +
    "-" +
    ("00" + d.getUTCDate()).slice(-2) +
    " " +
    ("00" + d.getUTCHours()).slice(-2) +
    ":" +
    ("00" + d.getUTCMinutes()).slice(-2) +
    ":" +
    ("00" + d.getUTCSeconds()).slice(-2);

  return s;
}
