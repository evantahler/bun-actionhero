import { useEffect, useState } from "react";
import { Button, Card } from "react-bootstrap";
import type { ActionResponse } from "../../backend/api";
import type { Status } from "../../packages/keryx/actions/status";
import { wrappedFetch } from "../utils/client";

export const StatusCard = () => {
  const [status, setStatus] = useState<ActionResponse<Status>>();
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const response = await wrappedFetch<ActionResponse<Status>>("/status");
    if (response) setStatus(response);
  };

  return (
    <Card bg="primary">
      <Card.Header>Server Status</Card.Header>
      <Card.Body>
        <code>
          <strong>Name</strong>: {status?.name}
          <br />
          <strong>PID</strong>: {status?.pid}
          <br />
          <strong>Version</strong>: {status?.version}
          <br />
          <strong>Uptime</strong>: {status?.uptime ? status.uptime / 1000 : 0}s
          <br />
          <strong>Memory Used</strong>: {status?.consumedMemoryMB}MB
        </code>
      </Card.Body>

      <Button onClick={loadStatus}>Refresh</Button>
    </Card>
  );
};
