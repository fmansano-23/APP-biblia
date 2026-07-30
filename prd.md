# PRD
# Evangelhos Cronológicos

Versão: 1.1

---

# Visão

Criar uma aplicação de leitura dos quatro Evangelhos em ordem cronológica, priorizando simplicidade, velocidade e uma excelente experiência de leitura.

O projeto não pretende ser uma Bíblia completa.

Seu objetivo é organizar todos os acontecimentos da vida de Jesus em uma sequência cronológica previamente definida pelo autor.

A aplicação deverá funcionar totalmente offline e ser utilizável como um aplicativo instalado no celular (PWA), sem depender de internet ou servidor.

---

# Objetivo

Permitir que o usuário leia os Evangelhos como uma única narrativa contínua.

Cada acontecimento será tratado como uma unidade cronológica.

Dentro dessa unidade poderão existir um, dois, três ou os quatro Evangelhos.

Exemplo:

Nascimento de João Batista

Lucas

...

ou

Multiplicação dos Pães

Mateus

...

Marcos

...

Lucas

...

João

...

---

# Filosofia do Produto

Este projeto não é um aplicativo para estudar capítulos da Bíblia.

É um aplicativo para acompanhar a história da vida de Cristo de forma contínua.

O usuário não deve pensar em capítulos.

Ele deve apenas seguir a sequência cronológica.

A experiência deve parecer a leitura de um livro.

---

# Plataforma

Aplicação desenvolvida utilizando:

- HTML
- CSS
- JavaScript (Vanilla)

Sem frameworks.

Transformada em PWA.

Requisitos:

- Offline
- Instalável
- Responsiva
- Muito rápida

---

# Estrutura dos Dados

Toda a cronologia será criada manualmente.

A aplicação nunca deverá reorganizar eventos automaticamente.

Cada item possui:

```json
{
  "id": 1,
  "ordem": 1,
  "titulo": "Anúncio do nascimento de João Batista",
  "mateus": null,
  "marcos": null,
  "lucas": {
    "referencia": "Lucas 1:5-25",
    "texto": "..."
  },
  "joao": null
}
```

---

# Tela Principal

A tela principal apresenta uma lista cronológica.

Cada item possui:

- título
- indicador dos evangelhos
- status de leitura
- botão para abrir

Exemplo

----------------------------------------------------

Anúncio do nascimento de João Batista

○ ○ ● ○

Não iniciado

>

----------------------------------------------------

---

# Indicador dos Evangelhos

Este será um dos elementos visuais mais importantes do aplicativo.

No canto direito de cada título existirá um indicador horizontal composto por quatro pequenos círculos.

A posição dos círculos é fixa.

Sempre na seguinte ordem:

1. Mateus
2. Marcos
3. Lucas
4. João

Nunca mudar essa ordem.

Exemplo:

● ○ ● ●

Significa:

Mateus possui esse acontecimento.

Marcos não possui.

Lucas possui.

João possui.

Após alguns dias de uso o usuário memorizará naturalmente essa ordem, conseguindo identificar rapidamente quais Evangelhos registram determinado acontecimento sem precisar ler nenhuma legenda.

Este indicador faz parte da identidade visual do aplicativo e deve estar presente em toda a navegação.

---

# Aparência do Indicador

Evangelho presente:

●

Evangelho ausente:

○

Sempre alinhado horizontalmente.

Pequeno.

Discreto.

Elegante.

Nunca utilizar letras.

Nunca utilizar abreviações.

Nunca utilizar texto.

Apenas quatro pequenos círculos.

---

# Tela de Leitura

Ao abrir um acontecimento mostrar:

Título

Indicador dos Evangelhos

Referências

Texto completo

Quando houver mais de um Evangelho, apresentar todos na mesma tela.

Exemplo

# Batismo de Jesus

Mateus 3

...

------------------

Marcos 1

...

------------------

Lucas 3

...

------------------

João 1

...

---

# Progresso

Cada acontecimento possui um status.

Estados possíveis:

Não iniciado

Em leitura

Concluído

Esse progresso será salvo localmente.

Sem login.

Sem conta.

Sem sincronização.

---

# Indicadores de Progresso

Na lista:

○ Não iniciado

◐ Em leitura

● Concluído

---

# Barra de Progresso

No topo:

145 / 380

38%

Barra horizontal preenchida.

---

# Continuar Leitura

Ao abrir o aplicativo:

Mostrar um botão

"Continuar leitura"

Esse botão leva diretamente ao último acontecimento aberto.

---

# Pesquisa

Pesquisar por:

- título
- referência
- palavras do texto

Resultados instantâneos.

---

# Favoritos

Cada acontecimento poderá ser favoritado.

Lista própria de favoritos.

---

# Anotações

Cada acontecimento aceita notas pessoais.

As notas ficam armazenadas apenas no dispositivo.

---

# Destaques

O usuário poderá destacar trechos importantes.

Os destaques ficam salvos localmente.

---

# Configurações

Modo claro

Modo escuro

Fonte maior

Fonte menor

Espaçamento

Fonte serifada

Fonte sem serifa

---

# Persistência

Utilizar LocalStorage.

Salvar:

- progresso
- favoritos
- destaques
- anotações
- último item aberto
- preferências

---

# Estrutura do Projeto

/
index.html

style.css

app.js

manifest.json

service-worker.js

dados/

cronologia.json

assets/

icons/

---

# Requisitos Técnicos

A aplicação deve abrir instantaneamente.

Nenhuma dependência externa.

Nenhum framework.

Nenhuma biblioteca pesada.

Código organizado.

Arquitetura modular.

Componentes reutilizáveis.

---

# Escalabilidade

Embora a primeira versão contenha apenas os quatro Evangelhos, toda a estrutura deve ser preparada para futuras expansões.

A arquitetura deve permitir adicionar posteriormente:

- Atos dos Apóstolos
- Cartas
- Apocalipse
- Todo o Novo Testamento
- Toda a Bíblia

sem necessidade de reescrever a aplicação.

---

# UX

A experiência deve transmitir a sensação de estar lendo um livro físico.

O usuário deve esquecer que está utilizando um aplicativo.

Toda a interface deve ser minimalista.

Sem distrações.

Sem animações desnecessárias.

Toda decisão de design deve favorecer a leitura.

---

# Objetivo Final

Criar a melhor experiência possível para acompanhar a vida de Cristo em ordem cronológica.

A aplicação deve ser extremamente simples, rápida, bonita e agradável de utilizar diariamente.

Ela deverá incentivar a leitura contínua, permitindo ao usuário retomar exatamente de onde parou e visualizar imediatamente quais Evangelhos registram cada acontecimento através do indicador de quatro círculos, que será um dos principais elementos da identidade visual do projeto.