#!/usr/bin/env python3
"""
gerar-cronologia.py

Baixa os 4 Evangelhos na versão ARC (Almeida Revista e Corrigida) do
repositório público damarals/biblias e monta dados/cronologia.json com
os 250 eventos cronológicos da vida de Cristo, incluindo texto completo.

Uso:  python scripts/gerar-cronologia.py
Req.: Python >= 3.8  (sem dependências externas — usa apenas stdlib)
"""

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

# ─── Configuração ──────────────────────────────────────────────────────────────

BASE = "https://raw.githubusercontent.com/damarals/biblias/main/data/canonical/ARC"

FONTES = {
    "mateus": f"{BASE}/MAT.json",
    "marcos": f"{BASE}/MRK.json",
    "lucas":  f"{BASE}/LUK.json",
    "joao":   f"{BASE}/JHN.json",
}

PREFIXOS = {"mateus": "Mt", "marcos": "Mc", "lucas": "Lc", "joao": "Jo"}

SECOES = {
    "A": "A. Nascimento e Preparação de Jesus Cristo",
    "B": "B. Mensagem e Ministério de Jesus",
    "C": "C. Morte e Ressurreição de Jesus",
}

OUTPUT = Path(__file__).parent.parent / "dados" / "cronologia.json"


# ─── Rede ──────────────────────────────────────────────────────────────────────

def baixar(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "cronologia-builder/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ─── Índice de versículos ──────────────────────────────────────────────────────

def indexar(livro_json: dict) -> dict:
    """Retorna dict[cap_int][verso_int] = texto."""
    idx = {}
    for cap in livro_json["chapters"]:
        c = cap["number"]
        idx[c] = {}
        for v in cap["verses"]:
            idx[c][v["number"]] = v["text"]
    return idx


# ─── Parser de referências ─────────────────────────────────────────────────────

def norm(ref: str) -> str:
    """Remove sufixos de letra (22.54a → 22.54) e espaços."""
    return re.sub(r"([0-9])([a-zA-Z])\b", r"\1", ref.strip())


def extrair_texto(ref_str: str, idx: dict) -> str:
    """
    Extrai versículos do índice dado uma string de referência.
    Formatos suportados:
      "1.5"           → cap 1, v5
      "1.5-25"        → cap 1, v5-25
      "2.23-3.21"     → cap 2 v23..fim + cap 3 v1-21
      "11.12-14,20-26"→ cap 11 v12-14 e v20-26
    Retorna string com versículos no formato "N texto. N+1 texto…"
    """
    if not ref_str or not idx:
        return ""

    ref = norm(ref_str)

    # Vírgula: múltiplos segmentos no mesmo capítulo
    if "," in ref:
        partes = ref.split(",")
        cap_base = partes[0].split(".")[0]
        segmentos = []
        for p in partes:
            seg = p.strip()
            full = seg if "." in seg else f"{cap_base}.{seg}"
            t = extrair_texto(full, idx)
            if t:
                segmentos.append(t)
        return " ".join(segmentos)

    # Cross-chapter: "X.Y-W.Z"
    m = re.match(r"^(\d+)\.(\d+)-(\d+)\.(\d+)$", ref)
    if m:
        c1, v1, c2, v2 = int(m[1]), int(m[2]), int(m[3]), int(m[4])
        partes = []
        for c in range(c1, c2 + 1):
            if c not in idx:
                continue
            vv = sorted(idx[c].keys())
            ini = v1 if c == c1 else vv[0]
            fim = v2 if c == c2 else vv[-1]
            for v in vv:
                if ini <= v <= fim and idx[c].get(v):
                    partes.append(f"{v} {idx[c][v]}")
        return " ".join(partes)

    # Padrão: "cap.vi[-vf]"
    m = re.match(r"^(\d+)\.(\d+)(?:-(\d+))?$", ref)
    if not m:
        print(f"  ⚠ Referência não reconhecida: '{ref_str}'", file=sys.stderr)
        return ""

    cap = int(m[1])
    vi  = int(m[2])
    vf  = int(m[3]) if m[3] else vi

    if cap not in idx:
        print(f"  ⚠ Capítulo {cap} ausente no índice", file=sys.stderr)
        return ""

    versos = []
    for v in range(vi, vf + 1):
        if idx[cap].get(v):
            versos.append(f"{v} {idx[cap][v]}")
    return " ".join(versos)


# ─── Tabela dos 250 Eventos ───────────────────────────────────────────────────
# s = seção (A/B/C), ss = subseção (str|None), t = título
# mt/mc/lc/jo = referência ARC (str|None)

EVENTOS_RAW = [
    # ── A. Nascimento e Preparação ────────────────────────────────────────────
    {"id": 1,   "s": "A", "ss": None, "t": "A natureza dos Evangelhos",                              "mt": None,        "mc": "1.1",       "lc": "1.1-4",       "jo": None},
    {"id": 2,   "s": "A", "ss": None, "t": "Deus fez-se homem",                                      "mt": None,        "mc": None,        "lc": None,          "jo": "1.1-18"},
    {"id": 3,   "s": "A", "ss": None, "t": "Um anjo promete a Zacarias o nascimento de João",         "mt": None,        "mc": None,        "lc": "1.5-25",      "jo": None},
    {"id": 4,   "s": "A", "ss": None, "t": "Um anjo promete a Maria o nascimento de Jesus",           "mt": None,        "mc": None,        "lc": "1.26-38",     "jo": None},
    {"id": 5,   "s": "A", "ss": None, "t": "Maria visita Isabel",                                     "mt": None,        "mc": None,        "lc": "1.39-45",     "jo": None},
    {"id": 6,   "s": "A", "ss": None, "t": "O Magnificat: cântico de louvor de Maria",                "mt": None,        "mc": None,        "lc": "1.46-56",     "jo": None},
    {"id": 7,   "s": "A", "ss": None, "t": "Nasce João Batista",                                      "mt": None,        "mc": None,        "lc": "1.57-66",     "jo": None},
    {"id": 8,   "s": "A", "ss": None, "t": "A profecia de Zacarias",                                  "mt": None,        "mc": None,        "lc": "1.67-80",     "jo": None},
    {"id": 9,   "s": "A", "ss": None, "t": "Um anjo aparece a José",                                  "mt": "1.18-25",   "mc": None,        "lc": None,          "jo": None},
    {"id": 10,  "s": "A", "ss": None, "t": "O registro dos antepassados de Jesus",                    "mt": "1.1-17",    "mc": None,        "lc": "3.23-38",     "jo": None},
    {"id": 11,  "s": "A", "ss": None, "t": "Nasce Jesus em Belém",                                    "mt": None,        "mc": None,        "lc": "2.1-7",       "jo": None},
    {"id": 12,  "s": "A", "ss": None, "t": "Pastores visitam Jesus",                                  "mt": None,        "mc": None,        "lc": "2.8-20",      "jo": None},
    {"id": 13,  "s": "A", "ss": None, "t": "Maria e José levam Jesus ao Templo",                      "mt": None,        "mc": None,        "lc": "2.21-24",     "jo": None},
    {"id": 14,  "s": "A", "ss": None, "t": "A profecia de Simeão",                                    "mt": None,        "mc": None,        "lc": "2.25-35",     "jo": None},
    {"id": 15,  "s": "A", "ss": None, "t": "A profecia de Ana",                                       "mt": None,        "mc": None,        "lc": "2.36-38",     "jo": None},
    {"id": 16,  "s": "A", "ss": None, "t": "Visitantes chegam do Oriente",                            "mt": "2.1-12",    "mc": None,        "lc": None,          "jo": None},
    {"id": 17,  "s": "A", "ss": None, "t": "A fuga para o Egito",                                     "mt": "2.13-18",   "mc": None,        "lc": None,          "jo": None},
    {"id": 18,  "s": "A", "ss": None, "t": "O retorno do Egito",                                      "mt": "2.19-22",   "mc": None,        "lc": None,          "jo": None},
    {"id": 19,  "s": "A", "ss": None, "t": "Infância de Jesus em Nazaré",                             "mt": "2.23",      "mc": None,        "lc": "2.39-40",     "jo": None},
    {"id": 20,  "s": "A", "ss": None, "t": "Jesus fala com os mestres religiosos",                    "mt": None,        "mc": None,        "lc": "2.41-52",     "jo": None},
    {"id": 21,  "s": "A", "ss": None, "t": "João Batista prepara o caminho para Jesus",               "mt": "3.1-12",    "mc": "1.2-8",     "lc": "3.1-18",      "jo": "1.19-28"},
    {"id": 22,  "s": "A", "ss": None, "t": "O batismo de Jesus",                                      "mt": "3.13-17",   "mc": "1.9-11",    "lc": "3.21-22",     "jo": None},
    {"id": 23,  "s": "A", "ss": None, "t": "Satanás tenta Jesus no deserto",                          "mt": "4.1-11",    "mc": "1.12-13",   "lc": "4.1-13",      "jo": None},
    {"id": 24,  "s": "A", "ss": None, "t": "João Batista proclama Jesus como o Messias",              "mt": None,        "mc": None,        "lc": None,          "jo": "1.29-34"},
    {"id": 25,  "s": "A", "ss": None, "t": "Os primeiros discípulos seguem Jesus",                    "mt": None,        "mc": None,        "lc": None,          "jo": "1.35-51"},
    {"id": 26,  "s": "A", "ss": None, "t": "Jesus transforma água em vinho",                          "mt": None,        "mc": None,        "lc": None,          "jo": "2.1-12"},

    # ── B. Mensagem e Ministério ───────────────────────────────────────────────
    # Jesus Inicia seu Ministério em Jerusalém
    {"id": 27,  "s": "B", "ss": "Jesus Inicia seu Ministério em Jerusalém",  "t": "Jesus limpa o Templo",                                      "mt": None,        "mc": None,        "lc": None,          "jo": "2.13-22"},
    {"id": 28,  "s": "B", "ss": "Jesus Inicia seu Ministério em Jerusalém",  "t": "Nicodemos visita Jesus à noite",                             "mt": None,        "mc": None,        "lc": None,          "jo": "2.23-3.21"},
    {"id": 29,  "s": "B", "ss": "Jesus Inicia seu Ministério em Jerusalém",  "t": "João Batista fala mais sobre Jesus",                         "mt": None,        "mc": None,        "lc": None,          "jo": "3.22-36"},
    {"id": 30,  "s": "B", "ss": "Jesus Inicia seu Ministério em Jerusalém",  "t": "Herodes coloca João na prisão",                              "mt": None,        "mc": None,        "lc": "3.19-20",     "jo": None},
    {"id": 31,  "s": "B", "ss": "Jesus Inicia seu Ministério em Jerusalém",  "t": "Jesus deixa a Judeia",                                       "mt": "4.12",      "mc": "1.14",      "lc": None,          "jo": "4.1-3"},

    # Jesus Ministra em Samaria
    {"id": 32,  "s": "B", "ss": "Jesus Ministra em Samaria",  "t": "Jesus conversa com uma mulher junto ao poço",                               "mt": None,        "mc": None,        "lc": None,          "jo": "4.4-26"},
    {"id": 33,  "s": "B", "ss": "Jesus Ministra em Samaria",  "t": "Jesus fala sobre a colheita espiritual",                                    "mt": None,        "mc": None,        "lc": None,          "jo": "4.27-38"},
    {"id": 34,  "s": "B", "ss": "Jesus Ministra em Samaria",  "t": "Muitos samaritanos creem em Jesus",                                         "mt": None,        "mc": None,        "lc": None,          "jo": "4.39-42"},

    # Jesus Ministra na Galileia
    {"id": 35,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus prega na Galileia",                                                   "mt": "4.13-17",   "mc": "1.15",      "lc": "4.14-15",     "jo": "4.43-45"},
    {"id": 36,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus cura o filho de um oficial do governo",                               "mt": None,        "mc": None,        "lc": None,          "jo": "4.46-54"},
    {"id": 37,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Alguns pescadores seguem Jesus",                                            "mt": "4.18-22",   "mc": "1.16-20",   "lc": "5.1-11",      "jo": None},
    {"id": 38,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus ensina com autoridade",                                               "mt": None,        "mc": "1.21-28",   "lc": "4.31-37",     "jo": None},
    {"id": 39,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus cura a sogra de Pedro e muitos outros",                               "mt": "8.14-17",   "mc": "1.29-34",   "lc": "4.38-41",     "jo": None},
    {"id": 40,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus prega por toda a Galileia",                                           "mt": "4.23-25",   "mc": "1.35-39",   "lc": "4.42-44",     "jo": None},
    {"id": 41,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus cura um leproso",                                                     "mt": "8.1-4",     "mc": "1.40-45",   "lc": "5.12-16",     "jo": None},
    {"id": 42,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus cura um paralítico",                                                  "mt": "9.1-8",     "mc": "2.1-12",    "lc": "5.17-26",     "jo": None},
    {"id": 43,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus come com pecadores na casa de Mateus",                                "mt": "9.9-13",    "mc": "2.13-17",   "lc": "5.27-32",     "jo": None},
    {"id": 44,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Os líderes religiosos perguntam a Jesus sobre o jejum",                     "mt": "9.14-17",   "mc": "2.18-22",   "lc": "5.33-39",     "jo": None},
    {"id": 45,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus cura o paralítico de Betesda",                                        "mt": None,        "mc": None,        "lc": None,          "jo": "5.1-15"},
    {"id": 46,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus afirma ser o Filho de Deus",                                          "mt": None,        "mc": None,        "lc": None,          "jo": "5.16-30"},
    {"id": 47,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus reforça sua reivindicação",                                           "mt": None,        "mc": None,        "lc": None,          "jo": "5.31-47"},
    {"id": 48,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Os discípulos colhem espigas no sábado",                                    "mt": "12.1-8",    "mc": "2.23-28",   "lc": "6.1-5",       "jo": None},
    {"id": 49,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus cura a mão de um homem no sábado",                                   "mt": "12.9-14",   "mc": "3.1-6",     "lc": "6.6-11",      "jo": None},
    {"id": 50,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Grandes multidões seguem Jesus",                                            "mt": "12.15-21",  "mc": "3.7-12",    "lc": "6.17-19",     "jo": None},
    {"id": 51,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus escolhe os doze discípulos",                                          "mt": None,        "mc": "3.13-19",   "lc": "6.12-16",     "jo": None},
    {"id": 52,  "s": "B", "ss": "Jesus Ministra na Galileia", "t": "Jesus profere as bem-aventuranças",                                         "mt": "5.1-12",    "mc": None,        "lc": "6.20-26",     "jo": None},
    {"id": 53,  "s": "B", "ss": None, "t": "Jesus ensina sobre o sal e a luz",                                                                  "mt": "5.13-16",   "mc": None,        "lc": None,          "jo": None},
    {"id": 54,  "s": "B", "ss": None, "t": "Jesus ensina sobre a lei",                                                                          "mt": "5.17-20",   "mc": None,        "lc": None,          "jo": None},
    {"id": 55,  "s": "B", "ss": None, "t": "Jesus ensina sobre a ira",                                                                          "mt": "5.21-26",   "mc": None,        "lc": None,          "jo": None},
    {"id": 56,  "s": "B", "ss": None, "t": "Jesus ensina sobre a luxúria",                                                                      "mt": "5.27-30",   "mc": None,        "lc": None,          "jo": None},
    {"id": 57,  "s": "B", "ss": None, "t": "Jesus ensina sobre o divórcio",                                                                     "mt": "5.31-32",   "mc": None,        "lc": None,          "jo": None},
    {"id": 58,  "s": "B", "ss": None, "t": "Jesus ensina sobre votos",                                                                          "mt": "5.33-37",   "mc": None,        "lc": None,          "jo": None},
    {"id": 59,  "s": "B", "ss": None, "t": "Jesus ensina sobre a vingança",                                                                     "mt": "5.38-42",   "mc": None,        "lc": None,          "jo": None},
    {"id": 60,  "s": "B", "ss": None, "t": "Jesus ensina sobre amar os inimigos",                                                               "mt": "5.43-48",   "mc": None,        "lc": "6.27-36",     "jo": None},
    {"id": 61,  "s": "B", "ss": None, "t": "Jesus ensina sobre dar aos necessitados",                                                           "mt": "6.1-4",     "mc": None,        "lc": None,          "jo": None},
    {"id": 62,  "s": "B", "ss": None, "t": "Jesus ensina sobre a oração",                                                                       "mt": "6.5-15",    "mc": None,        "lc": None,          "jo": None},
    {"id": 63,  "s": "B", "ss": None, "t": "Jesus ensina sobre o jejum",                                                                        "mt": "6.16-18",   "mc": None,        "lc": None,          "jo": None},
    {"id": 64,  "s": "B", "ss": None, "t": "Jesus ensina sobre o dinheiro",                                                                     "mt": "6.19-24",   "mc": None,        "lc": None,          "jo": None},
    {"id": 65,  "s": "B", "ss": None, "t": "Jesus ensina sobre a preocupação",                                                                  "mt": "6.25-34",   "mc": None,        "lc": None,          "jo": None},
    {"id": 66,  "s": "B", "ss": None, "t": "Jesus ensina sobre a atitude de julgar os outros",                                                  "mt": "7.1-6",     "mc": None,        "lc": "6.37-42",     "jo": None},
    {"id": 67,  "s": "B", "ss": None, "t": "Jesus ensina sobre pedir, buscar, bater",                                                           "mt": "7.7-11",    "mc": None,        "lc": None,          "jo": None},
    {"id": 68,  "s": "B", "ss": None, "t": "A regra áurea",                                                                                     "mt": "7.12",      "mc": None,        "lc": None,          "jo": None},
    {"id": 69,  "s": "B", "ss": None, "t": "Jesus ensina sobre o caminho para o céu",                                                           "mt": "7.13-14",   "mc": None,        "lc": None,          "jo": None},
    {"id": 70,  "s": "B", "ss": None, "t": "Jesus ensina sobre o fruto na vida das pessoas",                                                    "mt": "7.15-29",   "mc": None,        "lc": "6.43-49",     "jo": None},
    {"id": 71,  "s": "B", "ss": None, "t": "Um oficial romano demonstra fé",                                                                    "mt": "8.5-13",    "mc": None,        "lc": "7.1-10",      "jo": None},
    {"id": 72,  "s": "B", "ss": None, "t": "Jesus ressuscita o filho de uma viúva",                                                             "mt": None,        "mc": None,        "lc": "7.11-17",     "jo": None},
    {"id": 73,  "s": "B", "ss": None, "t": "Jesus sana a dúvida de João",                                                                       "mt": "11.1-19",   "mc": None,        "lc": "7.18-35",     "jo": None},
    {"id": 74,  "s": "B", "ss": None, "t": "Jesus promete repouso para a alma",                                                                 "mt": "11.20-30",  "mc": None,        "lc": None,          "jo": None},
    {"id": 75,  "s": "B", "ss": None, "t": "Uma mulher pecadora unge os pés de Jesus",                                                          "mt": None,        "mc": None,        "lc": "7.36-50",     "jo": None},
    {"id": 76,  "s": "B", "ss": None, "t": "Mulheres acompanham Jesus e os discípulos",                                                         "mt": None,        "mc": None,        "lc": "8.1-3",       "jo": None},
    {"id": 77,  "s": "B", "ss": None, "t": "Os líderes religiosos acusam Jesus de obter seu poder de Satanás",                                  "mt": "12.22-37",  "mc": "3.20-30",   "lc": "11.14-23",    "jo": None},
    {"id": 78,  "s": "B", "ss": None, "t": "Os líderes religiosos pedem a Jesus um sinal miraculoso",                                           "mt": "12.38-45",  "mc": None,        "lc": "11.24-32",    "jo": None},
    {"id": 79,  "s": "B", "ss": None, "t": "Jesus descreve sua verdadeira família",                                                             "mt": "12.46-50",  "mc": "3.31-35",   "lc": "8.19-21",     "jo": None},
    {"id": 80,  "s": "B", "ss": None, "t": "A parábola dos quatro tipos de solo",                                                               "mt": "13.1-23",   "mc": "4.1-20",    "lc": "8.4-15",      "jo": None},
    {"id": 81,  "s": "B", "ss": None, "t": "Jesus conta a parábola da candeia",                                                                 "mt": None,        "mc": "4.21-25",   "lc": "8.16-18",     "jo": None},
    {"id": 82,  "s": "B", "ss": None, "t": "Jesus conta a parábola da semente",                                                                 "mt": None,        "mc": "4.26-29",   "lc": None,          "jo": None},
    {"id": 83,  "s": "B", "ss": None, "t": "Jesus conta a parábola do joio",                                                                    "mt": "13.24-30",  "mc": None,        "lc": None,          "jo": None},
    {"id": 84,  "s": "B", "ss": None, "t": "Jesus conta as parábolas do grão de mostarda e do fermento",                                        "mt": "13.31-33",  "mc": "4.30-32",   "lc": "13.18-21",    "jo": None},
    {"id": 85,  "s": "B", "ss": None, "t": "Por que Jesus ensinava usando parábolas",                                                           "mt": "13.34-35",  "mc": "4.33-34",   "lc": None,          "jo": None},
    {"id": 86,  "s": "B", "ss": None, "t": "Jesus explica a parábola do joio",                                                                  "mt": "13.36-43",  "mc": None,        "lc": None,          "jo": None},
    {"id": 87,  "s": "B", "ss": None, "t": "Jesus conta a parábola do tesouro escondido",                                                       "mt": "13.44",     "mc": None,        "lc": None,          "jo": None},
    {"id": 88,  "s": "B", "ss": None, "t": "Jesus conta a parábola do negociante de pérolas",                                                   "mt": "13.45-46",  "mc": None,        "lc": None,          "jo": None},
    {"id": 89,  "s": "B", "ss": None, "t": "Jesus conta a parábola da rede de pesca",                                                           "mt": "13.47-52",  "mc": None,        "lc": None,          "jo": None},
    {"id": 90,  "s": "B", "ss": None, "t": "Jesus aplaca uma tempestade",                                                                       "mt": "8.23-27",   "mc": "4.35-41",   "lc": "8.22-25",     "jo": None},
    {"id": 91,  "s": "B", "ss": None, "t": "Jesus expulsa demônios e deixa que entrem em uma manada de porcos",                                 "mt": "8.28-34",   "mc": "5.1-20",    "lc": "8.26-39",     "jo": None},
    {"id": 92,  "s": "B", "ss": None, "t": "Jesus cura uma mulher com hemorragia e ressuscita uma menina",                                      "mt": "9.18-26",   "mc": "5.21-43",   "lc": "8.40-56",     "jo": None},
    {"id": 93,  "s": "B", "ss": None, "t": "Jesus cura cegos e um mudo",                                                                        "mt": "9.27-34",   "mc": None,        "lc": None,          "jo": None},
    {"id": 94,  "s": "B", "ss": None, "t": "Jesus é rejeitado em Nazaré",                                                                       "mt": "13.53-58",  "mc": "6.1-6",     "lc": "4.16-30",     "jo": None},
    {"id": 95,  "s": "B", "ss": None, "t": "Jesus insta com os discípulos para orar por mais obreiros",                                         "mt": "9.35-38",   "mc": None,        "lc": None,          "jo": None},
    {"id": 96,  "s": "B", "ss": None, "t": "Jesus envia os doze discípulos",                                                                    "mt": "10.1-15",   "mc": "6.6-13",    "lc": "9.1-6",       "jo": None},
    {"id": 97,  "s": "B", "ss": None, "t": "Jesus prepara os discípulos para a perseguição",                                                    "mt": "10.16-42",  "mc": None,        "lc": None,          "jo": None},
    {"id": 98,  "s": "B", "ss": None, "t": "Herodes mata João Batista",                                                                         "mt": "14.3-12",   "mc": "6.17-29",   "lc": None,          "jo": None},
    {"id": 99,  "s": "B", "ss": None, "t": "Herodes pensa que Jesus é João Batista ressuscitado dos mortos",                                    "mt": "14.1-2",    "mc": "6.14-16",   "lc": "9.7-9",       "jo": None},
    {"id": 100, "s": "B", "ss": None, "t": "Jesus alimenta cinco mil pessoas",                                                                  "mt": "14.13-21",  "mc": "6.30-44",   "lc": "9.10-17",     "jo": "6.1-15"},
    {"id": 101, "s": "B", "ss": None, "t": "Jesus anda sobre as águas",                                                                         "mt": "14.22-33",  "mc": "6.45-52",   "lc": None,          "jo": "6.16-21"},
    {"id": 102, "s": "B", "ss": None, "t": "Jesus cura todos aqueles que o tocam",                                                              "mt": "14.34-36",  "mc": "6.53-56",   "lc": None,          "jo": None},
    {"id": 103, "s": "B", "ss": None, "t": "Jesus é o verdadeiro pão que veio do céu",                                                         "mt": None,        "mc": None,        "lc": None,          "jo": "6.22-40"},
    {"id": 104, "s": "B", "ss": None, "t": "Alguns discordam de que Jesus veio do céu",                                                         "mt": None,        "mc": None,        "lc": None,          "jo": "6.41-59"},
    {"id": 105, "s": "B", "ss": None, "t": "Muitos discípulos abandonam Jesus",                                                                 "mt": None,        "mc": None,        "lc": None,          "jo": "6.60-71"},
    {"id": 106, "s": "B", "ss": None, "t": "Jesus ensina sobre a pureza interior",                                                              "mt": "15.1-20",   "mc": "7.1-23",    "lc": None,          "jo": None},

    # O Ministério de Jesus além da Galileia
    {"id": 107, "s": "B", "ss": "O Ministério de Jesus além da Galileia", "t": "Jesus expulsa um demônio de uma jovem",                         "mt": "15.21-28",  "mc": "7.24-30",   "lc": None,          "jo": None},
    {"id": 108, "s": "B", "ss": "O Ministério de Jesus além da Galileia", "t": "Jesus cura muitas pessoas",                                     "mt": "15.29-31",  "mc": "7.31-37",   "lc": None,          "jo": None},
    {"id": 109, "s": "B", "ss": "O Ministério de Jesus além da Galileia", "t": "Jesus alimenta quatro mil pessoas",                             "mt": "15.32-39",  "mc": "8.1-10",    "lc": None,          "jo": None},

    # Jesus Retoma seu Ministério na Galileia
    {"id": 110, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Os líderes exigem um sinal miraculoso",                        "mt": "16.1-4",    "mc": "8.11-13",   "lc": None,          "jo": None},
    {"id": 111, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Jesus adverte contra o ensino errôneo",                        "mt": "16.5-12",   "mc": "8.14-21",   "lc": None,          "jo": None},
    {"id": 112, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Jesus restaura a visão para um homem cego",                    "mt": None,        "mc": "8.22-26",   "lc": None,          "jo": None},
    {"id": 113, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Pedro diz que Jesus é o Messias",                              "mt": "16.13-20",  "mc": "8.27-30",   "lc": "9.18-21",     "jo": None},
    {"id": 114, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Jesus prediz sua morte pela primeira vez",                     "mt": "16.21-28",  "mc": "8.31-9.1",  "lc": "9.22-27",     "jo": None},
    {"id": 115, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Jesus transfigura-se no monte",                                "mt": "17.1-13",   "mc": "9.2-13",    "lc": "9.28-36",     "jo": None},
    {"id": 116, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Jesus cura um menino endemoninhado",                           "mt": "17.14-21",  "mc": "9.14-29",   "lc": "9.37-43",     "jo": None},
    {"id": 117, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Jesus prediz sua morte pela segunda vez",                      "mt": "17.22-23",  "mc": "9.30-32",   "lc": "9.43-45",     "jo": None},
    {"id": 118, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Pedro encontra a moeda na boca do peixe",                      "mt": "17.24-27",  "mc": None,        "lc": None,          "jo": None},
    {"id": 119, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Os discípulos discutem sobre quem seria o maior",              "mt": "18.1-5",    "mc": "9.33-37",   "lc": "9.46-48",     "jo": None},
    {"id": 120, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Os discípulos proíbem um homem de usar o nome de Jesus",       "mt": None,        "mc": "9.38-41",   "lc": "9.49-50",     "jo": None},
    {"id": 121, "s": "B", "ss": "Jesus Retoma seu Ministério na Galileia", "t": "Jesus adverte contra a tentação",                              "mt": "18.6-11",   "mc": "9.42-50",   "lc": None,          "jo": None},
    {"id": 122, "s": "B", "ss": None, "t": "Jesus conta a parábola da ovelha perdida",                                                          "mt": "18.12-14",  "mc": None,        "lc": None,          "jo": None},
    {"id": 123, "s": "B", "ss": None, "t": "Jesus ensina como lidar com um crente que peca",                                                    "mt": "18.15-20",  "mc": None,        "lc": None,          "jo": None},
    {"id": 124, "s": "B", "ss": None, "t": "Jesus conta a parábola do devedor inclemente",                                                      "mt": "18.21-35",  "mc": None,        "lc": None,          "jo": None},
    {"id": 125, "s": "B", "ss": None, "t": "Os irmãos de Jesus o ridicularizam",                                                                "mt": None,        "mc": None,        "lc": None,          "jo": "7.1-9"},

    # Jesus Dirige-se a Jerusalém
    {"id": 126, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus viaja para a Judeia",                                                "mt": "19.1-2",    "mc": "10.1",      "lc": "9.51",        "jo": None},
    {"id": 127, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus passa por Samaria",                                                  "mt": None,        "mc": None,        "lc": "9.52-56",     "jo": None},
    {"id": 128, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre o preço de segui-lo",                                   "mt": "8.18-22",   "mc": None,        "lc": "9.57-62",     "jo": None},
    {"id": 129, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina abertamente no Templo",                                       "mt": None,        "mc": None,        "lc": None,          "jo": "7.10-31"},
    {"id": 130, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Os líderes religiosos tentam prender Jesus",                               "mt": None,        "mc": None,        "lc": None,          "jo": "7.32-53"},
    {"id": 131, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus perdoa uma mulher adúltera",                                         "mt": None,        "mc": None,        "lc": None,          "jo": "8.1-11"},
    {"id": 132, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus é a luz do mundo",                                                   "mt": None,        "mc": None,        "lc": None,          "jo": "8.12-20"},
    {"id": 133, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus adverte do juízo vindouro",                                          "mt": None,        "mc": None,        "lc": None,          "jo": "8.21-30"},
    {"id": 134, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus fala sobre os verdadeiros filhos de Deus",                           "mt": None,        "mc": None,        "lc": None,          "jo": "8.31-47"},
    {"id": 135, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus declara que é eterno",                                               "mt": None,        "mc": None,        "lc": None,          "jo": "8.48-59"},
    {"id": 136, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus envia setenta e dois mensageiros",                                   "mt": None,        "mc": None,        "lc": "10.1-16",     "jo": None},
    {"id": 137, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Os setenta e dois mensageiros retornam",                                   "mt": None,        "mc": None,        "lc": "10.17-24",    "jo": None},
    {"id": 138, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola do bom samaritano",                                 "mt": None,        "mc": None,        "lc": "10.25-37",    "jo": None},
    {"id": 139, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus visita Marta e Maria",                                               "mt": None,        "mc": None,        "lc": "10.38-42",    "jo": None},
    {"id": 140, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus instrui seus discípulos sobre a oração",                             "mt": None,        "mc": None,        "lc": "11.1-13",     "jo": None},
    {"id": 141, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre a luz interior",                                        "mt": None,        "mc": None,        "lc": "11.33-36",    "jo": None},
    {"id": 142, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus critica os líderes religiosos",                                      "mt": None,        "mc": None,        "lc": "11.37-54",    "jo": None},
    {"id": 143, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus fala contra a hipocrisia",                                           "mt": None,        "mc": None,        "lc": "12.1-12",     "jo": None},
    {"id": 144, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola do rico insensato",                                 "mt": None,        "mc": None,        "lc": "12.13-21",    "jo": None},
    {"id": 145, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus adverte da preocupação",                                             "mt": None,        "mc": None,        "lc": "12.22-34",    "jo": None},
    {"id": 146, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus adverte dos preparativos para sua vinda",                            "mt": None,        "mc": None,        "lc": "12.35-48",    "jo": None},
    {"id": 147, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus adverte da divisão vindoura",                                        "mt": None,        "mc": None,        "lc": "12.49-53",    "jo": None},
    {"id": 148, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus adverte da crise futura",                                            "mt": None,        "mc": None,        "lc": "12.54-59",    "jo": None},
    {"id": 149, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus chama o povo ao arrependimento",                                     "mt": None,        "mc": None,        "lc": "13.1-9",      "jo": None},
    {"id": 150, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus cura uma mulher aleijada",                                           "mt": None,        "mc": None,        "lc": "13.10-17",    "jo": None},
    {"id": 151, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus cura um cego de nascença",                                           "mt": None,        "mc": None,        "lc": None,          "jo": "9.1-12"},
    {"id": 152, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Os líderes religiosos questionam o homem que fora cego",                   "mt": None,        "mc": None,        "lc": None,          "jo": "9.13-34"},
    {"id": 153, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre a cegueira espiritual",                                 "mt": None,        "mc": None,        "lc": None,          "jo": "9.35-41"},
    {"id": 154, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus é o bom pastor",                                                     "mt": None,        "mc": None,        "lc": None,          "jo": "10.1-21"},
    {"id": 155, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Os líderes religiosos cercam Jesus no Templo",                             "mt": None,        "mc": None,        "lc": None,          "jo": "10.22-42"},
    {"id": 156, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre a entrada no reino",                                    "mt": None,        "mc": None,        "lc": "13.22-30",    "jo": None},
    {"id": 157, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus se entristece por causa de Jerusalém",                               "mt": "23.37-39",  "mc": None,        "lc": "13.31-35",    "jo": None},
    {"id": 158, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus cura um homem com membros inchados",                                 "mt": None,        "mc": None,        "lc": "14.1-6",      "jo": None},
    {"id": 159, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre a humildade",                                           "mt": None,        "mc": None,        "lc": "14.7-14",     "jo": None},
    {"id": 160, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola do grande banquete",                                "mt": None,        "mc": None,        "lc": "14.15-24",    "jo": None},
    {"id": 161, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre o custo de ser um discípulo",                           "mt": None,        "mc": None,        "lc": "14.25-35",    "jo": None},
    {"id": 162, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola da ovelha perdida",                                 "mt": None,        "mc": None,        "lc": "15.1-7",      "jo": None},
    {"id": 163, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola da dracma perdida",                                 "mt": None,        "mc": None,        "lc": "15.8-10",     "jo": None},
    {"id": 164, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola do filho pródigo",                                  "mt": None,        "mc": None,        "lc": "15.11-32",    "jo": None},
    {"id": 165, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola do mordomo astuto",                                 "mt": None,        "mc": None,        "lc": "16.1-18",     "jo": None},
    {"id": 166, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus fala sobre o homem rico e o mendigo",                                "mt": None,        "mc": None,        "lc": "16.19-31",    "jo": None},
    {"id": 167, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus fala sobre perdão e fé",                                             "mt": None,        "mc": None,        "lc": "17.1-10",     "jo": None},
    {"id": 168, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Lázaro adoece e morre",                                                    "mt": None,        "mc": None,        "lc": None,          "jo": "11.1-16"},
    {"id": 169, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus consola Maria e Marta",                                              "mt": None,        "mc": None,        "lc": None,          "jo": "11.17-37"},
    {"id": 170, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ressuscita Lázaro",                                                  "mt": None,        "mc": None,        "lc": None,          "jo": "11.38-44"},
    {"id": 171, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Os líderes religiosos planejam matar Jesus",                               "mt": None,        "mc": None,        "lc": None,          "jo": "11.45-57"},
    {"id": 172, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus cura dez leprosos",                                                  "mt": None,        "mc": None,        "lc": "17.11-19",    "jo": None},
    {"id": 173, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre a vinda do reino de Deus",                              "mt": None,        "mc": None,        "lc": "17.20-37",    "jo": None},
    {"id": 174, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola da viúva persistente",                              "mt": None,        "mc": None,        "lc": "18.1-8",      "jo": None},
    {"id": 175, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola de dois homens que oravam",                         "mt": None,        "mc": None,        "lc": "18.9-14",     "jo": None},
    {"id": 176, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre casamento e divórcio",                                  "mt": "19.3-12",   "mc": "10.2-12",   "lc": None,          "jo": None},
    {"id": 177, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus abençoa as criancinhas",                                             "mt": "19.13-15",  "mc": "10.13-16",  "lc": "18.15-17",    "jo": None},
    {"id": 178, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus fala ao jovem rico",                                                 "mt": "19.16-30",  "mc": "10.17-31",  "lc": "18.18-30",    "jo": None},
    {"id": 179, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola dos trabalhadores da vinha",                        "mt": "20.1-16",   "mc": None,        "lc": None,          "jo": None},
    {"id": 180, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus prediz sua morte pela terceira vez",                                 "mt": "20.17-19",  "mc": "10.32-34",  "lc": "18.31-34",    "jo": None},
    {"id": 181, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus ensina sobre servir aos outros",                                     "mt": "20.20-28",  "mc": "10.35-45",  "lc": None,          "jo": None},
    {"id": 182, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus cura dois mendigos cegos",                                           "mt": "20.29-34",  "mc": "10.46-52",  "lc": "18.35-43",    "jo": None},
    {"id": 183, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus traz salvação à casa de Zaqueu",                                     "mt": None,        "mc": None,        "lc": "19.1-10",     "jo": None},
    {"id": 184, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Jesus conta a parábola dos dez servos do rei",                             "mt": None,        "mc": None,        "lc": "19.11-27",    "jo": None},
    {"id": 185, "s": "B", "ss": "Jesus Dirige-se a Jerusalém", "t": "Uma mulher unge Jesus com perfume",                                        "mt": "26.6-13",   "mc": "14.3-9",    "lc": None,          "jo": "12.1-11"},

    # O Ministério de Jesus em Jerusalém
    {"id": 186, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus entra em Jerusalém montado em um jumento",                    "mt": "21.1-11",   "mc": "11.1-11",   "lc": "19.28-40",    "jo": "12.12-19"},
    {"id": 187, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus se entristece outra vez por Jerusalém",                       "mt": None,        "mc": None,        "lc": "19.41-44",    "jo": None},
    {"id": 188, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus limpa outra vez o Templo",                                    "mt": "21.12-17",  "mc": "11.15-19",  "lc": "19.45-48",    "jo": None},
    {"id": 189, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus explica por que deve morrer",                                 "mt": None,        "mc": None,        "lc": None,          "jo": "12.20-36"},
    {"id": 190, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Muitas pessoas não creem em Jesus",                                 "mt": None,        "mc": None,        "lc": None,          "jo": "12.37-43"},
    {"id": 191, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus resume sua mensagem",                                         "mt": None,        "mc": None,        "lc": None,          "jo": "12.44-50"},
    {"id": 192, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus amaldiçoa uma figueira",                                      "mt": "21.18-22",  "mc": "11.12-26",  "lc": None,          "jo": None},
    {"id": 193, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Os líderes religiosos desafiam a autoridade de Jesus",              "mt": "21.23-27",  "mc": "11.27-33",  "lc": "20.1-8",      "jo": None},
    {"id": 194, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus conta a parábola dos dois filhos",                            "mt": "21.28-32",  "mc": None,        "lc": None,          "jo": None},
    {"id": 195, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus conta a parábola dos lavradores perversos",                   "mt": "21.33-46",  "mc": "12.1-12",   "lc": "20.9-19",     "jo": None},
    {"id": 196, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus conta a parábola do jantar de casamento",                     "mt": "22.1-14",   "mc": None,        "lc": None,          "jo": None},
    {"id": 197, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Os líderes religiosos questionam Jesus acerca do pagamento de impostos", "mt": "22.15-22", "mc": "12.13-17", "lc": "20.20-26", "jo": None},
    {"id": 198, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Os líderes religiosos questionam Jesus acerca da ressurreição",      "mt": "22.23-33",  "mc": "12.18-27",  "lc": "20.27-40",    "jo": None},
    {"id": 199, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Os líderes religiosos questionam Jesus acerca do maior mandamento",  "mt": "22.34-40",  "mc": "12.28-34",  "lc": None,          "jo": None},
    {"id": 200, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Os líderes religiosos não conseguem responder à pergunta de Jesus",  "mt": "22.41-46",  "mc": "12.35-37",  "lc": "20.41-44",    "jo": None},
    {"id": 201, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus adverte contra os líderes religiosos",                         "mt": "23.1-12",   "mc": "12.38-40",  "lc": "20.45-47",    "jo": None},
    {"id": 202, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus condena os líderes religiosos",                               "mt": "23.13-36",  "mc": None,        "lc": None,          "jo": None},
    {"id": 203, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Uma viúva pobre oferta tudo o que tem",                             "mt": None,        "mc": "12.41-44",  "lc": "21.1-4",      "jo": None},
    {"id": 204, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus ensina sobre estar vigilante quanto a sua volta",             "mt": "24.1-51",   "mc": "13.1-37",   "lc": "21.5-38",     "jo": None},
    {"id": 205, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus conta a parábola das dez virgens",                            "mt": "25.1-13",   "mc": None,        "lc": None,          "jo": None},
    {"id": 206, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus conta a parábola do dinheiro emprestado",                     "mt": "25.14-30",  "mc": None,        "lc": None,          "jo": None},
    {"id": 207, "s": "B", "ss": "O Ministério de Jesus em Jerusalém", "t": "Jesus fala sobre o juízo final",                                    "mt": "25.31-46",  "mc": None,        "lc": None,          "jo": None},

    # ── C. Morte e Ressurreição ────────────────────────────────────────────────
    {"id": 208, "s": "C", "ss": None, "t": "Os líderes religiosos tramam a morte de Jesus",                                                     "mt": "26.1-5",    "mc": "14.1-2",    "lc": "22.1-2",      "jo": None},
    {"id": 209, "s": "C", "ss": None, "t": "Judas concorda em trair Jesus",                                                                     "mt": "26.14-16",  "mc": "14.10-11",  "lc": "22.3-6",      "jo": None},
    {"id": 210, "s": "C", "ss": None, "t": "Os discípulos preparam-se para a Páscoa",                                                           "mt": "26.17-19",  "mc": "14.12-16",  "lc": "22.7-13",     "jo": None},
    {"id": 211, "s": "C", "ss": None, "t": "Jesus lava os pés dos discípulos",                                                                  "mt": None,        "mc": None,        "lc": None,          "jo": "13.1-20"},
    {"id": 212, "s": "C", "ss": None, "t": "Jesus e os discípulos participam da última ceia",                                                   "mt": "26.20-30",  "mc": "14.17-26",  "lc": "22.14-30",    "jo": "13.21-30"},
    {"id": 213, "s": "C", "ss": None, "t": "Jesus prediz a negação de Pedro",                                                                   "mt": "26.31-35",  "mc": "14.27-31",  "lc": "22.31-38",    "jo": "13.31-38"},
    {"id": 214, "s": "C", "ss": None, "t": "Jesus é o caminho até o Pai",                                                                       "mt": None,        "mc": None,        "lc": None,          "jo": "14.1-14"},
    {"id": 215, "s": "C", "ss": None, "t": "Jesus promete o Espírito Santo",                                                                    "mt": None,        "mc": None,        "lc": None,          "jo": "14.15-31"},
    {"id": 216, "s": "C", "ss": None, "t": "Jesus ensina sobre a videira e os ramos",                                                           "mt": None,        "mc": None,        "lc": None,          "jo": "15.1-17"},
    {"id": 217, "s": "C", "ss": None, "t": "Jesus adverte do ódio do mundo",                                                                    "mt": None,        "mc": None,        "lc": None,          "jo": "15.18-16.4"},
    {"id": 218, "s": "C", "ss": None, "t": "Jesus ensina sobre o Espírito Santo",                                                               "mt": None,        "mc": None,        "lc": None,          "jo": "16.5-15"},
    {"id": 219, "s": "C", "ss": None, "t": "Jesus ensina sobre o uso de seu nome em oração",                                                    "mt": None,        "mc": None,        "lc": None,          "jo": "16.16-33"},
    {"id": 220, "s": "C", "ss": None, "t": "Jesus ora por Ele mesmo",                                                                           "mt": None,        "mc": None,        "lc": None,          "jo": "17.1-5"},
    {"id": 221, "s": "C", "ss": None, "t": "Jesus ora por seus discípulos",                                                                     "mt": None,        "mc": None,        "lc": None,          "jo": "17.6-19"},
    {"id": 222, "s": "C", "ss": None, "t": "Jesus ora pelos futuros crentes",                                                                   "mt": None,        "mc": None,        "lc": None,          "jo": "17.20-26"},
    {"id": 223, "s": "C", "ss": None, "t": "Jesus agoniza no jardim",                                                                           "mt": "26.36-46",  "mc": "14.32-42",  "lc": "22.39-46",    "jo": None},
    {"id": 224, "s": "C", "ss": None, "t": "Jesus é traído e preso",                                                                            "mt": "26.47-56",  "mc": "14.43-52",  "lc": "22.47-53",    "jo": "18.1-11"},
    {"id": 225, "s": "C", "ss": None, "t": "Anás interroga Jesus",                                                                              "mt": None,        "mc": None,        "lc": None,          "jo": "18.12-24"},
    {"id": 226, "s": "C", "ss": None, "t": "Caifás interroga Jesus",                                                                            "mt": "26.57-68",  "mc": "14.53-65",  "lc": "22.54-65",    "jo": None},
    {"id": 227, "s": "C", "ss": None, "t": "Pedro nega conhecer Jesus",                                                                         "mt": "26.69-75",  "mc": "14.66-72",  "lc": "22.54-62",    "jo": "18.25-27"},
    {"id": 228, "s": "C", "ss": None, "t": "O conselho dos líderes religiosos condena Jesus",                                                   "mt": "27.1-2",    "mc": "15.1",      "lc": None,          "jo": None},
    {"id": 229, "s": "C", "ss": None, "t": "Judas enforca-se",                                                                                  "mt": "27.3-10",   "mc": None,        "lc": None,          "jo": None},
    {"id": 230, "s": "C", "ss": None, "t": "Jesus é julgado perante Pilatos",                                                                   "mt": "27.11-14",  "mc": "15.2-5",    "lc": "23.1-7",      "jo": "18.28-37"},
    {"id": 231, "s": "C", "ss": None, "t": "Jesus é julgado perante Herodes",                                                                   "mt": None,        "mc": None,        "lc": "23.8-12",     "jo": None},
    {"id": 232, "s": "C", "ss": None, "t": "Pilatos entrega Jesus para ser crucificado",                                                        "mt": "27.15-26",  "mc": "15.6-15",   "lc": "23.13-25",    "jo": "18.38-19.16"},
    {"id": 233, "s": "C", "ss": None, "t": "Os soldados romanos zombam de Jesus",                                                               "mt": "27.27-31",  "mc": "15.16-20",  "lc": None,          "jo": None},
    {"id": 234, "s": "C", "ss": None, "t": "Jesus é levado para ser crucificado",                                                               "mt": "27.32",     "mc": "15.21",     "lc": "23.26-31",    "jo": None},
    {"id": 235, "s": "C", "ss": None, "t": "Jesus é pregado na cruz",                                                                           "mt": "27.33-44",  "mc": "15.22-32",  "lc": "23.32-43",    "jo": "19.17-27"},
    {"id": 236, "s": "C", "ss": None, "t": "Jesus morre na cruz",                                                                               "mt": "27.45-56",  "mc": "15.33-41",  "lc": "23.44-49",    "jo": "19.28-37"},
    {"id": 237, "s": "C", "ss": None, "t": "Jesus é depositado no sepulcro",                                                                    "mt": "27.57-61",  "mc": "15.42-47",  "lc": "23.50-56",    "jo": "19.38-42"},
    {"id": 238, "s": "C", "ss": None, "t": "Uma guarda é postada no sepulcro",                                                                  "mt": "27.62-66",  "mc": None,        "lc": None,          "jo": None},
    {"id": 239, "s": "C", "ss": None, "t": "Jesus ressuscita",                                                                                  "mt": "28.1-8",    "mc": "16.1-8",    "lc": "24.1-11",     "jo": "20.1-2"},
    {"id": 240, "s": "C", "ss": None, "t": "Pedro e João correm até o sepulcro",                                                                "mt": None,        "mc": None,        "lc": "24.12",       "jo": "20.3-10"},
    {"id": 241, "s": "C", "ss": None, "t": "Jesus aparece às mulheres",                                                                         "mt": "28.9-10",   "mc": "16.9-11",   "lc": None,          "jo": "20.11-18"},
    {"id": 242, "s": "C", "ss": None, "t": "Os líderes religiosos subornam os guardas",                                                         "mt": "28.11-15",  "mc": None,        "lc": None,          "jo": None},
    {"id": 243, "s": "C", "ss": None, "t": "Jesus aparece a dois crentes que viajam pela estrada",                                              "mt": None,        "mc": "16.12-13",  "lc": "24.13-35",    "jo": None},
    {"id": 244, "s": "C", "ss": None, "t": "Jesus aparece a seus discípulos",                                                                   "mt": None,        "mc": "16.14",     "lc": "24.36-43",    "jo": "20.19-23"},
    {"id": 245, "s": "C", "ss": None, "t": "Jesus aparece a Tomé",                                                                              "mt": None,        "mc": None,        "lc": None,          "jo": "20.24-31"},
    {"id": 246, "s": "C", "ss": None, "t": "Jesus aparece a sete discípulos",                                                                   "mt": None,        "mc": None,        "lc": None,          "jo": "21.1-14"},
    {"id": 247, "s": "C", "ss": None, "t": "Jesus desafia Pedro",                                                                               "mt": None,        "mc": None,        "lc": None,          "jo": "21.15-25"},
    {"id": 248, "s": "C", "ss": None, "t": "Jesus transmite a grande comissão",                                                                 "mt": "28.16-20",  "mc": "16.15-18",  "lc": None,          "jo": None},
    {"id": 249, "s": "C", "ss": None, "t": "Jesus aparece aos discípulos em Jerusalém",                                                         "mt": None,        "mc": None,        "lc": "24.44-49",    "jo": None},
    {"id": 250, "s": "C", "ss": None, "t": "Jesus ascende ao céu",                                                                              "mt": None,        "mc": "16.19-20",  "lc": "24.50-53",    "jo": None},
]


# ─── Construção do JSON final ──────────────────────────────────────────────────

def construir_evento(raw: dict, indices: dict) -> dict:
    resultado = {
        "id":      raw["id"],
        "ordem":   raw["id"],
        "secao":   SECOES[raw["s"]],
        "subsecao": raw["ss"],
        "titulo":  raw["t"],
        "mateus":  None,
        "marcos":  None,
        "lucas":   None,
        "joao":    None,
    }

    mapa = {"mateus": "mt", "marcos": "mc", "lucas": "lc", "joao": "jo"}

    for evangelho, chave in mapa.items():
        ref_str = raw.get(chave)
        if not ref_str:
            continue
        prefixo = PREFIXOS[evangelho]
        texto   = extrair_texto(ref_str, indices[evangelho])
        resultado[evangelho] = {
            "referencia": f"{prefixo} {ref_str}",
            "texto": texto,
        }

    return resultado


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("📖 Gerando cronologia.json — Evangelhos Cronológicos (ARC)\n")

    # 1. Criar pasta dados/
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    # 2. Baixar os 4 Evangelhos
    print("⬇ Baixando Evangelhos da ARC (damarals/biblias)…")
    livros = {}
    for nome, url in FONTES.items():
        print(f"  • {nome}… ", end="", flush=True)
        livros[nome] = baixar(url)
        print("✓")

    # 3. Indexar versículos
    print("\n🔢 Indexando versículos…")
    indices = {nome: indexar(livro) for nome, livro in livros.items()}

    # 4. Processar os 250 eventos
    print("\n⚙ Processando 250 eventos…")
    cronologia = [construir_evento(raw, indices) for raw in EVENTOS_RAW]

    # 5. Salvar
    OUTPUT.write_text(
        json.dumps(cronologia, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    # 6. Resumo
    total      = len(cronologia)
    com_texto  = sum(
        1 for e in cronologia
        if any(e.get(g) and e[g].get("texto") for g in ["mateus","marcos","lucas","joao"])
    )
    tamanho_kb = OUTPUT.stat().st_size // 1024

    print(f"\n✅ Concluído!")
    print(f"   Eventos:    {total}")
    print(f"   Com texto:  {com_texto}")
    print(f"   Arquivo:    {OUTPUT}")
    print(f"   Tamanho:    ~{tamanho_kb} KB")


if __name__ == "__main__":
    main()
