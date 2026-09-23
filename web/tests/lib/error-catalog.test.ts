// @vitest-environment node
// Camada central de tradução de erros. O objetivo principal destes testes é
// garantir que NENHUM código técnico chegue ao texto exibido ao usuário.
import { describe, expect, it } from "vitest";
import {
  getUserFriendlyError,
  formatCountdown,
  formatRetryDuration,
  describeRetryDelay,
  looksLikeErrorCode,
  codeFromStatus,
  statusForCode,
  isAppErrorCode,
} from "@/lib/errors/error-catalog";

const TECHNICAL_LEAKS = [
  "INTERNAL_ERROR",
  "RATE_LIMIT",
  "SERVICE_UNAVAILABLE",
  "INVALID_CREDENTIALS",
  "VALIDATION_ERROR",
  "Prisma",
  "prisma",
  "MySQL",
  "Redis",
  "DATABASE_URL",
  "exemplo.invalid",
];

function assertNoLeak(text: string) {
  for (const leak of TECHNICAL_LEAKS) {
    expect(text).not.toContain(leak);
  }
}

describe("getUserFriendlyError — nada técnico vaza", () => {
  const codes = [
    "VALIDATION_ERROR",
    "INVALID_CREDENTIALS",
    "ACCOUNT_INACTIVE",
    "SESSION_EXPIRED",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "CSRF_INVALID",
    "NOT_FOUND",
    "CONFLICT",
    "RATE_LIMIT",
    "SERVICE_UNAVAILABLE",
    "INTERNAL_ERROR",
    "NETWORK_ERROR",
  ];

  it.each(codes)("%s produz título e descrição humanos", (code) => {
    const friendly = getUserFriendlyError(code);
    expect(friendly.title.length).toBeGreaterThan(3);
    expect(friendly.description.length).toBeGreaterThan(10);
    assertNoLeak(friendly.title);
    assertNoLeak(friendly.description);
  });

  it("um código DESCONHECIDO nunca é exibido como texto", () => {
    const friendly = getUserFriendlyError("ALGUM_CODIGO_NOVO", { status: 500 });
    expect(friendly.title).not.toContain("ALGUM_CODIGO_NOVO");
    expect(friendly.description).not.toContain("ALGUM_CODIGO_NOVO");
    expect(friendly.code).toBe("INTERNAL_ERROR");
  });

  it("uma `message` que na verdade é um código NÃO vira descrição", () => {
    const friendly = getUserFriendlyError(null, {
      status: 429,
      fallbackMessage: "RATE_LIMIT",
      preferServerMessage: true,
    });
    expect(friendly.description).not.toContain("RATE_LIMIT");
    expect(friendly.code).toBe("RATE_LIMIT");
    expect(friendly.title).toBe("Muitas tentativas de acesso");
  });
});

describe("textos exigidos pela especificação", () => {
  it("INVALID_CREDENTIALS", () => {
    const f = getUserFriendlyError("INVALID_CREDENTIALS");
    expect(f.title).toBe("Usuário ou senha incorretos");
    expect(f.description).toBe("Verifique seus dados e tente novamente.");
  });

  it("RATE_LIMIT não oferece 'Tentar novamente'", () => {
    const f = getUserFriendlyError("RATE_LIMIT", { retryAfterSeconds: 522 });
    expect(f.title).toBe("Muitas tentativas de acesso");
    expect(f.retryable).toBe(false);
    expect(f.actionLabel).toBeNull();
    expect(f.retryAfterSeconds).toBe(522);
    expect(f.retryHint).toBe("aproximadamente 9 minutos");
  });

  it("SERVICE_UNAVAILABLE oferece retry", () => {
    const f = getUserFriendlyError("SERVICE_UNAVAILABLE", { requestId: "8F2C-91A4" });
    expect(f.title).toBe("Sistema temporariamente indisponível");
    expect(f.retryable).toBe(true);
    expect(f.actionLabel).toBe("Tentar novamente");
  });

  it("INTERNAL_ERROR muda de título na tela de login", () => {
    expect(getUserFriendlyError("INTERNAL_ERROR").title).toBe(
      "Não foi possível concluir a operação",
    );
    expect(getUserFriendlyError("INTERNAL_ERROR", { surface: "login" }).title).toBe(
      "Não foi possível concluir o acesso",
    );
  });

  it("SESSION_EXPIRED e ACCOUNT_INACTIVE", () => {
    expect(getUserFriendlyError("SESSION_EXPIRED").title).toBe("Sua sessão expirou");
    expect(getUserFriendlyError("ACCOUNT_INACTIVE").title).toBe("Acesso indisponível");
  });

  it("NETWORK_ERROR", () => {
    const f = getUserFriendlyError("NETWORK_ERROR", { status: 0 });
    expect(f.title).toBe("Falha de comunicação");
    expect(f.retryable).toBe(true);
  });
});

describe("requestId é interno — nunca vira texto para o usuário", () => {
  it.each(["INTERNAL_ERROR", "SERVICE_UNAVAILABLE", "INVALID_CREDENTIALS", "RATE_LIMIT"])(
    "%s não expõe o requestId no título nem na descrição",
    (code) => {
      const f = getUserFriendlyError(code, { requestId: "8F2C-91A4" });
      expect(f.title).not.toContain("8F2C-91A4");
      expect(f.description).not.toContain("8F2C-91A4");
      expect(f).not.toHaveProperty("supportCode");
    },
  );
});

describe("mensagem específica da rota (telas genéricas)", () => {
  it("preferServerMessage deixa a frase da rota vencer o catálogo", () => {
    const f = getUserFriendlyError("VALIDATION_ERROR", {
      status: 400,
      fallbackMessage: "Nome já cadastrado.",
      preferServerMessage: true,
    });
    expect(f.description).toBe("Nome já cadastrado.");
  });

  it("sem preferServerMessage, o catálogo vence (texto padronizado do login)", () => {
    const f = getUserFriendlyError("RATE_LIMIT", {
      status: 429,
      fallbackMessage: "Muitas tentativas. Tente novamente em alguns minutos.",
    });
    expect(f.description).toContain("Por segurança");
  });
});

describe("helpers", () => {
  it("formatCountdown (rótulo do botão)", () => {
    expect(formatCountdown(522)).toBe("08:42");
    expect(formatCountdown(787)).toBe("13:07");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
    expect(formatCountdown(59)).toBe("00:59");
  });

  it("formatRetryDuration (texto do alerta)", () => {
    expect(formatRetryDuration(787)).toBe("13 min 07 s");
    expect(formatRetryDuration(522)).toBe("8 min 42 s");
    expect(formatRetryDuration(47)).toBe("47 s");
    expect(formatRetryDuration(0)).toBe("0 s");
    expect(formatRetryDuration(-3)).toBe("0 s");
  });

  it("describeRetryDelay", () => {
    expect(describeRetryDelay(30)).toBe("alguns segundos");
    expect(describeRetryDelay(60)).toBe("aproximadamente 1 minuto");
    expect(describeRetryDelay(420)).toBe("aproximadamente 7 minutos");
  });

  it("looksLikeErrorCode", () => {
    expect(looksLikeErrorCode("RATE_LIMIT")).toBe(true);
    expect(looksLikeErrorCode("INTERNAL_ERROR")).toBe(true);
    expect(looksLikeErrorCode("Usuário ou senha incorretos.")).toBe(false);
  });

  it("codeFromStatus e statusForCode são coerentes", () => {
    expect(codeFromStatus(429)).toBe("RATE_LIMIT");
    expect(codeFromStatus(503)).toBe("SERVICE_UNAVAILABLE");
    expect(codeFromStatus(undefined)).toBe("INTERNAL_ERROR");
    expect(statusForCode("RATE_LIMIT")).toBe(429);
    expect(statusForCode("SERVICE_UNAVAILABLE")).toBe(503);
    expect(statusForCode("INVALID_CREDENTIALS")).toBe(401);
  });

  it("isAppErrorCode", () => {
    expect(isAppErrorCode("RATE_LIMIT")).toBe(true);
    expect(isAppErrorCode("NAO_EXISTE")).toBe(false);
  });
});
