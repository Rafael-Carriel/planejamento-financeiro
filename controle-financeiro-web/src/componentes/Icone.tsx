import type { ReactNode, SVGProps } from 'react';

// Ícones em SVG com tamanho e peso de traço consistentes.
export type NomeDeIcone =
  | 'editar' | 'excluir'
  | 'ajuda' | 'instalar' | 'conta' | 'sair' | 'assinatura' | 'admin'
  | 'painel'
  | 'receitas'
  | 'despesas'
  | 'recorrencias'
  | 'previsao'
  | 'categorias'
  | 'dividas'
  | 'lembretes'
  | 'planejamento'
  | 'historico'
  | 'relatorios'
  | 'reserva'
  | 'objetivos'
  | 'mais'
  | 'sol'
  | 'lua'
  | 'sino'
  | 'sino-desligado';

const CAMINHOS: Record<NomeDeIcone, ReactNode> = {
  editar: <><path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/></>,
  excluir: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></>,
  ajuda: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/></>,
  instalar: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  conta: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  sair: <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/></>,
  assinatura: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></>,
  admin: <><path d="M12 3 4 7v5c0 5 8 9 8 9s8-4 8-9V7z"/><path d="m8 12 3 3 5-6"/></>,
  painel: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="2" />
      <rect x="13.5" y="11" width="7" height="9.5" rx="2" />
      <rect x="3.5" y="13" width="7" height="7.5" rx="2" />
    </>
  ),
  receitas: (
    <>
      <path d="M4 17.5 10 11l3.6 3.6L20 8" />
      <path d="M15 8h5v5" />
    </>
  ),
  despesas: (
    <>
      <path d="M4 6.5 10 13l3.6-3.6L20 16" />
      <path d="M15 16h5v-5" />
    </>
  ),
  recorrencias: (
    <>
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M20.5 6H8a4 4 0 0 0-4 4v1" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M3.5 18H16a4 4 0 0 0 4-4v-1" />
    </>
  ),
  previsao: (
    <>
      <path d="M3.5 18.5 9 12l3.6 3.6L20.5 7" />
      <path d="M3.5 21h17" />
    </>
  ),
  categorias: (
    <>
      <path d="M20.6 12.3 12.6 4.3a2 2 0 0 0-1.4-.6H5a2 2 0 0 0-2 2v6.2a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l6.2-6.2a2 2 0 0 0 0-2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  dividas: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.7v4.6M18 9.7v4.6" />
    </>
  ),
  lembretes: <Sino />,
  sino: <Sino />,
  planejamento: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z" />
    </>
  ),
  historico: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.4V12l3 1.9" />
    </>
  ),
  relatorios: (
    <>
      <path d="M5 20v-6M12 20V5.5M19 20v-9.5" />
      <path d="M2.8 20h18.4" />
    </>
  ),
  reserva: (
    <>
      <path d="M12 3 5 6v5.5c0 4.8 3 7.9 7 9.5 4-1.6 7-4.7 7-9.5V6z" />
      <path d="m9.2 12 2 2 3.8-4" />
    </>
  ),
  objetivos: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="0.9" />
    </>
  ),
  mais: (
    <>
      <circle cx="5.5" cy="5.5" r="1.7" />
      <circle cx="18.5" cy="5.5" r="1.7" />
      <circle cx="5.5" cy="18.5" r="1.7" />
      <circle cx="18.5" cy="18.5" r="1.7" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2.1M12 19.3v2.1M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.6 19.4 6.1 17.9M17.9 6.1l1.5-1.5" />
    </>
  ),
  lua: <path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z" />,
  'sino-desligado': (
    <>
      <path d="M17.6 17.6H4s3-1.1 3-7a6 6 0 0 1 1.2-3.6" />
      <path d="M10.3 3.4A6 6 0 0 1 18 8.6c0 2.1.4 3.6.9 4.7" />
      <path d="M13.7 20.4a2 2 0 0 1-3.4 0" />
      <path d="M3.2 3.2 20.8 20.8" />
    </>
  ),
};

function Sino() {
  return (
    <>
      <path d="M18 8.6a6 6 0 1 0-12 0c0 5.9-3 7-3 7h18s-3-1.1-3-7" />
      <path d="M13.7 20.4a2 2 0 0 1-3.4 0" />
    </>
  );
}

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  nome: NomeDeIcone;
}

export function Icone({ nome, ...resto }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {CAMINHOS[nome]}
    </svg>
  );
}
