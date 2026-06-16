import { describe, expect, it } from "vitest";
import {
  getProjectNotificationRecipients,
  isValidEmail,
} from "@/features/projects/services/project-notification-service";

describe("destinatários de notificação — somente o vendedor", () => {
  it("envia apenas para o e-mail do vendedor", () => {
    expect(getProjectNotificationRecipients("vendedor@tsteck.com.br")).toEqual({
      to: ["vendedor@tsteck.com.br"],
    });
  });

  it("não inclui CC nem o e-mail do time (projetos@tsteck.com.br)", () => {
    const r = getProjectNotificationRecipients("vendedor@tsteck.com.br");
    expect("cc" in r).toBe(false);
    expect(JSON.stringify(r)).not.toContain("projetos@tsteck.com.br");
  });

  it("sem vendedor / sem e-mail válido → nenhum destinatário (não envia)", () => {
    expect(getProjectNotificationRecipients(undefined)).toEqual({ to: [] });
    expect(getProjectNotificationRecipients("")).toEqual({ to: [] });
    expect(getProjectNotificationRecipients("email-invalido")).toEqual({ to: [] });
  });

  it("valida e-mails corretamente", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("sem-arroba")).toBe(false);
  });
});
