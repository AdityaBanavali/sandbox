import { useEffect, useState } from "react";
import { getDemoFixtures } from "../api/client";
import { FALLBACK_FIXTURES } from "../data/fallbackFixtures";
import { DemoFixture } from "../types";

export function useFixtures() {
  const [fixtures, setFixtures] = useState<DemoFixture[]>(FALLBACK_FIXTURES);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchFixtures() {
      try {
        setLoading(true);
        const data = await getDemoFixtures();
        if (isMounted) {
          if (data && data.length > 0) {
            setFixtures(data);
          } else {
            // Keep fallback fixtures if backend fixtures folder is empty
            setFixtures(FALLBACK_FIXTURES);
          }
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          // Gracefully fallback to local static fixtures on any network or server error
          setFixtures(FALLBACK_FIXTURES);
          setError(err.detail || "Using offline demo fixtures");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchFixtures();
    return () => {
      isMounted = false;
    };
  }, []);

  const getPresetFixture = (id: string): DemoFixture | undefined => {
    return fixtures.find((f) => f.id === id) || FALLBACK_FIXTURES.find((f) => f.id === id);
  };

  return { fixtures, loading, error, getPresetFixture };
}
