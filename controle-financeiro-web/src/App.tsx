import { PreferenciasMedicao } from './componentes/PreferenciasMedicao';
import { lazy, Suspense } from 'react';
const AreaAutenticada = lazy(() => import('./AreaAutenticada'));
import { ProvedorDeTema } from './contextos/ContextoTema';
import { ProvedorDeInstalacao } from './contextos/ContextoInstalacao';
import { Atendimento } from './paginas/Atendimento';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Apresentacao } from './paginas/Apresentacao';

import { Carregando } from './componentes/Estados';
import { ProvedorDeAutenticacao, useAutenticacao } from './contextos/ContextoAutenticacao';
import { ProvedorDeRepositorios } from './contextos/ContextoRepositorios';
import { ProvedorDeMes } from './contextos/ContextoMes';
import { Entrada } from './paginas/Entrada';
import { DocumentosLegais } from './paginas/Privacidade';
import { ConfirmacaoGoogle } from './componentes/ConfirmacaoGoogle';

/// Montagem do app.
///
/// Uso `HashRouter` de propósito: o endereço fica com `#/despesas`, o que é
/// menos bonito, mas funciona abrindo o `index.html` direto do disco e em
/// qualquer hospedagem estática, sem precisar configurar redirecionamento.

/// Só monta os provedores de dados depois que existe um usuário: assim nenhuma
/// consulta ao Firestore sai sem `uid` e sem permissão.
function Portao() {
  const { usuario, carregando, aceiteGooglePendente } = useAutenticacao();
  const { pathname } = useLocation();

  if (carregando) return <Carregando mensagem="Verificando sua sessão…" />;
  if (!usuario && pathname === '/atendimento') return <Atendimento />;
  if (!usuario) return pathname === '/' ? <Apresentacao /> : <Entrada key={pathname} modoInicial={pathname === '/criar-conta' ? 'criar' : 'entrar'} />;
  if (aceiteGooglePendente) return <ConfirmacaoGoogle />;

  return <AreaAutenticada key={usuario.uid} />;
}

export default function App() {
  return (
    <Suspense fallback={<Carregando mensagem="Abrindo o Planeora…" />}><ProvedorDeTema><ProvedorDeInstalacao><HashRouter><PreferenciasMedicao />
      <ProvedorDeAutenticacao>
        <ProvedorDeMes>
          <ProvedorDeRepositorios>
            <Routes>
              <Route path="/conheca" element={<Apresentacao />} />
              <Route path="/politica-de-privacidade" element={<DocumentosLegais tipo="privacidade" />} />
              <Route path="/termos-de-uso" element={<DocumentosLegais tipo="termos" />} />
              <Route path="*" element={<Portao />} />
            </Routes>
          </ProvedorDeRepositorios>
        </ProvedorDeMes>
      </ProvedorDeAutenticacao>
    </HashRouter></ProvedorDeInstalacao></ProvedorDeTema></Suspense>
  );
}
