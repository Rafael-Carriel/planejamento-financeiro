import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './componentes/Layout';
import { Carregando } from './componentes/Estados';
import { ProvedorDeAutenticacao, useAutenticacao } from './contextos/ContextoAutenticacao';
import { ProvedorDeDados } from './contextos/ContextoDados';
import { ProvedorDeLancamento } from './contextos/ContextoLancamento';
import { ProvedorDeMes } from './contextos/ContextoMes';
import { Categorias } from './paginas/Categorias';
import { Despesas } from './paginas/Despesas';
import { Dividas } from './paginas/Dividas';
import { Entrada } from './paginas/Entrada';
import { Historico } from './paginas/Historico';
import { Painel } from './paginas/Painel';
import { Planejamento } from './paginas/Planejamento';
import { Previsao } from './paginas/Previsao';
import { Receitas } from './paginas/Receitas';
import { Recorrencias } from './paginas/Recorrencias';
import { Relatorios } from './paginas/Relatorios';
import { ReservaEmergencia } from './paginas/ReservaEmergencia';

/// Montagem do app.
///
/// Uso `HashRouter` de propósito: o endereço fica com `#/despesas`, o que é
/// menos bonito, mas funciona abrindo o `index.html` direto do disco e em
/// qualquer hospedagem estática, sem precisar configurar redirecionamento.

/// Só monta os provedores de dados depois que existe um usuário: assim nenhuma
/// consulta ao Firestore sai sem `uid` e sem permissão.
function Portao() {
  const { usuario, carregando } = useAutenticacao();

  if (carregando) return <Carregando mensagem="Verificando sua sessão…" />;
  if (!usuario) return <Entrada />;

  return (
    <ProvedorDeDados>
      <ProvedorDeLancamento>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Painel />} />
            <Route path="receitas" element={<Receitas />} />
            <Route path="despesas" element={<Despesas />} />
            <Route path="recorrencias" element={<Recorrencias />} />
            <Route path="previsao" element={<Previsao />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="dividas" element={<Dividas />} />
            <Route path="planejamento" element={<Planejamento />} />
            <Route path="historico" element={<Historico />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="reserva-emergencia" element={<ReservaEmergencia />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ProvedorDeLancamento>
    </ProvedorDeDados>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ProvedorDeAutenticacao>
        <ProvedorDeMes>
          <Portao />
        </ProvedorDeMes>
      </ProvedorDeAutenticacao>
    </HashRouter>
  );
}
