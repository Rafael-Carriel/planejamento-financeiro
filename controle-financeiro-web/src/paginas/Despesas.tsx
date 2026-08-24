import { PaginaDeLancamentos } from '../componentes/PaginaDeLancamentos';

/// Despesas do mês — a mesma tela de receitas, com o sinal trocado.
export function Despesas() {
  return <PaginaDeLancamentos tipo="saida" />;
}
