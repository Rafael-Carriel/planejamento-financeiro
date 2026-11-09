import { lazy, Suspense } from 'react';
import { Carregando } from './componentes/Estados';
import { ProvedorDeLembretes } from './contextos/ContextoLembretes';
import { Layout } from './componentes/Layout';
import { ProvedorDeDados } from './contextos/ContextoDados';
import { ProvedorDeLancamento } from './contextos/ContextoLancamento';
const Categorias = lazy(() => import('./paginas/Categorias').then(m => ({ default: m.Categorias })));
import { Despesas } from './paginas/Despesas';
const Dividas = lazy(() => import('./paginas/Dividas').then(m => ({ default: m.Dividas })));
const Historico = lazy(() => import('./paginas/Historico').then(m => ({ default: m.Historico })));
import { Lembretes } from './paginas/Lembretes';
const Objetivos = lazy(() => import('./paginas/Objetivos').then(m => ({ default: m.Objetivos })));
import { Painel } from './paginas/Painel';
const Planejamento = lazy(() => import('./paginas/Planejamento').then(m => ({ default: m.Planejamento })));
const Previsao = lazy(() => import('./paginas/Previsao').then(m => ({ default: m.Previsao })));
import { Receitas } from './paginas/Receitas';
const Recorrencias = lazy(() => import('./paginas/Recorrencias').then(m => ({ default: m.Recorrencias })));
const Relatorios = lazy(() => import('./paginas/Relatorios').then(m => ({ default: m.Relatorios })));
const ReservaEmergencia = lazy(() => import('./paginas/ReservaEmergencia').then(m => ({ default: m.ReservaEmergencia })));
const Assinatura = lazy(() => import('./paginas/Assinatura').then(m => ({ default: m.Assinatura })));
const Administracao = lazy(() => import('./paginas/Administracao').then(m => ({ default: m.Administracao })));
import { ProvedorDeAssinatura } from './contextos/ContextoAssinatura';
const Instalacao = lazy(() => import('./paginas/Instalacao').then(m => ({ default: m.Instalacao })));
import { Navigate, Route, Routes } from 'react-router-dom';
import { Atendimento } from './paginas/Atendimento';
import { Privacidade } from './paginas/Privacidade';
export default function AreaAutenticada() {
  return (
    <ProvedorDeAssinatura >
    <ProvedorDeDados>
      <ProvedorDeLembretes><ProvedorDeLancamento>
        <Suspense fallback={<Carregando mensagem="Abrindo página…" />}><Routes>
          <Route element={<Layout />}>
            <Route index element={<Painel />} />
            <Route path="atendimento" element={<Atendimento integrado />} />
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
        </Routes></Suspense>
      </ProvedorDeLancamento></ProvedorDeLembretes>
    </ProvedorDeDados>
    </ProvedorDeAssinatura>
  );
}
