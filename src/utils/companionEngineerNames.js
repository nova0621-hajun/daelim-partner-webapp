function normalizedText(value) {
  return String(value || "").trim();
}

export function formatCompanionEngineerNames(companions, mainEngineerName = "") {
  const source = Array.isArray(companions)
    ? companions
    : normalizedText(companions)
      ? normalizedText(companions).split(",")
      : [];
  const normalizedMainEngineerName = normalizedText(mainEngineerName);
  const seenIds = new Set();
  const seenNames = new Set();
  const names = [];

  source.forEach((companion) => {
    const item = companion && typeof companion === "object" ? companion : null;
    const status = normalizedText(item?.status).toLowerCase();
    if (status && status !== "active") return;

    const name = normalizedText(item?.engineerName ?? item?.name ?? companion);
    if (!name || name === normalizedMainEngineerName) return;

    const id = normalizedText(item?.engineerId ?? item?.loginId ?? item?.companionId).toLowerCase();
    if ((id && seenIds.has(id)) || seenNames.has(name)) return;

    if (id) seenIds.add(id);
    seenNames.add(name);
    names.push(name);
  });

  return names.join(", ");
}
