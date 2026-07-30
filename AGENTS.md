# AGENTS.md — Evangelhos Cronológicos

## Contexto do Projeto

Aplicação PWA de leitura dos quatro Evangelhos em ordem cronológica.
Funciona totalmente offline, sem login, sem servidor, sem dependências externas.
O objetivo é imitar a experiência de leitura de um livro — não de uma Bíblia de estudo.

---

## Stack e Restrições Técnicas

- **HTML + CSS + JavaScript Vanilla** — sem frameworks, sem bibliotecas pesadas.
- **PWA**: `manifest.json` + `service-worker.js` para instalação e funcionamento offline.
- **Persistência**: `localStorage` exclusivamente (sem banco, sem API, sem sync).
- Zero dependências externas; tudo deve funcionar abrindo `index.html` diretamente no navegador.

---

## Build / Lint / Testes

Não há build step, bundler, nem test runner neste projeto.

- **Rodar localmente**: abrir `index.html` no navegador ou servir com qualquer servidor estático (ex.: `npx serve .` ou Live Server do VS Code).
- **Service Worker**: requer HTTPS ou `localhost` para registrar. Teste offline apenas nesses contextos.
- **Lint**: sem configuração formal — manter código consistente manualmente (ver convenções abaixo).

---

## Estrutura de Arquivos

```
/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── service-worker.js
├── dados/
│   └── cronologia.json
└── assets/
    └── icons/
```

---

## Estrutura de Dados (`cronologia.json`)

Cada item do array representa um acontecimento cronológico:

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

**Regras imutáveis:**
- A cronologia é definida manualmente pelo autor — a aplicação **nunca** reordena eventos automaticamente.
- Campos de evangelho ausente são `null` (não omitidos).
- A ordem dos evangelhos é sempre: **Mateus → Marcos → Lucas → João**. Nunca alterar essa sequência em nenhuma parte do código ou UI.

---

## Persistência (`localStorage`)

Chaves salvas:

| Chave | Conteúdo |
|---|---|
| progresso | status de cada acontecimento |
| favoritos | IDs favoritados |
| destaques | trechos marcados por ID |
| anotacoes | notas pessoais por ID |
| ultimoItem | ID do último acontecimento aberto |
| preferencias | tema, tamanho de fonte, espaçamento, fonte |

---

## Status de Progresso

Três estados possíveis, sem estados intermediários:

| Valor | Label | Ícone |
|---|---|---|
| `nao-iniciado` | Não iniciado | `○` |
| `em-leitura` | Em leitura | `◐` |
| `concluido` | Concluído | `●` |

---

## Indicador dos Evangelhos

Quatro círculos na ordem fixa **Mateus · Marcos · Lucas · João**:

- `●` = evangelho presente no acontecimento
- `○` = evangelho ausente

**Nunca usar letras, abreviações ou texto** no indicador. Apenas os quatro círculos.

---

## Convenções de Código

- **Modularidade**: separar responsabilidades em funções — dados, renderização, persistência.
- **Escalabilidade**: a estrutura de dados e a arquitetura devem suportar a adição futura de outros livros (Atos, Cartas, Apocalipse, AT) sem reescrita.
- **UX minimalista**: sem animações desnecessárias; toda decisão de design favorece a leitura.
- **Responsividade**: mobile-first; o app é projetado para uso diário no celular.
- Nenhuma lógica de negócio no HTML; todo o comportamento fica em `app.js`.
- Preferências do usuário (tema, fonte) são aplicadas via classes no `<html>` ou `<body>`.

---

## Funcionalidades (escopo v1.1)

1. Lista cronológica com título, indicador de evangelhos e status de leitura.
2. Barra de progresso global no topo (`145 / 380` · `38%`).
3. Botão "Continuar leitura" que leva ao `ultimoItem`.
4. Tela de leitura exibindo todos os evangelhos presentes em sequência, separados por divisor.
5. Pesquisa por título, referência e palavras do texto — resultados instantâneos.
6. Favoritos com lista própria.
7. Anotações pessoais por acontecimento.
8. Destaques de trechos salvos localmente.
9. Configurações: modo claro/escuro, tamanho de fonte, espaçamento, fonte serifada/sem serifa.
