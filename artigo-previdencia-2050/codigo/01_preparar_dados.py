"""
Etapa 1 - Prepara os dados oficiais usados no artigo.

Lê os arquivos originais em ../dados/brutos (baixados por 00_baixar_dados.py)
e grava tabelas limpas em ../dados/processados:

  populacao.csv          IBGE, Projeções da População (revisão 2024), Brasil,
                         por sexo e idade simples, 2000-2070
  perfis_idade.csv       AEPS 2012 e AEPS 2024: benefícios ativos (RGPS sem
                         pensões, pensões, BPC) e contribuintes, por sexo e
                         grupo de idade, 2010-2012 e 2022-2024
  beneficios_serie.csv   AEPS: quantidade e valor dos benefícios ativos do
                         RGPS em dezembro, 2011-2024
  fiscal_anual.csv       Tesouro (RTN), BCB (SGS) e Tesouro (DPF): contas
                         fiscais, PIB, inflação, salário mínimo e juros, 2006-2025
  participacao_piso.csv  AEPS, tabela B.23: valor dos benefícios iguais a um piso
  pnad_ocupacao.csv      IBGE, PNAD Contínua (tabela 4094): nível de ocupação e
                         informalidade por grupo de idade, médias anuais 2012-2025
"""

import glob
import json
import re
from pathlib import Path

import openpyxl
import pandas as pd
import xlrd

BASE = Path(__file__).resolve().parent.parent
BRUTOS = BASE / "dados" / "brutos"
PROC = BASE / "dados" / "processados"
PROC.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# População
# ---------------------------------------------------------------------------
def populacao() -> pd.DataFrame:
    ws = openpyxl.load_workbook(BRUTOS / "projecoes_2024_tab1_idade_simples.xlsx",
                                read_only=True).worksheets[0]
    linhas = []
    for r in ws.iter_rows(min_row=7, values_only=True):
        if r[4] != "Brasil" or r[1] not in ("Homens", "Mulheres"):
            continue
        for k, v in enumerate(r[5:76]):
            linhas.append((2000 + k, "M" if r[1] == "Homens" else "F", int(r[0]), float(v)))
    df = pd.DataFrame(linhas, columns=["ano", "sexo", "idade", "pop"])
    df.to_csv(PROC / "populacao.csv", index=False)
    return df


# ---------------------------------------------------------------------------
# Tabelas do AEPS por sexo e grupo de idade
# ---------------------------------------------------------------------------
def _faixa(rotulo: str):
    """Converte o rótulo do AEPS em (idade inicial, idade final)."""
    s = rotulo.strip().lower()
    if s.startswith("ignorad"):
        return None
    n = [int(x) for x in re.findall(r"\d+", s)]
    if s.startswith("até"):
        return (0, n[0])
    if "e mais" in s:
        return (n[0], 200)
    return (n[0], n[1])


def _linhas_xls(caminho):
    if str(caminho).lower().endswith(".xls"):
        ws = xlrd.open_workbook(caminho).sheet_by_index(0)
        return [ws.row_values(i) for i in range(ws.nrows)]
    ws = openpyxl.load_workbook(caminho, read_only=True, data_only=True).worksheets[0]
    return [list(r) for r in ws.iter_rows(values_only=True)]


def _num(x):
    if x in (None, "", "-"):
        return 0.0
    return float(x)


def tabela_idade(caminho, anos):
    """Lê tabela AEPS em blocos (um bloco por grupo de idade, uma linha por ano).

    Retorna colunas: ano, faixa (lo, hi), total, M, F, ign (quantidades).
    """
    registros, bloco, rotulo = [], [], None
    for linha in _linhas_xls(caminho):
        cel = [c for c in linha if c not in (None, "")]
        if not cel:
            continue
        # identifica o ano (numérico ou texto) e um eventual rótulo
        ano, pos = None, None
        for j, c in enumerate(cel[:2]):
            try:
                v = int(float(c))
                if v in anos:
                    ano, pos = v, j
                    break
            except (TypeError, ValueError):
                pass
        if ano is None:
            continue
        rot = str(cel[0]).strip() if pos == 1 else None
        vals = [_num(c) for c in cel[pos + 1:pos + 5]]
        if ano == anos[0]:
            bloco, rotulo = [], None
        if rot:
            rotulo = rot
        bloco.append((ano, vals))
        if ano == anos[-1]:
            for a, v in bloco:
                registros.append((rotulo, a, *v))
    df = pd.DataFrame(registros, columns=["rotulo", "ano", "total", "M", "F", "ign"])
    df = df[df.rotulo.str.upper().str.strip() != "TOTAL"]
    df["faixa"] = df.rotulo.map(_faixa)
    return df


def _achar(codigo, pasta):
    for f in glob.glob(str(BRUTOS / pasta / "**" / "*"), recursive=True):
        nome = Path(f).stem.upper()
        if nome == codigo.upper():
            return f
    raise FileNotFoundError(codigo)


def perfis_idade() -> pd.DataFrame:
    fontes = {
        # grupo: (código AEPS 2012, código AEPS 2024)
        "beneficios_sem_pensao": ("C_05", "24SC05"),   # inclui BPC e RMV
        "bpc_idoso": ("19_03", "24C19_03"),
        "bpc_deficiencia": ("19_02", "24C19_02"),
        "pensao_urbana": ("15_02", "24C15_02"),
        "pensao_rural": ("15_04", "24C15_04"),
        "contribuintes": ("32_03", "24C32_03"),
    }
    partes = []
    for grupo, (c12, c24) in fontes.items():
        for cod, pasta, anos in ((c12, "aeps2012", [2010, 2011, 2012]),
                                 (c24, "aeps2024", [2022, 2023, 2024])):
            t = tabela_idade(_achar(cod, pasta), anos)
            t["grupo"] = grupo
            partes.append(t)
    df = pd.concat(partes, ignore_index=True)
    # Distribui sexo ignorado e idade ignorada proporcionalmente
    for s in ("M", "F"):
        df[s] = df[s] + df["ign"] * df[s] / (df["M"] + df["F"]).where(lambda x: x > 0, 1)
    df = df[df.faixa.notna()].copy()
    df["lo"] = df.faixa.map(lambda f: f[0])
    df["hi"] = df.faixa.map(lambda f: f[1])
    out = df.melt(id_vars=["grupo", "ano", "lo", "hi"], value_vars=["M", "F"],
                  var_name="sexo", value_name="qtd")
    out = out.groupby(["grupo", "ano", "sexo", "lo", "hi"], as_index=False).qtd.sum()
    out.to_csv(PROC / "perfis_idade.csv", index=False)
    return out


# ---------------------------------------------------------------------------
# Série de benefícios ativos do RGPS (quantidade e valor em dezembro)
# ---------------------------------------------------------------------------
def _serie_grupos(caminho):
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    res = {}
    for ws in wb.worksheets:
        anos = None
        for r in ws.iter_rows(values_only=True):
            cel = [c for c in r if c not in (None, "")]
            if not cel:
                continue
            if anos is None and all(re.fullmatch(r"\d{4}", str(c)) for c in cel):
                anos = [int(c) for c in cel]
                continue
            if anos and isinstance(cel[0], str):
                nome = cel[0].strip()
                if nome in res and anos[0] in res[nome]:
                    continue  # mantém a primeira ocorrência (benefício previdenciário)
                for a, v in zip(anos, cel[1:]):
                    res.setdefault(nome, {})[a] = _num(v)
    return res


def beneficios_serie() -> pd.DataFrame:
    q = _serie_grupos(_achar("23SH1_25", "aepshist"))
    v = _serie_grupos(_achar("23SH1_26", "aepshist"))
    q24 = tabela_simples(_achar("24SC01", "aeps2024"))
    v24 = tabela_simples(_achar("24SC02", "aeps2024"))
    linhas = []
    for a in range(2011, 2024):
        linhas.append((a, q["BENEFÍCIOS DO RGPS"][a], v["BENEFÍCIOS DO RGPS"][a],
                       q["Pensão por Morte"][a], q["BENEFÍCIOS ASSISTENCIAIS"][a]))
    linhas.append((2024, q24["BENEFÍCIOS DO RGPS"], 1000 * v24["BENEFÍCIOS DO RGPS"],
                   q24["Pensão por Morte"], q24["BENEFÍCIOS ASSISTENCIAIS"]))
    df = pd.DataFrame(linhas, columns=["ano", "qtd_rgps", "valor_rgps_dez", "qtd_pensao",
                                       "qtd_assistenciais"])
    df.to_csv(PROC / "beneficios_serie.csv", index=False)
    # Valores de dezembro de 2024 por grupo (R$ mil), para ponderar a despesa
    pd.Series({"rgps": v24["BENEFÍCIOS DO RGPS"], "pensao": v24["Pensão por Morte"],
               "assistenciais": v24["BENEFÍCIOS ASSISTENCIAIS"]},
              name="valor_dez_2024_mil").to_csv(PROC / "valores_2024.csv")
    return df


def tabela_simples(caminho):
    """Primeira coluna numérica de 2024 (total) para cada grupo de espécies do AEPS 2024."""
    res = {}
    for r in _linhas_xls(caminho):
        cel = [c for c in r if c not in (None, "")]
        if len(cel) >= 4 and isinstance(cel[0], str) and not cel[0].startswith(("FONTE", "Nota")):
            nome = cel[0].strip()
            if nome not in res:  # primeira ocorrência = benefício previdenciário (não acidentário)
                res[nome] = _num(cel[3])  # colunas: 2022, 2023, 2024 (total)
    return res


# ---------------------------------------------------------------------------
# Séries fiscais e macroeconômicas
# ---------------------------------------------------------------------------
def _sgs(codigo):
    d = json.load(open(BRUTOS / f"sgs_{codigo}.json"))
    s = pd.Series({pd.to_datetime(x["data"], dayfirst=True): float(x["valor"]) for x in d})
    return s.sort_index()


def fiscal_anual() -> pd.DataFrame:
    # RTN, tabela 2.1-A (% do PIB)
    ws = openpyxl.load_workbook(BRUTOS / "rtn_serie_historica.xlsx", read_only=True,
                                data_only=True)["2.1-A"]
    rows = list(ws.iter_rows(values_only=True))
    cab = next(r for r in rows if r[0] == "Discriminação")
    anos = [int(c) for c in cab[1:] if isinstance(c, (int, float))]

    def linha(prefixo):
        r = next(r for r in rows if isinstance(r[0], str) and r[0].strip().startswith(prefixo))
        return pd.Series([100 * float(x) for x in r[1:1 + len(anos)]], index=anos)

    rtn = pd.DataFrame({
        "receita_rgps": linha("1.3 -  Arrecadação Líquida para o RGPS"),
        "despesa_rgps": linha("4.1  Benefícios Previdenciários"),
        "despesa_bpc": linha("4.3.05  Benefícios de Prestação Continuada"),
        "pessoal_uniao": linha("4.2  Pessoal e Encargos Sociais"),
        "primario_gc": linha("5. RESULTADO PRIMÁRIO GOVERNO CENTRAL - ACIMA"),
    })

    dez = lambda s: s[s.index.month == 12].groupby(s[s.index.month == 12].index.year).last()
    divida = dez(_sgs(13762))
    nfsp_primario = dez(_sgs(5793))   # déficit primário (+) do setor público, % PIB
    nfsp_nominal = dez(_sgs(5727))    # déficit nominal (+), % PIB
    pib = dez(_sgs(4382))             # PIB nominal acumulado em 12 meses, R$ milhões
    ipca_m = _sgs(433)
    ipca = ((1 + ipca_m / 100).groupby(ipca_m.index.year).prod() - 1) * 100
    pib_real = _sgs(7326)
    pib_real.index = pib_real.index.year
    sm = _sgs(1619)
    sm = sm[sm.index.month == 1]
    sm.index = sm.index.year

    # Custo implícito da Dívida Pública Federal: juros apropriados / estoque inicial
    ws = openpyxl.load_workbook(BRUTOS / "dpf_fatores.xlsx", read_only=True,
                                data_only=True).worksheets[0]
    r = list(ws.iter_rows(values_only=True))
    cab = r[6]
    idx = [j for j, c in enumerate(cab) if isinstance(c, int)]
    lin = {str(x[0]).strip(): x for x in r if x[0]}
    juros = pd.Series({cab[j]: lin["I.2 - Juros  Apropriados"][j] for j in idx})
    estoque_ini = pd.Series({cab[j]: lin["Estoque anterior1"][j] for j in idx})
    custo_dpf = 100 * juros / estoque_ini

    df = pd.DataFrame({
        "divida_bruta": divida,
        "primario_sp": -nfsp_primario,          # superávit (+)
        "juros_nominais_sp": nfsp_nominal - nfsp_primario,
        "pib_nominal": pib,
        "ipca": ipca,
        "pib_real_cresc": pib_real,
        "salario_minimo": sm,
        "custo_dpf_nominal": custo_dpf,
    }).join(rtn, how="left")
    df.index.name = "ano"
    df = df.loc[2006:2025]
    df["custo_dpf_real"] = 100 * ((1 + df.custo_dpf_nominal / 100) / (1 + df.ipca / 100) - 1)
    df.round(4).to_csv(PROC / "fiscal_anual.csv")
    return df


def participacao_piso() -> pd.DataFrame:
    """Parcela do valor dos benefícios do RGPS paga a quem recebe exatamente um piso.

    AEPS, tabela B.23 (benefícios emitidos por faixa de valor, dezembro). Os
    assistenciais (BPC e RMV) valem sempre um salário mínimo e são retirados.
    """
    linhas = []
    for cod, pasta, anos in (("B_23", "aeps2012", [2010, 2011, 2012]),
                             ("24SB23", "aeps2024", [2022, 2023, 2024])):
        reg = {}
        rotulo = None
        for r in _linhas_xls(_achar(cod, pasta)):
            cel = [c for c in r if c not in (None, "")]
            if not cel:
                continue
            ano, pos = None, None
            for j, c in enumerate(cel[:2]):
                try:
                    if int(float(c)) in anos:
                        ano, pos = int(float(c)), j
                        break
                except (TypeError, ValueError):
                    pass
            if ano is None:
                continue
            if pos == 1:
                rotulo = str(cel[0]).strip().lower()
            reg.setdefault(ano, []).append((rotulo, _num(cel[pos + 4])))  # valor total (R$ mil)
        for ano, itens in reg.items():
            # em 2012 o rótulo vem na linha do meio do bloco; reconstrói por posição
            valores = [v for _, v in itens]
            linhas.append((ano, valores[0], valores[2]))  # total, "igual a 1"
    df = pd.DataFrame(linhas, columns=["ano", "valor_total_mil", "valor_piso_mil"]).sort_values("ano")
    df.to_csv(PROC / "participacao_piso.csv", index=False)
    return df


def pnad_ocupacao() -> pd.DataFrame:
    d = json.load(open(BRUTOS / "sidra_4094.json"))[1:]
    df = pd.DataFrame(d)
    df = df[df.D2C.isin(["4090", "1641", "12466"])]
    df["ano"] = df.D3N.str[-4:].astype(int)
    df["V"] = pd.to_numeric(df.V, errors="coerce")
    t = df.pivot_table(index=["ano", "D4N"], columns="D2C", values="V", aggfunc="mean")
    t = t.rename(columns={"4090": "ocupados_mil", "1641": "pop14mais_mil",
                          "12466": "informalidade"}).reset_index().rename(columns={"D4N": "faixa"})
    t = t[t.ano <= 2025]
    t.to_csv(PROC / "pnad_ocupacao.csv", index=False)
    return t


if __name__ == "__main__":
    print("população:", populacao().shape)
    print("perfis:", perfis_idade().groupby(["grupo", "ano"]).qtd.sum().round(0).to_string())
    print(beneficios_serie().to_string())
    print(fiscal_anual().round(2).to_string())
    print(participacao_piso().to_string())
    print(pnad_ocupacao().query("ano in [2012, 2024]").round(1).to_string())
