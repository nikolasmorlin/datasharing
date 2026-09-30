"""
Etapa 0 - Baixa os dados oficiais usados no artigo para ../dados/brutos.

Fontes (todas públicas):
  IBGE     Projeções da População, revisão 2024 (idade simples)
  IBGE     PNAD Contínua, SIDRA tabela 4094 (ocupação por grupo de idade)
  MPS      Anuário Estatístico da Previdência Social (AEPS) 2012 e 2024, e suplemento histórico 2023
  Tesouro  Resultado do Tesouro Nacional, série histórica; fatores de variação da DPF
  BCB      SGS: 13762 (DBGG), 5793 (NFSP primário), 5727 (NFSP nominal), 4382 (PIB),
           433 (IPCA), 7326 (PIB real), 1619 (salário mínimo)
  MPO      PLDO 2027, Anexos IV.10 (RGPS) e IV.11 (RPPS da União)
  IFI      Relatório de Acompanhamento Fiscal nº 112 (maio de 2026)

Os arquivos .zip do AEPS são descompactados em aeps2012/, aeps2024/ e aepshist/.
"""

import subprocess
import zipfile
from pathlib import Path

import requests

DEST = Path(__file__).resolve().parent.parent / "dados" / "brutos"
DEST.mkdir(parents=True, exist_ok=True)

PREV = "https://www.gov.br/previdencia/pt-br"
PLDO = "https://www.gov.br/planejamento/pt-br/assuntos/orcamento/orcamentos-anuais/2027/pldo"
ARQUIVOS = {
    "projecoes_2024_tab1_idade_simples.xlsx":
        "https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/projecoes_2024_tab1_idade_simples.xlsx",
    "sidra_4094.json": "https://apisidra.ibge.gov.br/values/t/4094/n1/all/v/all/p/all/c58/all?formato=json",
    "aeps_2024.zip": f"{PREV}/assuntos/previdencia-social/arquivos/aeps_2024.zip",
    "aeps_supl_historico_2023.zip": f"{PREV}/assuntos/previdencia-social/arquivos/aeps_supl_historico_2023.zip",
    "aeps2012_tabelas.zip": f"{PREV}/outros/imagens/2013/05/AEPSa_2012a_Tabelas.zip",
    "rtn_serie_historica.xlsx":
        "https://www.tesourotransparente.gov.br/ckan/dataset/ab56485b-9c40-4efb-8563-9ce3e1973c4b/"
        "resource/527ccdb1-3059-42f3-bf23-b5e3ab4c6dc6/download/seriehistoricajul26.xlsx",
    "dpf_fatores.xlsx":
        "https://www.tesourotransparente.gov.br/ckan/dataset/fc2ea6ab-2130-4525-98f6-8bf04407f7fe/"
        "resource/ef6a250b-75bf-44c7-8c9f-8a746b6f469e/download/fatores-de-variacao-da-divida-publica-federal.xlsx",
    "pldo2027_anexo-iv-10-avaliacao-atuarial-rgps.pdf":
        f"{PLDO}/anexo-iv-10-avaliacao-atuarial-rgps.pdf/@@display-file/file",
    "pldo2027_anexo-iv-11-avaliacao-atuarial-rpps.pdf":
        f"{PLDO}/anexo-iv-11-avaliacao-atuarial-rpps.pdf/@@display-file/file",
    "ifi_raf112_mai2026.pdf": "https://www12.senado.leg.br/ifi/pdf/raf112_mai2026.pdf/",
}
for codigo in (13762, 5793, 5727, 4382, 433, 7326, 1619):
    ARQUIVOS[f"sgs_{codigo}.json"] = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados"
                                      "?formato=json&dataInicial=01/01/2000&dataFinal=31/12/2026")


def baixar(nome, url):
    destino = DEST / nome
    if destino.exists():
        return
    print("baixando", nome)
    r = requests.get(url, timeout=600)
    r.raise_for_status()
    destino.write_bytes(r.content)


def main():
    for nome, url in ARQUIVOS.items():
        baixar(nome, url)
    for zipado, pasta in (("aeps_2024.zip", "aeps2024"), ("aeps2012_tabelas.zip", "aeps2012"),
                          ("aeps_supl_historico_2023.zip", "aepshist")):
        with zipfile.ZipFile(DEST / zipado) as z:
            z.extractall(DEST / pasta)
    # o suplemento histórico vem com zips internos; interessa o de planilhas
    for interno in (DEST / "aepshist").rglob("*XLSX.zip"):
        with zipfile.ZipFile(interno) as z:
            z.extractall(DEST / "aepshist" / "x")
    # tabela 5.2 da avaliação atuarial do RGPS (PLDO 2027) -> CSV
    subprocess.run(["python3", str(Path(__file__).with_name("extrair_ldo.py"))], check=True)


if __name__ == "__main__":
    main()
