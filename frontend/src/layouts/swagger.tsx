import React from "react";
import { Alert } from "react-bootstrap";

export type LayoutProps = {
  title: string;
};

const swaggerVersion = "5.13.0";

export const SwaggerLayout = (props: React.PropsWithChildren<LayoutProps>) => {
  return (
    <Alert variant="info" className="swagger-alert">
      {props.children}
    </Alert>
  );
};
