import { Link } from 'react-router-dom';
import { useTema } from '../contextos/ContextoTema';

export function AcoesPublicas(){
  const {tema,alternarTema}=useTema();
  return <nav className="acoes-publicas" aria-label="Navegação e aparência"><Link to="/">← Voltar ao Planeora</Link><button type="button" className="botao botao-contorno" onClick={alternarTema} aria-label={tema==='dark'?'Ativar tema claro':'Ativar tema escuro'}>{tema==='dark'?'☀ Tema claro':'☾ Tema escuro'}</button></nav>;
}
