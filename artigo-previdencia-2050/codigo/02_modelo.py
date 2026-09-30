"""
Etapa 2 - Modelo de projeção, backtest, Monte Carlo e decomposição.

O modelo é contábil. Todas as quantidades de pessoas saem de uma única regra:

    número de pessoas em uma situação = taxa por sexo e idade x população por sexo e idade

aplicada a quatro situações: benefício do RGPS (exceto pensão), pensão por
morte, BPC e contribuinte do RGPS; e, com dados da PNAD, a ocupação.
As taxas são medidas no AEPS 2024 (e no AEPS 2012, para o backtest).

Valores em % do PIB:
  despesa RGPS  = despesa 2024 x (benefícios / benefícios 2024) x (benefício médio real / 2024)
                  / (PIB real / PIB real 2024)
  receita RGPS  = receita 2024 x (contribuintes / 2024) x (salário real / 2024) / (PIB real / 2024)
  despesa BPC   = despesa 2024 x (beneficiários / 2024) x (salário mínimo real / 2024) / (PIB real / 2024)
  PIB real      = ocupados x produtividade;  salário real acompanha a produtividade
  dívida (t)    = dívida (t-1) x (1 + juro real) / (1 + crescimento real) - resultado primário (t)

Resultados em ../resultados e figuras em ../figuras.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parent.parent
PROC = BASE / "dados" / "processados"
RES = BASE / "resultados"
FIG = BASE / "figuras"
RES.mkdir(exist_ok=True)
FIG.mkdir(exist_ok=True)

ANOS = np.arange(2024, 2051)
RNG = np.random.default_rng(20260930)

# ---------------------------------------------------------------------------
# Dados
# ---------------------------------------------------------------------------
POP = pd.read_csv(PROC / "populacao.csv")
PERFIS = pd.read_csv(PROC / "perfis_idade.csv")
SERIE = pd.read_csv(PROC / "beneficios_serie.csv", index_col="ano")
FISCAL = pd.read_csv(PROC / "fiscal_anual.csv", index_col="ano")
PNAD = pd.read_csv(PROC / "pnad_ocupacao.csv")
PISO = pd.read_csv(PROC / "participacao_piso.csv", index_col="ano")
VALORES = pd.read_csv(PROC / "valores_2024.csv", index_col=0).iloc[:, 0]
LDO = pd.read_csv(BASE / "dados" / "ldo2027_rgps_projecao.csv", index_col="ano")

# população por ano x sexo x idade (0..90+)
_P = {(a, s): g.sort_values("idade")["pop"].to_numpy()
      for (a, s), g in POP.groupby(["ano", "sexo"])}


def pop(ano, sexo, lo, hi, estrutura=None):
    """População do sexo `sexo` com idade entre lo e hi no ano `ano`.

    `estrutura`: se informado (um ano), usa a composição por sexo e idade
    daquele ano, reescalada para a população total do ano pedido
    (contrafactual 'sem envelhecimento').
    """
    if estrutura is None:
        v = _P[(ano, sexo)]
    else:
        tot = _P[(ano, "M")].sum() + _P[(ano, "F")].sum()
        tot0 = _P[(estrutura, "M")].sum() + _P[(estrutura, "F")].sum()
        v = _P[(estrutura, sexo)] * tot / tot0
    return v[lo:min(hi, 90) + 1].sum()


def pop_total(ano, lo, hi, estrutura=None):
    return pop(ano, "M", lo, hi, estrutura) + pop(ano, "F", lo, hi, estrutura)


# ---------------------------------------------------------------------------
# Taxas por sexo e idade
# ---------------------------------------------------------------------------
def taxas(ano_ref):
    """Taxas (pessoas / população) por grupo, sexo e faixa etária no ano_ref."""
    d = PERFIS[PERFIS.ano == ano_ref].copy()
    # BPC idoso: a primeira faixa do AEPS é "até 69 anos"; o benefício começa aos 65
    d.loc[(d.grupo == "bpc_idoso") & (d.lo == 0), "lo"] = 65
    d["taxa"] = [q / pop(ano_ref, s, lo, hi) for q, s, lo, hi in zip(d.qtd, d.sexo, d.lo, d.hi)]
    t = {g: gg[["sexo", "lo", "hi", "taxa"]].reset_index(drop=True) for g, gg in d.groupby("grupo")}
    # RGPS sem pensão = benefícios sem pensão - BPC (as faixas do BPC estão contidas nas do C.5)
    base = t["beneficios_sem_pensao"].copy()
    for g in ("bpc_idoso", "bpc_deficiencia"):
        for _, r in t[g].iterrows():
            m = (base.sexo == r.sexo) & (base.lo <= r.lo) & (base.hi >= min(r.hi, 200))
            if r.hi == 200:
                m = (base.sexo == r.sexo) & (base.hi == 200)
            qtd = r.taxa * pop(ano_ref, r.sexo, r.lo, r.hi)
            i = base.index[m][0]
            base.loc[i, "taxa"] -= qtd / pop(ano_ref, r.sexo, base.loc[i, "lo"], base.loc[i, "hi"])
    out = {
        "rgps_sem_pensao": base,
        "pensao": _soma_taxas(t["pensao_urbana"], t["pensao_rural"]),
        "bpc": _concat(t["bpc_idoso"], t["bpc_deficiencia"]),
        "contribuintes": t["contribuintes"],
    }
    return out


def _soma_taxas(a, b):
    m = a.merge(b, on=["sexo", "lo", "hi"], suffixes=("_a", "_b"))
    m["taxa"] = m.taxa_a + m.taxa_b
    return m[["sexo", "lo", "hi", "taxa"]]


def _concat(a, b):
    # BPC idoso e BPC deficiência têm faixas que se sobrepõem: soma-se cada um separadamente
    a = a.copy()
    b = b.copy()
    a["parte"], b["parte"] = "idoso", "deficiencia"
    return pd.concat([a, b], ignore_index=True)


TX12 = taxas(2012)
TX24 = taxas(2024)


def contar(tx, ano, estrutura=None, peso_tendencia=0.0, tx_antiga=None):
    """Número de pessoas no ano, dadas as taxas.

    peso_tendencia > 0 prolonga a variação das taxas observada entre 2012 e 2024
    (por sexo e faixa), com intensidade que se reduz linearmente até zero em 2050.
    """
    taxa = tx.taxa.to_numpy()
    if peso_tendencia and tx_antiga is not None:
        ant = tx_antiga.taxa.to_numpy()
        var_anual = np.log(np.where(ant > 0, taxa / np.where(ant > 0, ant, 1), 1)) / 12
        anos_efetivos = sum(max(0.0, 1 - (j - 2024) / 26) for j in range(2025, ano + 1))
        taxa = taxa * np.exp(peso_tendencia * var_anual * anos_efetivos)
    return float(sum(t * pop(ano, s, lo, hi, estrutura)
                     for t, s, lo, hi in zip(taxa, tx.sexo, tx.lo, tx.hi)))


# Ocupação (PNAD 2024): nível de ocupação por grupo de idade, ambos os sexos
_FAIXAS_PNAD = {"14 a 17 anos": (14, 17), "18 a 24 anos": (18, 24), "25 a 39 anos": (25, 39),
                "40 a 59 anos": (40, 59), "60 anos ou mais": (60, 200)}


def taxas_ocupacao(ano):
    d = PNAD[(PNAD.ano == ano) & (PNAD.faixa.isin(_FAIXAS_PNAD))]
    return {f: r.ocupados_mil / r.pop14mais_mil for f, r in zip(d.faixa, d.itertuples())}


OCUP24 = taxas_ocupacao(2024)


def ocupados(ano, estrutura=None, mult=1.0):
    return mult * sum(OCUP24[f] * pop_total(ano, lo, hi, estrutura) for f, (lo, hi) in _FAIXAS_PNAD.items())


# ---------------------------------------------------------------------------
# Parâmetros calibrados com dados
# ---------------------------------------------------------------------------
def calibrar():
    f = FISCAL
    defl = (1 + f.ipca / 100).cumprod()
    # participação do piso no valor do RGPS (sem assistenciais, que valem 1 SM)
    assist = SERIE.qtd_assistenciais * f.salario_minimo.reindex(SERIE.index) / 1000
    w_piso = ((PISO.valor_piso_mil - assist.reindex(PISO.index))
              / (PISO.valor_total_mil - assist.reindex(PISO.index))).dropna()
    # benefício médio real do RGPS e salário mínimo real
    med_real = (SERIE.valor_rgps_dez / SERIE.qtd_rgps) / defl.reindex(SERIE.index)
    sm_real = f.salario_minimo / defl.shift(1)
    n = 2024 - 2012
    g_med = np.log(med_real[2024] / med_real[2012]) / n
    g_sm = np.log(sm_real[2024] / sm_real[2012]) / n
    phi = w_piso.mean()
    alfa = g_med - phi * g_sm  # deriva de composição (novos benefícios maiores que os que cessam)
    # incerteza de alfa: desvio-padrão dos resíduos anuais / raiz(n)
    res = np.log(med_real).diff() - phi * np.log(sm_real).diff().reindex(med_real.index)
    alfa_ep = res.loc[2013:2024].std() / np.sqrt(n)
    # mesma conta só para o período posterior à EC 103/2019 (2019-2024)
    alfa_pos = (np.log(med_real[2024] / med_real[2019]) - phi * np.log(sm_real[2024] / sm_real[2019])) / 5
    alfa_pos_ep = res.loc[2020:2024].std() / np.sqrt(5)
    alfa_pre = (np.log(med_real[2019] / med_real[2012]) - phi * np.log(sm_real[2019] / sm_real[2012])) / 7
    # produtividade do trabalho: PIB real / ocupados (PNAD), 2013-2025
    occ = PNAD[PNAD.faixa == "Total"].set_index("ano").ocupados_mil
    prod = (1 + f.pib_real_cresc / 100) / (1 + occ.pct_change()) - 1
    # juro real implícito da DPF
    r = f.custo_dpf_real.loc[2007:2025] / 100
    g = f.pib_real_cresc.loc[2007:2025] / 100
    # reação fiscal (Bohn): primário = c + rho * dívida(t-1) + gama * crescimento, 2007-2025 exceto 2020
    d = pd.DataFrame({"s": f.primario_sp, "d": f.divida_bruta.shift(1), "g": f.pib_real_cresc}).loc[2007:2025].drop(2020)
    X = np.c_[np.ones(len(d)), d.d, d.g]
    beta = np.linalg.lstsq(X, d.s, rcond=None)[0]
    e = d.s - X @ beta
    ep = np.sqrt(np.diag(e @ e / (len(d) - 3) * np.linalg.inv(X.T @ X)))
    cal = dict(
        phi=phi, w_piso=w_piso.round(4).to_dict(), alfa=alfa, alfa_ep=alfa_ep,
        alfa_pre_2012_2019=alfa_pre, alfa_pos_2019_2024=alfa_pos, alfa_pos_ep=alfa_pos_ep,
        g_med_real=g_med, g_sm_real=g_sm,
        prod_media_2013_2025=prod.loc[2013:2025].mean(),
        r_media=r.mean(), r_dp=r.std(), r_ar1=np.corrcoef(r.values[1:], r.values[:-1])[0, 1],
        r_2025=r[2025],
        g_media=g.mean(), g_dp=g.drop(2020).std(), g_ar1=np.corrcoef(g.values[1:], g.values[:-1])[0, 1],
        corr_rg=np.corrcoef(r, g)[0, 1],
        bohn_c=beta[0], bohn_rho=beta[1], bohn_gama=beta[2], bohn_rho_ep=ep[1], bohn_n=len(d),
    )
    return cal


CAL = calibrar()

# Ano-base fiscal: 2024 (RTN, % do PIB); o ponto de partida da dívida é 2025 (BCB)
B24 = dict(desp_rgps=FISCAL.despesa_rgps[2024], rec_rgps=FISCAL.receita_rgps[2024],
           desp_bpc=FISCAL.despesa_bpc[2024])
PENSAO_PARTE = VALORES["pensao"] / VALORES["rgps"]
D2025 = FISCAL.divida_bruta[2025]
S2025 = FISCAL.primario_sp[2025]

# Ganho real do salário mínimo já conhecido (reajustes de jan/2025 e jan/2026)
IPCA = FISCAL.ipca
SM_REAL_CONHECIDO = {
    2025: FISCAL.salario_minimo[2025] / FISCAL.salario_minimo[2024] / (1 + IPCA[2024] / 100) - 1,
    2026: 1621.0 / FISCAL.salario_minimo[2025] / (1 + IPCA[2025] / 100) - 1,
}

# ---------------------------------------------------------------------------
# Parâmetros dos cenários
# ---------------------------------------------------------------------------
CENTRAL = dict(
    prod=0.010,          # produtividade do trabalho, % a.a. (ver texto)
    contr50=1.00,        # taxas de contribuição em 2050 / 2024
    ocup50=1.00,         # taxas de ocupação em 2050 / 2024
    peso_tend=1.0,       # peso da tendência 2012-2024 das taxas de benefício
    regra_sm="lei",      # "lei": ganho real = PIB de t-2, entre 0,6% e 2,5%; "zero"; "prod"
    alfa=CAL["alfa_pos_2019_2024"],  # deriva de composição pós-EC 103
    r=CAL["r_media"],    # juro real médio 2007-2025
    premio=0.0,          # p.p. de juro por p.p. de dívida acima de 2025 (x100 = pontos-base)
    reacao=0.0,          # resposta do primário à dívida (Bohn)
    esforco=0.0,         # ajuste primário permanente a partir de 2027, % PIB
    estrutura=None,      # None = demografia do IBGE; ano = estrutura etária congelada
)


def projetar(p, choques_g=None, choques_r=None, detalhe=True):
    """Projeção anual 2024-2050. Retorna DataFrame (ou só a dívida se detalhe=False)."""
    est = p["estrutura"]
    n = len(ANOS)
    fr = (ANOS - 2024) / 26  # fração do caminho até 2050
    ocup = np.array([ocupados(a, est, 1 + (p["ocup50"] - 1) * x) for a, x in zip(ANOS, fr)])
    contr = np.array([contar(TX24["contribuintes"], a, est) * (1 + (p["contr50"] - 1) * x)
                      for a, x in zip(ANOS, fr)])
    nb = np.array([contar(TX24["rgps_sem_pensao"], a, est, p["peso_tend"], TX12["rgps_sem_pensao"])
                   for a in ANOS])
    npn = np.array([contar(TX24["pensao"], a, est, p["peso_tend"], TX12["pensao"]) for a in ANOS])
    nbpc = np.array([contar(TX24["bpc"], a, est, p["peso_tend"], TX12["bpc"]) for a in ANOS])

    g_prod = np.full(n, p["prod"])
    if choques_g is not None:
        g_prod = g_prod + choques_g
    g_prod[0] = 0.0
    pib = ocup / ocup[0] * np.cumprod(1 + g_prod)
    g_pib = np.r_[FISCAL.pib_real_cresc[2024] / 100, pib[1:] / pib[:-1] - 1]

    sm = np.zeros(n)
    for i, a in enumerate(ANOS[1:], start=1):
        if a in SM_REAL_CONHECIDO and p["regra_sm"] == "lei":
            sm[i] = SM_REAL_CONHECIDO[a]
        elif p["regra_sm"] == "lei":
            g2 = g_pib[i - 2] if i >= 2 else FISCAL.pib_real_cresc[a - 2] / 100
            sm[i] = min(max(g2, 0.006), 0.025)
        elif p["regra_sm"] == "prod":
            sm[i] = g_prod[i]
    sm_idx = np.cumprod(1 + sm)
    ben_idx = np.cumprod(np.r_[1.0, np.exp(p["alfa"] + CAL["phi"] * np.log1p(sm[1:]))])
    if p["regra_sm"] == "zero":
        ben_idx = np.cumprod(np.r_[1.0, np.full(n - 1, np.exp(p["alfa"]))])

    y = pib  # PIB real, índice 2024 = 1
    mix = (1 - PENSAO_PARTE) * nb / nb[0] + PENSAO_PARTE * npn / npn[0]
    desp = B24["desp_rgps"] * mix * ben_idx / y
    rec = B24["rec_rgps"] * (contr / contr[0]) / (ocup / ocup[0])
    bpc = B24["desp_bpc"] * (nbpc / nbpc[0]) * sm_idx / y
    # níveis ancorados nos valores observados de 2025 (a relação 2025 -> 2050 vem do modelo)
    if p.get("ancorar", True):
        desp = desp * ANCORA["desp_rgps"]
        rec = rec * ANCORA["rec_rgps"]
        bpc = bpc * ANCORA["desp_bpc"]
    deficit = desp - rec + bpc  # RGPS + BPC

    # Dívida a partir de 2025 (valor observado); primário de 2025 observado
    i25 = 1
    divida = np.full(n, np.nan)
    prim = np.full(n, np.nan)
    juro = np.full(n, np.nan)
    divida[i25] = D2025
    prim[i25] = S2025
    for i in range(i25 + 1, n):
        esf = p["esforco"] if ANOS[i] >= 2027 else 0.0
        prim[i] = (S2025 - (deficit[i] - deficit[i25]) + esf
                   + p["reacao"] * (divida[i - 1] - D2025))
        juro[i] = p["r"] + p["premio"] / 100 * (divida[i - 1] - D2025)
        if choques_r is not None:
            juro[i] += choques_r[i]
        divida[i] = divida[i - 1] * (1 + juro[i]) / (1 + g_pib[i]) - prim[i]
    if not detalhe:
        fator = (1 + juro) / (1 + g_pib)
        # quanto 1 p.p. de ajuste permanente (2027-2050) reduz a dívida de 2050
        leva = np.array([np.prod(fator[i + 1:]) for i in range(n)])
        peso_ajuste = leva[ANOS >= 2027].sum()
        return divida, peso_ajuste
    pi = 0.03  # meta de inflação, para converter juros reais em nominais
    juros_nom = np.r_[np.nan, divida[:-1]] * ((1 + juro) * (1 + pi) - 1) / ((1 + g_pib) * (1 + pi))
    return pd.DataFrame(dict(
        ocupados=ocup, contribuintes=contr, benef_rgps=nb + npn, benef_sem_pensao=nb, pensoes=npn,
        bpc_qtd=nbpc, contrib_por_benef=contr / (nb + npn), pib_idx=pib, cresc_pib=g_pib,
        sm_real_idx=sm_idx, beneficio_real_idx=ben_idx,
        despesa_rgps=desp, receita_rgps=rec, deficit_rgps=desp - rec, despesa_bpc=bpc,
        deficit_rgps_bpc=deficit, primario=prim, juro_real=juro, divida=divida,
        juros_nominais=juros_nom, nfsp_nominal=juros_nom - prim,
    ), index=pd.Index(ANOS, name="ano"))


ANCORA = {"desp_rgps": 1.0, "rec_rgps": 1.0, "desp_bpc": 1.0}
_sem_ancora = projetar(dict(CENTRAL, ancorar=False))
CHECAGEM_2025 = pd.DataFrame({
    "projetado (base 2024)": _sem_ancora.loc[2025, ["despesa_rgps", "receita_rgps", "despesa_bpc"]].values,
    "observado": [FISCAL.despesa_rgps[2025], FISCAL.receita_rgps[2025], FISCAL.despesa_bpc[2025]]},
    index=["despesa_rgps", "receita_rgps", "despesa_bpc"])
_k = CHECAGEM_2025.observado / CHECAGEM_2025["projetado (base 2024)"]
ANCORA = {"desp_rgps": _k["despesa_rgps"], "rec_rgps": _k["receita_rgps"], "desp_bpc": _k["despesa_bpc"]}


def esforco_meta(p, meta=D2025):
    lo, hi = -10.0, 20.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if projetar({**p, "esforco": mid}, detalhe=False)[0][-1] > meta:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# ---------------------------------------------------------------------------
# 1. Backtest 2012 -> 2024
# ---------------------------------------------------------------------------
def backtest():
    anos = range(2012, 2025)
    prev = pd.DataFrame(index=pd.Index(anos, name="ano"))
    prev["rgps_previsto"] = [contar(TX12["rgps_sem_pensao"], a) + contar(TX12["pensao"], a) for a in anos]
    prev["bpc_previsto"] = [contar(TX12["bpc"], a) for a in anos]
    prev["contrib_previsto"] = [contar(TX12["contribuintes"], a) for a in anos]
    prev["rgps_observado"] = SERIE.qtd_rgps.reindex(anos)
    prev.loc[2012, "rgps_observado"] = prev.loc[2012, "rgps_observado"]
    prev["bpc_observado"] = SERIE.qtd_assistenciais.reindex(anos)
    obs_c = PERFIS[PERFIS.grupo == "contribuintes"].groupby("ano").qtd.sum()
    prev["contrib_observado"] = obs_c.reindex(anos)
    # despesa do RGPS em % do PIB: previsão com o benefício médio observado (testa o módulo
    # de quantidades) e com o benefício médio da regra calibrada (piso x salário mínimo)
    f = FISCAL
    defl = (1 + f.ipca / 100).cumprod()
    med_nom = SERIE.valor_rgps_dez / SERIE.qtd_rgps
    sm_real = f.salario_minimo / defl.shift(1)
    med_regra = med_nom[2012] / defl[2012] * np.exp(
        CAL["alfa"] * (np.array(anos) - 2012)
        + CAL["phi"] * np.log(sm_real.reindex(anos) / sm_real[2012]))
    med_regra = med_regra * defl.reindex(anos)
    pib_nom = f.pib_nominal.reindex(anos)
    k = f.despesa_rgps[2012] / (prev.rgps_observado[2012] * med_nom[2012] / pib_nom[2012])
    prev["despesa_obs"] = f.despesa_rgps.reindex(anos)
    prev["despesa_prev_qtd"] = k * prev.rgps_previsto * med_nom.reindex(anos) / pib_nom
    prev["despesa_prev_modelo"] = k * prev.rgps_previsto * med_regra / pib_nom
    # decomposição do crescimento dos benefícios 2012-2024: demografia x mudança nas taxas
    return prev


# ---------------------------------------------------------------------------
# 2. Monte Carlo
# ---------------------------------------------------------------------------
def ar1(n_sim, n, rho, dp):
    e = RNG.normal(0, dp * np.sqrt(1 - rho ** 2), (n_sim, n))
    x = np.zeros((n_sim, n))
    x[:, 0] = RNG.normal(0, dp, n_sim)
    for t in range(1, n):
        x[:, t] = rho * x[:, t - 1] + e[:, t]
    return x


def monte_carlo(n_sim=2000, reacao=0.0):
    n = len(ANOS)
    cg = ar1(n_sim, n, CAL["g_ar1"], CAL["g_dp"])
    cr_ind = ar1(n_sim, n, CAL["r_ar1"], CAL["r_dp"])
    cr = CAL["corr_rg"] * cg / CAL["g_dp"] * CAL["r_dp"] + np.sqrt(1 - CAL["corr_rg"] ** 2) * cr_ind
    sims = np.zeros((n_sim, n))
    esforcos = np.zeros(n_sim)
    params = []
    for k in range(n_sim):
        p = dict(CENTRAL,
                 prod=RNG.uniform(0.0, 0.02),
                 contr50=RNG.normal(1.0, 0.05),
                 ocup50=RNG.normal(1.0, 0.03),
                 peso_tend=RNG.uniform(0, 1.5),
                 alfa=RNG.normal(CAL["alfa_pos_2019_2024"], CAL["alfa_pos_ep"]),
                 r=RNG.normal(CAL["r_media"], CAL["r_dp"] / np.sqrt(19)),
                 premio=RNG.uniform(0.0, 0.04),
                 reacao=reacao)
        sims[k] = projetar(p, cg[k], cr[k], detalhe=False)[0]
        # ajuste que traz a dívida de 2050 ao nível de 2025 (sem prêmio: a dívida fica perto de 2025)
        d0, peso = projetar(dict(p, premio=0.0, reacao=0.0), cg[k], cr[k], detalhe=False)
        esforcos[k] = (d0[-1] - D2025) / peso
        params.append(p)
    return sims, esforcos, pd.DataFrame(params)


# ---------------------------------------------------------------------------
# 3. Decomposições
# ---------------------------------------------------------------------------
def decomposicao_contabil(p):
    """Decomposição exata do ajuste primário necessário (sem prêmio de risco nem reação).

    A dívida de 2050 é a dívida de 2025 corrigida por (1 + juro)/(1 + crescimento) em cada ano,
    menos cada resultado primário levado a 2050 com o mesmo fator. Como essa conta é linear
    nos resultados primários, o ajuste que devolve a dívida de 2050 ao nível de 2025 se divide,
    sem resíduo, em três parcelas.
    """
    df = projetar(dict(p, premio=0.0, reacao=0.0, esforco=0.0))
    anos = [a for a in ANOS if a >= 2026]
    fator = {a: (1 + df.juro_real[a]) / (1 + df.cresc_pib[a]) for a in anos}
    leva = {a: np.prod([fator[j] for j in anos if j > a]) for a in anos}
    peso = sum(leva[a] for a in anos if a >= 2027)
    estoque = D2025 * (np.prod(list(fator.values())) - 1) / peso
    inicial = sum(-S2025 * leva[a] for a in anos) / peso
    aumento = sum((df.deficit_rgps_bpc[a] - df.deficit_rgps_bpc[2025]) * leva[a] for a in anos) / peso
    return {"Juros acima do crescimento sobre a dívida de 2025": estoque,
            "Déficit primário de 2025 mantido": inicial,
            "Aumento do déficit RGPS + BPC após 2025": aumento,
            "Total: ajuste necessário 2027-2050": estoque + inicial + aumento}


def ano_cruza(divida, limite):
    idx = np.where(divida > limite)[0]
    return int(ANOS[idx[0]]) if len(idx) else np.nan


def shapley_demografia(p, medida="esforco"):
    """Contribuição da demografia e do ganho real dos benefícios para a dívida de 2050.

    Valor de Shapley com dois fatores: média das contribuições nas duas ordens possíveis.
    Referência: estrutura etária congelada em 2025 e salário mínimo sem ganho real.
    """
    def d(dem, ben):
        q = dict(p, estrutura=None if dem else 2025)
        if not ben:
            q.update(regra_sm="zero")
        return esforco_meta(q) if medida == "esforco" else projetar(q, detalhe=False)[0][-1]
    d11, d10, d01, d00 = d(1, 1), d(1, 0), d(0, 1), d(0, 0)
    dem = 0.5 * ((d10 - d00) + (d11 - d01))
    ben = 0.5 * ((d01 - d00) + (d11 - d10))
    return {"Referência (sem envelhecimento e sem ganho real do SM)": d00, "Envelhecimento": dem,
            "Ganho real do salário mínimo": ben, "Total": d11}


# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------
def main():
    pd.Series(CAL, dtype=object).to_csv(RES / "calibracao.csv", header=["valor"])
    print("Calibração:")
    for k, v in CAL.items():
        print(f"  {k}: {v}")

    # Backtest
    bt = backtest()
    bt.round(3).to_csv(RES / "backtest_2012_2024.csv")
    print("\nBacktest:\n", bt.round(3).to_string())

    # Demografia e indicadores
    anos_sel = [2024, 2030, 2035, 2040, 2045, 2050]
    demo = pd.DataFrame(index=pd.Index(range(2000, 2071), name="ano"))
    demo["populacao_mi"] = [pop_total(a, 0, 200) / 1e6 for a in demo.index]
    demo["pct_0_14"] = [100 * pop_total(a, 0, 14) / pop_total(a, 0, 200) for a in demo.index]
    demo["pct_15_64"] = [100 * pop_total(a, 15, 64) / pop_total(a, 0, 200) for a in demo.index]
    demo["pct_60mais"] = [100 * pop_total(a, 60, 200) / pop_total(a, 0, 200) for a in demo.index]
    demo["pct_65mais"] = [100 * pop_total(a, 65, 200) / pop_total(a, 0, 200) for a in demo.index]
    demo["pop_15_64_mi"] = [pop_total(a, 15, 64) / 1e6 for a in demo.index]
    demo["pop_60mais_mi"] = [pop_total(a, 60, 200) / 1e6 for a in demo.index]
    demo["dep_65_15_64"] = [100 * pop_total(a, 65, 200) / pop_total(a, 15, 64) for a in demo.index]
    # idade mínima de aposentadoria da EC 103/2019: 62 (mulheres) e 65 (homens)
    demo["dep_idade_legal"] = [100 * (pop(a, "F", 62, 200) + pop(a, "M", 65, 200))
                               / (pop(a, "F", 15, 61) + pop(a, "M", 15, 64)) for a in demo.index]
    demo.round(3).to_csv(RES / "demografia.csv")

    base = projetar(CENTRAL)
    base.round(4).to_csv(RES / "cenario_central.csv")

    cenarios = {
        "Central": CENTRAL,
        "Favorável": dict(CENTRAL, prod=0.018, contr50=1.08, ocup50=1.04, r=0.035),
        "Desfavorável": dict(CENTRAL, prod=0.003, contr50=0.92, ocup50=0.96, r=0.065),
        "Central, SM sem ganho real": dict(CENTRAL, regra_sm="zero"),
        "Central, sem envelhecimento": dict(CENTRAL, estrutura=2025),
    }
    res = {k: projetar(v) for k, v in cenarios.items()}
    resumo = pd.DataFrame({k: {
        "Cresc. médio do PIB 2026-2050 (% a.a.)": 100 * ((df.pib_idx[2050] / df.pib_idx[2025]) ** (1 / 25) - 1),
        "Contribuintes por beneficiário RGPS, 2050": df.contrib_por_benef[2050],
        "Despesa RGPS 2050": df.despesa_rgps[2050],
        "Receita RGPS 2050": df.receita_rgps[2050],
        "Déficit RGPS 2050": df.deficit_rgps[2050],
        "Despesa BPC 2050": df.despesa_bpc[2050],
        "Resultado primário 2050": df.primario[2050],
        "Juros nominais 2035": df.juros_nominais[2035],
        "Déficit nominal (NFSP) 2035": df.nfsp_nominal[2035],
        "Dívida bruta 2035": df.divida[2035],
        "Ano em que a dívida passa de 100% do PIB": ano_cruza(df.divida.values, 100),
        "Ajuste p/ dívida 2050 = 2025 (p.p. PIB)": esforco_meta(cenarios[k]),
    } for k, df in res.items()})
    resumo.round(2).to_csv(RES / "resumo_cenarios.csv")
    print("\nResumo:\n", resumo.round(2).to_string())
    print("\nCentral:\n", base.loc[anos_sel].round(2).T.to_string())

    # Checagem fora da amostra: 2025
    fora = CHECAGEM_2025
    fora.round(2).to_csv(RES / "checagem_2025.csv")
    print("\n2025 fora da amostra:\n", fora.round(2))

    # Comparação com a LDO 2027
    comp = pd.DataFrame({"despesa_modelo": base.despesa_rgps, "despesa_ldo": LDO.despesa_pib,
                         "receita_modelo": base.receita_rgps, "receita_ldo": LDO.receita_pib,
                         "deficit_modelo": base.deficit_rgps, "deficit_ldo": LDO.necessidade_pib}).loc[2026:2050]
    comp.round(2).to_csv(RES / "comparacao_ldo2027.csv")

    # Sensibilidade (um parâmetro por vez)
    sens = {
        "Produtividade 0,3% a.a.": dict(prod=0.003), "Produtividade 1,8% a.a.": dict(prod=0.018),
        "Formalização -8% em 2050": dict(contr50=0.92), "Formalização +8% em 2050": dict(contr50=1.08),
        "Ocupação -4% em 2050": dict(ocup50=0.96), "Ocupação +4% em 2050": dict(ocup50=1.04),
        "Juro real 3,5%": dict(r=0.035), "Juro real 6,5%": dict(r=0.065),
        "Taxas de benefício de 2024 constantes": dict(peso_tend=0.0),
        "Tendência das taxas 1,5 vez a observada": dict(peso_tend=1.5),
        "SM sem ganho real": dict(regra_sm="zero"), "SM acompanha produtividade": dict(regra_sm="prod"),
        "Deriva de composição pré-reforma (2012-2019)": dict(alfa=CAL["alfa_pre_2012_2019"]),
        "Deriva de composição nula": dict(alfa=0.0),
    }
    e_base = esforco_meta(CENTRAL)
    tab = []
    for k, v in sens.items():
        q = dict(CENTRAL, **v)
        df = projetar(q)
        e = esforco_meta(q)
        tab.append((k, df.deficit_rgps_bpc[2050], ano_cruza(df.divida.values, 100), e, e - e_base))
    sens_df = pd.DataFrame(tab, columns=["Hipótese", "Déficit RGPS+BPC 2050", "Ano dívida > 100%",
                                         "Ajuste necessário (p.p.)",
                                         "Diferença p/ central (p.p.)"]).set_index("Hipótese")
    # juros dependentes da dívida: efeito sobre a trajetória (não sobre o ajuste, que mantém a dívida em 2025)
    premio = pd.DataFrame({f"{int(b * 100)} p.b. por p.p.": projetar(dict(CENTRAL, premio=b)).divida
                           for b in (0.0, 0.02, 0.04)}).loc[[2025, 2030, 2035, 2040]]
    premio.round(1).to_csv(RES / "divida_premio_risco.csv")
    print("\nPrêmio de risco:\n", premio.round(1).to_string())
    sens_df.round(2).to_csv(RES / "sensibilidade.csv")
    print("\nSensibilidade:\n", sens_df.round(2).to_string())

    # Decomposições
    dc = decomposicao_contabil(CENTRAL)
    sh = shapley_demografia(CENTRAL)
    pd.Series(dc).round(2).to_csv(RES / "decomposicao_contabil.csv", header=["p.p. do PIB"])
    pd.Series(sh).round(2).to_csv(RES / "decomposicao_shapley.csv", header=["p.p. do PIB"])
    print("\nDecomposição contábil:", {k: round(v, 1) for k, v in dc.items()})
    print("Shapley:", {k: round(v, 1) for k, v in sh.items()})

    # Monte Carlo
    sims, esf, prm = monte_carlo(2000, reacao=0.0)
    sims_r, _, _ = monte_carlo(2000, reacao=0.05)
    pct = [5, 25, 50, 75, 95]
    fan = pd.DataFrame(np.percentile(sims[:, 1:], pct, axis=0).T, index=ANOS[1:], columns=[f"p{q}" for q in pct])
    fan_r = pd.DataFrame(np.percentile(sims_r[:, 1:], pct, axis=0).T, index=ANOS[1:], columns=[f"p{q}" for q in pct])
    fan.round(1).to_csv(RES / "montecarlo_divida_sem_reacao.csv")
    fan_r.round(1).to_csv(RES / "montecarlo_divida_com_reacao.csv")
    cruza = np.array([ano_cruza(x, 100) for x in sims])
    cruza_r = np.array([ano_cruza(x, 100) for x in sims_r])
    probs = pd.DataFrame({
        "Sem reação fiscal": [np.mean(sims[:, ANOS == 2035] > 100), np.mean(sims[:, -1] > D2025),
                              np.mean(sims[:, -1] > 150), np.nanmedian(cruza), np.mean(np.isnan(cruza))],
        "Com reação fiscal (0,05)": [np.mean(sims_r[:, ANOS == 2035] > 100), np.mean(sims_r[:, -1] > D2025),
                                     np.mean(sims_r[:, -1] > 150), np.nanmedian(cruza_r),
                                     np.mean(np.isnan(cruza_r))],
    }, index=["P(dívida 2035 > 100%)", "P(dívida 2050 > nível de 2025)", "P(dívida 2050 > 150%)",
              "Ano mediano em que passa de 100%", "P(não passa de 100% até 2050)"])
    probs.round(3).to_csv(RES / "montecarlo_probabilidades.csv")
    esf_q = pd.Series(np.percentile(esf, pct), index=[f"p{q}" for q in pct])
    esf_q.round(2).to_csv(RES / "montecarlo_ajuste_necessario.csv", header=["p.p. do PIB"])
    print("\nMonte Carlo, dívida sem reação:\n", fan.loc[[2030, 2035, 2040, 2050]].round(1))
    print("Monte Carlo, dívida com reação:\n", fan_r.loc[[2030, 2035, 2040, 2050]].round(1))
    print(probs.round(3))
    print("Ajuste necessário (percentis):", esf_q.round(2).to_dict())

    graficos(demo, bt, base, res, comp, fan, fan_r, sens_df, dc, sh, esf)


# ---------------------------------------------------------------------------
# Figuras
# ---------------------------------------------------------------------------
AZUL, LARANJA, AQUA, AMARELO = "#2a78d6", "#eb6834", "#1baf7a", "#eda100"
TINTA, TINTA2, GRADE = "#0b0b0b", "#52514e", "#e4e3df"


def _estilo():
    plt.rcParams.update({
        "figure.dpi": 160, "font.size": 9, "axes.spines.top": False, "axes.spines.right": False,
        "axes.edgecolor": TINTA2, "axes.labelcolor": TINTA2, "xtick.color": TINTA2,
        "ytick.color": TINTA2, "axes.grid": True, "grid.color": GRADE, "grid.linewidth": 0.6,
        "lines.linewidth": 2, "legend.frameon": False, "axes.titlesize": 10,
        "axes.titleweight": "bold", "axes.titlecolor": TINTA, "figure.facecolor": "white",
        "axes.formatter.use_locale": False,
    })
    import matplotlib.ticker as mt
    plt.rcParams["axes.formatter.useoffset"] = False
    global _FMT
    _FMT = mt.FuncFormatter(lambda x, _: f"{x:g}".replace(".", ","))


def _salvar(fig, nome):
    for ax in fig.axes:
        if ax.yaxis.units is None:  # não mexe em eixos de categorias
            ax.yaxis.set_major_formatter(_FMT)
        if ax.xaxis.units is None and ax.get_xlim()[0] < 1900:  # nem em eixos de anos
            ax.xaxis.set_major_formatter(_FMT)
    fig.savefig(FIG / nome)


def graficos(demo, bt, base, res, comp, fan, fan_r, sens, dc, sh, esf):
    _estilo()
    d = demo.loc[2000:2070]

    fig, axs = plt.subplots(1, 2, figsize=(8.6, 3.4))
    axs[0].plot(d.index, d.pct_15_64, color=AZUL, label="15 a 64 anos")
    axs[0].plot(d.index, d.pct_60mais, color=LARANJA, label="60 anos ou mais")
    axs[0].plot(d.index, d.pct_0_14, color=AQUA, label="0 a 14 anos")
    axs[0].set_title("Composição da população (%)")
    axs[0].axvspan(2024, 2050, color=GRADE, alpha=0.35, lw=0)
    axs[0].legend(fontsize=8)
    axs[1].plot(d.index, d.dep_65_15_64, color=AZUL, label="65+ / 15–64 (padrão internacional)")
    axs[1].plot(d.index, d.dep_idade_legal, color=LARANJA,
                label="Idade legal de aposentadoria¹ / abaixo dela")
    axs[1].axvspan(2024, 2050, color=GRADE, alpha=0.35, lw=0)
    axs[1].set_title("Razões de dependência (por 100)")
    axs[1].legend(fontsize=7.5)
    fig.text(0.01, 0.0, "¹ Mulheres 62+ e homens 65+ sobre mulheres 15–61 e homens 15–64. "
             "Fonte: IBGE, Projeções da População, revisão 2024.", fontsize=7, color=TINTA2)
    fig.suptitle("Figura 1 – Estrutura etária, 2000–2070", fontsize=10, fontweight="bold", x=0.01, ha="left")
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    _salvar(fig, "fig1_demografia.png")
    plt.close(fig)

    fig, axs = plt.subplots(1, 2, figsize=(8.6, 3.4))
    axs[0].plot(bt.index, bt.rgps_observado / 1e6, color=TINTA2, label="Observado (AEPS)")
    axs[0].plot(bt.index, bt.rgps_previsto / 1e6, color=AZUL, ls="--",
                label="Previsto só com demografia (taxas de 2012)")
    axs[0].set_title("Benefícios ativos do RGPS (milhões)")
    axs[0].legend(fontsize=7.5)
    axs[1].plot(bt.index, bt.despesa_obs, color=TINTA2, label="Observado (Tesouro)")
    axs[1].plot(bt.index, bt.despesa_prev_modelo, color=AZUL, ls="--",
                label="Modelo (demografia + regra do piso)")
    axs[1].set_title("Despesa do RGPS (% do PIB)")
    axs[1].legend(fontsize=7.5)
    fig.suptitle("Figura 2 – Backtest: modelo calibrado em 2012 contra o observado até 2024",
                 fontsize=10, fontweight="bold", x=0.01, ha="left")
    fig.tight_layout()
    _salvar(fig, "fig2_backtest.png")
    plt.close(fig)

    fig, axs = plt.subplots(1, 2, figsize=(8.6, 3.4), sharey=False)
    axs[0].plot(comp.index, comp.despesa_modelo, color=AZUL, label="Despesa – este modelo")
    axs[0].plot(comp.index, comp.despesa_ldo, color=AZUL, ls=":", label="Despesa – LDO 2027")
    axs[0].plot(comp.index, comp.receita_modelo, color=LARANJA, label="Receita – este modelo")
    axs[0].plot(comp.index, comp.receita_ldo, color=LARANJA, ls=":", label="Receita – LDO 2027")
    axs[0].set_title("RGPS: despesa e receita (% do PIB)")
    axs[0].legend(fontsize=7)
    cores = {"Central": AZUL, "Favorável": AQUA, "Desfavorável": LARANJA,
             "Central, SM sem ganho real": AMARELO}
    for k, c in cores.items():
        axs[1].plot(res[k].index, res[k].deficit_rgps_bpc, color=c, label=k)
    axs[1].set_title("Déficit RGPS + BPC (% do PIB)")
    axs[1].legend(fontsize=7)
    fig.suptitle("Figura 3 – Resultado previdenciário e assistencial", fontsize=10,
                 fontweight="bold", x=0.01, ha="left")
    fig.tight_layout()
    _salvar(fig, "fig3_previdencia.png")
    plt.close(fig)

    fig, axs = plt.subplots(1, 2, figsize=(8.6, 3.5), sharey=True)
    for ax, f, tit in ((axs[0], fan, "Sem reação fiscal"), (axs[1], fan_r, "Com reação fiscal (0,05)")):
        f = f.loc[2025:]
        ax.fill_between(f.index, f.p5, f.p95, color=AZUL, alpha=0.15, lw=0, label="90% das simulações")
        ax.fill_between(f.index, f.p25, f.p75, color=AZUL, alpha=0.35, lw=0, label="50% das simulações")
        ax.plot(f.index, f.p50, color=AZUL, label="Mediana")
        ax.axhline(D2025, color=TINTA2, lw=0.8, ls="--")
        ax.set_ylim(0, 300)
        ax.set_title(tit)
    axs[0].set_ylabel("% do PIB")
    axs[0].legend(fontsize=7.5, loc="upper left")
    fig.suptitle("Figura 4 – Dívida Bruta do Governo Geral: 2.000 simulações de Monte Carlo",
                 fontsize=10, fontweight="bold", x=0.01, ha="left")
    fig.tight_layout()
    _salvar(fig, "fig4_divida_fan.png")
    plt.close(fig)

    fig, axs = plt.subplots(1, 2, figsize=(8.8, 3.5), gridspec_kw={"width_ratios": [1.25, 1]})
    itens = [(k, v) for k, v in dc.items() if not k.startswith("Total")]
    rot = ["Juros acima do\ncrescimento sobre\na dívida de 2025", "Déficit primário\nde 2025 mantido",
           "Aumento do déficit\nRGPS + BPC"]
    base_ac = 0.0
    for (k, v), r_, c in zip(itens, rot, (TINTA2, AMARELO, LARANJA)):
        axs[0].bar(r_, v, bottom=base_ac, color=c, width=0.6)
        axs[0].text(r_, base_ac + v / 2, f"{v:.1f}".replace(".", ","), ha="center", va="center", color="white",
                    fontsize=9, fontweight="bold")
        base_ac += v
    axs[0].bar("Total", base_ac, color=AZUL, width=0.6)
    axs[0].text("Total", base_ac / 2, f"{base_ac:.1f}".replace(".", ","), ha="center", va="center", color="white",
                fontsize=9, fontweight="bold")
    axs[0].set_title("Ajuste necessário, cenário central (p.p. do PIB)")
    axs[0].grid(axis="x", visible=False)
    axs[0].tick_params(axis="x", labelsize=7.5)
    axs[1].hist(esf, bins=40, color=AZUL, alpha=0.8)
    for q, ls in ((5, ":"), (50, "-"), (95, ":")):
        v = np.percentile(esf, q)
        axs[1].axvline(v, color=TINTA, lw=1, ls=ls)
        axs[1].text(v, axs[1].get_ylim()[1] * 0.95, f" p{q}: {v:.1f}".replace(".", ","), fontsize=7.5, color=TINTA)
    axs[1].set_title("Ajuste necessário: 2.000 simulações")
    axs[1].set_xlabel("p.p. do PIB por ano, 2027–2050")
    axs[1].grid(axis="x", visible=False)
    fig.suptitle("Figura 5 – Ajuste primário permanente que devolve a dívida de 2050 ao nível de 2025",
                 fontsize=10, fontweight="bold", x=0.01, ha="left")
    fig.tight_layout()
    _salvar(fig, "fig5_ajuste.png")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8.6, 4.2))
    s = sens["Diferença p/ central (p.p.)"].sort_values()
    ax.barh(s.index, s.values, color=[AQUA if v < 0 else LARANJA for v in s.values], height=0.6)
    ax.axvline(0, color=TINTA2, lw=0.8)
    ax.set_xlabel("Diferença em relação ao cenário central (p.p. do PIB)")
    fig.suptitle("Figura 6 – Sensibilidade do ajuste primário necessário (uma hipótese por vez)",
                 fontsize=10, fontweight="bold", x=0.01, ha="left")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    _salvar(fig, "fig6_sensibilidade.png")
    plt.close(fig)


if __name__ == "__main__":
    main()
