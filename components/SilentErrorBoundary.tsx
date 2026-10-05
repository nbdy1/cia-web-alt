"use client";

import React from "react";

/**
 * Isolates an optional widget (e.g. the treatment follow-up reminder card).
 * If it throws while rendering, the widget disappears and the rest of the page
 * keeps working, instead of the whole route falling back to the error screen.
 */
export class SilentErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.label ?? "widget"}] failed to render:`, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
