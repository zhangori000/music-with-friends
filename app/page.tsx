import type { Metadata } from "next";
import { getDemoDashboard } from "@/src/application/demo/get-demo-dashboard";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Music with Friends — The Friday Loop",
  description:
    "A policy-aware social listening dashboard for friends, groups, and music discovery.",
};

export default function Home() {
  return <DashboardClient initialDashboard={getDemoDashboard("this_week")} />;
}
