# Controle Financeiro — app web

Versão web do controle financeiro pessoal, em React + Firebase. Lê e grava os
mesmos dados do aplicativo Flutter que está em `../controle_financeiro`: um
lançamento feito no celular aparece aqui, e vice-versa.

## Como rodar

Uma vez, para ligar o app ao Firebase e gravar o `.env.local`:

```powershell
cd "C:\Users\Rafael\Documents\DESENVOLVIMENTO\Controle Financeiro\controle-financeiro-web"
.\configurar-web.ps1
```

Depois, sempre que quiser trabalhar:

```powershell
.\iniciar.ps1
```

O app abre em <http://localhost:5173>. Para publicar:

```powershell
.\publicar.ps1
```

O `configurar-web.ps1` precisa da CLI do Firebase (`npm install -g
firebase-tools` e `firebase login`). Ele registra o app web no projeto
`controle-financeiro-rafael` — o projeto do Flutter só tinha o app Android — e
grava as seis variáveis que o Vite lê. Se preferir fazer à mão, copie o
`.env.example` para `.env.local` e complete com os dados de *Configurações do
projeto > Seus apps > app da Web* no console do Firebase.

No console, confira também se **Authentication > Sign-in method >
Email/Password** está ativado. É o único método que o app usa.

## O que tem em cada tela

**Painel** mostra o mês inteiro numa página: entradas, saídas, saldo, a régua
com o movimento dia a dia, a divisão por categoria, os limites que estão
apertando e os últimos lançamentos.

**Receitas** e **Despesas** são a mesma tela com o sinal trocado — totais do
mês, divisão por categoria, busca por descrição/categoria/observação, filtro por
categoria, ordenação e exportação em CSV.

**Recorrências** guarda o que se repete todo mês — salário, aluguel, assinatura,
o boleto em 3x. Você cadastra uma vez, dizendo a data da primeira vez e se
repete *sempre* ou um *número de vezes*. Nada é lançado automaticamente: cada mês
mostra a ocorrência como **prevista**, e um clique em *Lançar* transforma a
previsão em lançamento de verdade. Dá para pausar (⏸) sem perder o cadastro.

**Previsão** projeta os próximos 3, 6 ou 12 meses a partir das recorrências:
quanto entra, quanto sai, o saldo de cada mês e o acumulado. Cada mês vem com a
lista do que está previsto, e você pode confirmar um lançamento de mês futuro
direto dali — útil para o boleto que já foi pago adiantado.

**Categorias** lista o catálogo básico (o mesmo do app do celular, fixo) e as
categorias criadas por você, que podem ter emoji e cor ajustados. O nome de uma
categoria criada não muda: o lançamento guarda a categoria como texto, então
renomear desligaria a categoria de todo o histórico.

**Planejamento** define um limite por categoria de saída, mês a mês. A partir de
80% do limite a categoria aparece como "no limite", e acima de 100% como
"estourou". O botão *Copiar do mês anterior* evita redigitar tudo todo mês —
limites já ajustados no mês atual são preservados.

**Histórico** compara 6, 12 ou 24 meses: médias, melhor e pior mês, gráfico de
colunas, tabela mês a mês (clique numa linha para abrir aquele mês nas outras
telas) e os gastos do período somados por categoria.

## Como está organizado

```
src/
  firebase/config.ts     app, auth e Firestore
  tipos/                 os tipos do domínio
  utilitarios/           datas, formatação, CSV, estilo
  dados/                 catálogo básico de categorias
  servicos/              acesso ao Firestore e à autenticação
  dominio/               contas puras: resumos, totais, planejamento, recorrências
  contextos/             sessão, mês selecionado, dados do mês, lançamento
  componentes/           peças de tela reutilizadas
  paginas/               uma por rota
```

Quatro decisões que valem saber antes de mexer:

**Uma assinatura de transações para todo o app.** `ContextoDados` mantém o único
`onSnapshot` do mês; as páginas consomem a mesma lista. Se cada página abrisse a
sua, o mesmo mês seria lido várias vezes sem nenhum ganho. A exceção é o
histórico, que faz uma leitura pontual porque precisa de meses fora do
selecionado.

**Nenhum índice composto.** As consultas filtram e ordenam pelo mesmo campo
(`data`), então o índice automático do Firestore basta. Filtro por tipo e por
categoria acontece no navegador, sobre a lista já carregada.

**`valor` é sempre positivo.** O sinal vem do `tipo` (`entrada` ou `saida`).
Gravar valor negativo quebraria as regras do Firestore e os totais do app do
celular.

**Recorrência não grava nada sozinha.** A coleção `recorrencias` guarda só a
regra (valor, dia do mês, início, quantas parcelas). As ocorrências de um mês
são calculadas na hora, a partir da regra e das transações daquele mês. Uma
previsão desaparece quando existe uma transação com `recorrenciaId` igual ao id
da recorrência dentro do mês — esse campo é a única trava contra lançar duas
vezes. Foi escolhido assim para não depender de Cloud Function nem de tarefa
agendada: sem servidor rodando, nada some e nada duplica se o app ficar semanas
fechado.

## Regras do Firestore

As regras são as mesmas para os dois apps e ficam num só lugar:
`../controle_financeiro/firestore.rules`. Elas cobrem `usuarios/{uid}` e as
subcoleções `transacoes`, `categorias`, `orcamentos` e `recorrencias`, com
validação de campos. O app do celular não conhece as recorrências ainda, e não
precisa: ele ignora a coleção nova e o campo `recorrenciaId` das transações.
Para publicar:

```powershell
cd "C:\Users\Rafael\Documents\DESENVOLVIMENTO\Controle Financeiro\controle_financeiro"
firebase deploy --only firestore:rules
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | checagem de tipos + build de produção em `dist/` |
| `npm run preview` | serve o `dist/` para conferir o build |
| `npm run verificar` | só a checagem de tipos |

## Detalhes que costumam gerar dúvida

O endereço usa `#` (`/#/despesas`). É `HashRouter`: funciona abrindo o
`index.html` direto do disco e em qualquer hospedagem estática, sem configurar
redirecionamento.

As chaves do `.env.local` são públicas por natureza — o navegador precisa delas
para falar com o Firebase, e qualquer pessoa pode lê-las no código do site. O que
protege os dados são as regras do Firestore, que só liberam
`usuarios/{seu-uid}`. O arquivo fica fora do Git de todo modo.

As datas são tratadas em horário local, nunca em UTC. Um lançamento do dia 1º à
meia-noite convertido para UTC cairia no mês anterior num fuso negativo como o
do Brasil.

O CSV sai com ponto e vírgula, vírgula decimal e BOM — é o que o Excel em
português abre sem passar pelo assistente de importação.
