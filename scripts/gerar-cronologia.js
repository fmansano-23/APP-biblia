#!/usr/bin/env node
/**
 * gerar-cronologia.js
 *
 * Baixa os 4 Evangelhos na versão ARC (Almeida Revista e Corrigida) do
 * repositório público damarals/biblias e monta dados/cronologia.json com
 * os 250 eventos cronológicos da vida de Cristo, incluindo texto completo.
 *
 * Uso:  node scripts/gerar-cronologia.js
 * Node: >= 14  (sem dependências externas — usa apenas módulos built-in)
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── Configuração ─────────────────────────────────────────────────────────────

const BASE = 'https://raw.githubusercontent.com/damarals/biblias/main/data/canonical/ARC';

const FONTES = {
  mateus: `${BASE}/MAT.json`,
  marcos: `${BASE}/MRK.json`,
  lucas:  `${BASE}/LUK.json`,
  joao:   `${BASE}/JHN.json`,
};

const PREFIXOS = { mateus: 'Mt', marcos: 'Mc', lucas: 'Lc', joao: 'Jo' };

const SECOES = {
  A: 'A. Nascimento e Preparação de Jesus Cristo',
  B: 'B. Mensagem e Ministério de Jesus',
  C: 'C. Morte e Ressurreição de Jesus',
};

const OUTPUT = path.resolve(__dirname, '..', 'dados', 'cronologia.json');

// ─── Rede ─────────────────────────────────────────────────────────────────────

function baixar(url) {
  return new Promise((resolve, reject) => {
    let raw = '';
    https.get(url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} em ${url}`));
      }
      res.setEncoding('utf8');
      res.on('data', c => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ─── Índice de versículos ─────────────────────────────────────────────────────

/**
 * Cria índice: idx[capitulo][verso] = texto
 */
function indexar(livroJson) {
  const idx = {};
  for (const cap of livroJson.chapters) {
    idx[cap.number] = {};
    for (const v of cap.verses) {
      idx[cap.number][v.number] = v.text;
    }
  }
  return idx;
}

// ─── Parser de referências ─────────────────────────────────────────────────────

/** Remove sufixos de letra (22.54a → 22.54) e espaços extras */
function norm(ref) {
  return ref.trim().replace(/([0-9])([a-zA-Z])\b/g, '$1');
}

/**
 * Extrai versículos de um índice dado uma string de referência.
 * Formatos suportados:
 *   "1.5"          → cap 1, v5
 *   "1.5-25"       → cap 1, v5 a v25
 *   "2.23-3.21"    → cap 2 v23..fim + cap 3 v1-21
 *   "11.12-14,20-26" → cap 11 v12-14 e v20-26
 *
 * Retorna string com versículos no formato "N texto. N+1 texto..."
 */
function extrairTexto(refStr, idx) {
  if (!refStr || !idx) return '';
  const ref = norm(refStr);

  // Vírgula: múltiplos segmentos no mesmo capítulo ("11.12-14,20-26")
  if (ref.includes(',')) {
    const partes = ref.split(',');
    const capBase = partes[0].split('.')[0];
    return partes.map(p => {
      const seg = p.trim();
      return extrairTexto(seg.includes('.') ? seg : `${capBase}.${seg}`, idx);
    }).filter(Boolean).join(' ');
  }

  // Cross-chapter: "X.Y-W.Z"
  const cross = ref.match(/^(\d+)\.(\d+)-(\d+)\.(\d+)$/);
  if (cross) {
    const [, c1, v1, c2, v2] = cross.map(Number);
    const partes = [];
    for (let c = c1; c <= c2; c++) {
      if (!idx[c]) continue;
      const vv = Object.keys(idx[c]).map(Number).sort((a, b) => a - b);
      const ini = c === c1 ? v1 : vv[0];
      const fim = c === c2 ? v2 : vv[vv.length - 1];
      for (const v of vv) {
        if (v >= ini && v <= fim && idx[c][v]) partes.push(`${v} ${idx[c][v]}`);
      }
    }
    return partes.join(' ');
  }

  // Padrão: "cap.vi[-vf]"
  const m = ref.match(/^(\d+)\.(\d+)(?:-(\d+))?$/);
  if (!m) {
    process.stderr.write(`  ⚠ Referência não reconhecida: "${refStr}"\n`);
    return '';
  }
  const [, capStr, viStr, vfStr] = m;
  const cap = Number(capStr);
  const vi  = Number(viStr);
  const vf  = vfStr ? Number(vfStr) : vi;

  if (!idx[cap]) {
    process.stderr.write(`  ⚠ Capítulo ${cap} ausente no índice\n`);
    return '';
  }

  const versos = [];
  for (let v = vi; v <= vf; v++) {
    if (idx[cap][v]) versos.push(`${v} ${idx[cap][v]}`);
  }
  return versos.join(' ');
}

// ─── Tabela dos 250 Eventos ───────────────────────────────────────────────────
// Fonte: Harmonia dos Evangelhos — Bíblia de Estudo Cronológica Aplicação Pessoal
// Campos: id, secao (A/B/C), subsecao (string|null), titulo,
//         mt/mc/lc/jo (string de referência ARC | null)

const EVENTOS_RAW = [
  // ── A. Nascimento e Preparação ─────────────────────────────────────────────
  { id: 1,   s: 'A', ss: null, t: 'A natureza dos Evangelhos',                               mt: null,        mc: '1.1',       lc: '1.1-4',       jo: null         },
  { id: 2,   s: 'A', ss: null, t: 'Deus fez-se homem',                                       mt: null,        mc: null,        lc: null,          jo: '1.1-18'     },
  { id: 3,   s: 'A', ss: null, t: 'Um anjo promete a Zacarias o nascimento de João',          mt: null,        mc: null,        lc: '1.5-25',      jo: null         },
  { id: 4,   s: 'A', ss: null, t: 'Um anjo promete a Maria o nascimento de Jesus',            mt: null,        mc: null,        lc: '1.26-38',     jo: null         },
  { id: 5,   s: 'A', ss: null, t: 'Maria visita Isabel',                                      mt: null,        mc: null,        lc: '1.39-45',     jo: null         },
  { id: 6,   s: 'A', ss: null, t: 'O Magnificat: cântico de louvor de Maria',                 mt: null,        mc: null,        lc: '1.46-56',     jo: null         },
  { id: 7,   s: 'A', ss: null, t: 'Nasce João Batista',                                       mt: null,        mc: null,        lc: '1.57-66',     jo: null         },
  { id: 8,   s: 'A', ss: null, t: 'A profecia de Zacarias',                                   mt: null,        mc: null,        lc: '1.67-80',     jo: null         },
  { id: 9,   s: 'A', ss: null, t: 'Um anjo aparece a José',                                   mt: '1.18-25',   mc: null,        lc: null,          jo: null         },
  { id: 10,  s: 'A', ss: null, t: 'O registro dos antepassados de Jesus',                     mt: '1.1-17',    mc: null,        lc: '3.23-38',     jo: null         },
  { id: 11,  s: 'A', ss: null, t: 'Nasce Jesus em Belém',                                     mt: null,        mc: null,        lc: '2.1-7',       jo: null         },
  { id: 12,  s: 'A', ss: null, t: 'Pastores visitam Jesus',                                   mt: null,        mc: null,        lc: '2.8-20',      jo: null         },
  { id: 13,  s: 'A', ss: null, t: 'Maria e José levam Jesus ao Templo',                       mt: null,        mc: null,        lc: '2.21-24',     jo: null         },
  { id: 14,  s: 'A', ss: null, t: 'A profecia de Simeão',                                     mt: null,        mc: null,        lc: '2.25-35',     jo: null         },
  { id: 15,  s: 'A', ss: null, t: 'A profecia de Ana',                                        mt: null,        mc: null,        lc: '2.36-38',     jo: null         },
  { id: 16,  s: 'A', ss: null, t: 'Visitantes chegam do Oriente',                             mt: '2.1-12',    mc: null,        lc: null,          jo: null         },
  { id: 17,  s: 'A', ss: null, t: 'A fuga para o Egito',                                      mt: '2.13-18',   mc: null,        lc: null,          jo: null         },
  { id: 18,  s: 'A', ss: null, t: 'O retorno do Egito',                                       mt: '2.19-22',   mc: null,        lc: null,          jo: null         },
  { id: 19,  s: 'A', ss: null, t: 'Infância de Jesus em Nazaré',                              mt: '2.23',      mc: null,        lc: '2.39-40',     jo: null         },
  { id: 20,  s: 'A', ss: null, t: 'Jesus fala com os mestres religiosos',                     mt: null,        mc: null,        lc: '2.41-52',     jo: null         },
  { id: 21,  s: 'A', ss: null, t: 'João Batista prepara o caminho para Jesus',                mt: '3.1-12',    mc: '1.2-8',     lc: '3.1-18',      jo: '1.19-28'    },
  { id: 22,  s: 'A', ss: null, t: 'O batismo de Jesus',                                       mt: '3.13-17',   mc: '1.9-11',    lc: '3.21-22',     jo: null         },
  { id: 23,  s: 'A', ss: null, t: 'Satanás tenta Jesus no deserto',                           mt: '4.1-11',    mc: '1.12-13',   lc: '4.1-13',      jo: null         },
  { id: 24,  s: 'A', ss: null, t: 'João Batista proclama Jesus como o Messias',               mt: null,        mc: null,        lc: null,          jo: '1.29-34'    },
  { id: 25,  s: 'A', ss: null, t: 'Os primeiros discípulos seguem Jesus',                     mt: null,        mc: null,        lc: null,          jo: '1.35-51'    },
  { id: 26,  s: 'A', ss: null, t: 'Jesus transforma água em vinho',                           mt: null,        mc: null,        lc: null,          jo: '2.1-12'     },

  // ── B. Mensagem e Ministério ───────────────────────────────────────────────
  // Jesus Inicia seu Ministério em Jerusalém
  { id: 27,  s: 'B', ss: 'Jesus Inicia seu Ministério em Jerusalém',  t: 'Jesus limpa o Templo',                                          mt: null,        mc: null,        lc: null,          jo: '2.13-22'    },
  { id: 28,  s: 'B', ss: 'Jesus Inicia seu Ministério em Jerusalém',  t: 'Nicodemos visita Jesus à noite',                                 mt: null,        mc: null,        lc: null,          jo: '2.23-3.21'  },
  { id: 29,  s: 'B', ss: 'Jesus Inicia seu Ministério em Jerusalém',  t: 'João Batista fala mais sobre Jesus',                             mt: null,        mc: null,        lc: null,          jo: '3.22-36'    },
  { id: 30,  s: 'B', ss: 'Jesus Inicia seu Ministério em Jerusalém',  t: 'Herodes coloca João na prisão',                                  mt: null,        mc: null,        lc: '3.19-20',     jo: null         },
  { id: 31,  s: 'B', ss: 'Jesus Inicia seu Ministério em Jerusalém',  t: 'Jesus deixa a Judeia',                                           mt: '4.12',      mc: '1.14',      lc: null,          jo: '4.1-3'      },

  // Jesus Ministra em Samaria
  { id: 32,  s: 'B', ss: 'Jesus Ministra em Samaria',  t: 'Jesus conversa com uma mulher junto ao poço',                                  mt: null,        mc: null,        lc: null,          jo: '4.4-26'     },
  { id: 33,  s: 'B', ss: 'Jesus Ministra em Samaria',  t: 'Jesus fala sobre a colheita espiritual',                                       mt: null,        mc: null,        lc: null,          jo: '4.27-38'    },
  { id: 34,  s: 'B', ss: 'Jesus Ministra em Samaria',  t: 'Muitos samaritanos creem em Jesus',                                            mt: null,        mc: null,        lc: null,          jo: '4.39-42'    },

  // Jesus Ministra na Galileia
  { id: 35,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus prega na Galileia',                                                      mt: '4.13-17',   mc: '1.15',      lc: '4.14-15',     jo: '4.43-45'    },
  { id: 36,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus cura o filho de um oficial do governo',                                  mt: null,        mc: null,        lc: null,          jo: '4.46-54'    },
  { id: 37,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Alguns pescadores seguem Jesus',                                               mt: '4.18-22',   mc: '1.16-20',   lc: '5.1-11',      jo: null         },
  { id: 38,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus ensina com autoridade',                                                  mt: null,        mc: '1.21-28',   lc: '4.31-37',     jo: null         },
  { id: 39,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus cura a sogra de Pedro e muitos outros',                                  mt: '8.14-17',   mc: '1.29-34',   lc: '4.38-41',     jo: null         },
  { id: 40,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus prega por toda a Galileia',                                              mt: '4.23-25',   mc: '1.35-39',   lc: '4.42-44',     jo: null         },
  { id: 41,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus cura um leproso',                                                        mt: '8.1-4',     mc: '1.40-45',   lc: '5.12-16',     jo: null         },
  { id: 42,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus cura um paralítico',                                                     mt: '9.1-8',     mc: '2.1-12',    lc: '5.17-26',     jo: null         },
  { id: 43,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus come com pecadores na casa de Mateus',                                   mt: '9.9-13',    mc: '2.13-17',   lc: '5.27-32',     jo: null         },
  { id: 44,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Os líderes religiosos perguntam a Jesus sobre o jejum',                        mt: '9.14-17',   mc: '2.18-22',   lc: '5.33-39',     jo: null         },
  { id: 45,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus cura o paralítico de Betesda',                                           mt: null,        mc: null,        lc: null,          jo: '5.1-15'     },
  { id: 46,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus afirma ser o Filho de Deus',                                             mt: null,        mc: null,        lc: null,          jo: '5.16-30'    },
  { id: 47,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus reforça sua reivindicação',                                              mt: null,        mc: null,        lc: null,          jo: '5.31-47'    },
  { id: 48,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Os discípulos colhem espigas no sábado',                                       mt: '12.1-8',    mc: '2.23-28',   lc: '6.1-5',       jo: null         },
  { id: 49,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus cura a mão de um homem no sábado',                                       mt: '12.9-14',   mc: '3.1-6',     lc: '6.6-11',      jo: null         },
  { id: 50,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Grandes multidões seguem Jesus',                                               mt: '12.15-21',  mc: '3.7-12',    lc: '6.17-19',     jo: null         },
  { id: 51,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus escolhe os doze discípulos',                                             mt: null,        mc: '3.13-19',   lc: '6.12-16',     jo: null         },
  { id: 52,  s: 'B', ss: 'Jesus Ministra na Galileia', t: 'Jesus profere as bem-aventuranças',                                            mt: '5.1-12',    mc: null,        lc: '6.20-26',     jo: null         },
  { id: 53,  s: 'B', ss: null, t: 'Jesus ensina sobre o sal e a luz',                                                                     mt: '5.13-16',   mc: null,        lc: null,          jo: null         },
  { id: 54,  s: 'B', ss: null, t: 'Jesus ensina sobre a lei',                                                                             mt: '5.17-20',   mc: null,        lc: null,          jo: null         },
  { id: 55,  s: 'B', ss: null, t: 'Jesus ensina sobre a ira',                                                                             mt: '5.21-26',   mc: null,        lc: null,          jo: null         },
  { id: 56,  s: 'B', ss: null, t: 'Jesus ensina sobre a luxúria',                                                                         mt: '5.27-30',   mc: null,        lc: null,          jo: null         },
  { id: 57,  s: 'B', ss: null, t: 'Jesus ensina sobre o divórcio',                                                                        mt: '5.31-32',   mc: null,        lc: null,          jo: null         },
  { id: 58,  s: 'B', ss: null, t: 'Jesus ensina sobre votos',                                                                             mt: '5.33-37',   mc: null,        lc: null,          jo: null         },
  { id: 59,  s: 'B', ss: null, t: 'Jesus ensina sobre a vingança',                                                                        mt: '5.38-42',   mc: null,        lc: null,          jo: null         },
  { id: 60,  s: 'B', ss: null, t: 'Jesus ensina sobre amar os inimigos',                                                                  mt: '5.43-48',   mc: null,        lc: '6.27-36',     jo: null         },
  { id: 61,  s: 'B', ss: null, t: 'Jesus ensina sobre dar aos necessitados',                                                              mt: '6.1-4',     mc: null,        lc: null,          jo: null         },
  { id: 62,  s: 'B', ss: null, t: 'Jesus ensina sobre a oração',                                                                         mt: '6.5-15',    mc: null,        lc: null,          jo: null         },
  { id: 63,  s: 'B', ss: null, t: 'Jesus ensina sobre o jejum',                                                                           mt: '6.16-18',   mc: null,        lc: null,          jo: null         },
  { id: 64,  s: 'B', ss: null, t: 'Jesus ensina sobre o dinheiro',                                                                        mt: '6.19-24',   mc: null,        lc: null,          jo: null         },
  { id: 65,  s: 'B', ss: null, t: 'Jesus ensina sobre a preocupação',                                                                     mt: '6.25-34',   mc: null,        lc: null,          jo: null         },
  { id: 66,  s: 'B', ss: null, t: 'Jesus ensina sobre a atitude de julgar os outros',                                                     mt: '7.1-6',     mc: null,        lc: '6.37-42',     jo: null         },
  { id: 67,  s: 'B', ss: null, t: 'Jesus ensina sobre pedir, buscar, bater',                                                              mt: '7.7-11',    mc: null,        lc: null,          jo: null         },
  { id: 68,  s: 'B', ss: null, t: 'A regra áurea',                                                                                        mt: '7.12',      mc: null,        lc: null,          jo: null         },
  { id: 69,  s: 'B', ss: null, t: 'Jesus ensina sobre o caminho para o céu',                                                              mt: '7.13-14',   mc: null,        lc: null,          jo: null         },
  { id: 70,  s: 'B', ss: null, t: 'Jesus ensina sobre o fruto na vida das pessoas',                                                       mt: '7.15-29',   mc: null,        lc: '6.43-49',     jo: null         },
  { id: 71,  s: 'B', ss: null, t: 'Um oficial romano demonstra fé',                                                                       mt: '8.5-13',    mc: null,        lc: '7.1-10',      jo: null         },
  { id: 72,  s: 'B', ss: null, t: 'Jesus ressuscita o filho de uma viúva',                                                                mt: null,        mc: null,        lc: '7.11-17',     jo: null         },
  { id: 73,  s: 'B', ss: null, t: 'Jesus sana a dúvida de João',                                                                          mt: '11.1-19',   mc: null,        lc: '7.18-35',     jo: null         },
  { id: 74,  s: 'B', ss: null, t: 'Jesus promete repouso para a alma',                                                                    mt: '11.20-30',  mc: null,        lc: null,          jo: null         },
  { id: 75,  s: 'B', ss: null, t: 'Uma mulher pecadora unge os pés de Jesus',                                                             mt: null,        mc: null,        lc: '7.36-50',     jo: null         },
  { id: 76,  s: 'B', ss: null, t: 'Mulheres acompanham Jesus e os discípulos',                                                            mt: null,        mc: null,        lc: '8.1-3',       jo: null         },
  { id: 77,  s: 'B', ss: null, t: 'Os líderes religiosos acusam Jesus de obter seu poder de Satanás',                                     mt: '12.22-37',  mc: '3.20-30',   lc: '11.14-23',    jo: null         },
  { id: 78,  s: 'B', ss: null, t: 'Os líderes religiosos pedem a Jesus um sinal miraculoso',                                              mt: '12.38-45',  mc: null,        lc: '11.24-32',    jo: null         },
  { id: 79,  s: 'B', ss: null, t: 'Jesus descreve sua verdadeira família',                                                                mt: '12.46-50',  mc: '3.31-35',   lc: '8.19-21',     jo: null         },
  { id: 80,  s: 'B', ss: null, t: 'A parábola dos quatro tipos de solo',                                                                  mt: '13.1-23',   mc: '4.1-20',    lc: '8.4-15',      jo: null         },
  { id: 81,  s: 'B', ss: null, t: 'Jesus conta a parábola da candeia',                                                                    mt: null,        mc: '4.21-25',   lc: '8.16-18',     jo: null         },
  { id: 82,  s: 'B', ss: null, t: 'Jesus conta a parábola da semente',                                                                    mt: null,        mc: '4.26-29',   lc: null,          jo: null         },
  { id: 83,  s: 'B', ss: null, t: 'Jesus conta a parábola do joio',                                                                       mt: '13.24-30',  mc: null,        lc: null,          jo: null         },
  { id: 84,  s: 'B', ss: null, t: 'Jesus conta as parábolas do grão de mostarda e do fermento',                                           mt: '13.31-33',  mc: '4.30-32',   lc: '13.18-21',    jo: null         },
  { id: 85,  s: 'B', ss: null, t: 'Por que Jesus ensinava usando parábolas',                                                              mt: '13.34-35',  mc: '4.33-34',   lc: null,          jo: null         },
  { id: 86,  s: 'B', ss: null, t: 'Jesus explica a parábola do joio',                                                                     mt: '13.36-43',  mc: null,        lc: null,          jo: null         },
  { id: 87,  s: 'B', ss: null, t: 'Jesus conta a parábola do tesouro escondido',                                                          mt: '13.44',     mc: null,        lc: null,          jo: null         },
  { id: 88,  s: 'B', ss: null, t: 'Jesus conta a parábola do negociante de pérolas',                                                      mt: '13.45-46',  mc: null,        lc: null,          jo: null         },
  { id: 89,  s: 'B', ss: null, t: 'Jesus conta a parábola da rede de pesca',                                                              mt: '13.47-52',  mc: null,        lc: null,          jo: null         },
  { id: 90,  s: 'B', ss: null, t: 'Jesus aplaca uma tempestade',                                                                          mt: '8.23-27',   mc: '4.35-41',   lc: '8.22-25',     jo: null         },
  { id: 91,  s: 'B', ss: null, t: 'Jesus expulsa demônios e deixa que entrem em uma manada de porcos',                                    mt: '8.28-34',   mc: '5.1-20',    lc: '8.26-39',     jo: null         },
  { id: 92,  s: 'B', ss: null, t: 'Jesus cura uma mulher com hemorragia e ressuscita uma menina',                                         mt: '9.18-26',   mc: '5.21-43',   lc: '8.40-56',     jo: null         },
  { id: 93,  s: 'B', ss: null, t: 'Jesus cura cegos e um mudo',                                                                           mt: '9.27-34',   mc: null,        lc: null,          jo: null         },
  { id: 94,  s: 'B', ss: null, t: 'Jesus é rejeitado em Nazaré',                                                                          mt: '13.53-58',  mc: '6.1-6',     lc: '4.16-30',     jo: null         },
  { id: 95,  s: 'B', ss: null, t: 'Jesus insta com os discípulos para orar por mais obreiros',                                            mt: '9.35-38',   mc: null,        lc: null,          jo: null         },
  { id: 96,  s: 'B', ss: null, t: 'Jesus envia os doze discípulos',                                                                       mt: '10.1-15',   mc: '6.6-13',    lc: '9.1-6',       jo: null         },
  { id: 97,  s: 'B', ss: null, t: 'Jesus prepara os discípulos para a perseguição',                                                       mt: '10.16-42',  mc: null,        lc: null,          jo: null         },
  { id: 98,  s: 'B', ss: null, t: 'Herodes mata João Batista',                                                                            mt: '14.3-12',   mc: '6.17-29',   lc: null,          jo: null         },
  { id: 99,  s: 'B', ss: null, t: 'Herodes pensa que Jesus é João Batista ressuscitado dos mortos',                                       mt: '14.1-2',    mc: '6.14-16',   lc: '9.7-9',       jo: null         },
  { id: 100, s: 'B', ss: null, t: 'Jesus alimenta cinco mil pessoas',                                                                     mt: '14.13-21',  mc: '6.30-44',   lc: '9.10-17',     jo: '6.1-15'     },
  { id: 101, s: 'B', ss: null, t: 'Jesus anda sobre as águas',                                                                            mt: '14.22-33',  mc: '6.45-52',   lc: null,          jo: '6.16-21'    },
  { id: 102, s: 'B', ss: null, t: 'Jesus cura todos aqueles que o tocam',                                                                 mt: '14.34-36',  mc: '6.53-56',   lc: null,          jo: null         },
  { id: 103, s: 'B', ss: null, t: 'Jesus é o verdadeiro pão que veio do céu',                                                             mt: null,        mc: null,        lc: null,          jo: '6.22-40'    },
  { id: 104, s: 'B', ss: null, t: 'Alguns discordam de que Jesus veio do céu',                                                            mt: null,        mc: null,        lc: null,          jo: '6.41-59'    },
  { id: 105, s: 'B', ss: null, t: 'Muitos discípulos abandonam Jesus',                                                                    mt: null,        mc: null,        lc: null,          jo: '6.60-71'    },
  { id: 106, s: 'B', ss: null, t: 'Jesus ensina sobre a pureza interior',                                                                 mt: '15.1-20',   mc: '7.1-23',    lc: null,          jo: null         },

  // O Ministério de Jesus além da Galileia
  { id: 107, s: 'B', ss: 'O Ministério de Jesus além da Galileia', t: 'Jesus expulsa um demônio de uma jovem',                           mt: '15.21-28',  mc: '7.24-30',   lc: null,          jo: null         },
  { id: 108, s: 'B', ss: 'O Ministério de Jesus além da Galileia', t: 'Jesus cura muitas pessoas',                                       mt: '15.29-31',  mc: '7.31-37',   lc: null,          jo: null         },
  { id: 109, s: 'B', ss: 'O Ministério de Jesus além da Galileia', t: 'Jesus alimenta quatro mil pessoas',                               mt: '15.32-39',  mc: '8.1-10',    lc: null,          jo: null         },

  // Jesus Retoma seu Ministério na Galileia
  { id: 110, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Os líderes exigem um sinal miraculoso',                          mt: '16.1-4',    mc: '8.11-13',   lc: null,          jo: null         },
  { id: 111, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Jesus adverte contra o ensino errôneo',                          mt: '16.5-12',   mc: '8.14-21',   lc: null,          jo: null         },
  { id: 112, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Jesus restaura a visão para um homem cego',                      mt: null,        mc: '8.22-26',   lc: null,          jo: null         },
  { id: 113, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Pedro diz que Jesus é o Messias',                                mt: '16.13-20',  mc: '8.27-30',   lc: '9.18-21',     jo: null         },
  { id: 114, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Jesus prediz sua morte pela primeira vez',                       mt: '16.21-28',  mc: '8.31-9.1',  lc: '9.22-27',     jo: null         },
  { id: 115, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Jesus transfigura-se no monte',                                  mt: '17.1-13',   mc: '9.2-13',    lc: '9.28-36',     jo: null         },
  { id: 116, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Jesus cura um menino endemoninhado',                             mt: '17.14-21',  mc: '9.14-29',   lc: '9.37-43',     jo: null         },
  { id: 117, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Jesus prediz sua morte pela segunda vez',                        mt: '17.22-23',  mc: '9.30-32',   lc: '9.43-45',     jo: null         },
  { id: 118, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Pedro encontra a moeda na boca do peixe',                        mt: '17.24-27',  mc: null,        lc: null,          jo: null         },
  { id: 119, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Os discípulos discutem sobre quem seria o maior',                mt: '18.1-5',    mc: '9.33-37',   lc: '9.46-48',     jo: null         },
  { id: 120, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Os discípulos proíbem um homem de usar o nome de Jesus',         mt: null,        mc: '9.38-41',   lc: '9.49-50',     jo: null         },
  { id: 121, s: 'B', ss: 'Jesus Retoma seu Ministério na Galileia', t: 'Jesus adverte contra a tentação',                                mt: '18.6-11',   mc: '9.42-50',   lc: null,          jo: null         },
  { id: 122, s: 'B', ss: null, t: 'Jesus conta a parábola da ovelha perdida',                                                            mt: '18.12-14',  mc: null,        lc: null,          jo: null         },
  { id: 123, s: 'B', ss: null, t: 'Jesus ensina como lidar com um crente que peca',                                                      mt: '18.15-20',  mc: null,        lc: null,          jo: null         },
  { id: 124, s: 'B', ss: null, t: 'Jesus conta a parábola do devedor inclemente',                                                        mt: '18.21-35',  mc: null,        lc: null,          jo: null         },
  { id: 125, s: 'B', ss: null, t: 'Os irmãos de Jesus o ridicularizam',                                                                  mt: null,        mc: null,        lc: null,          jo: '7.1-9'      },

  // Jesus Dirige-se a Jerusalém
  { id: 126, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus viaja para a Judeia',                                                  mt: '19.1-2',    mc: '10.1',      lc: '9.51',        jo: null         },
  { id: 127, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus passa por Samaria',                                                    mt: null,        mc: null,        lc: '9.52-56',     jo: null         },
  { id: 128, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre o preço de segui-lo',                                     mt: '8.18-22',   mc: null,        lc: '9.57-62',     jo: null         },
  { id: 129, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina abertamente no Templo',                                         mt: null,        mc: null,        lc: null,          jo: '7.10-31'    },
  { id: 130, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Os líderes religiosos tentam prender Jesus',                                 mt: null,        mc: null,        lc: null,          jo: '7.32-53'    },
  { id: 131, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus perdoa uma mulher adúltera',                                           mt: null,        mc: null,        lc: null,          jo: '8.1-11'     },
  { id: 132, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus é a luz do mundo',                                                     mt: null,        mc: null,        lc: null,          jo: '8.12-20'    },
  { id: 133, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus adverte do juízo vindouro',                                            mt: null,        mc: null,        lc: null,          jo: '8.21-30'    },
  { id: 134, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus fala sobre os verdadeiros filhos de Deus',                             mt: null,        mc: null,        lc: null,          jo: '8.31-47'    },
  { id: 135, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus declara que é eterno',                                                 mt: null,        mc: null,        lc: null,          jo: '8.48-59'    },
  { id: 136, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus envia setenta e dois mensageiros',                                     mt: null,        mc: null,        lc: '10.1-16',     jo: null         },
  { id: 137, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Os setenta e dois mensageiros retornam',                                     mt: null,        mc: null,        lc: '10.17-24',    jo: null         },
  { id: 138, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola do bom samaritano',                                   mt: null,        mc: null,        lc: '10.25-37',    jo: null         },
  { id: 139, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus visita Marta e Maria',                                                 mt: null,        mc: null,        lc: '10.38-42',    jo: null         },
  { id: 140, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus instrui seus discípulos sobre a oração',                               mt: null,        mc: null,        lc: '11.1-13',     jo: null         },
  { id: 141, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre a luz interior',                                          mt: null,        mc: null,        lc: '11.33-36',    jo: null         },
  { id: 142, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus critica os líderes religiosos',                                        mt: null,        mc: null,        lc: '11.37-54',    jo: null         },
  { id: 143, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus fala contra a hipocrisia',                                             mt: null,        mc: null,        lc: '12.1-12',     jo: null         },
  { id: 144, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola do rico insensato',                                   mt: null,        mc: null,        lc: '12.13-21',    jo: null         },
  { id: 145, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus adverte da preocupação',                                               mt: null,        mc: null,        lc: '12.22-34',    jo: null         },
  { id: 146, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus adverte dos preparativos para sua vinda',                              mt: null,        mc: null,        lc: '12.35-48',    jo: null         },
  { id: 147, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus adverte da divisão vindoura',                                          mt: null,        mc: null,        lc: '12.49-53',    jo: null         },
  { id: 148, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus adverte da crise futura',                                              mt: null,        mc: null,        lc: '12.54-59',    jo: null         },
  { id: 149, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus chama o povo ao arrependimento',                                       mt: null,        mc: null,        lc: '13.1-9',      jo: null         },
  { id: 150, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus cura uma mulher aleijada',                                             mt: null,        mc: null,        lc: '13.10-17',    jo: null         },
  { id: 151, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus cura um cego de nascença',                                             mt: null,        mc: null,        lc: null,          jo: '9.1-12'     },
  { id: 152, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Os líderes religiosos questionam o homem que fora cego',                     mt: null,        mc: null,        lc: null,          jo: '9.13-34'    },
  { id: 153, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre a cegueira espiritual',                                   mt: null,        mc: null,        lc: null,          jo: '9.35-41'    },
  { id: 154, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus é o bom pastor',                                                       mt: null,        mc: null,        lc: null,          jo: '10.1-21'    },
  { id: 155, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Os líderes religiosos cercam Jesus no Templo',                               mt: null,        mc: null,        lc: null,          jo: '10.22-42'   },
  { id: 156, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre a entrada no reino',                                      mt: null,        mc: null,        lc: '13.22-30',    jo: null         },
  { id: 157, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus se entristece por causa de Jerusalém',                                 mt: '23.37-39',  mc: null,        lc: '13.31-35',    jo: null         },
  { id: 158, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus cura um homem com membros inchados',                                   mt: null,        mc: null,        lc: '14.1-6',      jo: null         },
  { id: 159, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre a humildade',                                             mt: null,        mc: null,        lc: '14.7-14',     jo: null         },
  { id: 160, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola do grande banquete',                                  mt: null,        mc: null,        lc: '14.15-24',    jo: null         },
  { id: 161, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre o custo de ser um discípulo',                             mt: null,        mc: null,        lc: '14.25-35',    jo: null         },
  { id: 162, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola da ovelha perdida',                                   mt: null,        mc: null,        lc: '15.1-7',      jo: null         },
  { id: 163, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola da dracma perdida',                                   mt: null,        mc: null,        lc: '15.8-10',     jo: null         },
  { id: 164, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola do filho pródigo',                                    mt: null,        mc: null,        lc: '15.11-32',    jo: null         },
  { id: 165, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola do mordomo astuto',                                   mt: null,        mc: null,        lc: '16.1-18',     jo: null         },
  { id: 166, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus fala sobre o homem rico e o mendigo',                                  mt: null,        mc: null,        lc: '16.19-31',    jo: null         },
  { id: 167, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus fala sobre perdão e fé',                                               mt: null,        mc: null,        lc: '17.1-10',     jo: null         },
  { id: 168, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Lázaro adoece e morre',                                                      mt: null,        mc: null,        lc: null,          jo: '11.1-16'    },
  { id: 169, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus consola Maria e Marta',                                                mt: null,        mc: null,        lc: null,          jo: '11.17-37'   },
  { id: 170, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ressuscita Lázaro',                                                    mt: null,        mc: null,        lc: null,          jo: '11.38-44'   },
  { id: 171, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Os líderes religiosos planejam matar Jesus',                                 mt: null,        mc: null,        lc: null,          jo: '11.45-57'   },
  { id: 172, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus cura dez leprosos',                                                    mt: null,        mc: null,        lc: '17.11-19',    jo: null         },
  { id: 173, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre a vinda do reino de Deus',                                mt: null,        mc: null,        lc: '17.20-37',    jo: null         },
  { id: 174, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola da viúva persistente',                                mt: null,        mc: null,        lc: '18.1-8',      jo: null         },
  { id: 175, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola de dois homens que oravam',                           mt: null,        mc: null,        lc: '18.9-14',     jo: null         },
  { id: 176, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre casamento e divórcio',                                    mt: '19.3-12',   mc: '10.2-12',   lc: null,          jo: null         },
  { id: 177, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus abençoa as criancinhas',                                               mt: '19.13-15',  mc: '10.13-16',  lc: '18.15-17',    jo: null         },
  { id: 178, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus fala ao jovem rico',                                                   mt: '19.16-30',  mc: '10.17-31',  lc: '18.18-30',    jo: null         },
  { id: 179, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola dos trabalhadores da vinha',                          mt: '20.1-16',   mc: null,        lc: null,          jo: null         },
  { id: 180, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus prediz sua morte pela terceira vez',                                   mt: '20.17-19',  mc: '10.32-34',  lc: '18.31-34',    jo: null         },
  { id: 181, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus ensina sobre servir aos outros',                                       mt: '20.20-28',  mc: '10.35-45',  lc: null,          jo: null         },
  { id: 182, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus cura dois mendigos cegos',                                             mt: '20.29-34',  mc: '10.46-52',  lc: '18.35-43',    jo: null         },
  { id: 183, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus traz salvação à casa de Zaqueu',                                       mt: null,        mc: null,        lc: '19.1-10',     jo: null         },
  { id: 184, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Jesus conta a parábola dos dez servos do rei',                               mt: null,        mc: null,        lc: '19.11-27',    jo: null         },
  { id: 185, s: 'B', ss: 'Jesus Dirige-se a Jerusalém', t: 'Uma mulher unge Jesus com perfume',                                          mt: '26.6-13',   mc: '14.3-9',    lc: null,          jo: '12.1-11'    },

  // O Ministério de Jesus em Jerusalém
  { id: 186, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus entra em Jerusalém montado em um jumento',                      mt: '21.1-11',   mc: '11.1-11',   lc: '19.28-40',    jo: '12.12-19'   },
  { id: 187, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus se entristece outra vez por Jerusalém',                         mt: null,        mc: null,        lc: '19.41-44',    jo: null         },
  { id: 188, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus limpa outra vez o Templo',                                      mt: '21.12-17',  mc: '11.15-19',  lc: '19.45-48',    jo: null         },
  { id: 189, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus explica por que deve morrer',                                   mt: null,        mc: null,        lc: null,          jo: '12.20-36'   },
  { id: 190, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Muitas pessoas não creem em Jesus',                                   mt: null,        mc: null,        lc: null,          jo: '12.37-43'   },
  { id: 191, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus resume sua mensagem',                                           mt: null,        mc: null,        lc: null,          jo: '12.44-50'   },
  { id: 192, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus amaldiçoa uma figueira',                                        mt: '21.18-22',  mc: '11.12-26',  lc: null,          jo: null         },
  { id: 193, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Os líderes religiosos desafiam a autoridade de Jesus',                mt: '21.23-27',  mc: '11.27-33',  lc: '20.1-8',      jo: null         },
  { id: 194, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus conta a parábola dos dois filhos',                              mt: '21.28-32',  mc: null,        lc: null,          jo: null         },
  { id: 195, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus conta a parábola dos lavradores perversos',                     mt: '21.33-46',  mc: '12.1-12',   lc: '20.9-19',     jo: null         },
  { id: 196, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus conta a parábola do jantar de casamento',                       mt: '22.1-14',   mc: null,        lc: null,          jo: null         },
  { id: 197, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Os líderes religiosos questionam Jesus acerca do pagamento de impostos', mt: '22.15-22', mc: '12.13-17', lc: '20.20-26',  jo: null         },
  { id: 198, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Os líderes religiosos questionam Jesus acerca da ressurreição',        mt: '22.23-33',  mc: '12.18-27',  lc: '20.27-40',    jo: null         },
  { id: 199, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Os líderes religiosos questionam Jesus acerca do maior mandamento',    mt: '22.34-40',  mc: '12.28-34',  lc: null,          jo: null         },
  { id: 200, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Os líderes religiosos não conseguem responder à pergunta de Jesus',    mt: '22.41-46',  mc: '12.35-37',  lc: '20.41-44',    jo: null         },
  { id: 201, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus adverte contra os líderes religiosos',                          mt: '23.1-12',   mc: '12.38-40',  lc: '20.45-47',    jo: null         },
  { id: 202, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus condena os líderes religiosos',                                 mt: '23.13-36',  mc: null,        lc: null,          jo: null         },
  { id: 203, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Uma viúva pobre oferta tudo o que tem',                               mt: null,        mc: '12.41-44',  lc: '21.1-4',      jo: null         },
  { id: 204, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus ensina sobre estar vigilante quanto a sua volta',               mt: '24.1-51',   mc: '13.1-37',   lc: '21.5-38',     jo: null         },
  { id: 205, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus conta a parábola das dez virgens',                              mt: '25.1-13',   mc: null,        lc: null,          jo: null         },
  { id: 206, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus conta a parábola do dinheiro emprestado',                       mt: '25.14-30',  mc: null,        lc: null,          jo: null         },
  { id: 207, s: 'B', ss: 'O Ministério de Jesus em Jerusalém', t: 'Jesus fala sobre o juízo final',                                      mt: '25.31-46',  mc: null,        lc: null,          jo: null         },

  // ── C. Morte e Ressurreição ────────────────────────────────────────────────
  { id: 208, s: 'C', ss: null, t: 'Os líderes religiosos tramam a morte de Jesus',                                                        mt: '26.1-5',    mc: '14.1-2',    lc: '22.1-2',      jo: null         },
  { id: 209, s: 'C', ss: null, t: 'Judas concorda em trair Jesus',                                                                        mt: '26.14-16',  mc: '14.10-11',  lc: '22.3-6',      jo: null         },
  { id: 210, s: 'C', ss: null, t: 'Os discípulos preparam-se para a Páscoa',                                                              mt: '26.17-19',  mc: '14.12-16',  lc: '22.7-13',     jo: null         },
  { id: 211, s: 'C', ss: null, t: 'Jesus lava os pés dos discípulos',                                                                     mt: null,        mc: null,        lc: null,          jo: '13.1-20'    },
  { id: 212, s: 'C', ss: null, t: 'Jesus e os discípulos participam da última ceia',                                                      mt: '26.20-30',  mc: '14.17-26',  lc: '22.14-30',    jo: '13.21-30'   },
  { id: 213, s: 'C', ss: null, t: 'Jesus prediz a negação de Pedro',                                                                      mt: '26.31-35',  mc: '14.27-31',  lc: '22.31-38',    jo: '13.31-38'   },
  { id: 214, s: 'C', ss: null, t: 'Jesus é o caminho até o Pai',                                                                          mt: null,        mc: null,        lc: null,          jo: '14.1-14'    },
  { id: 215, s: 'C', ss: null, t: 'Jesus promete o Espírito Santo',                                                                       mt: null,        mc: null,        lc: null,          jo: '14.15-31'   },
  { id: 216, s: 'C', ss: null, t: 'Jesus ensina sobre a videira e os ramos',                                                              mt: null,        mc: null,        lc: null,          jo: '15.1-17'    },
  { id: 217, s: 'C', ss: null, t: 'Jesus adverte do ódio do mundo',                                                                       mt: null,        mc: null,        lc: null,          jo: '15.18-16.4' },
  { id: 218, s: 'C', ss: null, t: 'Jesus ensina sobre o Espírito Santo',                                                                  mt: null,        mc: null,        lc: null,          jo: '16.5-15'    },
  { id: 219, s: 'C', ss: null, t: 'Jesus ensina sobre o uso de seu nome em oração',                                                       mt: null,        mc: null,        lc: null,          jo: '16.16-33'   },
  { id: 220, s: 'C', ss: null, t: 'Jesus ora por Ele mesmo',                                                                              mt: null,        mc: null,        lc: null,          jo: '17.1-5'     },
  { id: 221, s: 'C', ss: null, t: 'Jesus ora por seus discípulos',                                                                        mt: null,        mc: null,        lc: null,          jo: '17.6-19'    },
  { id: 222, s: 'C', ss: null, t: 'Jesus ora pelos futuros crentes',                                                                      mt: null,        mc: null,        lc: null,          jo: '17.20-26'   },
  { id: 223, s: 'C', ss: null, t: 'Jesus agoniza no jardim',                                                                              mt: '26.36-46',  mc: '14.32-42',  lc: '22.39-46',    jo: null         },
  { id: 224, s: 'C', ss: null, t: 'Jesus é traído e preso',                                                                               mt: '26.47-56',  mc: '14.43-52',  lc: '22.47-53',    jo: '18.1-11'    },
  { id: 225, s: 'C', ss: null, t: 'Anás interroga Jesus',                                                                                 mt: null,        mc: null,        lc: null,          jo: '18.12-24'   },
  { id: 226, s: 'C', ss: null, t: 'Caifás interroga Jesus',                                                                               mt: '26.57-68',  mc: '14.53-65',  lc: '22.54-65',    jo: null         },
  { id: 227, s: 'C', ss: null, t: 'Pedro nega conhecer Jesus',                                                                            mt: '26.69-75',  mc: '14.66-72',  lc: '22.54-62',    jo: '18.25-27'   },
  { id: 228, s: 'C', ss: null, t: 'O conselho dos líderes religiosos condena Jesus',                                                      mt: '27.1-2',    mc: '15.1',      lc: null,          jo: null         },
  { id: 229, s: 'C', ss: null, t: 'Judas enforca-se',                                                                                     mt: '27.3-10',   mc: null,        lc: null,          jo: null         },
  { id: 230, s: 'C', ss: null, t: 'Jesus é julgado perante Pilatos',                                                                      mt: '27.11-14',  mc: '15.2-5',    lc: '23.1-7',      jo: '18.28-37'   },
  { id: 231, s: 'C', ss: null, t: 'Jesus é julgado perante Herodes',                                                                      mt: null,        mc: null,        lc: '23.8-12',     jo: null         },
  { id: 232, s: 'C', ss: null, t: 'Pilatos entrega Jesus para ser crucificado',                                                           mt: '27.15-26',  mc: '15.6-15',   lc: '23.13-25',    jo: '18.38-19.16'},
  { id: 233, s: 'C', ss: null, t: 'Os soldados romanos zombam de Jesus',                                                                  mt: '27.27-31',  mc: '15.16-20',  lc: null,          jo: null         },
  { id: 234, s: 'C', ss: null, t: 'Jesus é levado para ser crucificado',                                                                  mt: '27.32',     mc: '15.21',     lc: '23.26-31',    jo: null         },
  { id: 235, s: 'C', ss: null, t: 'Jesus é pregado na cruz',                                                                              mt: '27.33-44',  mc: '15.22-32',  lc: '23.32-43',    jo: '19.17-27'   },
  { id: 236, s: 'C', ss: null, t: 'Jesus morre na cruz',                                                                                  mt: '27.45-56',  mc: '15.33-41',  lc: '23.44-49',    jo: '19.28-37'   },
  { id: 237, s: 'C', ss: null, t: 'Jesus é depositado no sepulcro',                                                                       mt: '27.57-61',  mc: '15.42-47',  lc: '23.50-56',    jo: '19.38-42'   },
  { id: 238, s: 'C', ss: null, t: 'Uma guarda é postada no sepulcro',                                                                     mt: '27.62-66',  mc: null,        lc: null,          jo: null         },
  { id: 239, s: 'C', ss: null, t: 'Jesus ressuscita',                                                                                     mt: '28.1-8',    mc: '16.1-8',    lc: '24.1-11',     jo: '20.1-2'     },
  { id: 240, s: 'C', ss: null, t: 'Pedro e João correm até o sepulcro',                                                                   mt: null,        mc: null,        lc: '24.12',       jo: '20.3-10'    },
  { id: 241, s: 'C', ss: null, t: 'Jesus aparece às mulheres',                                                                            mt: '28.9-10',   mc: '16.9-11',   lc: null,          jo: '20.11-18'   },
  { id: 242, s: 'C', ss: null, t: 'Os líderes religiosos subornam os guardas',                                                            mt: '28.11-15',  mc: null,        lc: null,          jo: null         },
  { id: 243, s: 'C', ss: null, t: 'Jesus aparece a dois crentes que viajam pela estrada',                                                 mt: null,        mc: '16.12-13',  lc: '24.13-35',    jo: null         },
  { id: 244, s: 'C', ss: null, t: 'Jesus aparece a seus discípulos',                                                                      mt: null,        mc: '16.14',     lc: '24.36-43',    jo: '20.19-23'   },
  { id: 245, s: 'C', ss: null, t: 'Jesus aparece a Tomé',                                                                                 mt: null,        mc: null,        lc: null,          jo: '20.24-31'   },
  { id: 246, s: 'C', ss: null, t: 'Jesus aparece a sete discípulos',                                                                      mt: null,        mc: null,        lc: null,          jo: '21.1-14'    },
  { id: 247, s: 'C', ss: null, t: 'Jesus desafia Pedro',                                                                                  mt: null,        mc: null,        lc: null,          jo: '21.15-25'   },
  { id: 248, s: 'C', ss: null, t: 'Jesus transmite a grande comissão',                                                                    mt: '28.16-20',  mc: '16.15-18',  lc: null,          jo: null         },
  { id: 249, s: 'C', ss: null, t: 'Jesus aparece aos discípulos em Jerusalém',                                                            mt: null,        mc: null,        lc: '24.44-49',    jo: null         },
  { id: 250, s: 'C', ss: null, t: 'Jesus ascende ao céu',                                                                                 mt: null,        mc: '16.19-20',  lc: '24.50-53',    jo: null         },
];

// ─── Construção do JSON final ─────────────────────────────────────────────────

function construirEvento(raw, indices) {
  const resultado = {
    id:      raw.id,
    ordem:   raw.id,
    secao:   SECOES[raw.s],
    subsecao: raw.ss || null,
    titulo:  raw.t,
    mateus:  null,
    marcos:  null,
    lucas:   null,
    joao:    null,
  };

  const mapa = { mateus: 'mt', marcos: 'mc', lucas: 'lc', joao: 'jo' };

  for (const [evangelho, chave] of Object.entries(mapa)) {
    const refStr = raw[chave];
    if (!refStr) continue;

    const prefixo = PREFIXOS[evangelho];
    const texto   = extrairTexto(refStr, indices[evangelho]);

    resultado[evangelho] = {
      referencia: `${prefixo} ${refStr}`,
      texto: texto,
    };
  }

  return resultado;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📖 Gerando cronologia.json — Evangelhos Cronológicos (ARC)\n');

  // 1. Criar pasta dados/ se não existir
  const dir = path.dirname(OUTPUT);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Criada pasta: ${dir}`);
  }

  // 2. Baixar os 4 Evangelhos
  console.log('⬇ Baixando Evangelhos da ARC (damarals/biblias)…');
  const livros = {};
  for (const [nome, url] of Object.entries(FONTES)) {
    process.stdout.write(`  • ${nome}… `);
    livros[nome] = await baixar(url);
    console.log('✓');
  }

  // 3. Indexar versículos
  console.log('\n🔢 Indexando versículos…');
  const indices = {};
  for (const nome of Object.keys(FONTES)) {
    indices[nome] = indexar(livros[nome]);
  }

  // 4. Processar os 250 eventos
  console.log('\n⚙ Processando 250 eventos…');
  const cronologia = EVENTOS_RAW.map(raw => construirEvento(raw, indices));

  // 5. Salvar
  fs.writeFileSync(OUTPUT, JSON.stringify(cronologia, null, 2), 'utf8');

  // 6. Resumo
  const total  = cronologia.length;
  const comTexto = cronologia.filter(e =>
    ['mateus', 'marcos', 'lucas', 'joao'].some(g => e[g]?.texto)
  ).length;
  const tamanho = (fs.statSync(OUTPUT).size / 1024).toFixed(0);

  console.log('\n✅ Concluído!');
  console.log(`   Eventos: ${total}`);
  console.log(`   Com texto: ${comTexto}`);
  console.log(`   Arquivo: ${OUTPUT}`);
  console.log(`   Tamanho: ~${tamanho} KB`);
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
