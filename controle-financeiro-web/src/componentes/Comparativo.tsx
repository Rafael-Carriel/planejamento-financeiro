import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ResumoDeMes } from '../tipos';
import { rotuloDoMesCurto } from '../utilitarios/datas';
import { formatarMoeda } from '../utilitarios/formatadores';

interface ComparativoProps {
  resumos: ResumoDeMes[];
}

interface DadosGrafico {
  nome: string;
  entradas: number;
  saidas: number;
}

/// Gráfico de barras comparativo: entradas vs. saídas por mês.
///
/// Mostra a evolução lado a lado em cada período, usando as cores do design
/// system (--entrada para verde, --saida para vermelho).
export function Comparativo({ resumos }: ComparativoProps) {
  if (resumos.length === 0) return null;

  const dados: DadosGrafico[] = resumos.map((r) => ({
    nome: rotuloDoMesCurto(r.inicio),
    entradas: r.entradas,
    saidas: r.saidas,
  }));

  return (
    <section className="cartao">
      <div className="cartao-cabeca">
        <h2>Comparativo Mensal</h2>
        <span className="texto-miudo">entradas vs. saídas</span>
      </div>
      <div className="cartao-corpo">
        <div className="comparativo-grafico">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={dados}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--borda)"
              />
              <XAxis
                dataKey="nome"
                tick={{ fill: 'var(--tinta-fraca)', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--borda)' }}
              />
              <YAxis
                tick={{ fill: 'var(--tinta-fraca)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(valor: number) => formatarMoeda(valor)}
              />
              <Tooltip
                formatter={(valor, nome) => [
                  formatarMoeda(Number(valor)),
                  nome === 'entradas' ? 'Entradas' : 'Saídas',
                ]}
                labelStyle={{ color: 'var(--tinta)', fontWeight: 600 }}
                contentStyle={{
                  background: 'var(--cartao)',
                  border: '1px solid var(--borda)',
                  borderRadius: 'var(--raio-pequeno)',
                  boxShadow: 'var(--sombra-cartao)',
                }}
                cursor={{ fill: 'rgba(109, 40, 217, 0.04)' }}
              />
              <Legend
                formatter={(valor: string) =>
                  valor === 'entradas' ? 'Entradas' : 'Saídas'
                }
              />
              <Bar
                dataKey="entradas"
                fill="var(--entrada)"
                radius={[4, 4, 0, 0]}
                name="entradas"
              />
              <Bar
                dataKey="saidas"
                fill="var(--saida)"
                radius={[4, 4, 0, 0]}
                name="saidas"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
