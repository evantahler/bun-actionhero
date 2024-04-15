import type { AppUser } from "./App";

export default function ChatCard({
  user,
  setSuccessMessage,
  setErrorMessage,
}: {
  user: AppUser;
  setSuccessMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  return <></>;
}
