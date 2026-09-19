import useSWRMutation from "swr/mutation";
import { sendProcess } from "./process";

export function useProcess() {
  return useSWRMutation("/api/word/process", sendProcess);
}
