import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { FormularioDeTransacao } from '../componentes/FormularioDeTransacao';
import type { TipoTransacao, Transacao } from '../tipos';

/// Quem abre o formulário de lançamento.
///
/// O modal é montado uma vez, aqui, e qualquer tela pede a abertura pelo hook.
/// Sem isso, o painel, receitas, despesas e histórico repetiriam o mesmo estado
/// de "modal aberto" cada um do seu jeito.

interface ValorDoLancamento {
  abrirNovo: (tipo?: TipoTransacao) => void;
  abrirEdicao: (transacao: Transacao) => void;
}

const ContextoLancamento = createContext<ValorDoLancamento | null>(null);

export function ProvedorDeLancamento({ children }: { children: ReactNode }) {
  const [aberto, definirAberto] = useState(false);
  const [tipoInicial, definirTipoInicial] = useState<TipoTransacao>('saida');
  const [emEdicao, definirEmEdicao] = useState<Transacao | null>(null);

  const abrirNovo = useCallback((tipo: TipoTransacao = 'saida') => {
    definirEmEdicao(null);
    definirTipoInicial(tipo);
    definirAberto(true);
  }, []);

  const abrirEdicao = useCallback((transacao: Transacao) => {
    definirEmEdicao(transacao);
    definirTipoInicial(transacao.tipo);
    definirAberto(true);
  }, []);

  const fechar = useCallback(() => {
    definirAberto(false);
    definirEmEdicao(null);
  }, []);

  const valor = useMemo<ValorDoLancamento>(
    () => ({ abrirNovo, abrirEdicao }),
    [abrirNovo, abrirEdicao],
  );

  return (
    <ContextoLancamento.Provider value={valor}>
      {children}
      {aberto ? (
        // A chave força um formulário novo a cada abertura: sem ela, o estado do
        // lançamento anterior sobreviveria e apareceria pré-preenchido.
        <FormularioDeTransacao
          key={emEdicao?.id ?? 'novo'}
          transacao={emEdicao}
          tipoInicial={tipoInicial}
          aoFechar={fechar}
        />
      ) : null}
    </ContextoLancamento.Provider>
  );
}

export function useLancamento(): ValorDoLancamento {
  const valor = useContext(ContextoLancamento);
  if (!valor) {
    throw new Error('useLancamento precisa estar dentro de <ProvedorDeLancamento>.');
  }
  return valor;
}
