import { Plus, Trash2 } from "lucide-react";
import type { Simulation, State } from "../types";
import { id } from "../defaults";
import { ItemsEditor, Numeric, Select, TextField, tips } from "./ui";
export function Advanced({
  state,
  onChange,
}: {
  state: State;
  onChange: (s: Simulation) => void;
}) {
  const s = state.simulation;
  const patch = (v: Partial<Simulation>) => onChange({ ...s, ...v });
  return (
    <div className="advanced-stack">
      <details open>
        <summary>Material e perdas</summary>
        <p className="muted small">
          O peso principal representa material útil do lote. Adicione apenas
          perdas ainda não incluídas nele.
        </p>
        {s.waste.map((w) => (
          <div className="item-row" key={w.id}>
            <TextField
              label="Tipo de perda"
              value={w.name}
              onChange={(name) =>
                patch({
                  waste: s.waste.map((i) =>
                    i.id === w.id ? { ...i, name } : i,
                  ),
                })
              }
            />
            <Numeric
              label="Perda"
              value={w.value}
              onChange={(value) =>
                patch({
                  waste: s.waste.map((i) =>
                    i.id === w.id ? { ...i, value } : i,
                  ),
                })
              }
            />
            <Select
              label="Unidade"
              value={w.mode}
              options={[
                { id: "g", name: "Gramas" },
                { id: "%", name: "% do peso útil" },
              ]}
              onChange={(mode) =>
                patch({
                  waste: s.waste.map((i) =>
                    i.id === w.id ? { ...i, mode: mode as "g" | "%" } : i,
                  ),
                })
              }
            />
            <button
              className="icon-button danger"
              aria-label="Excluir perda"
              onClick={() =>
                patch({ waste: s.waste.filter((i) => i.id !== w.id) })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="text-button"
          onClick={() =>
            patch({
              waste: [
                ...s.waste,
                { id: id(), name: "Suportes / purga", value: 0, mode: "g" },
              ],
            })
          }
        >
          <Plus size={15} />
          Adicionar perda
        </button>
      </details>
      <details>
        <summary>Tempo humano e desenvolvimento</summary>
        <p className="muted small">
          Cadastre preparação, modelagem, acabamento, atendimento e outras
          atividades. Não inclua desenvolvimento novamente se ele já estiver
          diluído abaixo.
        </p>
        {s.labor.map((l) => (
          <div className="item-row" key={l.id}>
            <TextField
              label="Atividade"
              value={l.name}
              onChange={(name) =>
                patch({
                  labor: s.labor.map((i) =>
                    i.id === l.id ? { ...i, name } : i,
                  ),
                })
              }
            />
            <Numeric
              label="Minutos de trabalho"
              value={l.minutes}
              onChange={(minutes) =>
                patch({
                  labor: s.labor.map((i) =>
                    i.id === l.id ? { ...i, minutes } : i,
                  ),
                })
              }
            />
            <Select
              label="Aplicação"
              value={l.scope}
              options={[
                { id: "job", name: "Por lote" },
                { id: "unit", name: "Por unidade" },
              ]}
              onChange={(scope) =>
                patch({
                  labor: s.labor.map((i) =>
                    i.id === l.id
                      ? { ...i, scope: scope as "unit" | "job" }
                      : i,
                  ),
                })
              }
            />
            <button
              className="icon-button danger"
              aria-label="Excluir atividade"
              onClick={() =>
                patch({ labor: s.labor.filter((i) => i.id !== l.id) })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="text-button"
          onClick={() =>
            patch({
              labor: [
                ...s.labor,
                { id: id(), name: "Nova atividade", minutes: 0, scope: "job" },
              ],
            })
          }
        >
          <Plus size={15} />
          Adicionar atividade
        </button>
        <h3>Desenvolvimento diluído</h3>
        <div className="form-grid">
          <Numeric
            label="Tempo de desenvolvimento"
            suffix="h"
            value={s.developmentHours}
            onChange={(developmentHours) => patch({ developmentHours })}
          />
          <Numeric
            label="Valor da hora"
            suffix="R$"
            value={s.developmentRate}
            onChange={(developmentRate) => patch({ developmentRate })}
          />
          <Numeric
            label="Unidades previstas"
            min={1}
            value={s.developmentUnits}
            onChange={(developmentUnits) => patch({ developmentUnits })}
          />
        </div>
      </details>
      <details>
        <summary>Embalagem, componentes e outros</summary>
        <ItemsEditor
          title="Embalagem"
          items={s.packaging}
          onChange={(packaging) => patch({ packaging })}
        />
        <ItemsEditor
          title="Componentes"
          items={s.components}
          onChange={(components) => patch({ components })}
        />
        <ItemsEditor
          title="Outros custos"
          items={s.other}
          onChange={(other) => patch({ other })}
        />
      </details>
      <details>
        <summary>Frete e dados do produto</summary>
        <div className="form-grid">
          <Numeric
            label="Frete real do pedido"
            value={s.shippingReal}
            suffix="R$"
            onChange={(shippingReal) => patch({ shippingReal })}
          />
          <Numeric
            label="Frete cobrado do cliente"
            value={s.shippingCharged}
            suffix="R$"
            onChange={(shippingCharged) => patch({ shippingCharged })}
          />
          <TextField
            label="Categoria"
            value={s.category}
            onChange={(category) => patch({ category })}
          />
          <TextField
            label="Observações"
            value={s.notes}
            onChange={(notes) => patch({ notes })}
          />
        </div>
        <p className="muted small">
          O frete líquido é real menos cobrado; eventual excedente é um crédito.
          Percentuais incidem no valor dos produtos. Ajuste taxas adicionais
          caso o canal também cobre sobre frete.
        </p>
      </details>
      <div className="note">
        Energia, impressora, manutenção, falhas, mão de obra, impostos,
        marketing, margens e taxas são editados em Configurações.{" "}
        {tips.variable}
      </div>
    </div>
  );
}
