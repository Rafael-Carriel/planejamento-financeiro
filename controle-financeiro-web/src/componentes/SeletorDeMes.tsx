import { useMes } from '../contextos/ContextoMes';

/// Navegação entre meses: anterior, mês atual, próximo.
///
/// O botão "Hoje" só aparece quando o usuário não está no mês corrente — é a
/// única situação em que ele serve para algo.
export function SeletorDeMes() {
  const { rotulo, ehMesAtual, irParaMesAnterior, irParaProximoMes, irParaMesAtual } = useMes();

  return (
    <div className="cabecalho-acoes">
      <div className="seletor-mes">
        <button type="button" onClick={irParaMesAnterior} aria-label="Mês anterior">
          ‹
        </button>
        <span className="seletor-mes-rotulo">{rotulo}</span>
        <button type="button" onClick={irParaProximoMes} aria-label="Próximo mês">
          ›
        </button>
      </div>

      {ehMesAtual ? null : (
        <button type="button" className="seletor-mes-hoje" onClick={irParaMesAtual}>
          Voltar para hoje
        </button>
      )}
    </div>
  );
}
