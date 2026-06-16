import { describe, expect, it } from "vitest";
import { QUEUE_MESSAGE, ELABORATE_MESSAGE } from "@/lib/mail/messages";

describe("mensagens dos e-mails automáticos", () => {
  it("mensagem de projeto criado (em fila)", () => {
    expect(QUEUE_MESSAGE).toBe(
      "Seu projeto já está em fila aguardando local da cabine e projeto da obra.",
    );
  });

  it("mensagem de entrada em Elaborar Ante-Projeto (esteira, 45 dias)", () => {
    expect(ELABORATE_MESSAGE).toContain("esteira de desenvolvimento");
    expect(ELABORATE_MESSAGE).toContain("45 dias");
  });
});
