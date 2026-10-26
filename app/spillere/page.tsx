"use client";

import { PeopleIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";

/** The right half of Spillere when no one is chosen (from 900 pixels; on a phone the list is the page and this is not shown). */
export default function PlayersIndexPage() {
  return (
    <div className="screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <EmptyState icon={<PeopleIcon className="w-6 h-6" />} title="Velg en spiller" />
      </div>
    </div>
  );
}
