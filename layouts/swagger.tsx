import React from "react";

export type LayoutProps = {
  title: string;
};

const swaggerVersion = "5.13.0";

export const SwaggerLayout = (props: React.PropsWithChildren<LayoutProps>) => {
  return (
    <React.StrictMode>
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <link
            rel="stylesheet"
            href={`https://unpkg.com/swagger-ui-dist@${swaggerVersion}/swagger-ui.css`}
          />
          <script
            src={`https://unpkg.com/swagger-ui-dist@${swaggerVersion}/swagger-ui-bundle.js`}
          ></script>

          <title>{props.title}</title>
        </head>
        <body>{props.children}</body>
      </html>
    </React.StrictMode>
  );
};
