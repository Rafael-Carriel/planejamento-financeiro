import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { bancoDeDados } from '../firebase/config';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { useDados } from '../contextos/ContextoDados';
import { useLancamento } from '../contextos/ContextoLancamento';

export function PrimeirosPassos() {
  const { usuario } = useAutenticacao();
  const { transacoes } = useDados();
  const { abrirNovo } = useLancamento();
  const [estado, definir] = useState<{ oculto: boolean; saldoVisto: boolean } | null>(null);
  const [erro, falhar] = useState('');
  const [salvando, salvar] = useState(false);
  useEffect(() => {
    let ativo = true;
    if (!usuario) return;
    void getDoc(doc(bancoDeDados, 'usuarios', usuario.uid, 'preferencias', 'inicio')).then(d => {
      if (ativo) definir({ oculto: d.data()?.oculto === true, saldoVisto: d.data()?.saldoVisto === true });
    }).catch(() => { if (ativo) { definir({ oculto: false, saldoVisto: false }); falhar('Não foi possível recuperar seus primeiros passos.'); } });
    return () => { ativo = false; };
  }, [usuario?.uid]);
  async function gravar(patch: { oculto?: boolean; saldoVisto?: boolean }) {
    if (!usuario || !estado || salvando) return;
    salvar(true); falhar('');
    const proximo = { ...estado, ...patch };
    try {
      await setDoc(doc(bancoDeDados, 'usuarios', usuario.uid, 'preferencias', 'inicio'), { ...proximo, atualizadoEm: serverTimestamp() });
      definir(proximo);
    } catch { falhar('Não foi possível salvar esta preferência. Tente novamente.'); }
    finally { salvar(false); }
  }
  if (!estado || estado.oculto) return null;
  const registrado = transacoes.length > 0;
  return <section className="primeiros-passos" aria-labelledby="inicio-titulo">
    <div className="inicio-cabecalho"><div><span className="texto-miudo">SEU PRIMEIRO MÊS</span><h2 id="inicio-titulo">Comece pelo que importa</h2></div><button className="botao-texto" disabled={salvando} onClick={() => void gravar({ oculto: true })}>Pular guia</button></div>
    <ol><li><strong>{registrado ? '✓' : '1.'} Registre uma movimentação</strong><p>Uma receita ou despesa já é suficiente para começar.</p>{!registrado && <button className="botao botao-principal" onClick={() => abrirNovo('saida')}>Registrar minha primeira despesa</button>}</li>
      <li><strong>{estado.saldoVisto ? '✓' : '2.'} Entenda seu saldo</strong><p>O saldo é a diferença entre as receitas e despesas registradas no mês; não é uma consulta ao banco.</p><button className="botao botao-contorno" disabled={!registrado || salvando || estado.saldoVisto} onClick={() => void gravar({ saldoVisto: true })}>{estado.saldoVisto ? 'Saldo entendido' : 'Entendi meu saldo'}</button></li>
      <li><strong>3. Escolha o próximo passo</strong><p>Defina quanto pretende gastar em uma categoria ou continue registrando.</p><Link className="botao botao-contorno" to="/planejamento">Planejar meus gastos</Link>{estado.saldoVisto && <button className="botao botao-suave" disabled={salvando} onClick={() => void gravar({ oculto: true })}>Concluir guia</button>}</li></ol>
    {erro && <p role="alert">{erro}</p>}
  </section>;
}
