import type { IconName } from "@/components/common/Icon";

export interface NavItem { path: string; label: string; icon: IconName; title: string; subtitle: string }

export const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Overview", icon: "grid", title: "Thermal Intelligence Overview", subtitle: "Satellite-derived thermal observations and industrial risk monitoring" },
  { path: "/map", label: "Thermal Map", icon: "map", title: "Thermal Map", subtitle: "Interactive geospatial view of thermal events and industrial facilities" },
  { path: "/investigation", label: "AI Investigation", icon: "scan", title: "AI Investigation", subtitle: "Explainable, AI-assisted analysis of a selected thermal event" },
  { path: "/alerts", label: "Alerts", icon: "bell", title: "Alert Center", subtitle: "Triage and acknowledge prioritised thermal alerts" },
  { path: "/sites", label: "Industrial Sites", icon: "factory", title: "Industrial Sites", subtitle: "Facility-level thermal activity and persistence" },
  { path: "/analytics", label: "Analytics", icon: "chart", title: "Analytics", subtitle: "Trends, distributions and source activity" },
  { path: "/history", label: "History", icon: "clock", title: "Historical Activity", subtitle: "Persistence and past observations for a location" },
  { path: "/reports", label: "Reports", icon: "file", title: "Investigation Reports", subtitle: "Generate, review and export thermal event investigation reports." },
  { path: "/settings", label: "Settings", icon: "settings", title: "Settings", subtitle: "Data source and display configuration" },
];
