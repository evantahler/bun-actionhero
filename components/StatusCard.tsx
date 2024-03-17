import { useEffect, useState } from "react";
import { Card } from "react-bootstrap";
import type { ActionResponse } from "../api";
import type { Status } from "../actions/status";

export const StatusCard = () => {
  const [status, setStatus] = useState<ActionResponse<Status>>();
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const response = (await fetch("/api/status").then((res) =>
      res.json(),
    )) as ActionResponse<Status>;
    setStatus(response);
  };

  return (
    <Card bg="primary">
      <Card.Header>Server Status</Card.Header>
      <Card.Body>{JSON.stringify(status)}</Card.Body>
    </Card>
  );
};
