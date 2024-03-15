import React, { type ReactNode } from "react";

export const MainLayout = (page: ReactNode) => {
  return (
    <React.StrictMode>
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Document</title>
        </head>
        <body>{page}</body>
      </html>
    </React.StrictMode>
  );
};
