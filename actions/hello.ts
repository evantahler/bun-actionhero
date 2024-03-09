import { Action, type ActionParams } from "../classes/Action";
import type { Input } from "../classes/Input";
import { ensureNumber } from "../util/formatters";

export class Hello extends Action {
  constructor() {
    super();

    this.name = "hello";
    this.inputs = {
      name: { required: true },
      number: {
        required: true,
        default: 42,
        formatter: ensureNumber,
      },
    };
  }

  async run(params: ActionParams<Hello>) {
    return { message: `Hello, ${params.name} (${params.number})!` };
  }
}

type Match = typeof ensureNumber extends (...p: any) => any ? true : false;
type RTypeA = ReturnType<typeof ensureNumber>;

type FormatterOrString<I extends Input> = I["formatter"] extends (
  ...args: any[]
) => any
  ? ReturnType<I["formatter"]>
  : Date;

type RTypeB = FormatterOrString<Hello["inputs"]["number"]>;

type TypeNumber = Hello["inputs"]["number"]["formatter"] extends (p: any) => any
  ? ReturnType<Hello["inputs"]["number"]["formatter"]>
  : Date;

type TypeName = Hello["inputs"]["name"]["formatter"] extends (
  ...args: any[]
) => any
  ? ReturnType<Hello["inputs"]["name"]["formatter"]>
  : Date;
