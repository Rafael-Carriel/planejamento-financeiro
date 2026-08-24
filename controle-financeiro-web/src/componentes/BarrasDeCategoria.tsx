import { useDados } from '../contextos/ContextoDados';
import type { TotalPorCategoria } from '../tipos';
import { formatarPorcentagem } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';
import { Dinheiro } from './Dinheiro';
import { EstadoVazio } from './Estados';

/// Quanto cada categoria movimentou, em barras.
///
/// A barra é proporcional à maior categoria do período, não ao total: com uma
/// categoria dominante, comparar contra o total achataria todas as outras a
/// ponto de não dar para distinguir a segunda da quinta.

interface Propriedades {
  totais: TotalPorCategoria[];
  cor: 'entrada' | 'saida';
  quantidadeMaxima?: number;
  tituloVazio?: string;
  descricaoVazia?: string;
}

export function BarrasDeCategoria({
  totais,
  cor,
  quantidadeMaxima,
  tituloVazio = 'Nenhuma categoria movimentada',
  descricaoVazia = 'Os lançamentos deste mês aparecem agrupados por categoria aqui.',
}: Propriedades) {
  const { descreverCategoria } = useDados();

  if (totais.length === 0) {
    return <EstadoVazio selo="🏷️" titulo={tituloVazio} descricao={descricaoVazia} />;
  }

  const visiveis = quantidadeMaxima ? totais.slice(0, quantidadeMaxima) : totais;
  const maior = visiveis.reduce((topo, item) => Math.max(topo, item.total), 0);
  const restantes = totais.length - visiveis.length;
  const totalRestante = totais
    .slice(visiveis.length)
    .reduce((soma, item) => soma + item.total, 0);

  return (
    <div className="linhas-categoria">
      {visiveis.map((item) => {
        const categoria = descreverCategoria(item.categoria);
        const largura = maior > 0 ? Math.max(2, (item.total / maior) * 100) : 0;

        return (
          <div className="linha-categoria" key={item.categoria}>
            <div className="linha-categoria-topo">
              <span className="linha-categoria-nome">
                <span aria-hidden="true">{categoria.emoji}</span>
                <span>{item.categoria}</span>
              </span>
              <span className="linha-categoria-valores">
                <span className="texto-miudo">{formatarPorcentagem(item.fatia)}</span>
                <Dinheiro valor={item.total} cor={cor} />
              </span>
            </div>

            <div className="trilha">
              <div
                className="trilha-preenchida"
                style={{ ...comVariaveis({ '--cor-barra': categoria.cor }), width: `${largura}%` }}
              />
            </div>

            <span className="texto-miudo">
              {item.quantidade === 1 ? '1 lançamento' : `${item.quantidade} lançamentos`}
            </span>
          </div>
        );
      })}

      {restantes > 0 ? (
        <p className="texto-miudo">
          {restantes === 1 ? 'Mais 1 categoria' : `Mais ${restantes} categorias`} somando{' '}
          <Dinheiro valor={totalRestante} cor={cor} />.
        </p>
      ) : null}
    </div>
  );
}
