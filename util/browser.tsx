import ReactDOM from "react-dom/client";

/**
 * From https://stackoverflow.com/questions/32216383/in-react-how-do-i-detect-if-my-component-is-rendering-from-the-client-or-the-se
 */
export const isBrowser = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

export const mount = (Node: () => JSX.Element) => {
  if (isBrowser) {
    ReactDOM.createRoot(document as any).render(<Node />);
  }
};
