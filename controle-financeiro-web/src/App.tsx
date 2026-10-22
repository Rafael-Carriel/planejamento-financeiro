import { ProvedorDeLembretes } from './contextos/ContextoLembretes';
import { ProvedorDeTema } from './contextos/ContextoTema';
import { ProvedorDeInstalacao } from './contextos/ContextoInstalacao';
import { Atendimento } from './paginas/Atendimento';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Apresentacao } from './paginas/Apresentacao';

import { Layout } from './componentes/Layout';
import { Carregando } from './componentes/Estados';
import { ProvedorDeAutenticacao, useAutenticacao } from './contextos/ContextoAutenticacao';
import { ProvedorDeDados } from './contextos/ContextoDados';
import { ProvedorDeRepositorios } from './contextos/ContextoRepositorios';
import { ProvedorDeLancamento } from './contextos/ContextoLancamento';
import { ProvedorDeMes } from './contextos/ContextoMes';
import { Categorias } from './paginas/Categorias';
import { Despesas } from './paginas/Despesas';
import { Dividas } from './paginas/Dividas';
import { Entrada } from './paginas/Entrada';
import { Historico } from './paginas/Historico';
import { Lembretes } from './paginas/Lembretes';
import { Objetivos } from './paginas/Objetivos';
import { Painel } from './paginas/Painel';
import { Planejamento } from './paginas/Planejamento';
import { Previsao } from './paginas/Previsao';
import { Receitas } from './paginas/Receitas';
import { Recorrencias } from './paginas/Recorrencias';
import { Relatorios } from './paginas/Relatorios';
import { ReservaEmergencia } from './paginas/ReservaEmergencia';
import { Assinatura } from './paginas/Assinatura';
import { Administracao } from './paginas/Administracao';
import { ProvedorDeAssinatura } from './contextos/ContextoAssinatura';
import { DocumentosLegais, Privacidade } from './paginas/Privacidade';
import { Instalacao } from './paginas/Instalacao';

/// Montagem do app.
///
/// Uso `HashRouter` de propósito: o endereço fica com `#/despesas`, o que é
/// menos bonito, mas funciona abrindo o `index.html` direto do disco e em
/// qualquer hospedagem estática, sem precisar configurar redirecionamento.

/// Só monta os provedores de dados depois que existe um usuário: assim nenhuma
/// consulta ao Firestore sai sem `uid` e sem permissão.
function Portao() {
  const { usuario, carregando } = useAutenticacao();
  const { pathname } = useLocation();

  if (carregando) return <Carregando mensagem="Verificando sua sessão…" />;
  if (!usuario) return pathname === '/' ? <Apresentacao /> : <Entrada key={pathname} modoInicial={pathname === '/criar-conta' ? 'criar' : 'entrar'} />;

  return (
    <ProvedorDeAssinatura key={usuario.uid}>
    <ProvedorDeDados>
      <ProvedorDeLembretes><ProvedorDeLancamento>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Painel />} />
            <Route path="instalar" element={<Instalacao />} />
            <Route path="receitas" element={<Receitas />} />
            <Route path="despesas" element={<Despesas />} />
            <Route path="recorrencias" element={<Recorrencias />} />
            <Route path="previsao" element={<Previsao />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="dividas" element={<Dividas />} />
            <Route path="planejamento" element={<Planejamento />} />
            <Route path="historico" element={<Historico />} />
            <Route path="lembretes" element={<Lembretes />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="reserva-emergencia" element={<ReservaEmergencia />} />
            <Route path="objetivos" element={<Objetivos />} />
            <Route path="assinatura" element={<Assinatura />} />
            <Route path="admin" element={<Administracao />} />
            <Route path="privacidade" element={<Privacidade />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ProvedorDeLancamento></ProvedorDeLembretes>
    </ProvedorDeDados>
    </ProvedorDeAssinatura>
  );
}

export default function App() {
  return (
    <ProvedorDeTema><ProvedorDeInstalacao><HashRouter>
      <ProvedorDeAutenticacao>
        <ProvedorDeMes>
          <ProvedorDeRepositorios>
            <Routes>
              <Route path="/conheca" element={<Apresentacao />} />
              <Route path="/politica-de-privacidade" element={<DocumentosLegais tipo="privacidade" />} />
              <Route path="/atendimento" element={<Atendimento />} />
              <Route path="/termos-de-uso" element={<DocumentosLegais tipo="termos" />} />
              <Route path="*" element={<Portao />} />
            </Routes>
          </ProvedorDeRepositorios>
        </ProvedorDeMes>
      </ProvedorDeAutenticacao>
    </HashRouter></ProvedorDeInstalacao></ProvedorDeTema>
  );
}
