import { useState } from "react";
import { Copy, ExternalLink, Trash2, Package, Trophy } from "lucide-react";
import type { State, SavedProduct } from "../types";
import { id } from "../defaults";
import { money, num, Select } from "../components/ui";
export function Products({
  state,
  setState,
  open,
}: {
  state: State;
  setState: (s: State) => void;
  open: (p: SavedProduct) => void;
}) {
  const [sort, setSort] = useState("hour");
  const products = [...state.products].sort((a, b) => {
    const metric = (p: SavedProduct) =>
      sort === "hour"
        ? (p.result.profitHour ?? -Infinity)
        : sort === "profit"
          ? p.result.profit / p.result.quantity
          : sort === "margin"
            ? p.result.margin
            : (p.result.roi ?? -Infinity);
    return metric(b) - metric(a);
  });
  return (
    <div>
      <div className="page-intro">
        <span className="eyebrow">SEU CATÁLOGO INTELIGENTE</span>
        <h1>Boas ideias. Melhores negócios.</h1>
        <p>
          Compare produtos com os valores e configurações do momento em que
          foram salvos.
        </p>
      </div>
      {products.length === 0 ? (
        <div className="empty panel">
          <Package size={44} />
          <h2>Seu próximo produto começa aqui.</h2>
          <p>
            Salve uma simulação na calculadora para construir seu catálogo e
            comparar a rentabilidade.
          </p>
        </div>
      ) : (
        <>
          <div className="section-row">
            <h3>
              <Trophy size={20} /> Mais rentáveis
            </h3>
            <Select
              label="Ordenar por"
              value={sort}
              onChange={setSort}
              options={[
                { id: "hour", name: "Lucro por hora" },
                { id: "profit", name: "Lucro por unidade" },
                { id: "margin", name: "Margem" },
                { id: "roi", name: "ROI" },
              ]}
            />
          </div>
          <div className="product-grid">
            {products.map((p, i) => (
              <article className="panel product-card" key={p.id}>
                <div className="section-row">
                  <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mini-status">{p.result.status}</span>
                </div>
                <span className="eyebrow">
                  {p.input.category || "SEM CATEGORIA"}
                </span>
                <h2>{p.input.name}</h2>
                <div className="product-profit">
                  {money(p.result.profitHour)}
                  <small>/hora de máquina</small>
                </div>
                <div className="product-numbers">
                  <span>
                    Venda/un. <b>{money(p.result.price)}</b>
                  </span>
                  <span>
                    Custo/un. <b>{money(p.result.total / p.result.quantity)}</b>
                  </span>
                  <span>
                    Lucro/un.{" "}
                    <b>{money(p.result.profit / p.result.quantity)}</b>
                  </span>
                  <span>
                    Margem <b>{num(p.result.margin)}%</b>
                  </span>
                  <span>
                    Peso/lote <b>{num(p.input.grams, 2)} g</b>
                  </span>
                  <span>
                    Tempo/lote <b>{num(p.result.hours)} h</b>
                  </span>
                </div>
                {p.input.notes && (
                  <p className="muted small">{p.input.notes}</p>
                )}
                <p className="muted small">
                  {new Date(p.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                  {p.input.quantity} un./lote
                </p>
                <div className="button-row">
                  <button className="secondary" onClick={() => open(p)}>
                    <ExternalLink size={15} />
                    Abrir / editar
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Duplicar ${p.input.name}`}
                    onClick={() =>
                      setState({
                        ...state,
                        products: [
                          ...state.products,
                          {
                            ...structuredClone(p),
                            id: id(),
                            createdAt: new Date().toISOString(),
                            input: {
                              ...p.input,
                              name: `${p.input.name} (cópia)`,
                            },
                          },
                        ],
                      })
                    }
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Excluir ${p.input.name}`}
                    onClick={() => {
                      if (confirm(`Excluir “${p.input.name}”?`))
                        setState({
                          ...state,
                          products: state.products.filter((x) => x.id !== p.id),
                        });
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
