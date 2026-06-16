// Hidrata o store de Cadastros Mestres a partir do MySQL (para os dropdowns do
// formulário de Projeto e o lookup de e-mail do vendedor). Sem localStorage.
import { listEntity } from "./master-data-api";
import { useMasterDataStore } from "../state/master-data-store";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function hydrateMasterDataFromApi(): Promise<void> {
  try {
    const [construtoras, obras, equipamentos, tiposCabine, vendedores, engenheiros] = await Promise.all([
      listEntity<any>("construtoras", true),
      listEntity<any>("obras", true),
      listEntity<any>("equipamentos", true),
      listEntity<any>("tiposCabine", true),
      listEntity<any>("vendedores", true),
      listEntity<any>("engenheiros", true),
    ]);
    useMasterDataStore.setState({ construtoras, obras, equipamentos, tiposCabine, vendedores, engenheiros });
  } catch (e) {
    console.error("[master-data] falha ao hidratar do MySQL:", e);
  }
}
