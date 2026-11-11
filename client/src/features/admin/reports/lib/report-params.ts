export type RawSearchParams = Record<string, string | string[] | undefined>;

export function getStringParam(searchParams: RawSearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
