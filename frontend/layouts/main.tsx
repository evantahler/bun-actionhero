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
        <title>{props.title}</title>
      </Head>

      {props.children}
    </>
  );
};
