import type { Metadata } from "next";
import { LoginPage } from "@/features/auth/components/login-page";

export const metadata: Metadata = {
  title: "Acesso | TSTECK Projetos",
  description: "Acesse o Pipeline de Projetos TSTECK",
};

export default function Page() {
  return <LoginPage />;
}
