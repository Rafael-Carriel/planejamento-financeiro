import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, query, where } from 'firebase/firestore';
import { auth, bancoDeDados } from '../firebase/config';
import { chamarCobranca, cobrancaConfigurada } from './servicoAssinatura';

import { VERSAO_LEGAL } from '../legal';
export { VERSAO_LEGAL } from '../legal';
export type TipoSolicitacao = 'acesso' | 'correcao' | 'exclusao' | 'portabilidade' | 'oposicao';
const colecoes = ['transacoes','categorias','orcamentos','recorrencias','dividas','lembretes','reservaEmergencia','movimentacoesReserva','objetivos','aceitesLegais'];
export async function exportarDadosPessoais() {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Entre na sua conta para exportar seus dados.');
  const uid = usuario.uid;
  const perfil = await getDoc(doc(bancoDeDados, 'usuarios', uid));
  const dados: Record<string, unknown> = { exportadoEm: new Date().toISOString(), conta: {uid,email:usuario.email,nome:usuario.displayName}, perfil:perfil.data() ?? null };
  const legado = await getDoc(doc(bancoDeDados,'solicitacoesDeAssinatura',uid));
  dados.solicitacaoDeAssinaturaLegada = legado.data() ?? null;
  for (const nome of colecoes) {
    const lista = await getDocs(collection(bancoDeDados,'usuarios',uid,nome));
    const registros = [];
    for (const item of lista.docs) {
      const registro: Record<string,unknown> = {id:item.id,...item.data()};
      if (nome === 'objetivos') {
        const movimentos = await getDocs(collection(bancoDeDados,'usuarios',uid,'objetivos',item.id,'movimentacoes'));
        registro.movimentacoes = movimentos.docs.map(m=>({id:m.id,...m.data()}));
      }
      registros.push(registro);
    }
    dados[nome] = registros;
  }
  if (cobrancaConfigurada) {
    try { dados.assinatura = await chamarCobranca('/me'); }
    catch { dados.assinatura = { indisponivel:true,aviso:'Os dados de assinatura não puderam ser consultados. Solicite o complemento pelo canal de privacidade.' }; }
  }
  const pedidos = await getDocs(query(collection(bancoDeDados,'solicitacoesPrivacidade'),where('uid','==',uid)));
  dados.solicitacoesPrivacidade = pedidos.docs.map(item=>({id:item.id,...item.data()}));
  if (auth.currentUser?.uid !== uid) throw new Error('Sua sessão mudou. Faça a exportação novamente.');
  const json = JSON.stringify(dados, (_key,valor) => valor && typeof valor.toDate === 'function' ? valor.toDate().toISOString() : valor,2);
  const url = URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url; link.download=`planeora-dados-${new Date().toISOString().slice(0,10)}.json`; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function registrarSolicitacao(id:string,tipo:TipoSolicitacao,mensagem:string) {
  const usuario=auth.currentUser;
  if (!usuario?.emailVerified) throw new Error('Confirme seu e-mail antes de registrar uma solicitação.');
  await setDoc(doc(bancoDeDados,'solicitacoesPrivacidade',id),{uid:usuario.uid,tipo,mensagem:mensagem.trim(),status:'recebida',criadoEm:serverTimestamp(),versao:VERSAO_LEGAL});
}
