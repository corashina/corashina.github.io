import {
  DEFAULT_SCENE_PARAMETERS,
  normalizeSceneParameters,
  SCENE_PARAMETER_DEFINITIONS,
  updateSceneParameter,
  type SceneParameterKey,
  type SceneParameters,
} from "../runtime/SceneParameters";

export type ParameterPanelOptions = {
  root: HTMLElement;
  initial: SceneParameters;
  collapsed: boolean;
  onChange(parameters: SceneParameters): void;
};

export class ParameterPanel {
  private current: SceneParameters;
  private readonly cleanups: Array<() => void> = [];
  private readonly body: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private disposed = false;

  constructor(private readonly options: ParameterPanelOptions) {
    this.current = normalizeSceneParameters(options.initial);
    this.body = options.root.querySelector<HTMLElement>("[data-panel-body]")!;
    this.toggle = options.root.querySelector<HTMLButtonElement>("[data-panel-toggle]")!;
    this.buildInputs();
    this.setCollapsed(options.collapsed);
    this.listen(this.toggle, "click", () => {
      this.setCollapsed(this.toggle.getAttribute("aria-expanded") === "true");
    });

    const reset = options.root.querySelector<HTMLButtonElement>("[data-parameter-reset]");
    if (reset !== null) {
      this.listen(reset, "click", () => {
        this.setParameters({ ...DEFAULT_SCENE_PARAMETERS });
        options.onChange({ ...this.current });
      });
    }
  }

  setParameters(parameters: SceneParameters): void {
    this.current = normalizeSceneParameters(parameters, this.current);
    for (const input of this.options.root.querySelectorAll<HTMLInputElement>("[data-parameter]")) {
      const key = input.dataset.parameter as SceneParameterKey;
      input.value = String(this.current[key]);
      const output = this.options.root.querySelector<HTMLOutputElement>(`[data-parameter-value="${key}"]`);
      if (output !== null) output.value = input.value;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  private buildInputs(): void {
    this.body.replaceChildren();
    for (const [key, definition] of Object.entries(SCENE_PARAMETER_DEFINITIONS) as Array<
      [SceneParameterKey, (typeof SCENE_PARAMETER_DEFINITIONS)[SceneParameterKey]]
    >) {
      const label = document.createElement("label");
      label.className = "particle-lab__control";
      label.innerHTML = `<span>${definition.label}</span><output data-parameter-value="${key}"></output>`;

      const input = document.createElement("input");
      input.type = "range";
      input.dataset.parameter = key;
      input.min = String(definition.min);
      input.max = String(definition.max);
      input.step = String(definition.step);

      label.append(input);
      this.body.append(label);
      this.listen(input, "input", () => {
        this.current = updateSceneParameter(this.current, key, input.valueAsNumber);
        this.setParameters(this.current);
        this.options.onChange({ ...this.current });
      });
    }
    this.setParameters(this.current);
  }

  private setCollapsed(collapsed: boolean): void {
    this.options.root.dataset.collapsed = String(collapsed);
    this.toggle.setAttribute("aria-expanded", String(!collapsed));
    this.body.hidden = collapsed;
  }

  private listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }
}
