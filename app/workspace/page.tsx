import { CustomerWorkspace } from "@/components/explain/CustomerWorkspace";

export const metadata = { title: "Mandate — spending workspace" };

/**
 * Backwards-compatible workspace route. The same human home is now the root route.
 */
export default function WorkspacePage() {
  return <CustomerWorkspace />;
}
