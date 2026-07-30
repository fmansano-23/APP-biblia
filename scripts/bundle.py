#!/usr/bin/env python3
"""
bundle.py — Evangelhos Cronológicos
Gera um único index-standalone.html com CSS, JS e dados embutidos.
Funciona com duplo clique, sem servidor.

Uso: python scripts/bundle.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent

def ler(caminho: Path) -> str:
    return caminho.read_text(encoding='utf-8')

def main():
    print("📦 Bundling Evangelhos Cronológicos…")

    # 1. Ler fontes
    css      = ler(ROOT / 'style.css')
    js       = ler(ROOT / 'app.js')
    template = ler(ROOT / 'index.html')
    dados    = json.loads(ler(ROOT / 'dados' / 'cronologia.json'))

    print(f"  ✓ CSS:    {len(css):,} chars")
    print(f"  ✓ JS:     {len(js):,} chars")
    print(f"  ✓ Dados:  {len(dados)} eventos")

    # 2. Serializar dados como variável JS (sem pretty-print para economizar espaço)
    dados_js = f"window.__CRONOLOGIA__ = {json.dumps(dados, ensure_ascii=False)};"

    # 3. Substituir links externos por versão embutida
    html = template

    # Remover link do Google Fonts (offline-first; fallback para system fonts)
    html = re.sub(r'<link[^>]+fonts\.googleapis[^>]+>\s*', '', html)
    html = re.sub(r'<link[^>]+fonts\.gstatic[^>]+>\s*', '', html)

    # Substituir <link rel="stylesheet" href="./style.css" />
    html = html.replace(
        '<link rel="stylesheet" href="./style.css" />',
        f'<style>\n{css}\n</style>'
    )

    # Injetar dados antes do app.js
    html = html.replace(
        '<script src="./app.js"></script>',
        f'<script>\n{dados_js}\n</script>\n<script>\n{js}\n</script>'
    )

    # Remover referência ao manifest e service worker
    # (SW não funciona em file://, mas não causa erro; manifest é OK)
    # Manter manifest e SW links para quando servido por servidor

    # 4. Escrever arquivo de saída
    saida = ROOT / 'index-standalone.html'
    saida.write_text(html, encoding='utf-8')

    tamanho_kb = saida.stat().st_size // 1024
    print(f"\n✅ Gerado: {saida}")
    print(f"   Tamanho: ~{tamanho_kb} KB")
    print(f"\n   Abra com duplo clique ou via file:// no navegador.")

if __name__ == '__main__':
    main()
