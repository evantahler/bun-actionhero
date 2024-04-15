import { useState } from "react";
import { Alert } from "react-bootstrap";

const timeout = 1000 * 3;

export default function InfoBar({
  variant,
  message,
  updateMessage,
}: {
  message: string | null;
  updateMessage: React.Dispatch<React.SetStateAction<string | null>>;
  variant: "success" | "danger";
}) {
  const [show, setShow] = useState(false);
  let timer: ReturnType<typeof setTimeout>;

  if (message && !show) {
    setShow(true);
    timer = setTimeout(() => {
      updateMessage(null);
      setShow(false);
    }, timeout);
  }

  if (!message) return null;

  return (
    <Alert show={show} dismissible={false} variant={variant}>
      {message}
    </Alert>
  );
}
