import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { RepositorioFirestoreCategorias } from '../repositorios/firestore/RepositorioFirestoreCategorias';
import { RepositorioFirestoreMetas } from '../repositorios/firestore/RepositorioFirestoreMetas';
import { RepositorioFirestoreOrcamentos } from '../repositorios/firestore/RepositorioFirestoreOrcamentos';
import { RepositorioFirestoreTransacoes } from '../repositorios/firestore/RepositorioFirestoreTransacoes';
import type { Repositorios } from '../repositorios/interfaces';
import { definirRepositorioCategorias } from '../servicos/servicoCategorias';
import { definirRepositorioMetas } from '../servicos/servicoMetas';
import { definirRepositorioOrcamentos } from '../servicos/servicoOrcamentos';
import { definirRepositorioTransacoes } from '../servicos/servicoTransacoes';

/// Injeção de dependência da camada de dados.
///
/// Monta as quatro implementações de repositório (Firestore, por padrão) e as
/// entrega a quem consumir via `useRepositorios`. Também injeta as mesmas
/// instâncias na camada de serviço, que é baseada em módulo — assim os serviços
/// e os componentes compartilham exatamente a mesma implementação.
///
/// O parâmetro opcional `repositorios` permite trocar tudo por dublês em teste,
/// sem alterar nenhum componente.

interface PropsDoProvedor {
  children: ReactNode;
  /// Só as chaves informadas são substituídas; o resto cai no Firestore.
  repositorios?: Partial<Repositorios>;
}

const ContextoRepositorios = createContext<Repositorios | null>(null);

export function ProvedorDeRepositorios({ children, repositorios }: PropsDoProvedor) {
  const valor = useMemo<Repositorios>(
    () => ({
      transacoes: repositorios?.transacoes ?? new RepositorioFirestoreTransacoes(),
      categorias: repositorios?.categorias ?? new RepositorioFirestoreCategorias(),
      orcamentos: repositorios?.orcamentos ?? new RepositorioFirestoreOrcamentos(),
      metas: repositorios?.metas ?? new RepositorioFirestoreMetas(),
    }),
    [repositorios],
  );

  // Executa na fase de render do provedor, portanto antes de os filhos
  // renderizarem: os serviços já apontam para estas instâncias quando as telas
  // disparam seus efeitos. É idempotente, então sobrevive ao StrictMode.
  useMemo(() => {
    definirRepositorioTransacoes(valor.transacoes);
    definirRepositorioCategorias(valor.categorias);
    definirRepositorioOrcamentos(valor.orcamentos);
    definirRepositorioMetas(valor.metas);
  }, [valor]);

  return (
    <ContextoRepositorios.Provider value={valor}>
      {children}
    </ContextoRepositorios.Provider>
  );
}

export function useRepositorios(): Repositorios {
  const valor = useContext(ContextoRepositorios);
  if (!valor) {
    throw new Error('useRepositorios precisa estar dentro de <ProvedorDeRepositorios>.');
  }
  return valor;
}
