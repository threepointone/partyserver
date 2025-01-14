import { Demo } from "~/components/Demo.client";
import { useIsServer } from "~/hooks/useIsServer";

export default function Component() {
  const isServer = useIsServer();
  if (isServer) return null;
  return <Demo />;
}
