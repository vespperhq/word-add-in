import { JSONParser } from "@streamparser/json";
import { EditPairSchema, type EditInputParser, type EditPair } from "./types";

interface EditInputParserOptions {
  onEdit(index: number, edit: EditPair): void;
  onError(): void;
}

export function createEditInputParser({
  onEdit,
  onError,
}: EditInputParserOptions): EditInputParser {
  const parser = new JSONParser({
    paths: ["$.edits.*"],
    keepStack: false,
    emitPartialValues: false,
  });
  parser.onError = onError;
  parser.onValue = ({ key, value, partial }) => {
    if (partial || typeof key !== "number") return;
    const edit = EditPairSchema.safeParse(value);
    if (edit.success) onEdit(key, edit.data);
  };

  return {
    get ended() {
      return parser.isEnded;
    },
    write(delta) {
      if (!parser.isEnded) parser.write(delta);
    },
    finish() {
      if (!parser.isEnded) parser.end();
    },
  };
}
