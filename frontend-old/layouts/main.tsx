import Head from "next/head";
import React from "react";

export type LayoutProps = {
  title: string;
};

export const MainLayout = (props: React.PropsWithChildren<LayoutProps>) => {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="/assets/styles/bootstrap.min.css"></link>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <title>{props.title}</title>
      </Head>

      <div className="miami-vice-container">
        <div className="neon-grid"></div>
        {props.children}
      </div>
    </>
  );
};
