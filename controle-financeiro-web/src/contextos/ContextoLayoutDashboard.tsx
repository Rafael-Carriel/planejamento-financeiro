import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/// A personalização do Painel: quais cartões aparecem e em que ordem.
///
/// O layout é do usuário, não do mês — por isso mora no `localStorage` e não no
/// Firestore: é uma preferência de tela, some se o navegador for limpo, e não
/// vale a pena gastar leitura para sincronizá-la entre aparelhos.

/// Um widget que o Painel sabe desenhar. O `id` é a chave estável usada na
/// ordem, na visibilidade e no `localStorage`; o `titulo` só aparece na tela de
/// personalização.
export interface DefinicaoWidget {
  id: string;
  titulo: string;
}

/// A lista canônica, na ordem padrão. Widgets novos entram no fim para não
/// bagunçar o layout de quem já personalizou.
export const WIDGETS_DO_PAINEL: DefinicaoWidget[] = [
  { id: 'resumo', titulo: 'Resumo do mês' },
  { id: 'previstos', titulo: 'Previstos do mês' },
  { id: 'movimento', titulo: 'Movimento do mês' },
  { id: 'grafico-despesas', titulo: 'Para onde foi' },
  { id: 'grafico-receitas', titulo: 'De onde veio' },
  { id: 'limites', titulo: 'Limites apertando' },
  { id: 'lancamentos', titulo: 'Últimos lançamentos' },
  { id: 'dicas', titulo: 'Dicas financeiras' },
];

const CHAVE_DE_ARMAZENAMENTO = 'painel:layout:v1';

export interface EstadoDoLayout {
  ordem: string[];
  visiveis: Record<string, boolean>;
}

interface ValorDoLayout {
  /// A ordem completa, incluindo widgets escondidos — é o que o arraste usa.
  ordem: string[];
  visiveis: Record<string, boolean>;
  /// `true` enquanto o usuário está personalizando: mostra alças e olhos.
  editando: boolean;
  definirEditando: (editando: boolean) => void;
  reordenar: (novaOrdem: string[]) => void;
  alternarVisibilidade: (id: string) => void;
  restaurarPadrao: () => void;
}

const ContextoLayoutDashboard = createContext<ValorDoLayout | null>(null);

function layoutPadrao(): EstadoDoLayout {
  return {
    ordem: WIDGETS_DO_PAINEL.map((widget) => widget.id),
    visiveis: Object.fromEntries(WIDGETS_DO_PAINEL.map((widget) => [widget.id, true])),
  };
}

/// Reconstrói um layout válido a partir do que veio do `localStorage`.
///
/// A ordem gravada pode estar desatualizada — um widget removido sobra, um novo
/// falta. Aqui a lista é limpa, os desconhecidos descartados e os ausentes
/// anexados no fim, na ordem padrão, sem perder o que o usuário escolheu.
function normalizar(bruto: unknown): EstadoDoLayout {
  const padrao = layoutPadrao();
  if (!bruto || typeof bruto !== 'object') return padrao;

  const registrado = bruto as { ordem?: unknown; visiveis?: unknown };
  const conhecidos = new Set(padrao.ordem);

  const lidos = Array.isArray(registrado.ordem)
    ? registrado.ordem.filter((id): id is string => typeof id === 'string' && conhecidos.has(id))
    : [];
  const ordem = [...new Set(lidos)];
  for (const id of padrao.ordem) {
    if (!ordem.includes(id)) ordem.push(id);
  }

  const visiveis = { ...padrao.visiveis };
  if (registrado.visiveis && typeof registrado.visiveis === 'object') {
    const salvo = registrado.visiveis as Record<string, unknown>;
    for (const id of padrao.ordem) {
      if (typeof salvo[id] === 'boolean') visiveis[id] = salvo[id];
    }
  }

  return { ordem, visiveis };
}

function lerArmazenado(): EstadoDoLayout {
  try {
    const guardado = window.localStorage.getItem(CHAVE_DE_ARMAZENAMENTO);
    return guardado ? normalizar(JSON.parse(guardado)) : layoutPadrao();
  } catch {
    // Sem armazenamento (modo privado, JSON corrompido): o Painel abre no padrão.
    return layoutPadrao();
  }
}

export function ProvedorDeLayoutDashboard({ children }: { children: ReactNode }) {
  const [estado, definirEstado] = useState<EstadoDoLayout>(lerArmazenado);
  const [editando, definirEditando] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_DE_ARMAZENAMENTO, JSON.stringify(estado));
    } catch {
      // Armazenamento indisponível: a personalização vale só nesta sessão.
    }
  }, [estado]);

  const reordenar = useCallback((novaOrdem: string[]) => {
    const conhecidos = new Set(WIDGETS_DO_PAINEL.map((widget) => widget.id));
    definirEstado((atual) => {
      const ordem = novaOrdem.filter((id) => conhecidos.has(id));
      for (const id of atual.ordem) {
        if (!ordem.includes(id)) ordem.push(id);
      }
      return { ...atual, ordem };
    });
  }, []);

  const alternarVisibilidade = useCallback((id: string) => {
    definirEstado((atual) => ({
      ...atual,
      visiveis: { ...atual.visiveis, [id]: !(atual.visiveis[id] ?? true) },
    }));
  }, []);

  const restaurarPadrao = useCallback(() => definirEstado(layoutPadrao()), []);

  const valor = useMemo<ValorDoLayout>(
    () => ({
      ordem: estado.ordem,
      visiveis: estado.visiveis,
      editando,
      definirEditando,
      reordenar,
      alternarVisibilidade,
      restaurarPadrao,
    }),
    [estado, editando, reordenar, alternarVisibilidade, restaurarPadrao],
  );

  return (
    <ContextoLayoutDashboard.Provider value={valor}>
      {children}
    </ContextoLayoutDashboard.Provider>
  );
}

export function useLayout(): ValorDoLayout {
  const valor = useContext(ContextoLayoutDashboard);
  if (!valor) {
    throw new Error('useLayout precisa estar dentro de <ProvedorDeLayoutDashboard>.');
  }
  return valor;
}
