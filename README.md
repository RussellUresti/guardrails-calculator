# Guardrails Calculator

A Monte Carlo retirement spending calculator implementing risk-based guardrails (the Kitces/Income Lab method): given a portfolio, spending, and asset mix, it finds the withdrawal-rate triggers at which you'd cut or raise spending, and reports the odds of running out of money. It also overlays a historical cohort replay (literal chronological sequences from 1928–2025) alongside the Monte Carlo band, as a check on sequence-of-returns risk.

Static HTML/JS/CSS, no build step and no dependencies.

## Disclaimer

This tool is for **educational and illustrative purposes only**. It is not financial, investment, tax, or legal advice, and none of its outputs — success rates, spending amounts, guardrail triggers, or anything else it calculates — should be relied on for actual retirement or investment decisions.

- **Not reviewed by a financial professional.** The methodology (Monte Carlo simulation, historical cohort replay, guardrails logic) draws on publicly available financial research and industry-standard techniques, but neither the methodology nor the implementation has been audited or reviewed for correctness by a licensed financial advisor, actuary, or other qualified professional.
- **No guarantee of accuracy.** Historical data and projected capital market assumptions come from third-party sources (see "Updating the market data" below) and may be wrong, outdated, or superseded without notice. The code itself may also contain bugs that produce incorrect results.
- **Past performance and projections are not guarantees of future results.** Historical returns don't predict future returns, and projected forecasts are estimates, not promises.
- **This can't capture your whole financial picture.** Taxes, estate planning, healthcare costs, Social Security timing, legal considerations, and countless other individual factors are simplified or omitted entirely.
- **Use at your own risk.** Consult a qualified, licensed financial advisor, tax professional, and/or attorney before making any retirement, investment, or spending decisions. Nobody involved in building this tool accepts any liability for decisions made using it.

## How to use this tool

1. **Timeline and accounts.** Enter your current age, plan-through age, and (if applicable) the age retirement accounts open at — leave that equal to your current age if there's no bridge period. Fill in taxable, cash, and retirement balances, and each side's stock/bond split.
2. **Spending.** Pick a mode: "I know my spending" solves for your odds of success at a given withdrawal amount; "I know my target odds" solves for the spending that hits a target success rate instead.
3. **Guardrails.** Set the target success % and the lower/upper guardrails around it. These define the cut and raise triggers reported in the results.
4. **Market assumptions.** Choose Global or US stocks, then a return source:
   - **Historical** samples real (inflation-adjusted) return windows sized to your plan length — US stocks uses 1928–2025 data, Global stocks blends in real developed-ex-US data that only reaches back to 1991 (see [data/exus-returns.json](#dataexus-returnsjson) below); Pessimistic/Consensus/Optimistic pick the worst, average, or best window for your mix.
   - **Projected** uses current 10–15yr forecasts from several firms; Pessimistic/Consensus/Optimistic pick the lowest, average, or highest.
   - **Custom** lets you type in your own mean/volatility/correlation assumptions directly (opens the advanced section automatically).
5. **Read the results.** The three cards show the portfolio values at which you'd cut spending, where you stand today, and where you'd raise spending, plus your odds of success at your current spending. The chart below shows the Monte Carlo 10th–90th percentile band alongside dotted lines for the worst/typical/best *actual* historical period of your plan length — a check on sequence-of-returns risk that the randomized Monte Carlo band can understate. For longer plans the worst/best lines drop off first (too few distinct historical periods left to trust an extreme pick), then "typical" too once the plan is longer than any period the data can replay.
6. **Re-run regularly.** This is a point-in-time snapshot, not a set-and-forget plan. Re-check your total portfolio against the cut/raise triggers each quarter, and re-run the whole calculation — with updated balances and age — at least once a year or after any spending change.

## Running locally

Serve the directory with any static file server and open it in a browser, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Project structure

```
index.html                   markup, inputs, "How it's calculated" notes
css/styles.css                styling
data/
  historical-returns.json     annual nominal US stock/bond/cash/inflation, 1928–
  exus-returns.json           annual nominal developed ex-US stock return, 1991–
  market-assumptions.json     projected (CMA) forecasts and volatility/correlation assumptions
js/
  main.js                     form wiring, persistence, orchestration
  assumptions.js               historical windows, cohort replay, projected presets
  simulation.js                Monte Carlo engine (buildReturns, simulate, solve)
  render.js                    results panel, stats, road diagram
  chart.js                     portfolio projection SVG chart
  stats.js                     shared math (mean/sd/corr, lognormal params, PRNG)
  dom.js, format.js            small DOM/formatting helpers
favicon.svg
```

The in-app "How it's calculated" section (bottom of the results panel) is the source of truth for the methodology; keep it in sync with `assumptions.js` and `simulation.js` when either changes.

## Updating the market data

The historical and projected return assumptions should be refreshed at least once a year as new data and forecasts are published. Nothing fetches this automatically — it's a manual edit of the two files in `data/`.

### `data/historical-returns.json`

One row per year: `{ "year", "stock", "cash", "bond", "inflation" }`, all nominal percentages. Stock is the S&P 500 with dividends, bond is the 10-year Treasury (constant maturity, coupon + price return), cash is the 3-month T-bill, and inflation is CPI.

**Source:** Aswath Damodaran (NYU Stern), [Historical Returns on Stocks, Bonds and Bills](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html) — raw spreadsheet: [histretSP.xls](https://pages.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls). Published annually, typically in January. Append the new final year's row; don't restate prior years, since Damodaran occasionally revises methodology (e.g. T-bill averaging) retroactively — diff against the new file if a past year's numbers shift.

### `data/market-assumptions.json`

| Field | What it is | Source |
|---|---|---|
| `inflation` | Projected long-run inflation used to convert nominal CMA forecasts to real | [Schwab Long-Term Capital Market Expectations](https://www.schwab.com/learn/story/schwabs-long-term-capital-market-expectations) — same report as `cashMean`, chosen because Schwab publishes stocks, bonds, cash and inflation together as one internally-consistent set |
| `stockVolatility`, `bondVolatility`, `cashVolatility`, `stockBondCorrelation` | Assumed volatility/correlation for the projected scenario | Held roughly constant; revisit if a source's own risk assumptions materially shift |
| `cashMean` | Projected 10-year cash return | [Schwab Long-Term Capital Market Expectations](https://www.schwab.com/learn/story/schwabs-long-term-capital-market-expectations) |
| `stockForecasts` | US large-cap 10–15yr projected return, one entry per firm | [Research Affiliates Asset Allocation Interactive](https://interactive.researchaffiliates.com/asset-allocation) (updated monthly) · [Vanguard market perspectives](https://advisors.vanguard.com/insights/article/series/market-perspectives) · [Verus Capital Market Assumptions](https://www.verusinvestments.com/verus-2026-capital-market-assumptions/) (annual; URL includes the year) · [Schwab Long-Term Capital Market Expectations](https://www.schwab.com/learn/story/schwabs-long-term-capital-market-expectations) · [J.P. Morgan LTCMA](https://am.jpmorgan.com/us/en/asset-management/adv/insights/portfolio-insights/ltcma/) (annual, ~October) |
| `bondForecasts` | US aggregate bond 10–15yr projected return, one entry per firm | Same reports as `stockForecasts` |
| `globalStockForecasts` | Each firm's US/developed-ex-US/emerging (or direct global) split | Same reports as `stockForecasts`; not every firm publishes every cut — see `js/assumptions.js`'s `globalStocks()` for how missing splits are approximated |

When updating `market-assumptions.json`, replace each firm's `value` with its latest published figure (add/remove firms if a report is discontinued or a new one adopted), and sanity-check the new numbers against the "How it's calculated" text in `index.html`, which lists the same figures inline for users.

### `data/exus-returns.json`

One row per year: `{ "year", "stock" }`, nominal %. This is the equity leg used for **Historical + Global stocks**: each year's stock return is blended between this and the corresponding year of `historical-returns.json`'s US stock return, at the "US share of global stocks %" weight (`usW`) — see `dataset()` in `js/assumptions.js`. Bonds and cash always come from `historical-returns.json` regardless of the stock-market toggle; there's no ex-US bond/cash series.

**Source:** [Kenneth French Data Library](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html) (Dartmouth), "Fama/French Developed ex US 3 Factors," annual block — raw zip: [Developed_ex_US_3_Factors_CSV.zip](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_ex_US_3_Factors_CSV.zip). Value is `Mkt-RF + RF` from that file (developed-ex-US market return). Sourced from MSCI through 2006 and Bloomberg from 2007 on. Chosen over MSCI EAFE/World-ex-USA directly (which have a longer back-history, to 1969–70) specifically because this is the dataset most academic research actually uses — the tradeoff is a shorter series.

**Coverage starts in 1991** (the file's first full annual row; monthly data starts July 1990) — it does not reach back to 1928 like the US dataset. This is a real, load-bearing limitation, not just a data-freshness note:
- `TIER1` in `js/assumptions.js` (`{ us: 75, global: 20 }`) and the dataset lengths it's compared against (98 years of US data, 35 years of ex-US data) together drive how much cohort detail is shown — see the "How it's calculated" bullet on cohort tiers in `index.html` for the exact thresholds, and keep both in sync if either dataset's length changes.
- **Global-stocks historical scenarios can never see the Great Depression, WWII, or any other pre-1991 crash** — those only appear when US stocks is selected. The worst Global-stocks cohort is bounded by whatever the worst 1991–2025 period was, not history's actual worst case.
- This is developed-market data only; it excludes emerging markets (~10% of global market cap today).

Update by re-downloading the zip and re-extracting the annual block when French republishes (periodically, not on a fixed schedule); append new final year(s), don't restate prior years.
