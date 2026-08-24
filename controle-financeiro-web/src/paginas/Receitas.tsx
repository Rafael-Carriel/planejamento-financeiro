import { PaginaDeLancamentos } from '../componentes/PaginaDeLancamentos';

/// Receitas do mês — a mesma tela de despesas, com o sinal trocado.
export function Receitas() {
  return <PaginaDeLancamentos tipo="entrada" />;
}
