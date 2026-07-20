import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";

/**
 * Hook to get the current organization ID from localStorage.
 * Falls back to the first org from the API.
 */
export function useOrgId(): number | null {
  const [orgId, setOrgId] = useState<number | null>(() => {
    const saved = localStorage.getItem("mailflow-current-org");
    return saved ? parseInt(saved, 10) : null;
  });

  const { data: orgs } = trpc.org.list.useQuery();

  useEffect(() => {
    if (!orgId && orgs && orgs.length > 0) {
      setOrgId(orgs[0].id);
    }
  }, [orgs, orgId]);

  // Listen for org changes from the sidebar switcher
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem("mailflow-current-org");
      if (saved) setOrgId(parseInt(saved, 10));
    };
    window.addEventListener("storage", handler);
    window.addEventListener("org-changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("org-changed", handler);
    };
  }, []);

  return orgId;
}
