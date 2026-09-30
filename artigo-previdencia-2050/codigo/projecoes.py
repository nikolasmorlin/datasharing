"""
Envelhecimento populacional, Previdência Social e dívida pública (2024-2050).

Modelo contábil simples, por cenários. Todas as contas são feitas em proporção
do PIB, a partir de quatro relações:

  1. Contribuintes  = População 15-64 x taxa de ocupação x taxa de contribuição
  2. Beneficiários  = População 60+   x benefícios por idoso
  3. PIB (real)     = Ocupados x produtividade
  4. Dívida(t)      = Dívida(t-1) x (1 + r) / (1 + g) - Resultado primário(t)

A receita previdenciária cresce com (contribuintes x salário médio) e a despesa
com (beneficiários x benefício médio). O salário médio acompanha a
produtividade; o benefício médio acompanha uma fração "phi" dela.

Os dados demográficos são uma trajetória estilizada, calibrada de forma
aproximada às Projeções da População do IBGE (revisão 2024). Os dados fiscais
do ano-base (2024) são aproximações de valores divulgados por RGPS/Tesouro/BCB.
Substitua-os pelas séries oficiais mais recentes antes de qualquer uso aplicado.

Uso:  python3 projecoes.py   (gera CSVs em ../resultados e PNGs em ../figuras)
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

BASE = Path(__file__).resolve().parent.parent
RES = BASE / "resultados"
FIG = BASE / "figuras"
RES.mkdir(exist_ok=True)
FIG.mkdir(exist_ok=True)

ANOS = list(range(2024, 2051))

# ---------------------------------------------------------------------------
# 1. Demografia (milhões de pessoas e participações na população total)
# ---------------------------------------------------------------------------
ANCORAS_DEMO = pd.DataFrame(
    {
        "pop_total": [212.6, 216.5, 220.2, 216.9],
        "sh_0_14": [0.190, 0.175, 0.155, 0.140],
        "sh_15_64": [0.697, 0.690, 0.670, 0.640],
        "sh_65": [0.113, 0.135, 0.175, 0.220],
        "sh_60": [0.160, 0.190, 0.240, 0.290],
    },
    index=[2024, 2030, 2040, 2050],
)


def demografia() -> pd.DataFrame:
    d = ANCORAS_DEMO.reindex(ANOS).interpolate(method="index")
    d["pop_0_14"] = d.pop_total * d.sh_0_14
    d["pop_15_64"] = d.pop_total * d.sh_15_64
    d["pop_60"] = d.pop_total * d.sh_60
    d["pop_65"] = d.pop_total * d.sh_65
    d["razao_dep_idosos"] = d.pop_65 / d.pop_15_64  # 65+ por pessoa de 15-64
    d.index.name = "ano"
    return d


# ---------------------------------------------------------------------------
# 2. Ano-base fiscal (2024, % do PIB) e mercado de trabalho
# ---------------------------------------------------------------------------
ANO_BASE = dict(
    despesa_rgps=8.0,  # benefícios do RGPS, % do PIB
    receita_rgps=5.5,  # arrecadação líquida do RGPS, % do PIB
    primario_total=-0.4,  # resultado primário do setor público, % do PIB
    divida=76.5,  # Dívida Bruta do Governo Geral, % do PIB
    ocupacao=0.69,  # ocupados / população 15-64
    contribuicao=0.57,  # ocupados que contribuem ao RGPS / ocupados
    beneficios_por_idoso=1.00,  # benefícios do RGPS / população 60+
)
# Resultado primário fora do RGPS (mantido constante: isola o efeito previdenciário)
PRIMARIO_NAO_PREV = ANO_BASE["primario_total"] + (
    ANO_BASE["despesa_rgps"] - ANO_BASE["receita_rgps"]
)

# ---------------------------------------------------------------------------
# 3. Cenários
# ---------------------------------------------------------------------------
#   prod     crescimento anual da produtividade do trabalho (e do salário real)
#   ocup50   taxa de ocupação em 2050 (transição linear a partir de 2024)
#   contr50  taxa de contribuição (formalização) em 2050
#   benid50  benefícios por idoso em 2050 (queda reflete a idade mínima da EC 103/2019)
#   phi      fração do ganho de produtividade repassada ao benefício médio
#   r        juro real implícito da dívida bruta
CENARIOS = {
    "Base": dict(prod=0.012, ocup50=0.70, contr50=0.58, benid50=0.85, phi=0.5, r=0.040),
    "Otimista": dict(prod=0.020, ocup50=0.73, contr50=0.66, benid50=0.85, phi=0.5, r=0.035),
    "Pessimista": dict(prod=0.005, ocup50=0.67, contr50=0.52, benid50=0.85, phi=0.5, r=0.050),
    "Base + indexação plena": dict(prod=0.012, ocup50=0.70, contr50=0.58, benid50=0.85, phi=1.0, r=0.040),
}


def linear(v0: float, v1: float, ano: int) -> float:
    return v0 + (v1 - v0) * (ano - 2024) / (2050 - 2024)


def projetar(p: dict, demo: pd.DataFrame, esforco: float = 0.0) -> pd.DataFrame:
    """Projeta um cenário. `esforco` = ajuste primário adicional (% PIB) a partir de 2026."""
    b = ANO_BASE
    linhas = []
    for ano in ANOS:
        t = ano - 2024
        ocup = linear(b["ocupacao"], p["ocup50"], ano)
        contr = linear(b["contribuicao"], p["contr50"], ano)
        benid = linear(b["beneficios_por_idoso"], p["benid50"], ano)

        ocupados = demo.at[ano, "pop_15_64"] * ocup
        contribuintes = ocupados * contr
        beneficiarios = demo.at[ano, "pop_60"] * benid
        produtividade = (1 + p["prod"]) ** t  # índice 2024 = 1
        salario = produtividade
        beneficio = (1 + p["phi"] * p["prod"]) ** t
        pib = ocupados * produtividade
        linhas.append(
            dict(ano=ano, ocupados=ocupados, contribuintes=contribuintes,
                 beneficiarios=beneficiarios, pib=pib,
                 massa_salarial=contribuintes * salario,
                 massa_beneficios=beneficiarios * beneficio)
        )
    df = pd.DataFrame(linhas).set_index("ano")
    b0 = df.iloc[0]

    df["contrib_por_benef"] = df.contribuintes / df.beneficiarios
    df["cresc_pib"] = df.pib.pct_change().fillna(0.0)
    df["pib_indice"] = df.pib / b0.pib * 100
    df["receita_rgps"] = b["receita_rgps"] * (df.massa_salarial / b0.massa_salarial) / (df.pib / b0.pib)
    df["despesa_rgps"] = b["despesa_rgps"] * (df.massa_beneficios / b0.massa_beneficios) / (df.pib / b0.pib)
    df["deficit_rgps"] = df.despesa_rgps - df.receita_rgps
    ajuste = pd.Series([esforco if a >= 2026 else 0.0 for a in ANOS], index=df.index)
    df["primario_total"] = PRIMARIO_NAO_PREV + ajuste - df.deficit_rgps

    divida, juros = [b["divida"]], [float("nan")]
    for ano in ANOS[1:]:
        g = df.at[ano, "cresc_pib"]
        d_ant = divida[-1]
        juros.append(d_ant * p["r"] / (1 + g))
        divida.append(d_ant * (1 + p["r"]) / (1 + g) - df.at[ano, "primario_total"])
    df["divida"] = divida
    df["juros_reais"] = juros
    # Necessidade de financiamento (conceito real): juros reais + déficit primário
    df["necessidade_financiamento"] = df.juros_reais - df.primario_total
    # Primário que estabilizaria a dívida no nível do ano: d * (r - g) / (1 + g)
    df["primario_estabilizador"] = df.divida * (p["r"] - df.cresc_pib) / (1 + df.cresc_pib)
    return df


def esforco_para_meta(p: dict, demo: pd.DataFrame, meta: float) -> float:
    """Ajuste primário permanente (a partir de 2026) que leva a dívida de 2050 à `meta`."""
    lo, hi = -10.0, 15.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if projetar(p, demo, mid).at[2050, "divida"] > meta:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# ---------------------------------------------------------------------------
# 4. Execução
# ---------------------------------------------------------------------------
def main() -> None:
    demo = demografia()
    demo.round(4).to_csv(RES / "demografia.csv")

    resultados = {nome: projetar(p, demo) for nome, p in CENARIOS.items()}
    colunas = ["pib_indice", "cresc_pib", "contribuintes", "beneficiarios", "contrib_por_benef",
               "receita_rgps", "despesa_rgps", "deficit_rgps", "primario_total",
               "juros_reais", "necessidade_financiamento", "divida", "primario_estabilizador"]
    for nome, df in resultados.items():
        arq = nome.lower().replace(" + ", "_").replace(" ", "_").replace("ç", "c").replace("ã", "a")
        df[colunas].round(3).to_csv(RES / f"cenario_{arq}.csv")

    # Tabela-resumo dos cenários
    resumo = []
    for nome, df in resultados.items():
        p = CENARIOS[nome]
        resumo.append({
            "Cenário": nome,
            "Cresc. médio PIB 2025-50 (% a.a.)": 100 * ((df.pib.iloc[-1] / df.pib.iloc[0]) ** (1 / 26) - 1),
            "Contrib./benef. 2050": df.at[2050, "contrib_por_benef"],
            "Despesa RGPS 2050 (% PIB)": df.at[2050, "despesa_rgps"],
            "Receita RGPS 2050 (% PIB)": df.at[2050, "receita_rgps"],
            "Déficit RGPS 2050 (% PIB)": df.at[2050, "deficit_rgps"],
            "Primário 2050 (% PIB)": df.at[2050, "primario_total"],
            "Nec. financ. 2050 (% PIB)": df.at[2050, "necessidade_financiamento"],
            "Dívida 2050 (% PIB)": df.at[2050, "divida"],
            "Esforço p/ dívida 2050 = 2024 (p.p. PIB)": esforco_para_meta(p, demo, ANO_BASE["divida"]),
        })
    resumo = pd.DataFrame(resumo).set_index("Cenário")
    resumo.round(2).to_csv(RES / "resumo_cenarios.csv")

    # Sensibilidade: altera um parâmetro por vez em relação ao cenário Base
    base = CENARIOS["Base"]
    variacoes = {
        "Base": {},
        "Produtividade 2,0% a.a.": dict(prod=0.020),
        "Produtividade 0,5% a.a.": dict(prod=0.005),
        "Formalização 66% em 2050": dict(contr50=0.66),
        "Formalização 52% em 2050": dict(contr50=0.52),
        "Ocupação 73% em 2050": dict(ocup50=0.73),
        "Ocupação 67% em 2050": dict(ocup50=0.67),
        "Juro real 3,0%": dict(r=0.030),
        "Juro real 5,0%": dict(r=0.050),
        "Benefício sem ganho real (phi=0)": dict(phi=0.0),
        "Benefício acompanha salário (phi=1)": dict(phi=1.0),
        "Sem efeito da EC 103 (benef./idoso = 1,00)": dict(benid50=1.00),
    }
    # Contrafactual: estrutura etária congelada em 2024 (mesma população total)
    demo_cong = demo.copy()
    for c in ["sh_0_14", "sh_15_64", "sh_60", "sh_65"]:
        demo_cong[c] = demo.at[2024, c]
    for c, sh in [("pop_0_14", "sh_0_14"), ("pop_15_64", "sh_15_64"), ("pop_60", "sh_60"), ("pop_65", "sh_65")]:
        demo_cong[c] = demo_cong.pop_total * demo_cong[sh]
    sens = []
    for nome, mud in list(variacoes.items()) + [("Sem envelhecimento (estrutura etária de 2024)", None)]:
        df = projetar(base, demo_cong) if mud is None else projetar({**base, **mud}, demo)
        sens.append({"Hipótese": nome,
                     "Déficit RGPS 2050 (% PIB)": df.at[2050, "deficit_rgps"],
                     "Dívida 2050 (% PIB)": df.at[2050, "divida"]})
    sens = pd.DataFrame(sens).set_index("Hipótese")
    sens["Diferença p/ Base (dívida, p.p.)"] = sens["Dívida 2050 (% PIB)"] - sens.at["Base", "Dívida 2050 (% PIB)"]
    sens.round(2).to_csv(RES / "sensibilidade.csv")

    # Tabela demográfica e trabalho (cenário Base) em anos selecionados
    anos_sel = [2024, 2030, 2035, 2040, 2045, 2050]
    b = resultados["Base"]
    tab_demo = pd.DataFrame({
        "População (mi)": demo.pop_total,
        "15-64 (mi)": demo.pop_15_64,
        "60+ (mi)": demo.pop_60,
        "60+ (% pop.)": 100 * demo.sh_60,
        "65+ (% pop.)": 100 * demo.sh_65,
        "Razão de dependência 65+/15-64 (%)": 100 * demo.razao_dep_idosos,
        "Contribuintes RGPS (mi)": b.contribuintes,
        "Beneficiários RGPS (mi)": b.beneficiarios,
        "Contribuintes por beneficiário": b.contrib_por_benef,
    }).loc[anos_sel]
    tab_demo.round(2).to_csv(RES / "tabela_demografia_trabalho.csv")

    print("\n=== Demografia e trabalho (Base) ===\n", tab_demo.round(2).T.to_string())
    print("\n=== Resumo dos cenários ===\n", resumo.round(2).T.to_string())
    print("\n=== Sensibilidade ===\n", sens.round(2).to_string())
    for nome in ["Base"]:
        print(f"\n=== {nome}: trajetória ===\n",
              resultados[nome].loc[anos_sel, colunas].round(2).T.to_string())

    graficos(demo, resultados)


def graficos(demo: pd.DataFrame, resultados: dict) -> None:
    plt.rcParams.update({"figure.dpi": 150, "font.size": 9, "axes.spines.top": False,
                         "axes.spines.right": False, "axes.grid": True, "grid.alpha": 0.3})
    cores = {"Base": "#2a6fdb", "Otimista": "#1a9e5c", "Pessimista": "#d1495b",
             "Base + indexação plena": "#8c6bb1"}

    # Figura 1: estrutura etária
    fig, ax = plt.subplots(figsize=(6.4, 3.6))
    ax.plot(demo.index, 100 * demo.sh_0_14, label="0 a 14 anos", color="#9aa5b1")
    ax.plot(demo.index, 100 * demo.sh_15_64, label="15 a 64 anos", color="#2a6fdb")
    ax.plot(demo.index, 100 * demo.sh_60, label="60 anos ou mais", color="#d1495b")
    ax.plot(demo.index, 100 * demo.sh_65, label="65 anos ou mais", color="#e8a33d", ls="--")
    ax.set_ylabel("% da população")
    ax.set_title("Figura 1 – Composição etária da população, 2024-2050")
    ax.legend(frameon=False, ncol=2)
    fig.tight_layout()
    fig.savefig(FIG / "fig1_estrutura_etaria.png")
    plt.close(fig)

    # Figura 2: contribuintes por beneficiário
    fig, ax = plt.subplots(figsize=(6.4, 3.6))
    for nome in ["Otimista", "Base", "Pessimista"]:
        ax.plot(resultados[nome].index, resultados[nome].contrib_por_benef, label=nome, color=cores[nome])
    ax.set_ylabel("contribuintes por beneficiário")
    ax.set_title("Figura 2 – Contribuintes do RGPS por beneficiário")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(FIG / "fig2_contribuintes_beneficiarios.png")
    plt.close(fig)

    # Figura 3: receita e despesa do RGPS
    fig, axs = plt.subplots(1, 2, figsize=(8.0, 3.4), sharey=True)
    for nome, df in resultados.items():
        axs[0].plot(df.index, df.despesa_rgps, color=cores[nome], label=nome)
        axs[0].plot(df.index, df.receita_rgps, color=cores[nome], ls=":")
        axs[1].plot(df.index, df.deficit_rgps, color=cores[nome], label=nome)
    axs[0].set_title("Despesa (—) e receita (···) do RGPS")
    axs[1].set_title("Déficit do RGPS")
    axs[0].set_ylabel("% do PIB")
    axs[1].legend(frameon=False, fontsize=7)
    fig.suptitle("Figura 3 – Resultado previdenciário por cenário", fontsize=10)
    fig.tight_layout()
    fig.savefig(FIG / "fig3_resultado_rgps.png")
    plt.close(fig)

    # Figura 4: dívida bruta
    fig, ax = plt.subplots(figsize=(6.4, 3.6))
    for nome, df in resultados.items():
        ax.plot(df.index, df.divida, color=cores[nome], label=nome)
    ax.axhline(ANO_BASE["divida"], color="grey", lw=0.8, ls="--")
    ax.set_ylabel("% do PIB")
    ax.set_title("Figura 4 – Dívida Bruta do Governo Geral (sem ajuste fiscal adicional)")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(FIG / "fig4_divida.png")
    plt.close(fig)


if __name__ == "__main__":
    main()
