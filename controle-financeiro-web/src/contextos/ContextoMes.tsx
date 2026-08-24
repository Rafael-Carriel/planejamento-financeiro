import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  chaveDoMes,
  hoje,
  inicioDoMes,
  inicioDoProximoMes,
  mesmoMes,
  rotuloDoMes,
  somarMeses,
} from '../utilitarios/datas';

/// O mês que as telas estão mostrando.
///
/// Fica acima das páginas para a navegação entre meses não zerar quando o
/// usuário troca de aba: escolher março no painel e ir para despesas mantém
/// março.

interface ValorDoMes {
  /// Sempre o dia 1º do mês selecionado, à meia-noite.
  mes: Date;
  chave: string;
  rotulo: string;
  inicio: Date;
  /// Limite superior exclusivo: o primeiro instante do mês seguinte.
  fim: Date;
  ehMesAtual: boolean;
  irParaMesAnterior: () => void;
  irParaProximoMes: () => void;
  irParaMesAtual: () => void;
  definirMes: (mes: Date) => void;
}

const ContextoMes = createContext<ValorDoMes | null>(null);

export function ProvedorDeMes({ children }: { children: ReactNode }) {
  const [mes, definirMesInterno] = useState<Date>(() => inicioDoMes(hoje()));

  // Escolher o mês que já está selecionado devolve o mesmo objeto Date. Sem
  // isso, cada clique numa linha do histórico criaria uma Date nova, mudaria a
  // identidade do estado e disparariam leituras repetidas do mesmo período.
  const definirMes = useCallback((novo: Date) => {
    definirMesInterno((atual) => (mesmoMes(atual, novo) ? atual : inicioDoMes(novo)));
  }, []);

  const valor = useMemo<ValorDoMes>(
    () => ({
      mes,
      chave: chaveDoMes(mes),
      rotulo: rotuloDoMes(mes),
      inicio: inicioDoMes(mes),
      fim: inicioDoProximoMes(mes),
      ehMesAtual: mesmoMes(mes, new Date()),
      irParaMesAnterior: () => definirMesInterno(somarMeses(mes, -1)),
      irParaProximoMes: () => definirMesInterno(somarMeses(mes, 1)),
      irParaMesAtual: () => definirMesInterno(inicioDoMes(hoje())),
      definirMes,
    }),
    [mes, definirMes],
  );

  return <ContextoMes.Provider value={valor}>{children}</ContextoMes.Provider>;
}

export function useMes(): ValorDoMes {
  const valor = useContext(ContextoMes);
  if (!valor) throw new Error('useMes precisa estar dentro de <ProvedorDeMes>.');
  return valor;
}
