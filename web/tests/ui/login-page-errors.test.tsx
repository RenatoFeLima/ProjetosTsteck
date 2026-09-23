import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoginResult } from "@/features/auth/lib/auth-types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const loginMock = vi.fn<(u: string, p: string) => Promise<LoginResult>>();
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ login: loginMock }),
}));

import { LoginPage } from "@/features/auth/components/login-page";

/** Textos que JAMAIS podem aparecer para o usuário final. */
const NEVER_VISIBLE = [
  "INTERNAL_ERROR",
  "RATE_LIMIT",
  "SERVICE_UNAVAILABLE",
  "INVALID_CREDENTIALS",
  "NETWORK_ERROR",
  "Prisma",
  "prisma",
  "MySQL",
  "Redis",
  "DATABASE_URL",
  "exemplo.invalid",
  "at async",
];

function expectNoTechnicalLeak() {
  const text = document.body.textContent ?? "";
  for (const forbidden of NEVER_VISIBLE) {
    expect(text).not.toContain(forbidden);
  }
}

async function submitLogin() {
  const user = userEvent.setup({ delay: null });
  render(<LoginPage />);
  await user.type(screen.getByLabelText("Usuário"), "UsuarioTeste");
  await user.type(screen.getByPlaceholderText("••••••••"), "senha123");
  await user.click(screen.getByRole("button", { name: /^entrar$/i }));
  return user;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  loginMock.mockReset();
});

describe("credencial inválida", () => {
  it("mostra mensagem amigável e nenhum código técnico", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Usuário ou senha incorretos.",
      status: 401,
      requestId: null,
      retryAfterSeconds: null,
    });
    await submitLogin();

    await screen.findByText("Usuário ou senha incorretos");
    expect(screen.getByText("Verifique seus dados e tente novamente.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expectNoTechnicalLeak();
  });

  it("nunca mostra código de atendimento nem o requestId", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: null,
      status: 401,
      requestId: "8F2C-91A4",
      retryAfterSeconds: null,
    });
    await submitLogin();

    await screen.findByText("Usuário ou senha incorretos");
    expect(screen.queryByText(/Código de atendimento/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("8F2C-91A4");
  });

  it("limpa a senha, mantém o usuário e devolve o foco para a senha", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: null,
      status: 401,
      requestId: null,
      retryAfterSeconds: null,
    });
    await submitLogin();

    await screen.findByText("Usuário ou senha incorretos");
    const senha = screen.getByPlaceholderText("••••••••");
    expect(senha).toHaveValue("");
    expect(screen.getByLabelText("Usuário")).toHaveValue("UsuarioTeste");
    expect(senha).toHaveFocus();
  });

  it("volta a mascarar a senha mesmo se 'mostrar senha' estava ativo", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: null,
      status: 401,
      requestId: null,
      retryAfterSeconds: null,
    });
    const user = userEvent.setup({ delay: null });
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Usuário"), "UsuarioTeste");
    await user.type(screen.getByPlaceholderText("••••••••"), "senha123");

    await user.click(screen.getByRole("button", { name: /mostrar senha/i }));
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await screen.findByText("Usuário ou senha incorretos");
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute("type", "password");
  });
});

describe("rate limit (429)", () => {
  beforeEach(() => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "RATE_LIMIT",
      message: "Muitas tentativas. Tente novamente em alguns minutos.",
      status: 429,
      requestId: null,
      retryAfterSeconds: 522,
    });
  });

  it("mostra título, texto de segurança e tempo restante por extenso", async () => {
    await submitLogin();

    await screen.findByText("Muitas tentativas de acesso");
    expect(screen.getByText(/Por segurança, seu acesso foi temporariamente limitado/)).toBeInTheDocument();
    // 522s = 8 min 42 s (a margem cobre o tempo gasto digitando no teste).
    expect(await screen.findByText(/Tente novamente em [78] min \d\d s\./)).toBeInTheDocument();
    expectNoTechnicalLeak();
  });

  it("desabilita o botão Entrar durante o bloqueio", async () => {
    await submitLogin();

    await screen.findByText("Muitas tentativas de acesso");
    const button = screen.getByRole("button", { name: /aguarde/i });
    expect(button).toBeDisabled();
  });

  it("NÃO oferece 'Tentar novamente' enquanto bloqueado", async () => {
    await submitLogin();

    await screen.findByText("Muitas tentativas de acesso");
    expect(screen.queryByRole("button", { name: /tentar novamente/i })).not.toBeInTheDocument();
  });

  it("não continua enviando POSTs enquanto o username bloqueado continuar", async () => {
    const user = await submitLogin();
    await screen.findByText("Muitas tentativas de acesso");
    expect(loginMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /aguarde/i }));
    await user.keyboard("{Enter}");
    expect(loginMock).toHaveBeenCalledTimes(1);
  });

  it("mantém os campos EDITÁVEIS durante o bloqueio", async () => {
    await submitLogin();

    await screen.findByText("Muitas tentativas de acesso");
    expect(screen.getByLabelText("Usuário")).toBeEnabled();
    expect(screen.getByPlaceholderText("••••••••")).toBeEnabled();
  });

  it("trocar o username remove o bloqueio e permite nova tentativa", async () => {
    const user = await submitLogin();
    await screen.findByText("Muitas tentativas de acesso");

    // O bloqueio é por IP+username: corrigir o usuário deve liberar o submit.
    await user.clear(screen.getByLabelText("Usuário"));
    await user.type(screen.getByLabelText("Usuário"), "OutroUsuario");

    expect(screen.queryByText("Muitas tentativas de acesso")).not.toBeInTheDocument();
    const entrar = screen.getByRole("button", { name: /^entrar$/i });
    expect(entrar).toBeEnabled();

    await user.click(entrar);
    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(2));
  });

  it("voltar para o username bloqueado restaura o bloqueio do botão", async () => {
    const user = await submitLogin();
    await screen.findByText("Muitas tentativas de acesso");

    await user.clear(screen.getByLabelText("Usuário"));
    await user.type(screen.getByLabelText("Usuário"), "OutroUsuario");
    expect(screen.getByRole("button", { name: /^entrar$/i })).toBeEnabled();

    await user.clear(screen.getByLabelText("Usuário"));
    await user.type(screen.getByLabelText("Usuário"), "usuarioteste"); // mesma chave normalizada
    expect(screen.getByRole("button", { name: /aguarde/i })).toBeDisabled();
  });
});

describe("banco indisponível (503)", () => {
  beforeEach(() => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
      message: "Sistema temporariamente indisponível.",
      status: 503,
      requestId: "8F2C-91A4",
      retryAfterSeconds: null,
    });
  });

  it("mostra mensagem de indisponibilidade, não de senha incorreta", async () => {
    await submitLogin();

    await screen.findByText("Sistema temporariamente indisponível");
    expect(screen.getByText(/Não foi possível conectar aos serviços do sistema/)).toBeInTheDocument();
    expect(screen.queryByText("Usuário ou senha incorretos")).not.toBeInTheDocument();
    expectNoTechnicalLeak();
  });

  it("NÃO exibe código de atendimento nem requestId", async () => {
    await submitLogin();

    await screen.findByText("Sistema temporariamente indisponível");
    expect(screen.queryByText(/Código de atendimento/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("8F2C-91A4");
  });

  it("'Tentar novamente' é a única ação: o botão principal fica bloqueado", async () => {
    await submitLogin();

    await screen.findByText("Sistema temporariamente indisponível");
    expect(screen.getByRole("button", { name: /serviço indisponível/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeEnabled();
  });

  it("mantém os campos editáveis e o usuário digitado", async () => {
    await submitLogin();

    await screen.findByText("Sistema temporariamente indisponível");
    expect(screen.getByLabelText("Usuário")).toHaveValue("UsuarioTeste");
    expect(screen.getByLabelText("Usuário")).toBeEnabled();
    expect(screen.getByPlaceholderText("••••••••")).toBeEnabled();
  });

  it("recupera sem recarregar a página quando o banco volta", async () => {
    const user = await submitLogin();
    await screen.findByText("Sistema temporariamente indisponível");

    // Banco volta ao ar.
    loginMock.mockResolvedValue({ ok: true, mustChangePassword: false });
    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(loginMock).toHaveBeenCalledTimes(2);
  });

  it("uma única requisição por clique — sem loop nem polling", async () => {
    const user = await submitLogin();
    await screen.findByText("Sistema temporariamente indisponível");
    expect(loginMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));
    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(2));

    // Nada dispara sozinho depois disso.
    await new Promise((r) => setTimeout(r, 60));
    expect(loginMock).toHaveBeenCalledTimes(2);
  });
});

describe("erro inesperado (500)", () => {
  it("mostra o título da tela de login, sem código de atendimento", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Erro interno do servidor.",
      status: 500,
      requestId: "41AD-028C",
      retryAfterSeconds: null,
    });
    await submitLogin();

    await screen.findByText("Não foi possível concluir o acesso");
    expect(screen.queryByText(/Código de atendimento/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("41AD-028C");
    expectNoTechnicalLeak();
  });

  it("re-mascara a senha", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "INTERNAL_ERROR",
      message: null,
      status: 500,
      requestId: null,
      retryAfterSeconds: null,
    });
    const user = userEvent.setup({ delay: null });
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Usuário"), "UsuarioTeste");
    await user.type(screen.getByPlaceholderText("••••••••"), "senha123");
    await user.click(screen.getByRole("button", { name: /mostrar senha/i }));
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await screen.findByText("Não foi possível concluir o acesso");
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute("type", "password");
  });
});

describe("falha de rede", () => {
  it("mostra 'Falha de comunicação' com opção de tentar novamente", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      code: "NETWORK_ERROR",
      message: null,
      status: 0,
      requestId: null,
      retryAfterSeconds: null,
    });
    await submitLogin();

    await screen.findByText("Falha de comunicação");
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
    expectNoTechnicalLeak();
  });
});

describe("segurança da senha", () => {
  it.each([
    ["INVALID_CREDENTIALS", 401],
    ["RATE_LIMIT", 429],
    ["SERVICE_UNAVAILABLE", 503],
    ["INTERNAL_ERROR", 500],
  ])("a senha nunca é persistida (%s)", async (code, status) => {
    localStorage.clear();
    sessionStorage.clear();
    loginMock.mockResolvedValue({
      ok: false,
      code,
      message: null,
      status,
      requestId: null,
      retryAfterSeconds: code === "RATE_LIMIT" ? 300 : null,
    });
    await submitLogin();
    await screen.findByRole("alert");

    const stored = [
      JSON.stringify(Object.entries(localStorage)),
      JSON.stringify(Object.entries(sessionStorage)),
      document.cookie,
      window.location.search,
    ].join(" ");
    expect(stored).not.toContain("senha123");
  });
});

describe("login válido", () => {
  it("navega para a home", async () => {
    loginMock.mockResolvedValue({ ok: true, mustChangePassword: false });
    await submitLogin();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("navega para troca de senha quando exigido", async () => {
    loginMock.mockResolvedValue({ ok: true, mustChangePassword: true });
    await submitLogin();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/change-password"));
  });
});
