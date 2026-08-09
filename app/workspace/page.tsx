import { CustomerWorkspace } from "@/components/explain/CustomerWorkspace";

export const metadata = { title: "Mandate, spending workspace" };

/**
 * Customer home. The existing root route is intentionally retained as the Operations
 * view, so the demo console and its raw audit controls remain available without a revert.
 */
export default function WorkspacePage() {
  return <CustomerWorkspace />;
}
