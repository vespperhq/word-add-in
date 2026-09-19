import useSWR from "swr";
import { fetchHealth } from "./health";

export function useHealth() {
  return useSWR("/health", fetchHealth);
}
