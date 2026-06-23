export const splitEmployeeNameLines = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { line1: parts[0] ?? name, line2: null as string | null };
  }
  return { line1: parts[0]!, line2: parts.slice(1).join(' ') };
};
