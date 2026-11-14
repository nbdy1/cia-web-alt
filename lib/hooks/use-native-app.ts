"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * True when running inside the Android app. Resolved after mount (false on the
 * server and for the first client render) so server and client markup match.
 */
export function useNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNative(isNativeApp());
  }, []);
  return native;
}
