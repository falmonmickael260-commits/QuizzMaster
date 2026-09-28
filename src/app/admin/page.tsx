import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";
import "./admin.css";

export const metadata: Metadata = { title: "BLIND QUIZZ — Régie des questions" };

export default function AdminPage() {
  return <AdminApp />;
}
