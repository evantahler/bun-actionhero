import { useEffect, useState } from "react";
import { Button, Card } from "react-bootstrap";
import type { Status } from "../../backend/actions/status";
import type { ActionResponse } from "../../backend/api";
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
    <Card bg="primary" data-testid="status-card">
      <Card.Header>Server Status</Card.Header>
      <Card.Body>
        <code>
          <strong>Name</strong>:{" "}
          <span data-testid="status-name">{status?.name ?? ""}</span>
          <br />
          <strong>PID</strong>:{" "}
          <span data-testid="status-pid">{status?.pid ?? ""}</span>
          <br />
          <strong>Version</strong>:{" "}
          <span data-testid="status-version">{status?.version ?? ""}</span>
          <br />
          <strong>Uptime</strong>:{" "}
          <span data-testid="status-uptime">
            {status?.uptime ? status.uptime / 1000 : 0}
          </span>
          s
          <br />
          <strong>Memory Used</strong>:{" "}
          <span data-testid="status-memory">{status?.consumedMemoryMB ?? ""}</span>
          MB
        </code>
      </Card.Body>

      <Button data-testid="status-refresh" onClick={loadStatus}>
        Refresh
      </Button>
    </Card>
  );
};
