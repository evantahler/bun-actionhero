import React from "react";

export type LayoutProps = {
  title: string;
};

export const MainLayout = (props: React.PropsWithChildren<LayoutProps>) => {
  return (
    <React.StrictMode>
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>{props.title}</title>
        </head>
        <body>{props.children}</body>
      </html>
    </React.StrictMode>
  );
};
