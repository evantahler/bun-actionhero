import React from "react";

export type LayoutProps = {
  title: string;
};

export const MainLayout = (props: React.PropsWithChildren<LayoutProps>) => {
  return (
    <div className="miami-vice-container">
      <div className="neon-grid"></div>
      {props.children}
    </div>
  );
};
