"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "../lib/master-data-api";
import type { MasterEntityKey } from "../lib/master-entity-keys";

type Options = { includeInactive?: boolean };

/**
 * Hook de dados de um Cadastro Mestre, com MySQL como fonte da verdade.
 * Carrega ao montar, expõe loading/error e mutações que recarregam a lista.
 */
export function useMasterDataEntity<T extends { id: string }>(
  entity: MasterEntityKey,
  { includeInactive = false }: Options = {},
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setItems(await api.listEntity<T>(entity, includeInactive));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [entity, includeInactive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (payload: Record<string, unknown>) => {
      const item = await api.createEntity<T>(entity, payload);
      await reload();
      return item;
    },
    [entity, reload],
  );

  const update = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const item = await api.updateEntity<T>(entity, id, patch);
      await reload();
      return item;
    },
    [entity, reload],
  );

  const setActive = useCallback(
    async (id: string, active: boolean) => {
      const item = await api.setEntityActive<T>(entity, id, active);
      await reload();
      return item;
    },
    [entity, reload],
  );

  return { items, loading, error, reload, create, update, setActive };
}
