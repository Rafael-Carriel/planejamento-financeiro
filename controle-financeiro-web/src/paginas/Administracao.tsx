import { useEffect, useState } from 'react';
import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { useAssinatura } from '../contextos/ContextoAssinatura';
import { chamarCobranca, cobrancaConfigurada, linkPagamento, rotuloPagamento, type Pagamento, type UsuarioAdministrado } from '../servicos/servicoAssinatura';
import { formatarMoeda as moeda } from '../utilitarios/formatadores';
import '../assinatura.css';
import { VerificacaoDaConta } from '../componentes/VerificacaoDaConta';
import { SolicitacoesPrivacidade } from '../componentes/SolicitacoesPrivacidade';

export function Administracao() {
  const { assinatura, carregando, erro: erroAssinatura } = useAssinatura();
  const [usuarios, definirUsuarios] = useState<UsuarioAdministrado[]>([]);
  const [pagamentos, definirPagamentos] = useState<Pagamento[]>([]);
  const [cursorUsuarios, proximaUsuarios] = useState<string | null>(null);
  const [cursorPagamentos, proximaPagamentos] = useState<string | null>(null);
  const [erro, falhar] = useState('');
  const [ocupado, ocupar] = useState(false);
  const [busca, buscar] = useState('');
  const [filtro, filtrar] = useState('todos');
  const [conexao, informarConexao] = useState('');
  const [verificando, verificar] = useState(false);
  async function verificarAsaas() {
    verificar(true);
    try {
      const status = await chamarCobranca<{ connected: boolean; environment: string }>('/admin/asaas-status');
      informarConexao(`Asaas conectado — ${status.environment === 'production' ? 'produção' : 'testes'}. A chave foi aceita em uma consulta sem cobrança. O ciclo de pagamento ainda precisa ser validado.`);
    } catch (e) { informarConexao(e instanceof Error ? e.message : 'Não foi possível confirmar a conexão.'); }
    finally { verificar(false); }
  }
  async function carregar(tipo: 'usuarios' | 'pagamentos' | 'todos', mais = false) {
    ocupar(true); falhar('');
    try {
      if (tipo !== 'pagamentos') {
        const data = await chamarCobranca<{ users: UsuarioAdministrado[]; nextCursor: string | null }>(`/admin/users${mais && cursorUsuarios ? `?cursor=${encodeURIComponent(cursorUsuarios)}` : ''}`);
        definirUsuarios(prev => mais ? [...prev, ...data.users] : data.users); proximaUsuarios(data.nextCursor);
      }
      if (tipo !== 'usuarios') {
        const data = await chamarCobranca<{ payments: Pagamento[]; nextCursor: string | null }>(`/admin/payments${mais && cursorPagamentos ? `?cursor=${encodeURIComponent(cursorPagamentos)}` : ''}`);
        definirPagamentos(prev => mais ? [...new Map([...prev, ...data.payments].map(p => [p.id, p])).values()] : data.payments); proximaPagamentos(data.nextCursor);
      }
    } catch (e) { falhar(e instanceof Error ? e.message : 'Não foi possível consultar os dados.'); }
    finally { ocupar(false); }
  }
  useEffect(() => { if (assinatura?.admin) void carregar('todos'); }, [assinatura?.admin]);
  const visiveis = usuarios.filter(u => `${u.name} ${u.email} ${u.uid}`.toLowerCase().includes(busca.toLowerCase()));
  const pagamentosVisiveis = pagamentos.filter(p => filtro === 'todos' || (filtro === 'pagos'
    ? ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status) : filtro === p.status));
  const recebido = pagamentos.filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)).reduce((sum, p) => sum + p.value, 0);
  return <>
    <CabecalhoDaPagina titulo="Administração" descricao="Usuários, consumo e pagamentos do Planeora." comSeletorDeMes={false}
      acoes={<button className="botao" disabled={ocupado || !assinatura?.admin} onClick={() => void carregar('todos')}>Atualizar dados</button>} />
    <VerificacaoDaConta />
    {erroAssinatura && <p className="assinatura-aviso" role="alert">{erroAssinatura}</p>}
    {!cobrancaConfigurada ? <div className="assinatura-aviso" role="status">A área administrativa está preparada. Conecte a integração e configure o acesso do proprietário para consultar dados reais.</div>
      : carregando ? <p role="status">Verificando sua permissão…</p>
      : !assinatura?.admin ? <div className="assinatura-aviso" role="alert">Acesso exclusivo do administrador. Entre com a conta autorizada.</div> : null}
    {assinatura?.environment === 'sandbox' && <div className="assinatura-aviso">Ambiente de testes. Os valores abaixo não representam recebimentos reais.</div>}
    {erro && <p role="alert" className="assinatura-aviso">{erro}</p>}
    {assinatura?.admin && <section className="assinatura-card assinatura-historico" aria-label="Conexão com o Asaas">
      <button className="botao" disabled={verificando} onClick={() => void verificarAsaas()}>{verificando ? 'Verificando…' : 'Verificar conexão com o Asaas'}</button>
      {conexao && <p role="status">{conexao}</p>}
    </section>}
    <div className="assinatura-grid admin-indicadores">
      <section className="assinatura-card"><span>Usuários carregados</span><h2>{assinatura?.admin ? usuarios.length : '—'}</h2></section>
      <section className="assinatura-card"><span>Com acesso pago ativo</span><h2>{assinatura?.admin ? usuarios.filter(u => u.blocks > 0).length : '—'}</h2></section>
      <section className="assinatura-card"><span>Pagamentos confirmados carregados</span><h2>{assinatura?.admin ? moeda(recebido) : '—'}</h2></section>
    </div>
    <section className="assinatura-card assinatura-historico"><h2>Usuários</h2>
      <label className="assinatura-campo">Buscar nos usuários carregados<input type="search" placeholder="Nome, e-mail ou identificador" value={busca} onChange={e => buscar(e.target.value)} disabled={!assinatura?.admin} /></label>
      <div className="assinatura-tabela"><table><thead><tr><th>Usuário</th><th>Consumo acumulado</th><th>Mensalidade</th><th>Acesso até</th><th>Situação</th></tr></thead>
        <tbody>{visiveis.map(u => <tr key={u.uid}><td><strong>{u.name || 'Sem nome'}</strong><br />{u.email}<br /><small>{u.uid}</small></td>
          <td>{u.count} / {u.limit}{u.admin ? ' · administrador' : ''}</td><td>{moeda(u.price)}</td>
          <td>{u.validUntil ? new Date(u.validUntil).toLocaleDateString('pt-BR') : '—'}</td>
          <td>{u.disabled ? 'Desativado' : u.canceled ? 'Renovação cancelada' : u.blocks > 0 ? 'Plano pago' : 'Gratuito'}</td></tr>)}</tbody></table></div>
      {!visiveis.length && <p>{assinatura?.admin ? 'Nenhum usuário encontrado nesta página.' : 'Os usuários aparecerão após a conexão e autorização.'}</p>}
      {cursorUsuarios && <button className="botao" disabled={ocupado} onClick={() => void carregar('usuarios', true)}>Carregar mais usuários</button>}
    </section>
    <section className="assinatura-card assinatura-historico"><h2>Pagamentos</h2>
      <label className="assinatura-campo">Situação<select value={filtro} onChange={e => filtrar(e.target.value)} disabled={!assinatura?.admin}>
        <option value="todos">Todas</option><option value="pagos">Pagos</option><option value="PENDING">Aguardando</option><option value="OVERDUE">Vencidos</option><option value="REFUNDED">Estornados</option>
      </select></label>
      <div className="assinatura-tabela"><table><thead><tr><th>Usuário / cobrança</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Detalhes</th></tr></thead>
        <tbody>{pagamentosVisiveis.map(p => <tr key={p.id}><td>{usuarios.find(u => u.uid === p.uid)?.email || p.uid}<br /><small>{p.id}</small></td>
          <td>{p.dueDate.split('-').reverse().join('/')}</td><td>{moeda(p.value)}</td><td>{rotuloPagamento(p.status)}</td>
          <td>{linkPagamento(p.url) ? <a href={linkPagamento(p.url)} target="_blank" rel="noopener noreferrer">Abrir no Asaas ↗</a> : '—'}</td></tr>)}</tbody></table></div>
      {!pagamentosVisiveis.length && <p>Nenhuma cobrança disponível.</p>}
      {cursorPagamentos && <button className="botao" disabled={ocupado} onClick={() => void carregar('pagamentos', true)}>Carregar mais pagamentos</button>}
    </section>
    {assinatura?.admin && <SolicitacoesPrivacidade />}
  </>;
}
