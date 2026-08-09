import { CustomerWorkspace } from "@/components/explain/CustomerWorkspace";

/**
 * The human operator's home. Agents act through the API; people begin with the state of
 * their organization, not a raw transaction trace.
 */
export default function HomePage() {
  return <CustomerWorkspace />;
}
