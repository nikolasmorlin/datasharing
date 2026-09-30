"""Extrai a Tabela 5.2 (receita, despesa e necessidade de financiamento do RGPS, % do PIB)
da avaliação atuarial do RGPS do PLDO 2027 para ../dados/ldo2027_rgps_projecao.csv."""

import csv
import re
from pathlib import Path

import pdfplumber

BASE = Path(__file__).resolve().parent.parent
PDF = BASE / "dados" / "brutos" / "pldo2027_anexo-iv-10-avaliacao-atuarial-rgps.pdf"
SAIDA = BASE / "dados" / "ldo2027_rgps_projecao.csv"

LINHA = re.compile(r"^(20\d\d|21\d\d) ([\d\.]+) ([\d,]+)% ([\d\.]+) ([\d,]+)% ([\d\.]+) ([\d,]+)% ([\d\.]+)")

linhas = []
with pdfplumber.open(PDF) as pdf:
    for pagina in pdf.pages:
        texto = pagina.extract_text() or ""
        if "Necessidade" not in texto:
            continue
        for l in texto.splitlines():
            m = LINHA.match(l)
            if m:
                linhas.append([m.group(1)] + [m.group(k).replace(",", ".") for k in (3, 5, 7)])

with open(SAIDA, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ano", "receita_pib", "despesa_pib", "necessidade_pib"])
    w.writerows(sorted({tuple(x) for x in linhas}))
print(f"{len(linhas)} linhas gravadas em {SAIDA}")
