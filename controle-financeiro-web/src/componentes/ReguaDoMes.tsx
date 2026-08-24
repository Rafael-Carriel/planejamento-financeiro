import { useMemo } from 'react';

import { fluxoPorDia } from '../dominio/calculos';
import type { Transacao } from '../tipos';
import { ehHoje } from '../utilitarios/datas';
import { formatarMoeda } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';

/// A régua do mês.
///
/// Cada dia é uma coluna: o que entrou sobe da linha de base, o que saiu desce.
/// A altura é proporcional ao maior movimento do próprio mês, então a leitura é
/// relativa — dá para ver em que dias o dinheiro se mexeu e se as saídas estão
/// espalhadas ou concentradas, sem depender de biblioteca de gráfico.
///
/// Os dias sem lançamento aparecem como colunas vazias, de propósito: a lacuna
/// no meio do mês é informação.

interface Propriedades {
  transacoes: Transacao[];
  mes: Date;
}

/// Rótulos do eixo: começo, marcos de 5 em 5, fim do mês e o dia de hoje.
function mostrarRotulo(dia: number, total: number, ehDeHoje: boolean): boolean {
  if (ehDeHoje) return true;
  if (dia === 1 || dia === total) return true;
  return dia % 5 === 0 && dia + 1 !== total && dia !== total - 1;
}

export function ReguaDoMes({ transacoes, mes }: Propriedades) {
  const fluxo = useMemo(() => fluxoPorDia(transacoes, mes), [transacoes, mes]);

  const maior = useMemo(
    () =>
      fluxo.reduce(
        (topo, dia) => Math.max(topo, dia.entradas, dia.saidas),
        0,
      ),
    [fluxo],
  );

  const diaDeMaiorSaida = useMemo(
    () => fluxo.reduce((topo, dia) => (dia.saidas > topo.saidas ? dia : topo), fluxo[0]),
    [fluxo],
  );

  const total = fluxo.length;

  function altura(valor: number): string {
    if (valor <= 0 || maior <= 0) return '0%';
    // Piso de 3% para um lançamento pequeno não virar uma linha invisível.
    return `${Math.max(3, (valor / maior) * 100)}%`;
  }

  return (
    <div>
      <div className="regua">
        {fluxo.map((dia) => {
          const data = new Date(mes.getFullYear(), mes.getMonth(), dia.dia);
          const deHoje = ehHoje(data);
          const partes = [`Dia ${dia.dia}`];
          if (dia.entradas > 0) partes.push(`entradas ${formatarMoeda(dia.entradas)}`);
          if (dia.saidas > 0) partes.push(`saídas ${formatarMoeda(dia.saidas)}`);
          if (dia.entradas === 0 && dia.saidas === 0) partes.push('sem lançamentos');

          return (
            <div
              key={dia.dia}
              className={deHoje ? 'regua-dia regua-dia-hoje' : 'regua-dia'}
              title={partes.join(' · ')}
            >
              <div className="regua-acima">
                {dia.entradas > 0 ? (
                  <div className="regua-barra" style={{ height: altura(dia.entradas) }} />
                ) : null}
              </div>
              <div className="regua-linha" />
              <div className="regua-abaixo">
                {dia.saidas > 0 ? (
                  <div className="regua-barra" style={{ height: altura(dia.saidas) }} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="regua-eixo" aria-hidden="true">
        {fluxo.map((dia) => {
          const data = new Date(mes.getFullYear(), mes.getMonth(), dia.dia);
          const deHoje = ehHoje(data);
          return (
            <span key={dia.dia} className={deHoje ? 'hoje' : undefined}>
              {mostrarRotulo(dia.dia, total, deHoje) ? dia.dia : ''}
            </span>
          );
        })}
      </div>

      <div className="legenda" style={{ marginTop: 14 }}>
        <span className="legenda-item">
          <span className="legenda-marca" style={comVariaveis({ '--cor-marca': 'var(--entrada)' })} />
          Entradas
        </span>
        <span className="legenda-item">
          <span className="legenda-marca" style={comVariaveis({ '--cor-marca': 'var(--saida)' })} />
          Saídas
        </span>
        {maior > 0 ? (
          <span className="legenda-item">
            Maior barra: {formatarMoeda(maior)}
          </span>
        ) : null}
        {diaDeMaiorSaida && diaDeMaiorSaida.saidas > 0 ? (
          <span className="legenda-item">
            Dia de maior saída: {diaDeMaiorSaida.dia} ({formatarMoeda(diaDeMaiorSaida.saidas)})
          </span>
        ) : null}
      </div>
    </div>
  );
}
